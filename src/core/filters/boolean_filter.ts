/**
 * @fileoverview Feed filtering information related to a single criterion on which posts
 * can be filtered inclusively or exclusively based on an array of strings
 * (e.g. language, hashtag, type of post).
 */
import { isNil } from "lodash";

import { BooleanFilterOptionList } from "../api/counted_list";
import { buildTag } from "../api/objects/tag";
import type Post from "../api/objects/post";
import { config } from "../config";
import {
	BooleanFilterName,
	TypeFilterName,
	UNKNOWN_SOURCE,
	isValueInStringEnum,
} from "../enums";
import { compareStr, isEmptyStr } from "../helpers/string_helpers";
import type { BooleanFilterOption } from "../types";
import PostFilter, { type FilterArgs } from "./post_filter";

type TootMatcher = (post: Post, selectedOptions: string[]) => boolean;
type TypeFilter = (post: Post) => boolean;
export type BooleanFilterOptionState = "include" | "exclude" | "neutral";

const SOURCE_FILTER_DESCRIPTION = "Choose what kind of posts are in your feed";

// Type-based filters for posts. Defining a new filter just requires adding a new TypeFilterName
// and a function that matches the post.
export const TYPE_FILTERS: Record<TypeFilterName, TypeFilter> = {
	[TypeFilterName.AUDIO]: (post) => !!post.realToot.audioAttachments?.length,
	[TypeFilterName.BOT]: (post) => post.accounts.some((account) => account.bot),
	[TypeFilterName.DIRECT_MESSAGE]: (post) => post.isDM,
	[TypeFilterName.FOLLOWED_ACCOUNTS]: (post) =>
		post.accounts.some((account) => account.isFollowed),
	[TypeFilterName.FOLLOWED_HASHTAGS]: (post) =>
		!!post.realToot.followedTags?.length,
	[TypeFilterName.IMAGES]: (post) => !!post.realToot.imageAttachments?.length,
	[TypeFilterName.LINKS]: (post) => !!post.realToot.card,
	[TypeFilterName.MENTIONS]: (post) => post.containsUserMention(),
	[TypeFilterName.POLLS]: (post) => !!post.realToot.poll,
	[TypeFilterName.PRIVATE]: (post) => post.realToot.isPrivate,
	[TypeFilterName.REPLIES]: (post) => !!post.realToot.inReplyToId,
	[TypeFilterName.BOOSTS]: (post) => !!post.reblog,
	[TypeFilterName.SEEN]: (post) =>
		(post.numTimesShown ?? 0) > 0 ||
		(post.realToot.numTimesShown ?? 0) > 0 ||
		!!post.favourited ||
		!!post.realToot?.favourited ||
		!!post.reblogged ||
		!!post.realToot?.reblogged,
	[TypeFilterName.SENSITIVE]: (post) => post.realToot.sensitive,
	[TypeFilterName.SPOILERED]: (post) => !isEmptyStr(post.realToot.spoilerText),
	[TypeFilterName.TRENDING_TAGS]: (post) =>
		!!post.realToot.trendingTags?.length,
	[TypeFilterName.TRENDING_POSTS]: (post) => !!post.realToot.trendingRank,
	[TypeFilterName.VIDEOS]: (post) => !!post.realToot.videoAttachments?.length,
} as const;

// Matchers for each BooleanFilterName.
const POST_MATCHERS: Record<BooleanFilterName, TootMatcher> = {
	[BooleanFilterName.APP]: (post: Post, selectedOptions: string[]) => {
		const appName = post.realToot.application?.name;
		return appName ? selectedOptions.includes(appName) : false;
	},
	[BooleanFilterName.SERVER]: (post: Post, selectedOptions: string[]) => {
		return selectedOptions.includes(post.homeserver);
	},
	[BooleanFilterName.HASHTAG]: (post: Post, selectedOptions: string[]) => {
		return !!selectedOptions.find((v) =>
			post.realToot.containsTag(buildTag(v), true),
		);
	},
	[BooleanFilterName.LANGUAGE]: (post: Post, selectedOptions: string[]) => {
		return selectedOptions.includes(
			post.realToot.language || config.locale.defaultLanguage,
		);
	},
	[BooleanFilterName.SOURCE]: (post: Post, selectedOptions: string[]) => {
		const sources = post.sources ?? [];
		// If post has no sources and "Unknown" is selected, match it
		if (sources.length === 0 && selectedOptions.includes(UNKNOWN_SOURCE)) {
			return true;
		}
		return selectedOptions.some((source) => sources.includes(source));
	},
	[BooleanFilterName.TYPE]: (post: Post, selectedOptions: string[]) => {
		return selectedOptions.some((v) => TYPE_FILTERS[v as TypeFilterName](post));
	},
	[BooleanFilterName.USER]: (post: Post, selectedOptions: string[]) => {
		return selectedOptions.includes(post.realToot.account.webfingerURI);
	},
} as const;

