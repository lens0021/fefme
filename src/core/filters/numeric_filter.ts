/**
 * @fileoverview Filter posts based on numeric properties like replies, reblogs, and favourites.
 */
import { isFinite, isNil } from "lodash";

import type Post from "../api/objects/post";
import type { PostNumberProp } from "../types";
import PostFilter, { type FilterArgs } from "./post_filter";

// List of post numeric properties that can be filtered.
export const FILTERABLE_SCORES: PostNumberProp[] = [
	"repliesCount",
	"reblogsCount",
	"favouritesCount",
];

export interface NumericFilterArgs extends Omit<FilterArgs, "description"> {
	propertyName: PostNumberProp;
	value?: number;
}

/**
 * Filter for numeric properties of a {@linkcode Post} (e.g. replies, reblogs, favourites).
 * Allows filtering {@linkcode Post}s based on a minimum value for a given property.
 * @augments PostFilter
 * @property {string} [description] - Optional description of the filter for display or documentation purposes.
 * @property {boolean} [invertSelection] - If true, the filter logic is inverted (e.g. exclude instead of include).
 * @property {PostNumberProp} propertyName - The property of the post to filter on (e.g. {@linkcode repliesCount}).
 * @property {number} value - Minimum value a post must have in the {@linkcode propertyName} field to be included in the timeline.
 */
export default class NumericFilter extends PostFilter {
	propertyName: PostNumberProp;
	value: number;

	/**
	 * @param {NumericFilterArgs} params - The filter arguments.
	 * @param {boolean} [params.invertSelection] - If true, the filter logic is inverted (exclude instead of include).
	 * @param {PostNumberProp} params.propertyName - Post property to filter on (e.g.{@linkcode repliesCount}).
	 * @param {number} [params.value] - The minimum value for the filter.
	 */
	constructor(params: NumericFilterArgs) {
		const { invertSelection, propertyName, value } = params;

		super({
			description: `Minimum number of ${propertyName.replace(/Count$/, "")}`,
			invertSelection,
			propertyName,
		});

		this.propertyName = propertyName;
		this.value = value ?? 0;
	}

	/**
	 * Check if the {@linkcode Post} meets the filter criterion.
	 * @param {Post} post - The post to check.
	 * @returns {boolean} True if the post should appear in the timeline feed.
	 */
	isAllowed(post: Post): boolean {
		if (this.invertSelection && this.value === 0) return true; // 0 doesn't work as a maximum
		const propertyValue = post.realToot[this.propertyName];

		if (!isFinite(propertyValue)) {
			this.logger.warn(
				`No value found for ${this.propertyName} (interrupted scoring?) in post: ${post.description}`,
			);
			return true;
		}

		const isOK = propertyValue >= this.value;
		return this.invertSelection ? !isOK : isOK;
	}

	/**
	 * Serializes the filter state for storage.
	 * @returns {NumericFilterArgs} Arguments that can be used to reconstruct the filter.
	 */
	toArgs(): NumericFilterArgs {
		const filterArgs = super.toArgs() as NumericFilterArgs;
		// Ensure we don't serialize NaN/undefined - use 0 as fallback
		filterArgs.value = isFinite(this.value) ? this.value : 0;
		return filterArgs;
	}

	/**
	 * Updates the filter's {@linkcode value} property.
	 * @param {number} newValue - The new minimum value for the filter.
	 */
	updateValue(newValue: number): void {
		// Validate that newValue is a finite number, default to 0 if not
		if (!isFinite(newValue)) {
			this.logger.warn(
				`Invalid value ${newValue} for ${this.propertyName}, defaulting to 0`,
			);
			this.value = 0;
		} else {
			this.value = newValue;
		}
	}

	/**
	 * Checks if a given property name is a valid numeric filter name.
	 * @param {string} name - The property name to check.
	 * @returns {boolean} True if the name is a filterable numeric property.
	 */
	static isValidFilterProperty(name: string | undefined): boolean {
		return !isNil(name) && FILTERABLE_SCORES.includes(name as PostNumberProp);
	}
}
