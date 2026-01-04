import type { mastodon } from "masto";

import { config } from "../config";
import { CacheKey, LoadAction, LogAction } from "../enums";
import { updateBooleanFilterOptions } from "../filters/feed_filters";
import { lockExecution } from "../helpers/mutex_helpers";
import { AgeIn, ageString } from "../helpers/time_helpers";
import { Logger } from "../helpers/logger";
import Post from "../api/objects/post";
import { throwIfAccessTokenRevoked } from "../api/errors";
import { scoreAndFilterFeed } from "./scoring";
import { flushDeferredTimeline } from "./filters";
import { loggers, logger } from "./loggers";
import { launchBackgroundPollers } from "./background";
import { mostRecentHomeTootAt } from "./stats";
import type { CoordinatorState } from "./state";
import type { PostSource } from "../types";

export async function fetchAndMergePosts(
	state: CoordinatorState,
	postFetcher: Promise<Post[]>,
	logger: Logger,
): Promise<Post[]> {
	const startedAt = new Date();
	let newPosts: Post[] = [];

	try {
		newPosts = await postFetcher;
		logger.logTelemetry(
			`Got ${newPosts.length} posts for ${CacheKey.HOME_TIMELINE_POSTS}`,
			startedAt,
		);
	} catch (e) {
		throwIfAccessTokenRevoked(
			logger,
			e,
			`Error fetching posts ${ageString(startedAt)}`,
		);
	}

	await lockedMergeToFeed(state, newPosts, logger);
	return newPosts;
}

export async function mergeExternalStatuses(
	state: CoordinatorState,
	statuses: mastodon.v1.Status[],
	source: PostSource,
): Promise<void> {
	if (!statuses?.length) return;
	const posts = await Post.buildPosts(statuses, source);
	await lockedMergeToFeed(state, posts, new Logger(source));
}

export async function lockedMergeToFeed(
	state: CoordinatorState,
	newPosts: Post[],
	logger: Logger,
): Promise<void> {
	const hereLogger = logger.tempLogger("lockedMergeToFeed");
	const releaseMutex = await lockExecution(state.mergeMutex, hereLogger);

	try {
		await mergePostsToFeed(state, newPosts, logger);
		hereLogger.trace(`Merged ${newPosts.length} newPosts, released mutex`);
	} finally {
		releaseMutex();
	}
}

export async function mergePostsToFeed(
	state: CoordinatorState,
	newPosts: Post[],
	inLogger: Logger,
): Promise<void> {
	const hereLogger = inLogger.tempLogger("mergePostsToFeed");
	const numPostsBefore = state.feed.length;
	const startedAt = new Date();

	state.feed = Post.dedupePosts([...state.feed, ...newPosts], hereLogger);
	state.numUnscannedPosts += newPosts.length;

	if (
		state.feed.length < config.posts.minToSkipFilterUpdates ||
		state.numUnscannedPosts > config.posts.filterUpdateBatchSize
	) {
		await updateBooleanFilterOptions(state.filters, state.feed);
		state.numUnscannedPosts = 0;
	} else {
		logger.trace(
			`Skipping filter update, feed length: ${state.feed.length}, unscanned posts: ${state.numUnscannedPosts}`,
		);
	}

	await scoreAndFilterFeed(state);
	if (state.currentAction !== LoadAction.TIMELINE_BACKFILL) {
		const statusMsgFxn = config.locale.messages[LoadAction.FEED_UPDATE];
		state.loadingStatus = statusMsgFxn(state.feed, mostRecentHomeTootAt(state));
	}
	hereLogger.logTelemetry(
		`Merged ${newPosts.length} new posts into ${numPostsBefore} timeline posts`,
		startedAt,
	);
}

export async function finishFeedUpdate(state: CoordinatorState): Promise<void> {
	const action = LogAction.FINISH_FEED_UPDATE;
	const hereLogger = loggers[action];
	state.loadingStatus = config.locale.messages[action];

	hereLogger.debug(`${state.loadingStatus}...`);

	await Post.completePosts(state.feed, hereLogger);
	state.feed = await Post.removeInvalidPosts(state.feed, hereLogger);

	await updateBooleanFilterOptions(state.filters, state.feed, true);
	await scoreAndFilterFeed(state);
	flushDeferredTimeline(state);

	if (state.loadStartedAt) {
		hereLogger.logTelemetry(
			`finished home TL load w/ ${state.feed.length} posts`,
			state.loadStartedAt,
		);
		state.lastLoadTimeInSeconds = AgeIn.seconds(state.loadStartedAt);
	} else {
		hereLogger.warn(`finished but loadStartedAt is null!`);
	}

	state.loadStartedAt = undefined;
	state.loadingStatus = null;
	launchBackgroundPollers(state);
}
