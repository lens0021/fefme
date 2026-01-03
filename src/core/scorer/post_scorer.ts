/**
 * Namespace for Scorers that operate on a Post independent of the rest of the feed.
 * @module post_scorers
 */

import type { ScoreName } from "../enums";
import { ageString } from "../helpers/time_helpers";
import type { StringNumberDict } from "../types";
import Scorer from "./scorer";

/**
 * Base class for a {@linkcode Scorer} that can score a {@linkcode Post} based solely on the properties of
 * that {@linkcode Post}, optionally coupled with the fefme user's account data. Most importantly a
 * {@linkcode PostScorer} does *not* require information about any other {@linkcode Post}s in the feed
 * (unlike a {@linkcode FeedScorer}, which requires knowledge of the entire timeline to render a score).
 * @memberof module:post_scorers
 * @augments Scorer
 */
export default abstract class PostScorer extends Scorer {
	constructor(scoreName: ScoreName) {
		super(scoreName);
	}

	/**
	 * Calls {@linkcode PostScorer.prepareScoreData} to get any data required for scoring {@linkcode Post} later.
	 * NOTE: Don't overload this - {@linkcode prepareScoreData()} instead.
	 */
	async fetchRequiredData(): Promise<void> {
		const startTime = Date.now();

		try {
			this.scoreData = await this.prepareScoreData();
		} catch (e) {
			this.logger.error(`Error in prepareScoreData():`, e);
			this.scoreData = {};
		}

		if (Object.values(this.scoreData).length > 0) {
			this.logger.debugWithTraceObjs(
				`prepareScoreData() finished ${ageString(startTime)}`,
				this.scoreData,
			);
		}

		this.isReady = true;
	}

	/**
	 * Can be overloaded in subclasses to set up any data required for scoring {@linkcode Post}s.
	 * @returns {StringNumberDict} Dictionary of data required for scoring {@linkcode Post}s.
	 */
	async prepareScoreData(): Promise<StringNumberDict> {
		return {};
	}
}
