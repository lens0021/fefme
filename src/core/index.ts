/*
 * Main class that handles scoring and sorting a feed made of Post objects.
 */
import "reflect-metadata"; // Required for class-transformer
import { Buffer } from "buffer"; // Maybe Required for class-transformer though seems to be required in client?
import type { mastodon } from "masto";

import Storage from "./Storage";
import MastoApi, { FULL_HISTORY_PARAMS } from "./api/api";
import type { ObjList } from "./api/counted_list";
import { isAccessTokenRevokedError, throwSanitizedRateLimitError } from "./api/errors";
import Account from "./api/objects/account";
import Post from "./api/objects/post";
import TagList from "./api/tag_list";
import TagsForFetchingPosts from "./api/tags_for_fetching_posts";
import UserData from "./api/user_data";
import { MAX_ENDPOINT_RECORDS_TO_PULL, config } from "./config";
import {
	AlgorithmStorageKey,
	BooleanFilterName,
	CacheKey,
	FEDERATED_TIMELINE_SOURCE,
	LoadAction,
	LogAction,
	MediaCategory,
	NonScoreWeightName,
	ScoreName,
	TagPostsCategory,
	TrendingType,
	TypeFilterName,
	isValueInStringEnum,
} from "./enums";
import BooleanFilter from "./filters/boolean_filter";
import NumericFilter from "./filters/numeric_filter";
import { makeChunks, sortKeysByValue } from "./helpers/collection_helpers";
import {
	isDebugMode,
	isDeepDebug,
	isLoadTest,
	isQuickMode,
} from "./helpers/environment_helpers";
import { Logger } from "./helpers/logger";
import {
	DEFAULT_FONT_SIZE,
	FEDIALGO,
	GIFV,
	VIDEO_TYPES,
	extractDomain,
	optionalSuffix,
} from "./helpers/string_helpers";
import { AgeIn, sleep, timeString } from "./helpers/time_helpers";
import Scorer from "./scorer/scorer";
import ScorerCache from "./scorer/scorer_cache";
import {
	WEIGHT_PRESETS,
	type WeightPresetLabel,
	type WeightPresets,
	isWeightPresetLabel,
} from "./scorer/weight_presets";
import {
	type BooleanFilterOption,
	FILTER_OPTION_DATA_SOURCES,
	type FeedFilterSettings,
	type FilterOptionDataSource,
	type Hashtag,
	type KeysOfValueType,
	type MastodonInstance,
	type MinMaxAvgScore,
	type ScoreStats,
	type StringNumberDict,
	type TagWithUsageCounts,
	type PostSource,
	type TrendingData,
	type TrendingLink,
	type TrendingObj,
	type TrendingWithHistory,
	type WeightInfoDict,
	type WeightName,
	type Weights,
} from "./types";
import { AlgorithmState } from "./coordinator/state";
import { EMPTY_TRENDING_DATA } from "./coordinator/constants";
import { loggers, logger } from "./coordinator/loggers";
import { releaseLoadingMutex, shouldSkip, startAction } from "./coordinator/actions";
import { updateFilters } from "./coordinator/filters";
import { loadCachedData, resetSeenState, saveTimelineToCache } from "./coordinator/cache";
import { recomputeScores, scoreAndFilterFeed } from "./coordinator/scoring";
import {
	fetchAndMergePosts,
	finishFeedUpdate,
	lockedMergeToFeed,
	mergeExternalStatuses,
} from "./coordinator/feed";
import { getHomeTimeline, mergeFederatedTimeline } from "./coordinator/loaders";
import {
	getDataStats,
	getSourceBounds,
	mostRecentHomeTootAgeInSeconds,
	mostRecentHomeTootAt,
	statusDict as buildStatusDict,
	type SourceStats,
} from "./coordinator/stats";

const DEFAULT_SET_TIMELINE_IN_APP = (_feed: Post[]) =>
	console.debug(`Default setTimelineInApp() called`);

interface AlgorithmArgs {
	api: mastodon.rest.Client;
	user: mastodon.v1.Account;
	locale?: string; // Optional locale to use for date formatting
	setTimelineInApp?: (feed: Post[]) => void; // Optional callback to set the feed in the code using this package
}

