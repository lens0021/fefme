import Storage from "../Storage";
import MastoApi from "../api/api";
import { BooleanFilterOptionList } from "../api/counted_list";
import type Account from "../api/objects/account";
import { buildTag, isValidForSubstringSearch } from "../api/objects/tag";
import type Post from "../api/objects/post";
import type TagList from "../api/tag_list";
import TagsForFetchingPosts from "../api/tags_for_fetching_posts";
import { config } from "../config";
import {
	BooleanFilterName,
	ScoreName,
	UNKNOWN_SOURCE,
	type TagPostsCategory,
} from "../enums";
import {
	incrementCount,
	sortedDictString,
	sumValues,
} from "../helpers/collection_helpers";
import { languageName } from "../helpers/language_helper";
import { Logger } from "../helpers/logger";
import { suppressedHashtags } from "../helpers/suppressed_hashtags";
import { WaitTime, ageString } from "../helpers/time_helpers";
import type {
	BooleanFilterOption,
	BooleanFilters,
	FeedFilterSettings,
	NumericFilters,
	StringNumberDict,
	TagWithUsageCounts,
	PostNumberProp,
} from "../types";
/**
 * @fileoverview Helpers for building and serializing a complete set of {@linkcode FeedFilterSettings}.
 */
import BooleanFilter, {
	TYPE_FILTERS,
	type BooleanFilterArgs,
} from "./boolean_filter";
import NumericFilter, {
	FILTERABLE_SCORES,
	type NumericFilterArgs,
} from "./numeric_filter";

type FilterOptions = Record<BooleanFilterName, BooleanFilterOptionList>;

const DEFAULT_FILTERS: FeedFilterSettings = {
	booleanFilterArgs: [],
	booleanFilters: {} as BooleanFilters,
	numericFilterArgs: [],
	numericFilters: {} as NumericFilters,
};

const logger = new Logger("feed_filters.ts");

/**
 * Build a new {@linkcode FeedFilterSettings} object with {@linkcode DEFAULT_FILTERS} as the base.
 * Start with numeric & type filters. Other {@linkcode BooleanFilter}s depend on what's in the posts.
 * @returns {FeedFilterSettings}
 */
export function buildNewFilterSettings(): FeedFilterSettings {
	const filters: FeedFilterSettings = structuredClone(DEFAULT_FILTERS);
	populateMissingFilters(filters);
	return filters;
}

/**
 * Build a {@linkcode FeedFilterSettings} object from the serialized version.
 * NOTE: Mutates object.
 * @param {FeedFilterSettings} filterArgs - The serialized filter settings.
 * @returns {FeedFilterSettings} The reconstructed filter settings with instantiated filter objects.
 */
export function buildFiltersFromArgs(
	filterArgs: FeedFilterSettings,
): FeedFilterSettings {
	filterArgs.booleanFilters = filterArgs.booleanFilterArgs.reduce(
		(filters, args) => {
			filters[args.propertyName as BooleanFilterName] = new BooleanFilter(args);
			return filters;
		},
		{} as BooleanFilters,
	);

	filterArgs.numericFilters = filterArgs.numericFilterArgs.reduce(
		(filters, args) => {
			filters[args.propertyName as PostNumberProp] = new NumericFilter(args);
			return filters;
		},
		{} as NumericFilters,
	);

	populateMissingFilters(filterArgs);
	logger.trace(`buildFiltersFromArgs() result:`, filterArgs);
	return filterArgs;
}

/**
 * Remove filter args with invalid {@linkcode propertyName}s. Used to upgrade
 * existing users who may have obsolete args in browser Storage.
 * @param {FeedFilterSettings} filters - The filter settings to check and repair.
 * @returns {boolean} True if any repairs were made, false otherwise.
 */
export function repairFilterSettings(filters: FeedFilterSettings): boolean {
	let wasChanged = false;

	const validBooleanFilterArgs = BooleanFilter.removeInvalidFilterArgs(
		filters.booleanFilterArgs,
		logger,
	);
	const validNumericFilterArgs = NumericFilter.removeInvalidFilterArgs(
		filters.numericFilterArgs,
		logger,
	);
	wasChanged ||=
		validBooleanFilterArgs.length !== filters.booleanFilterArgs.length;
	wasChanged ||=
		validNumericFilterArgs.length !== filters.numericFilterArgs.length;

	if (wasChanged) {
		logger.warn(`Repaired invalid filter args:`, filters);
	}

	filters.booleanFilterArgs = validBooleanFilterArgs as BooleanFilterArgs[];
	filters.numericFilterArgs = validNumericFilterArgs as NumericFilterArgs[];
	return wasChanged;
}