export interface BooleanFilterArgs extends Omit<FilterArgs, "description"> {
	selectedOptions?: string[];
	excludedOptions?: string[];
	propertyName: BooleanFilterName;
}

/**
 * Handles filtering {@linkcode Post}s by boolean criteria (e.g. language, hashtag, type).
 * @augments PostFilter
 * @property {string} [description] - Optional description of the filter for display or documentation purposes.
 * @property {boolean} [invertSelection] - If true, the filter logic is inverted (e.g. exclude instead of include).
 * @property {BooleanFilterOptionList} options - The BooleanFilterOptions available for this filter.
 * @property {BooleanFilterName} propertyName - The BooleanFilterOptions available for this filter.
 * @property {string[]} selectedOptions - The names of the options selected for use in filtering.
 */
export default class BooleanFilter extends PostFilter {
	selectedOptions: string[];
	excludedOptions: string[];
	propertyName: BooleanFilterName;

	get options() {
		return this._options;
	}
	private _options: BooleanFilterOptionList;

	/**
	 * Set {@linkcode this._options} and remove invalid values from {@linkcode this.selectedOptions}.
	 * @param {BooleanFilterOptionList} optionList
	 */
	public set options(optionList: BooleanFilterOptionList) {
		this._options = optionList;
		this.selectedOptions = this.selectedOptions.filter((v) =>
			optionList.getObj(v),
		);
		this.excludedOptions = this.excludedOptions.filter((v) =>
			optionList.getObj(v),
		);
		this.excludedOptions = this.excludedOptions.filter(
			(option) => !this.selectedOptions.includes(option),
		);
	}

	/**
	 * @param {BooleanFilterArgs} params - The filter arguments.
	 * @param {boolean} [params.invertSelection] - If true, the filter logic is inverted (e.g. exclude instead of include).
	 * @param {string[]} [params.selectedOptions] - The selected options.
	 * @param {BooleanFilterName} params.propertyName - The property the filter is working with (hashtags/post type/etc).
	 */
	constructor(params: BooleanFilterArgs) {
		const { invertSelection, propertyName, selectedOptions, excludedOptions } =
			params;
		const optionInfo = new BooleanFilterOptionList([], propertyName);
		let description: string;

		if (propertyName == BooleanFilterName.TYPE) {
			description = SOURCE_FILTER_DESCRIPTION;
		} else {
			const descriptionWord =
				propertyName == BooleanFilterName.HASHTAG ? "including" : "from";
			description = `Show only posts ${descriptionWord} these ${propertyName}s`;
		}

		super({ description, invertSelection, propertyName });
		this._options = optionInfo;
		this.propertyName = propertyName;
		this.selectedOptions = selectedOptions ?? [];
		this.excludedOptions = excludedOptions ?? [];
		if (
			this.invertSelection &&
			!this.excludedOptions.length &&
			this.selectedOptions.length
		) {
			this.excludedOptions = [...this.selectedOptions];
			this.selectedOptions = [];
			this.invertSelection = false;
		}
	}

	/**
	 * Return true if the {@linkcode Post} matches the filter.
	 * @param {Post} post - The post to check.
	 * @returns {boolean}
	 */
	isAllowed(post: Post): boolean {
		const includeOptions = this.selectedOptions;
		const excludeOptions = this.excludedOptions.length
			? this.excludedOptions
			: this.invertSelection
				? this.selectedOptions
				: [];

		// Check if post matches include filter
		if (
			includeOptions.length &&
			!POST_MATCHERS[this.propertyName](post, includeOptions)
		) {
			return false;
		}

		// Check if post matches exclude filter
		if (
			excludeOptions.length &&
			POST_MATCHERS[this.propertyName](post, excludeOptions)
		) {
			return false;
		}

		return true;
	}

	/**
	 * Return true if the option is included or excluded.
	 * @param {string} optionName - The option name.
	 * @returns {boolean}
	 */
	isOptionActive(optionName: string): boolean {
		return (
			this.selectedOptions.includes(optionName) ||
			this.excludedOptions.includes(optionName)
		);
	}

	/**
	 * Return options with {@linkcode numPosts} >= {@linkcode minPosts} sorted by name
	 * ({@linkcode this.selectedOptions} are always included).
	 * @param {number} [minPosts=0] - Minimum number of posts.
	 * @param {boolean} [includeFollowed=false] - Always include options with {@linkcode isFollowed} set to true.
	 * @returns {BooleanFilterOptionList}
	 */
	optionsSortedByName(
		minPosts = 0,
		includeFollowed = false,
	): BooleanFilterOptionList {
		const options = this.options.objs.toSorted((a, b) =>
			compareStr(a.displayName || a.name, b.displayName || b.name),
		);

		return this.optionListWithMinPosts(options, minPosts, includeFollowed);
	}