/**
 * Main class for scoring, sorting, and managing a Mastodon feed made of {@linkcode Post} objects.
 *
 * {@linkcode FeedCoordinator} orchestrates fetching, scoring, filtering, and updating the user's timeline/feed.
 * It manages feature and feed scorers, trending data, filters, user weights, and background polling. Key
 * responsibilities:
 *
 *  1. Fetches and merges posts from multiple sources (home timeline, trending, hashtags, etc.).
 *  2. Applies scoring algorithms and user-defined weights to rank posts.
 *  3. Filters the feed based on user settings and filter options.
 *  4. Handles background polling for new data and saving state to storage.
 *  5. Provides methods for updating filters, weights, and retrieving current state.
 *  6. Exposes utility methods for stats, server info, and tag URLs.
 *
 * @property {string[]} apiErrorMsgs - API error messages
 * @property {FeedFilterSettings} filters - Current filter settings for the feed
 * @property {boolean} isLoading - Whether a feed load is in progress*
 * @property {number} [lastLoadTimeInSeconds] - Duration of the last load in seconds
 * @property {string | null} loadingStatus - String describing load activity
 * @property {Post[]} timeline - The current filtered timeline
 * @property {TrendingData} trendingData - Trending data (tags, servers, posts)
 * @property {UserData} userData - User data for scoring and filtering
 * @property {WeightInfoDict} weightsInfo - Info about all scoring weights
 */
export default class FeedCoordinator {
	private state: AlgorithmState;

	get filters(): FeedFilterSettings {
		return this.state.filters;
	}
	set filters(value: FeedFilterSettings) {
		this.state.filters = value;
	}
	get lastLoadTimeInSeconds(): number | undefined {
		return this.state.lastLoadTimeInSeconds;
	}
	set lastLoadTimeInSeconds(value: number | undefined) {
		this.state.lastLoadTimeInSeconds = value;
	}
	get loadingStatus(): string | null {
		return this.state.loadingStatus;
	}
	set loadingStatus(value: string | null) {
		this.state.loadingStatus = value;
	}
	get trendingData(): TrendingData {
		return this.state.trendingData;
	}
	set trendingData(value: TrendingData) {
		this.state.trendingData = value;
	}
	get weightsInfo(): WeightInfoDict {
		return this.state.weightsInfo;
	}

	get apiErrorMsgs(): string[] {
		return MastoApi.instance.apiErrorMsgs();
	}
	get isLoading(): boolean {
		return this.state.loadingMutex.isLocked();
	}
	get timeline(): Post[] {
		return [...this.state.filteredTimeline];
	}
	get userData(): UserData {
		return MastoApi.instance.userData || new UserData();
	}

	/**
	 * Publicly callable constructor that instantiates the class and loads the feed from storage.
	 * @param {AlgorithmArgs} params - The parameters for algorithm creation.
	 * @param {mastodon.rest.Client} params.api - The Mastodon REST API client instance.
	 * @param {mastodon.v1.Account} params.user - The Mastodon user account for which to build the feed.
	 * @param {string} [params.locale] - Optional locale string for date formatting.
	 * @param {(feed: Post[]) => void} [params.setTimelineInApp] - Optional callback to set the feed in the consuming app.
	 * @returns {Promise<FeedCoordinator>} FeedCoordinator instance.
	 */
	static async create(params: AlgorithmArgs): Promise<FeedCoordinator> {
		config.setLocale(params.locale);
		const user = Account.build(params.user);
		await MastoApi.init(params.api, user);
		await Storage.logAppOpen(user);

		// Construct the algorithm object, set the default weights, load feed and filters
		const algo = new FeedCoordinator(params);
		ScorerCache.addScorers(algo.state.postScorers, algo.state.feedScorers);
		await loadCachedData(algo.state, false);
		return algo;
	}

	/**
	 * Private constructor. Use {@linkcode FeedCoordinator.create} to instantiate.
	 * @param {AlgorithmArgs} params - Constructor params (API client, user, and optional timeline callback/locale).
	 */
	private constructor(params: AlgorithmArgs) {
		const setTimelineInApp =
			params.setTimelineInApp ?? DEFAULT_SET_TIMELINE_IN_APP;
		this.state = new AlgorithmState(setTimelineInApp);
	}

