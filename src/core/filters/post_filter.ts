/**
 * @fileoverview Abstract class for filtering {@linkcode Post} objects in or out of the timeline feed.
 */
import type Post from "../api/objects/post";
import { split } from "../helpers/collection_helpers";
import { Logger } from "../helpers/logger";
import type { FilterProperty } from "../types";

export interface FilterArgs {
	description?: string;
	invertSelection?: boolean;
	propertyName: FilterProperty;
}

/**
 * Abstract base class representing a filter that can be applied to a {@linkcode Post} to determine
 * if it should be included in the timeline feed. Subclasses must implement the
 * {@linkcode PostFilter.isAllowed} method.
 * @property {string} description - Description of the filter for display or documentation purposes.
 * @property {boolean} invertSelection - If true, the filter logic is inverted (e.g. exclude instead of include).
 * @property {Logger} logger - Logger instance for this filter.
 * @property {FilterProperty} propertyName - The property this filter works on
 */
export default abstract class PostFilter {
	description: string;
	invertSelection: boolean;
	logger: Logger;
	propertyName: FilterProperty;

	/**
	 * @param {FilterArgs} params - The arguments for configuring the filter.
	 * @param {string} [params.description] - Optional description of the filter for display or documentation purposes.
	 * @param {boolean} [params.invertSelection] - If true, the filter logic is inverted (e.g. exclude instead of include).
	 * @param {FilterProperty} params.propertyName - Key identifying what this filter is filtering on.
	 */
	constructor(params: FilterArgs) {
		const { description, invertSelection, propertyName } = params;
		this.description = description ?? (propertyName as string);
		this.invertSelection = invertSelection ?? false;
		this.propertyName = propertyName;
		this.logger = Logger.withParenthesizedName("PostFilter", propertyName);
	}

	/**
	 * Determines if the given {@linkcode Post} should appear in the timeline feed.
	 * @abstract
	 * @param {Post} post - The post to check.
	 * @returns {boolean} True if the post meets the filter criteria, false otherwise.
	 */
	abstract isAllowed(post: Post): boolean;

	/**
	 * Returns the arguments needed to reconstruct this filter. Extend in subclasses for serialization.
	 * @returns {FilterArgs} The arguments representing this filter's configuration.
	 */
	toArgs(): FilterArgs {
		return {
			invertSelection: this.invertSelection,
			propertyName: this.propertyName,
		};
	}

	/** Abstract method. Must be overridden in subclasses. */
	static isValidFilterProperty(_name: string): boolean {
		throw new Error(
			"isValidFilterProperty() must be implemented in subclasses",
		);
	}

	/** Remove any filter args from the list whose {@linkcode propertyName} value is obsolete. */
	static removeInvalidFilterArgs(
		args: FilterArgs[],
		logger: Logger,
	): FilterArgs[] {
		const [validArgs, invalidArgs] = split(args, (arg) =>
			this.isValidFilterProperty(arg.propertyName),
		);

		if (invalidArgs.length > 0) {
			logger.warn(
				`Found invalid filter args [${invalidArgs.map((a) => a.propertyName)}]...`,
			);
		} else {
			logger.trace("All filter args are valid.");
		}

		return validArgs;
	}
}