	/**
	 * Return options with {@linkcode numPosts} >= {@linkcode minPosts} sorted by {@linkcode numPosts}
	 * ({@linkcode this.selectedOptions} are always included).
	 * @param {number} [minPosts=0] - Minimum number of posts.
	 * @param {boolean} [includeFollowed=false] - Always include options with {@linkcode isFollowed} set to true.
	 * @returns {BooleanFilterOptionList}
	 */
	optionsSortedByValue(
		minPosts = 0,
		includeFollowed = false,
	): BooleanFilterOptionList {
		const sortedObjs = this.optionListWithMinPosts(
			this.options.topObjs(),
			minPosts,
			includeFollowed,
		);
		this.logger.trace(`optionsSortedByValue() sortedObjs:`, sortedObjs.objs);
		return sortedObjs;
	}

	/**
	 * Remove an option from the array and deduplicate.
	 * @param {string[]} options - Array to filter.
	 * @param {string} toRemove - Option name to remove.
	 * @returns {string[]} New deduplicated array without the removed option.
	 */
	private removeAndDeduplicate(options: string[], toRemove: string): string[] {
		return [...new Set(options.filter((option) => option !== toRemove))];
	}

	/**
	 * Set the option to include, exclude, or neutral.
	 * @param {string} optionName - The option name.
	 * @param {BooleanFilterOptionState} state - Desired option state.
	 */
	updateOption(optionName: string, state: BooleanFilterOptionState): void {
		this.logger.trace(`updateOption(${optionName}, ${state}) invoked`);

		// Remove from both arrays first
		const newSelectedOptions = this.selectedOptions.filter(
			(opt) => opt !== optionName,
		);
		const newExcludedOptions = this.excludedOptions.filter(
			(opt) => opt !== optionName,
		);

		// Add to appropriate array based on state
		if (state === "include") {
			newSelectedOptions.push(optionName);
		} else if (state === "exclude") {
			newExcludedOptions.push(optionName);
		}

		// Assign new arrays to trigger React re-renders
		this.selectedOptions = newSelectedOptions;
		this.excludedOptions = newExcludedOptions;
	}

	getOptionState(optionName: string): BooleanFilterOptionState {
		if (this.selectedOptions.includes(optionName)) return "include";
		if (this.excludedOptions.includes(optionName)) return "exclude";
		return "neutral";
	}

	/**
	 * Required for serialization of settings to local storage.
	 * @returns {BooleanFilterArgs} Serialized arguments used to construct this filter.
	 */
	toArgs(): BooleanFilterArgs {
		const filterArgs = super.toArgs() as BooleanFilterArgs;
		filterArgs.invertSelection = false;
		filterArgs.selectedOptions = this.selectedOptions;
		filterArgs.excludedOptions = this.excludedOptions;
		return filterArgs;
	}

	/**
	 * Add synthetic options for selected/excluded options that are missing from the options list.
	 * @private
	 * @param {BooleanFilterOption[]} options - The current options list.
	 */
	private addMissingActiveOptions(options: BooleanFilterOption[]): void {
		const activeOptions = [...this.selectedOptions, ...this.excludedOptions];

		activeOptions.forEach((optionName) => {
			if (optionName && !options.some((opt) => opt.name === optionName)) {
				this.logger.warn(
					`Active option "${optionName}" not found in options, adding synthetically`,
				);
				options.push({
					name: optionName,
					displayName: optionName,
					numPosts: 0,
				} as BooleanFilterOption);
			}
		});
	}

	/**
	 * Return only options that have at least {@linkcode minPosts} or are in {@linkcode selectedOptions}.
	 * @private
	 * @param {BooleanFilterOption[]} options - The options to filter.
	 * @param {number} [minPosts=0] - Minimum number of posts.
	 * @param {boolean} [includeFollowed=false] - Always include options with {@linkcode isFollowed} set to true.
	 * @returns {BooleanFilterOptionList}
	 */
	private optionListWithMinPosts(
		options: BooleanFilterOption[],
		minPosts = 0,
		includeFollowed = false,
	): BooleanFilterOptionList {
		const newOptions = options.filter((o) => {
			const numPosts = o.numPosts || 0;
			return (
				numPosts >= minPosts ||
				this.isOptionActive(o.name) ||
				(includeFollowed && o.isFollowed && numPosts > 0)
			);
		});

		this.addMissingActiveOptions(newOptions);

		return new BooleanFilterOptionList(newOptions, this.propertyName);
	}

	/**
	 * Checks if a given property name is a valid {@linkcode BooleanFilterName}.
	 * @param {string} name - The property name to check.
	 * @returns {boolean} True if the name is a filterable numeric property.
	 */
	static isValidFilterProperty(name: string): boolean {
		return !isNil(name) && isValueInStringEnum(BooleanFilterName)(name);
	}
}