	/**
	 * Trigger the retrieval of the user's timeline from all the sources.
	 * @returns {Promise<void>}
	 */
	async triggerFeedUpdate(): Promise<void> {
		if (shouldSkip(this.state)) return;
		const action = LoadAction.FEED_UPDATE;
		const hereLogger = loggers[action];
		await startAction(this.state, action);

		try {
			const postsForHashtags = async (
				key: TagPostsCategory,
			): Promise<Post[]> => {
				hereLogger.trace(`Fetching posts for hashtags with key: ${key}`);
				const tagList = await TagsForFetchingPosts.create(key);
				return await fetchAndMergePosts(
					this.state,
					tagList.getPosts(),
					tagList.logger,
				);
			};

			const dataLoads: Promise<unknown>[] = [
				// Post fetchers
				getHomeTimeline(
					(posts, logger) => lockedMergeToFeed(this.state, posts, logger),
				).then((posts) => {
					this.state.homeFeed = posts;
				}),
				// Federated timeline posts
				mergeFederatedTimeline(this.state, "newer", 40),
				...Object.values(TagPostsCategory)
					.filter((key) => key !== TagPostsCategory.TRENDING)
					.map(async (key) => await postsForHashtags(key)),
				// Other data fetchers
				MastoApi.instance.getUserData(),
				ScorerCache.prepareScorers(),
			];

			const allResults = await Promise.allSettled(dataLoads);
			hereLogger.deep(`FINISHED promises, allResults:`, allResults);
			await finishFeedUpdate(this.state);
		} finally {
			releaseLoadingMutex(this.state, action);
		}
	}

	/**
	 * Trigger the fetching of additional earlier {@linkcode Post}s from the server.
	 * @returns {Promise<void>}
	 */
	async triggerHomeTimelineBackFill(): Promise<void> {
		await startAction(this.state, LoadAction.TIMELINE_BACKFILL);

		try {
			this.state.homeFeed = await getHomeTimeline(
				(posts, logger) => lockedMergeToFeed(this.state, posts, logger),
				true,
			);
			await finishFeedUpdate(this.state);
		} finally {
			releaseLoadingMutex(this.state, LoadAction.TIMELINE_BACKFILL);
		}
	}

	/**
	 * Trigger the fetching of additional earlier {@linkcode Post}s from the federated timeline.
	 * @returns {Promise<void>}
	 */
	async triggerFederatedTimelineBackFill(): Promise<void> {
		await startAction(this.state, LoadAction.TIMELINE_BACKFILL);

		try {
			await mergeFederatedTimeline(this.state, "older", 40);
			await finishFeedUpdate(this.state);
		} finally {
			releaseLoadingMutex(this.state, LoadAction.TIMELINE_BACKFILL);
		}
	}

	/**
	 * Trigger the fetching of additional earlier {@linkcode Post}s for a tag category.
	 * @param {TagPostsCategory} category - Tag category to backfill.
	 * @returns {Promise<void>}
	 */
	async triggerTagTimelineBackFill(category: TagPostsCategory): Promise<void> {
		await startAction(this.state, LoadAction.TIMELINE_BACKFILL);
		const hereLogger = loggers[LoadAction.TIMELINE_BACKFILL];

		try {
			const { minId } = getSourceBounds(this.state, category);
			if (!minId) {
				hereLogger.info(
					`No cached posts found for ${category}, skipping tag backfill`,
				);
				await finishFeedUpdate(this.state);
				return;
			}

			const tagList = await TagsForFetchingPosts.create(category);
			await fetchAndMergePosts(
				this.state,
				tagList.getOlderPosts(minId),
				tagList.logger,
			);
			await finishFeedUpdate(this.state);
		} finally {
			releaseLoadingMutex(this.state, LoadAction.TIMELINE_BACKFILL);
		}
	}

