/**
 * @fileoverview Methods for dealing with data about the user currently using
 * fefme - background data for the scorers and so on.
 */
import type { mastodon } from "masto";

import Storage from "../Storage";
import { config } from "../config";
import { BooleanFilterName, ScoreName, TagPostsCategory } from "../enums";
import { keyById, resolvePromiseDict } from "../helpers/collection_helpers";
import { languageName } from "../helpers/language_helper";
import { Logger } from "../helpers/logger";
import { WaitTime } from "../helpers/time_helpers";
import type {
	AccountNames,
	BooleanFilterOption,
	StringNumberDict,
	TagWithUsageCounts,
} from "../types";
import MastoApi from "./api";
import CountedList, {
	BooleanFilterOptionList,
	type ObjList,
} from "./counted_list";
import Account from "./objects/account";
import { buildMutedRegex, extractMutedKeywords } from "./objects/filter";
import Post, { mostRecentTootedAt } from "./objects/post";
import TagList from "./tag_list";

const logger = new Logger("UserData");

// Raw API data required to build UserData
interface UserApiData {
	blockedDomains: string[];
	favouritedPosts: Post[];
	followedAccounts: Account[];
	followedTags: TagWithUsageCounts[];
	mutedAccounts: Account[];
	recentPosts: Post[];
	serverSideFilters: mastodon.v2.Filter[];
}

/**
 * Represents background and scoring-related data about the current Fedialgo user.
 * Used as a central source of user context for scoring, filtering, and personalization.
 *
 * This class aggregates and manages user-related data such as favourited accounts, followed tags,
 * muted accounts, languages posted in, and server-side filters. It provides methods to build user data
 * from the Mastodon API or from raw API data, and supports updating, counting, and filtering operations
 * for use in scoring and filtering algorithms.
 *
 * @property {Set<string>} blockedDomains - Set of domains the user has blocked.
 * @property {BooleanFilterOptionList} favouriteAccounts - Accounts the user has favourited, boosted, or replied to.
 * @property {TagList} favouritedTags - List of tags the user has favourited.
 * @property {StringNumberDict} followedAccounts - Dictionary of accounts the user follows, keyed by account name.
 * @property {TagList} followedTags - List of tags the user follows.
 * @property {boolean} isBooster - True if the user is primarily a booster (boostPct above configured threshold).
 * @property {ObjList} languagesPostedIn - List of languages the user has posted in, with usage counts.
 * @property {Record<string, Account>} mutedAccounts - Dictionary of accounts the user has muted or blocked, keyed by Account["webfingerURI"].
 * @property {RegExp} mutedKeywordsRegex - Cached regex for muted keywords, built from server-side filters.
 * @property {TagList} participatedTags - List of tags the user has participated in.
 * @property {string} preferredLanguage - The user's preferred language (ISO code).
 * @property {mastodon.v2.Filter[]} serverSideFilters - Array of server-side {@linkcode https://docs.joinmastodon.org/entities/Filter/ Filters} set by the user.
 */
export default class UserData {
	blockedDomains: Set<string> = new Set();
	favouriteAccounts = new BooleanFilterOptionList(
		[],
		ScoreName.FAVOURITED_ACCOUNTS,
	);
	favouritedTags = new TagList([], TagPostsCategory.FAVOURITED);
	followedAccounts: StringNumberDict = {};
	followedTags = new TagList([], ScoreName.FOLLOWED_TAGS);
	isBooster = false;
	languagesPostedIn: ObjList = new CountedList([], BooleanFilterName.LANGUAGE);
	mutedAccounts: AccountNames = {};
	mutedKeywordsRegex!: RegExp; // Cached regex for muted keywords, built from server-side filters
	participatedTags = new TagList([], TagPostsCategory.PARTICIPATED);
	preferredLanguage = config.locale.defaultLanguage;
	serverSideFilters: mastodon.v2.Filter[] = [];

	private lastUpdatedAt?: Date | null;

	/**
	 * Alternate constructor for the {@linkcode UserData} object to build itself from the API (or cache).
	 * @static
	 * @returns {Promise<UserData>} {@linkcode UserData} instance populated with the fefme user's data.
	 */
	static async build(): Promise<UserData> {
		const waitTime = new WaitTime();

		const responses = await resolvePromiseDict(
			{
				blockedDomains: MastoApi.instance.getBlockedDomains(),
				favouritedPosts: MastoApi.instance.getFavouritedPosts(),
				followedAccounts: MastoApi.instance.getFollowedAccounts(),
				followedTags: MastoApi.instance.getFollowedTags(),
				mutedAccounts: MastoApi.instance.getMutedAccounts(),
				recentPosts: MastoApi.instance.getRecentUserPosts(),
				serverSideFilters: MastoApi.instance.getServerSideFilters(),
			},
			logger,
			[],
		);

		const userData = this.buildFromData(responses as UserApiData);
		logger.debug(
			`Built ${waitTime.ageString()}, setting lastUpdatedAt to "${waitTime.startedAt.toISOString()}"`,
		);
		userData.lastUpdatedAt = waitTime.startedAt;
		return userData;
	}

