/**
 * @fileoverview Feed filtering information related to a single criterion on which toots
 * can be filtered inclusively or exclusively based on an array of strings
 * (e.g. language, hashtag, type of toot).
 */
import { isNil } from "lodash";

import TootFilter, { type FilterArgs } from "./toot_filter";
import type Toot from "../api/objects/toot";
import {
	BooleanFilterName,
	TypeFilterName,
	isValueInStringEnum,
} from "../enums";
import { BooleanFilterOptionList } from "../api/counted_list";
import { buildTag } from "../api/objects/tag";
import { compareStr, isEmptyStr } from "../helpers/string_helpers";
import { config } from "../config";
import { type BooleanFilterOption } from "../types";

type TootMatcher = (toot: Toot, selectedOptions: string[]) => boolean;
type TypeFilter = (toot: Toot) => boolean;
export type BooleanFilterOptionState = "include" | "exclude" | "neutral";

const SOURCE_FILTER_DESCRIPTION = "Choose what kind of toots are in your feed";

// Type-based filters for toots. Defining a new filter just requires adding a new TypeFilterName
// and a function that matches the toot.
export const TYPE_FILTERS: Record<TypeFilterName, TypeFilter> = {
	[TypeFilterName.AUDIO]: (toot) => !!toot.realToot.audioAttachments?.length,
	[TypeFilterName.BOT]: (toot) => toot.accounts.some((account) => account.bot),
	[TypeFilterName.DIRECT_MESSAGE]: (toot) => toot.isDM,
	[TypeFilterName.FOLLOWED_ACCOUNTS]: (toot) =>
		toot.accounts.some((account) => account.isFollowed),
	[TypeFilterName.FOLLOWED_HASHTAGS]: (toot) =>
		!!toot.realToot.followedTags?.length,
	[TypeFilterName.IMAGES]: (toot) => !!toot.realToot.imageAttachments?.length,
	[TypeFilterName.LINKS]: (toot) =>
		!!(toot.realToot.card || toot.realToot.trendingLinks?.length),
	[TypeFilterName.MENTIONS]: (toot) => toot.containsUserMention(),
	[TypeFilterName.POLLS]: (toot) => !!toot.realToot.poll,
	[TypeFilterName.PARTICIPATED_TAGS]: (toot) =>
		!!toot.realToot.participatedTags?.length,
	[TypeFilterName.PRIVATE]: (toot) => toot.realToot.isPrivate,
	[TypeFilterName.REPLIES]: (toot) => !!toot.realToot.inReplyToId,
	[TypeFilterName.RETOOTS]: (toot) => !!toot.reblog,
	[TypeFilterName.SEEN]: (toot) => (toot.numTimesShown ?? 0) > 0,
	[TypeFilterName.SENSITIVE]: (toot) => toot.realToot.sensitive,
	[TypeFilterName.SPOILERED]: (toot) => !isEmptyStr(toot.realToot.spoilerText),
	[TypeFilterName.TRENDING_LINKS]: (toot) =>
		!!toot.realToot.trendingLinks?.length,
	[TypeFilterName.TRENDING_TAGS]: (toot) =>
		!!toot.realToot.trendingTags?.length,
	[TypeFilterName.TRENDING_TOOTS]: (toot) => !!toot.realToot.trendingRank,
	[TypeFilterName.VIDEOS]: (toot) => !!toot.realToot.videoAttachments?.length,
} as const;

// Matchers for each BooleanFilterName.
const TOOT_MATCHERS: Record<BooleanFilterName, TootMatcher> = {
	[BooleanFilterName.APP]: (toot: Toot, selectedOptions: string[]) => {
		return selectedOptions.includes(toot.realToot.application?.name);
	},
	[BooleanFilterName.SERVER]: (toot: Toot, selectedOptions: string[]) => {
		return selectedOptions.includes(toot.homeserver);
	},
	[BooleanFilterName.HASHTAG]: (toot: Toot, selectedOptions: string[]) => {
		return !!selectedOptions.find((v) =>
			toot.realToot.containsTag(buildTag(v), true),
		);
	},
	[BooleanFilterName.LANGUAGE]: (toot: Toot, selectedOptions: string[]) => {
		return selectedOptions.includes(
			toot.realToot.language || config.locale.defaultLanguage,
		);
	},
	[BooleanFilterName.TYPE]: (toot: Toot, selectedOptions: string[]) => {
		return selectedOptions.some((v) => TYPE_FILTERS[v as TypeFilterName](toot));
	},
	[BooleanFilterName.USER]: (toot: Toot, selectedOptions: string[]) => {
		return selectedOptions.includes(toot.realToot.account.webfingerURI);
	},
} as const;

export interface BooleanFilterArgs extends Omit<FilterArgs, "description"> {
	selectedOptions?: string[];
	excludedOptions?: string[];
	propertyName: BooleanFilterName;
}