	/**
	 * Merge external statuses into the feed, score, and filter.
	 * @param {mastodon.v1.Status[]} statuses - Statuses to merge.
	 * @param {PostSource} source - Source label used for completion/scoring metadata.
	 */
	async mergeExternalStatuses(
		statuses: mastodon.v1.Status[],
		source: PostSource,
	): Promise<void> {
		await mergeExternalStatuses(this.state, statuses, source);
	}

	/**
	 * Fetch and merge federated timeline posts into the feed.
	 * @param {number} [limit=40] - Maximum number of posts to fetch.
	 */
	async triggerFederatedTimelineMerge(limit = 40): Promise<void> {
		await mergeFederatedTimeline(this.state, "newer", limit);
	}

	/**
	 * Manually trigger the loading of "moar" user data (recent posts, favourites, notifications, etc).
	 * Usually done by a background task on a set interval.
	 * @returns {Promise<void>}
	 */
	async triggerMoarData(): Promise<void> {
		const shouldReenablePoller = this.state.userDataPoller.stop();
		await startAction(this.state, LoadAction.GET_MOAR_DATA);

		try {
			await this.state.userDataPoller.getMoarData();
			await recomputeScores(this.state);
		} catch (error) {
			throwSanitizedRateLimitError(
				error,
				`triggerMoarData() Error pulling user data:`,
			);
		} finally {
			if (shouldReenablePoller) this.state.userDataPoller.start();
			releaseLoadingMutex(this.state, LoadAction.GET_MOAR_DATA);
		}
	}

	/**
	 * Collect **ALL** the user's history data from the server - past posts, favourites, etc.
	 * Use with caution!
	 * @returns {Promise<void>}
	 */
	async triggerPullAllUserData(): Promise<void> {
		const action = LoadAction.PULL_ALL_USER_DATA;
		const hereLogger = loggers[action];
		startAction(this.state, action);

		try {
			this.state.userDataPoller.stop(); // Stop the dataPoller if it's running

			const _allResults = await Promise.allSettled([
				MastoApi.instance.getFavouritedPosts(FULL_HISTORY_PARAMS),
				// TODO: there's just too many notifications to pull all of them
				MastoApi.instance.getNotifications({
					maxRecords: MAX_ENDPOINT_RECORDS_TO_PULL,
					moar: true,
				}),
				MastoApi.instance.getRecentUserPosts(FULL_HISTORY_PARAMS),
			]);

			await recomputeScores(this.state);
		} catch (error) {
			throwSanitizedRateLimitError(
				error,
				hereLogger.line(`Error pulling user data:`),
			);
		} finally {
			releaseLoadingMutex(this.state, action); // TODO: should we restart data poller?
		}
	}

	/**
	 * Return an object describing the state of the world. Mostly for debugging.
	 * @returns {Promise<Record<string, any>>} State object.
	 */
	async getCurrentState(): Promise<Record<string, unknown>> {
		return {
			Algorithm: buildStatusDict(this.state),
			Api: MastoApi.instance.currentState(),
			Config: config,
			Filters: this.state.filters,
			Homeserver: await this.serverInfo(),
			Storage: await Storage.storedObjsInfo(),
			Trending: this.state.trendingData,
			UserData: await MastoApi.instance.getUserData(),
		};
	}

	/**
	 * Return the user's current weightings for each score category.
	 * @returns {Promise<Weights>} The user's weights.
	 */
	async getUserWeights(): Promise<Weights> {
		return await Storage.getWeights();
	}

	/**
	 * Return the timestamp of the most recent post from followed accounts + hashtags ONLY.
	 * @returns {Date | null} The most recent post date or null.
	 */
	mostRecentHomeTootAt(): Date | null {
		return mostRecentHomeTootAt(this.state);
	}

	/**
	 * Return the number of seconds since the most recent home timeline {@linkcode Post}.
	 * @returns {number | null} Age in seconds or null.
	 */
	mostRecentHomeTootAgeInSeconds(): number | null {
		return mostRecentHomeTootAgeInSeconds(this.state);
	}