/**
 * Compute language, app, etc. tallies for posts in feed and use the result to initialize filter options.
 * Note that this shouldn't need to be called when initializing from storage because the filter options
 * will all have been stored and reloaded along with the feed that birthed those filter options.
 * @param {FeedFilterSettings} filters - The filter settings to update with new options.
 * @param {Post[]} posts - The posts to analyze for filter options.
 * @param {boolean} [scanForTags=false] - Whether to scan followed tags for counts.
 * @returns {Promise<void>} A promise that resolves when the filter options have been updated.
 */
export async function updateBooleanFilterOptions(
	filters: FeedFilterSettings,
	posts: Post[],
	scanForTags = false,
): Promise<void> {
	populateMissingFilters(filters); // Ensure all filters are instantiated
	const timer = new WaitTime();
	const tagLists = await TagsForFetchingPosts.rawTagLists();
	const userData = await MastoApi.instance.getUserData();

	const optionLists: FilterOptions = Object.values(BooleanFilterName).reduce(
		(lists, filterName) => {
			lists[filterName] = new BooleanFilterOptionList([], filterName);
			return lists;
		},
		{} as FilterOptions,
	);

	const decorateAccount = (
		accountOption: BooleanFilterOption,
		account: Account,
	): void => {
		accountOption.displayName = account.displayName;
		const favouriteAccountProps = userData.favouriteAccounts.getObj(
			accountOption.name,
		);

		if (favouriteAccountProps) {
			accountOption.isFollowed = favouriteAccountProps.isFollowed;
			accountOption[ScoreName.FAVOURITED_ACCOUNTS] =
				favouriteAccountProps.numPosts || 0;
		}
	};

	const decorateHashtag = (tagOption: BooleanFilterOption): void => {
		Object.entries(tagLists).forEach(([key, tagList]) => {
			const propertyObj = tagList.getObj(tagOption.name);

			if (propertyObj) {
				tagOption[key as TagPostsCategory] = propertyObj.numPosts || 0;
			}
		});

		if (userData.followedTags.getObj(tagOption.name)) {
			tagOption.isFollowed = true;
		}
	};

	const decorateLanguage = (languageOption: BooleanFilterOption): void => {
		languageOption.displayName = languageName(languageOption.name);
		const languageUsage = userData.languagesPostedIn.getObj(
			languageOption.name,
		);

		if (languageUsage) {
			languageOption[BooleanFilterName.LANGUAGE] = languageUsage.numPosts || 0;
		}
	};

	posts.forEach((post) => {
		const decorateThisAccount = (option: BooleanFilterOption) =>
			decorateAccount(option, post.author);
		optionLists[BooleanFilterName.USER].incrementCount(
			post.author.webfingerURI,
			decorateThisAccount,
		);
		optionLists[BooleanFilterName.APP].incrementCount(
			post.realToot.application.name,
		);
		optionLists[BooleanFilterName.SERVER].incrementCount(post.homeserver);
		optionLists[BooleanFilterName.LANGUAGE].incrementCount(
			post.realToot.language!,
			decorateLanguage,
		);
		// Create a Set of sources, using UNKNOWN_SOURCE if the post has no sources
		// Note: We don't mutate post.sources here - that's handled elsewhere in the pipeline
		const sourceSet = new Set(
			post.sources && post.sources.length > 0 ? post.sources : [UNKNOWN_SOURCE],
		);
		sourceSet.forEach((source) => {
			optionLists[BooleanFilterName.SOURCE].incrementCount(source);
		});

		// Aggregate counts for each kind ("type") of post
		Object.entries(TYPE_FILTERS).forEach(([name, typeFilter]) => {
			if (typeFilter(post)) {
				optionLists[BooleanFilterName.TYPE].incrementCount(name);
			}
		});

		// Count tags. Note: This only counts explicit hashtags (#tag), not substring matches
		// in post text. The scanForTags parameter enables a slower but more comprehensive scan.
		post.realToot.tags.forEach((tag) => {
			// Suppress non-Latin script tags unless they match the user's language
			if (tag.language && tag.language != config.locale.language) {
				suppressedHashtags.increment(tag, post.realToot);
			} else {
				optionLists[BooleanFilterName.HASHTAG].incrementCount(
					tag.name,
					decorateHashtag,
				);
			}
		});
	});

	// Double check for hashtags that are in the feed but without a formal "#" character.
	if (scanForTags) {
		const hashtagOptions = optionLists[BooleanFilterName.HASHTAG];
		optionLists[BooleanFilterName.HASHTAG] = updateHashtagCounts(
			hashtagOptions,
			userData.followedTags,
			posts,
		);
	}

	// Always ensure "seen" option is available, even if there are no seen posts yet
	if (!optionLists[BooleanFilterName.TYPE].getObj("seen")) {
		optionLists[BooleanFilterName.TYPE].addObjs([
			{ name: "seen", numPosts: 0 },
		]);
	}

	// Build the options for all the boolean filters based on the counts
	Object.keys(optionLists).forEach((key) => {
		const filterName = key as BooleanFilterName;
		filters.booleanFilters[filterName].options = optionLists[filterName];
	});

	suppressedHashtags.log(logger);
	await Storage.setFilters(filters);
	logger.debugWithTraceObjs(
		`Updated all filters ${timer.ageString()}`,
		filters,
	);
}