	/**
	 * Alternate constructor to build {@linkcode UserData} from API data.
	 * @static
	 * @param {UserApiData} data - The raw API data to build the {@linkcode UserData} from.
	 * @param {string[]} data.blockedDomains - Domains the user has blocked.
	 * @param {Post[]} data.favouritedPosts - Posts the user has favourited.
	 * @param {Account[]} data.followedAccounts - Accounts the user follows.
	 * @param {TagWithUsageCounts[]} data.followedTags - Tags the user follows, with usage counts.
	 * @param {Account[]} data.mutedAccounts - Accounts the user has muted.
	 * @param {Post[]} data.recentPosts - Recent posts by the user.*
	 * @param {mastodon.v2.Filter[]} data.serverSideFilters - Server-side filters set by the user.
	 * @returns {UserData} A new UserData instance populated with the provided data.
	 */
	static buildFromData(data: UserApiData): UserData {
		const userData = new UserData();

		if (data.recentPosts.length) {
			const boostsPct =
				Post.onlyBoosts(data.recentPosts).length / data.recentPosts.length;
			userData.isBooster =
				boostsPct > config.participatedTags.minPctToCountBoosts;
		}

		userData.blockedDomains = new Set(data.blockedDomains);
		userData.favouritedTags = TagList.fromUsageCounts(
			data.favouritedPosts,
			TagPostsCategory.FAVOURITED,
		);
		userData.followedAccounts = Account.countAccounts(data.followedAccounts);
		userData.followedTags = new TagList(
			data.followedTags,
			ScoreName.FOLLOWED_TAGS,
		);
		userData.mutedAccounts = Account.buildAccountNames(data.mutedAccounts);
		userData.mutedKeywordsRegex = buildMutedRegex(data.serverSideFilters);
		userData.participatedTags = TagList.fromParticipations(
			data.recentPosts,
			userData.isBooster,
		);
		userData.serverSideFilters = data.serverSideFilters;
		userData.languagesPostedIn.populateByCountingProps(
			data.recentPosts,
			postLanguageOption,
		);
		userData.populateFavouriteAccounts(data);

		// Use the newest recent or favourited post as proxy for freshness (other stuff rarely changes)
		userData.lastUpdatedAt = mostRecentTootedAt([
			...data.recentPosts,
			...data.favouritedPosts,
		]);
		userData.preferredLanguage =
			userData.languagesPostedIn.topObjs()[0]?.name ||
			config.locale.defaultLanguage;
		logger.trace("Built from data:", userData);
		return userData;
	}

	/**
	 * If there's newer data in the cache the data is not fresh.
	 * @returns {Promise<boolean>} True if UserData object was created after the {@linkcode Storage.lastUpdatedAt}.
	 */
	async hasNewestApiData(): Promise<boolean> {
		return !!(
			Storage.lastUpdatedAt &&
			this.lastUpdatedAt &&
			this.lastUpdatedAt >= Storage.lastUpdatedAt
		);
	}

	/**
	 * Add up the favourites, boosts, and replies for each account
	 * @private
	 * @param {UserApiData} data - The raw API data containing recent posts and favourited posts.
	 */
	private populateFavouriteAccounts(data: UserApiData): void {
		const boostsAndFaves = [
			...Post.onlyBoosts(data.recentPosts),
			...data.favouritedPosts,
		];
		const boostAndFaveAccounts = boostsAndFaves.map((t) => t.author);
		const followedAccountIdMap = keyById(data.followedAccounts);

		// TODO: Replies are imperfect, we only have inReplyToAccountId to work with. IDing ~1/3rd of the replies.
		// Currently that's only around 1/3rd of the replies.
		const replies = Post.onlyReplies(data.recentPosts);
		const repliedToAccounts = replies
			.map((post) => followedAccountIdMap[post.inReplyToAccountId!])
			.filter(Boolean);
		logger.trace(
			`Found ${boostsAndFaves.length} boostsAndFaves, ${repliedToAccounts.length} replied posts' accounts (of ${replies.length} replies)`,
		);
		const favouredAccounts = [...repliedToAccounts, ...boostAndFaveAccounts];
		this.favouriteAccounts.populateByCountingProps(
			favouredAccounts,
			(account) => account.asBooleanFilterOption,
		);

		// Find the followed accounts that don't exist yet as options. Has side effect of mutating isFollowed property
		const additionalFollowedAccounts = data.followedAccounts.filter(
			(account) => {
				const option = account.asBooleanFilterOption;
				const existingOption = this.favouriteAccounts.getObj(option.name);

				if (!option.isFollowed) {
					logger.warn(
						"populateFavouriteAccounts() followed account is not marked as followed:",
						account,
					);
					option.isFollowed = true;
				}

				if (existingOption) {
					existingOption.isFollowed = option.isFollowed;
					return false;
				} else {
					return true;
				}
			},
		);

		this.favouriteAccounts.addObjs(
			additionalFollowedAccounts.map(
				(account) => account.asBooleanFilterOption,
			),
		);
	}

	/////////////////////////////
	//      Static Methods     //
	/////////////////////////////

	/**
	 * Get an array of keywords the user has muted on the server side.
	 * @returns {Promise<string[]>} An array of muted keywords.
	 */
	static async getMutedKeywords(): Promise<string[]> {
		return extractMutedKeywords(await MastoApi.instance.getServerSideFilters());
	}

	/**
	 * Build a regex that matches any of the user's muted keywords.
	 * @returns {Promise<RegExp>} A RegExp that matches any of the user's muted keywords.
	 */
	static async getMutedKeywordsRegex(): Promise<RegExp> {
		return buildMutedRegex(await MastoApi.instance.getServerSideFilters());
	}
}

// Extract information for language BoooleanFilterOption.
function postLanguageOption(post: Post): BooleanFilterOption {
	if (!post.language) {
		logger.warn(
			"Post has no language set, using default language instead",
			post,
		);
		post.language = config.locale.defaultLanguage;
	}

	return {
		displayName: languageName(post.language!),
		name: post.language!,
	};
}