	/**
	 * Pull the latest list of muted accounts from the server and use that to filter any newly muted
	 * accounts out of the timeline.
	 * @returns {Promise<void>}
	 */
	async refreshMutedAccounts(): Promise<void> {
		const hereLogger = loggers[LoadAction.REFRESH_MUTED_ACCOUNTS];
		hereLogger.log(
			`called (${Object.keys(this.userData.mutedAccounts).length} current muted accounts)...`,
		);
		// TODO: move refreshMutedAccounts() to UserData class?
		const mutedAccounts = await MastoApi.instance.getMutedAccounts({
			bustCache: true,
		});
		hereLogger.log(
			`Found ${mutedAccounts.length} muted accounts after refresh...`,
		);
		this.userData.mutedAccounts = Account.buildAccountNames(mutedAccounts);
		await Post.completePosts(
			this.state.feed,
			hereLogger,
			LoadAction.REFRESH_MUTED_ACCOUNTS,
		);
		await finishFeedUpdate(this.state);
	}

	/**
	 * Clear everything from browser storage except the user's identity and weightings (unless complete is true).
	 * @param {boolean} [complete=false] - If true, remove user data as well.
	 * @returns {Promise<void>}
	 */
	async reset(complete = false): Promise<void> {
		await startAction(this.state, LoadAction.RESET);

		try {
			this.state.userDataPoller.stop();
			if (this.state.cacheUpdater) clearInterval(this.state.cacheUpdater);
			this.state.cacheUpdater = undefined;
			this.state.hasProvidedAnyPostsToClient = false;
			this.state.loadingStatus =
				config.locale.messages[LogAction.INITIAL_LOADING_STATUS];
			this.state.loadStartedAt = new Date();
			this.state.numTriggers = 0;
			this.state.trendingData = EMPTY_TRENDING_DATA;
			this.state.feed = [];
			this.state.filteredTimeline = [];
			this.state.setTimelineInApp([]);

			// Call other classes' reset methods
			MastoApi.instance.reset();
			ScorerCache.resetScorers();
			await Storage.clearAll();

			if (complete) {
				await Storage.remove(AlgorithmStorageKey.USER); // Remove user data so it gets reloaded
			} else {
				await loadCachedData(this.state);
			}
		} finally {
			releaseLoadingMutex(this.state, LoadAction.RESET);
		}
	}

	/**
	 * Reset only the "already seen" state for all cached posts.
	 * @returns {Promise<void>}
	 */
	async resetSeenState(): Promise<void> {
		await resetSeenState(this.state);
	}

	/**
	 * Save the current timeline to the browser storage. Used to save the state of {@linkcode Post.numTimesShown}.
	 * @returns {Promise<void>}
	 */
	async saveTimelineToCache(): Promise<void> {
		await saveTimelineToCache(this.state);
	}

	/**
	 * True if Fefme user is on a GoToSocial instance instead of plain vanilla Mastodon.
	 * @returns {boolean}
	 */
	async isGoToSocialUser(): Promise<boolean> {
		return await MastoApi.instance.isGoToSocialUser();
	}

	/**
	 * Update {@linkcode this.trendingData} with latest available data.
	 * // TODO: this shouldn't be necessary but there's weirdness on initial load
	 * @returns {Promise<TrendingData>}
	 */
	async refreshTrendingData(): Promise<TrendingData> {
		this.state.trendingData = EMPTY_TRENDING_DATA;
		return this.state.trendingData;
	}

	/**
	 * Returns info about the Fedialgo user's home Mastodon instance.
	 * @returns {Promise<mastodon.v2.Instance>} Instance info.
	 */
	async serverInfo(): Promise<mastodon.v2.Instance> {
		return await MastoApi.instance.instanceInfo();
	}

	/**
	 * Get the URL for a tag on the user's home instance (aka "server").
	 * @param {string | Hashtag} tag - The tag or tag object.
	 * @returns {string} The tag URL.
	 */
	tagUrl(tag: string | Hashtag): string {
		return MastoApi.instance.tagUrl(tag);
	}

	/**
	 * Update the feed filters and return the newly filtered feed.
	 * @param {FeedFilterSettings} newFilters - The new filter settings.
	 * @returns {Post[]} The filtered feed.
	 */
	updateFilters(newFilters: FeedFilterSettings): Post[] {
		return updateFilters(this.state, newFilters);
	}