// Fill in any missing numeric filters (if there's no args saved nothing will be reconstructed
// when Storage tries to restore the filter objects).
function populateMissingFilters(filters: FeedFilterSettings): void {
	const thisLogger = logger.tempLogger("populateMissingFilters");

	FILTERABLE_SCORES.forEach((scoreName) => {
		if (!filters.numericFilters[scoreName]) {
			thisLogger.trace(`No NumericFilter for ${scoreName}, creating new one`);
			filters.numericFilters[scoreName] ??= new NumericFilter({
				propertyName: scoreName,
			});
		}
	});

	Object.values(BooleanFilterName).forEach((booleanFilterName) => {
		if (!filters.booleanFilters[booleanFilterName]) {
			thisLogger.trace(
				`No BooleanFilter for ${booleanFilterName}, creating new one`,
			);
			filters.booleanFilters[booleanFilterName] = new BooleanFilter({
				propertyName: booleanFilterName,
			});
		}
	});
}

/**
 * Create a combined options list with followed tags added.
 * @private
 */
function addFollowedTagsToOptions(
	options: BooleanFilterOptionList,
	followedTags: TagList,
): BooleanFilterOptionList {
	const allOptions = new BooleanFilterOptionList(options.objs, options.source);
	allOptions.addObjs(
		followedTags.objs.map((tag) => {
			return { name: tag.name, isFollowed: true };
		}),
	);
	return allOptions;
}

/**
 * Scan posts for substring matches of a tag and update counts.
 * @private
 */
function scanPostsForTagMatches(
	posts: Post[],
	tag: TagWithUsageCounts,
	option: BooleanFilterOption,
	allOptions: BooleanFilterOptionList,
	tagsFound: StringNumberDict,
): number {
	let followedTagMatches = 0;

	posts.forEach((post) => {
		// Check if post contains tag as substring but not as explicit hashtag
		if (
			post.realToot.containsTag(tag, true) &&
			!post.realToot.containsTag(tag)
		) {
			allOptions.incrementCount(tag.name);
			incrementCount(tagsFound, tag.name);

			if (option.isFollowed) {
				followedTagMatches++;
			}
		}
	});

	return followedTagMatches;
}

/**
 * Scan a list of {@linkcode Post}s for a set of hashtags and update their counts in the provided
 * hashtagOptions. Used to search the home timeline for Posts that contain discussion of a given
 * tag even if it's not actually tagged with it (e.g. post mentions "AI" in the text but doesn't
 * contain "#AI").
 * @private
 * @param {BooleanFilterOptionList} options - Options list to update with additional hashtag matches.
 * @param {TagList} followedTags - List of followed tags to check against.
 * @param {Post[]} posts - List of posts to scan.
 */
function updateHashtagCounts(
	options: BooleanFilterOptionList,
	followedTags: TagList,
	posts: Post[],
): BooleanFilterOptionList {
	const startedAt = Date.now();
	const tagsFound: StringNumberDict = {};
	const allOptions = addFollowedTagsToOptions(options, followedTags);
	let followedTagsFound = 0;

	allOptions.topObjs().forEach((option) => {
		const tag: TagWithUsageCounts = {
			...buildTag(option.name),
			numAccounts: option.numAccounts,
			numPosts: option.numPosts,
		};

		// Skip invalid tags and those that don't already appear in the hashtagOptions
		if (!(isValidForSubstringSearch(tag) && options.getObj(tag.name))) {
			return;
		}

		followedTagsFound += scanPostsForTagMatches(
			posts,
			tag,
			option,
			allOptions,
			tagsFound,
		);
	});

	logger.info(
		`updateHashtagCounts() found ${sumValues(tagsFound)} more matches for ${Object.keys(tagsFound).length} of` +
			` ${allOptions.length} tags in ${posts.length} Posts ${ageString(startedAt)} (${followedTagsFound} followed tags): ` +
			sortedDictString(tagsFound),
	);

	return allOptions;
}

/**
 * Check if the "Seen" type filter is excluded in the current filter settings.
 * @param filters - The feed filter settings to check
 * @returns true if "Seen" posts are being filtered out
 */
export function isSeenFilterExcluded(filters: FeedFilterSettings): boolean {
	const typeFilter = filters.booleanFilters?.[BooleanFilterName.TYPE];
	if (!typeFilter?.excludedOptions) return false;
	return typeFilter.excludedOptions.includes("seen");
}