/**
 * Handles filtering {@linkcode Toot}s by boolean criteria (e.g. language, hashtag, type).
 * @augments TootFilter
 * @property {string} [description] - Optional description of the filter for display or documentation purposes.
 * @property {boolean} [invertSelection] - If true, the filter logic is inverted (e.g. exclude instead of include).
 * @property {BooleanFilterOptionList} options - The BooleanFilterOptions available for this filter.
 * @property {BooleanFilterName} propretyName - The BooleanFilterOptions available for this filter.
 * @property {string[]} selectedOptions - The names of the options selected for use in filtering.
 */
export default class BooleanFilter extends TootFilter {
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
	 * @param {BooleanFilterName} params.propertyName - The property the filter is working with (hashtags/toot type/etc).
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
			description = `Show only toots ${descriptionWord} these ${propertyName}s`;
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
	 * Return true if the {@linkcode Toot} matches the filter.
	 * @param {Toot} toot - The toot to check.
	 * @returns {boolean}
	 */
	isAllowed(toot: Toot): boolean {
		const includeOptions = this.selectedOptions;
		const excludeOptions = this.excludedOptions.length
			? this.excludedOptions
			: this.invertSelection
				? this.selectedOptions
				: [];

		if (
			includeOptions.length &&
			!TOOT_MATCHERS[this.propertyName](toot, includeOptions)
		) {
			return false;
		}

		if (
			excludeOptions.length &&
			TOOT_MATCHERS[this.propertyName](toot, excludeOptions)
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
	 * Return options with {@linkcode numToots} >= {@linkcode minToots} sorted by name
	 * ({@linkcode this.selectedOptions} are always included).
	 * @param {number} [minToots=0] - Minimum number of toots.
	 * @param {boolean} [includeFollowed=false] - Always include options with {@linkcode isFollowed} set to true.
	 * @returns {BooleanFilterOptionList}
	 */
	optionsSortedByName(
		minToots: number = 0,
		includeFollowed: boolean = false,
	): BooleanFilterOptionList {
		const options = this.options.objs.toSorted((a, b) =>
			compareStr(a.displayName || a.name, b.displayName || b.name),
		);

		return this.optionListWithMinToots(options, minToots, includeFollowed);
	}

	/**
	 * Return options with {@linkcode numToots} >= {@linkcode minToots} sorted by {@linkcode numToots}
	 * ({@linkcode this.selectedOptions} are always included).
	 * @param {number} [minToots=0] - Minimum number of toots.
	 * @param {boolean} [includeFollowed=false] - Always include options with {@linkcode isFollowed} set to true.
	 * @returns {BooleanFilterOptionList}
	 */
	optionsSortedByValue(
		minToots: number = 0,
		includeFollowed: boolean = false,
	): BooleanFilterOptionList {
		const sortedObjs = this.optionListWithMinToots(
			this.options.topObjs(),
			minToots,
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
	updateOption(
		optionName: string,
		state: BooleanFilterOptionState,
	): void {
		this.logger.trace(
			`updateOption(${optionName}, ${state}) invoked`,
		);

		this.selectedOptions = this.removeAndDeduplicate(this.selectedOptions, optionName);
		this.excludedOptions = this.removeAndDeduplicate(this.excludedOptions, optionName);

		if (state === "include") {
			this.selectedOptions.push(optionName);
		} else if (state === "exclude") {
			this.excludedOptions.push(optionName);
		}

		// Build new Array object to trigger useMemo() in Demo App  // TODO: not great
		this.selectedOptions = [...this.selectedOptions];
		this.excludedOptions = [...this.excludedOptions];
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
	 * Return only options that have at least {@linkcode minToots} or are in {@linkcode selectedOptions}.
	 * @private
	 * @param {BooleanFilterOption[]} options - The options to filter.
	 * @param {number} [minToots=0] - Minimum number of toots.
	 * @param {boolean} [includeFollowed=false] - Always include options with {@linkcode isFollowed} set to true.
	 * @returns {BooleanFilterOptionList}
	 */
	private optionListWithMinToots(
		options: BooleanFilterOption[],
		minToots: number = 0,
		includeFollowed: boolean = false,
	): BooleanFilterOptionList {
		const newOptions = options.filter((o) => {
			const numToots = o.numToots || 0;
			return (
				numToots >= minToots ||
				this.isOptionActive(o.name) ||
				(includeFollowed && o.isFollowed && numToots > 0)
			);
		});

		[...this.selectedOptions, ...this.excludedOptions].forEach((selected) => {
			if (selected && !newOptions.some((opt) => opt.name === selected)) {
				this.logger.warn(
					`Selected option "${selected}" not found in options, adding synthetically`,
				);
				newOptions.push({
					name: selected,
					displayName: selected,
					numToots: 0,
				} as BooleanFilterOption);
			}
		});

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