	/**
	 * Update user weightings and rescore / resort the feed.
	 * @param {Weights} userWeights - The new user weights.
	 * @returns {Promise<Post[]>} The filtered and rescored feed.
	 */
	async updateUserWeights(userWeights: Weights): Promise<Post[]> {
		logger.info("updateUserWeights() called with weights:", userWeights);
		Scorer.validateWeights(userWeights);
		await Storage.setWeightings(userWeights);
		return scoreAndFilterFeed(this.state);
	}

	/**
	 * Update user weightings to one of the preset values and rescore / resort the feed.
	 * @param {WeightPresetLabel | string} presetName - The preset name.
	 * @returns {Promise<Post[]>} The filtered and rescored feed.
	 */
	async updateUserWeightsToPreset(
		presetName: WeightPresetLabel | string,
	): Promise<Post[]> {
		logger.info(
			"updateUserWeightsToPreset() called with presetName:",
			presetName,
		);

		if (!isWeightPresetLabel(presetName)) {
			logger.logAndThrowError(`Invalid weight preset: "${presetName}"`);
		}

		return await this.updateUserWeights(
			WEIGHT_PRESETS[presetName as WeightPresetLabel],
		);
	}

	getDataStats(): {
		feedTotal: number;
		homeFeedTotal: number;
		unseenTotal: number;
		oldestCachedTime: Date | null;
		mostRecentCachedTime: Date | null;
		sourceStats: Record<PostSource, SourceStats>;
	} {
		return getDataStats(this.state);
	}

	///////////////////////////////
	//      Static Methods       //
	///////////////////////////////

	/** True if {@linkcode FEDIALGO_DEBUG} environment var was set at run time. */
	static get isDebugMode(): boolean {
		return isDebugMode;
	}
	/** True if {@linkcode FEDIALGO_DEEP_DEBUG} environment var was set at run time. */
	static get isDeepDebug(): boolean {
		return isDeepDebug;
	}
	/** True if {@linkcode LOAD_TEST} environment var was set at run time. */
	static get isLoadTest(): boolean {
		return isLoadTest;
	}
	/** True if {@linkcode QUICK_MODE} environment var was set at run time. */
	static get isQuickMode(): boolean {
		return isQuickMode;
	}

	/**
	 * Dictionary of preset weight configurations that can be selected from to set weights.
	 * @returns {WeightPresets}
	 */
	static get weightPresets(): WeightPresets {
		return WEIGHT_PRESETS;
	}
}

// Some strings we want to export from the config
const GET_FEED_BUSY_MSG = config.locale.messages[LoadAction.IS_BUSY];
const READY_TO_LOAD_MSG =
	config.locale.messages[LogAction.INITIAL_LOADING_STATUS];

// Export types and constants needed by apps using this package
export {
	// Constants
	DEFAULT_FONT_SIZE,
	FILTER_OPTION_DATA_SOURCES,
	FEDIALGO,
	FEDERATED_TIMELINE_SOURCE,
	GET_FEED_BUSY_MSG,
	GIFV,
	READY_TO_LOAD_MSG,
	VIDEO_TYPES,
	// Classes
	Account,
	BooleanFilter,
	Logger,
	NumericFilter,
	TagList,
	Post,
	// Enums
	BooleanFilterName,
	MediaCategory,
	NonScoreWeightName,
	ScoreName,
	TagPostsCategory,
	TrendingType,
	TypeFilterName,
	type WeightName,
	// Helpers
	AgeIn,
	extractDomain,
	isAccessTokenRevokedError,
	isValueInStringEnum,
	makeChunks,
	optionalSuffix,
	sleep,
	sortKeysByValue,
	timeString,
	// Types
	type BooleanFilterOption,
	type FeedFilterSettings,
	type FilterOptionDataSource,
	type KeysOfValueType,
	type MastodonInstance,
	type MinMaxAvgScore,
	type ObjList,
	type ScoreStats,
	type StringNumberDict,
	type TagWithUsageCounts,
	type TrendingData,
	type TrendingLink,
	type TrendingObj,
	type TrendingWithHistory,
	type Weights,
};
