/**
 * @fileoverview Base class for {@linkcode Post} scorers.
 */
import { E_CANCELED, Mutex, type MutexInterface } from "async-mutex";
import { isFinite } from "lodash";

import Storage from "../Storage";
import type Post from "../api/objects/post";
import { config } from "../config";
import {
	NonScoreWeightName,
	ScoreName,
	isNonScoreWeightName,
	isWeightName,
} from "../enums";
import { batchMap, sumArray } from "../helpers/collection_helpers";
import { Logger } from "../helpers/logger";
import { ageString } from "../helpers/time_helpers";
import type {
	ScoreType,
	StringNumberDict,
	TootScore,
	TootScores,
	WeightInfo,
	WeightName,
	Weights,
} from "../types";
import ScorerCache from "./scorer_cache";
import { DEFAULT_WEIGHTS } from "./weight_presets";

// Local constants
const LOG_PREFIX = "Scorer";
const SCORE_MUTEX = new Mutex();

const TRENDING_WEIGHTS = new Set([
	ScoreName.TRENDING_TAGS,
	ScoreName.TRENDING_POSTS,
]);

const scoreLogger = new Logger(LOG_PREFIX, "scorePosts");

/**
 * Abstract base class for scoring {@linkcode Post} objects.
 *
 * {@linkcode Scorer} implementations provide algorithms for assigning scores to {@linkcode Post}s,
 * which are used for ranking and filtering feeds. This class manages scorer state, logging, and
 * provides a public API for scoring, as well as static utilities for scoring arrays of {@linkcode Post}s.
 *
 * @abstract
 * @property {string} description - Description of the scoring algorithm.
 * @property {boolean} isReady - True if the scorer is ready to score posts.
 * @property {Logger} logger - Logger instance for this scorer.
 * @property {ScoreName} name - The name/key of this scorer.
 * @property {StringNumberDict} scoreData - Background data used to score a post.
 */
export default abstract class Scorer {
	abstract description: string;

	isReady = false; // Set to true when the scorer is ready to score
	logger: Logger;
	name: ScoreName;
	scoreData: StringNumberDict = {}; // Background data used to score a post

	/**
	 * @param {ScoreName} name - The name/key of this scorer.
	 */
	constructor(name: ScoreName) {
		this.name = name;
		this.logger = new Logger(LOG_PREFIX, name);
	}

	/**
	 * Returns a {@linkcode WeightInfo} object with the description of the scorer.
	 * @returns {WeightInfo} The weight info for this scorer.
	 */
	getInfo(): WeightInfo {
		return { description: this.description };
	}

	/** Resets the scorer's state and score data. */
	reset(): void {
		this.isReady = false;
		this.scoreData = {};
		this.logger.debug(`Reset scorer`);
	}

	/**
	 * Public API for scoring a {@linkcode Post}.
	 * @param {Post} post - The post to score.
	 * @returns {Promise<number>} The computed score for the post or 0 if not ready.
	 */
	async score(post: Post): Promise<number> {
		if (this.isReady) {
			return await this._score(post);
		} else if (post.scoreInfo) {
			const existingScore = post.getIndividualScore("raw", this.name);
			this.logger.deep(`Not ready but post already scored ${existingScore}`);
			return existingScore;
		} else {
			this.logger.deep(`Not ready and no existing scoreInfo, scoring 0...`);
			return 0;
		}
	}

	/**
	 * Actual implementation of the scoring algorithm. Must be implemented in subclasses.
	 * @abstract
	 * @param {Post} _post - The post to score.
	 * @returns {Promise<number>} The computed score for the post.
	 */
	abstract _score(_post: Post): Promise<number>;

	//////////////////////////////
	//   Static class methods   //
	//////////////////////////////

	/**
	 * Scores and returns an array of {@linkcode Post}s sorted by score (descending). Does NOT mutate the input
	 * array! If you need the sorted array you need to use the return value.
	 * @static
	 * @param {Post[]} posts - Array of posts to score.
	 * @param {boolean} [isScoringFeed] - If true, refreshes feed scorer data and locks scoring.
	 * @returns {Promise<Post[]>} Array of scored and sorted posts.
	 */
	static async scorePosts(
		posts: Post[],
		isScoringFeed?: boolean,
	): Promise<Post[]> {
		const scorers = ScorerCache.weightedScorers;
		const startedAt = new Date();

		try {
			let releaseMutex: MutexInterface.Releaser | undefined;

			// Feed scorers' data must be refreshed each time the main timeline feed changes so we half heartedly
			// lock mutex to prevent multiple scoring loops calling DiversityFeedScorer simultaneously.
			// If it's already locked just cancel the current loop and start over (scoring is idempotent so it's OK).
			// Makes the feed scoring more responsive to the user adjusting the weights (less waiting).
			if (isScoringFeed) {
				SCORE_MUTEX.cancel();
				releaseMutex = await SCORE_MUTEX.acquire();
				ScorerCache.feedScorers.forEach((scorer) =>
					scorer.extractScoreDataFromFeed(posts),
				);
			}

			try {
				// Score the posts asynchronously in batches
				await batchMap(posts, (t) => this.decorateWithScoreInfo(t, scorers), {
					logger: scoreLogger,
				});
			} finally {
				releaseMutex?.();
			}

			// Sort feed based on score from high to low and return
			scoreLogger.trace(
				`Scored ${posts.length} posts ${ageString(startedAt)} (${scorers.length} scorers)`,
			);
			posts = posts.toSorted((a, b) => b.score - a.score);
		} catch (e) {
			if (e == E_CANCELED) {
				scoreLogger.trace(`Mutex cancellation...`);
			} else {
				scoreLogger.warn(`Caught error:`, e);
			}
		}

		return posts;
	}

	/**
	 * Validates that the {@linkcode weights} object contains valid weight names and values.
	 * @static
	 * @param {Weights} weights - Weights object to validate.
	 * @throws {Error} If any weight is invalid or missing.
	 */
	static validateWeights(weights: Weights) {
		Object.entries(weights).forEach(([weightName, value]) => {
			if (!isWeightName(weightName))
				throw new Error(`Invalid weight name: ${weightName}`);
			if (!isFinite(value))
				throw new Error(`Weight ${weightName} is missing from weights object!`);

			// Validate NonScoreWeight constraints
			if (isNonScoreWeightName(weightName)) {
				// OUTLIER_DAMPENER must be > 0 (used in division: 1 / outlierDampener)
				if (weightName === NonScoreWeightName.OUTLIER_DAMPENER && value <= 0) {
					throw new Error(
						`Non-score weight ${weightName} must be greater than 0!`,
					);
				}
				// TIME_DECAY can be 0 (neutral) but not negative
				if (weightName === NonScoreWeightName.TIME_DECAY && value < 0) {
					throw new Error(`Non-score weight ${weightName} cannot be negative!`);
				}
				// TRENDING has no restrictions beyond being finite
			}
		});
	}

	////////////////////////////////
	//   Private static methods   //
	////////////////////////////////

	/**
	 * Adds all score info to a {@linkcode Post}'s {@linkcode scoreInfo} property.
	 * @private
	 * @static
	 * @param {Post} post - The post to decorate.
	 * @param {Scorer[]} scorers - Array of scorer instances.
	 * @returns {Promise<void>}
	 */
	private static async decorateWithScoreInfo(
		post: Post,
		scorers: Scorer[],
	): Promise<void> {
		const rawestScores = await Promise.all(scorers.map((s) => s.score(post)));
		const userWeights = await Storage.getWeights();

		const getWeight = (weightKey: WeightName) =>
			userWeights[weightKey] ?? DEFAULT_WEIGHTS[weightKey];

		const trendingMultiplier = getWeight(NonScoreWeightName.TRENDING);
		let outlierDampener = getWeight(NonScoreWeightName.OUTLIER_DAMPENER);

		if (outlierDampener <= 0) {
			scoreLogger.warn(
				`Outlier dampener is ${outlierDampener} but should not be less than 0! Using 1 instead.`,
			);
			outlierDampener = 1; // Prevent division by zero
		}

		// Compute individual weighted scores
		const scores: TootScores = scorers.reduce((scoreDict, scorer, i) => {
			const rawScore = rawestScores[i] || 0;
			const weight = userWeights[scorer.name] ?? 0;

			const weightedScore = this.calculateWeightedScore(
				rawScore,
				weight,
				scorer.name,
				outlierDampener,
				trendingMultiplier,
			);

			scoreDict[scorer.name] = {
				raw: rawScore,
				weighted: weightedScore,
				weight,
			};
			return scoreDict;
		}, {} as TootScores);

		// Calculate Final Score
		const timeDecayWeight = getWeight(NonScoreWeightName.TIME_DECAY);
		const timeDecayMultiplier = this.calculateTimeDecayMultiplier(
			post.ageInHours,
			timeDecayWeight,
		);

		const weightedScore = this.sumScores(scores, "weighted");
		const score = weightedScore * timeDecayMultiplier;

		// Preserve rawScores, timeDecayMultiplier, and weightedScores for debugging
		const scoreInfo = {
			rawScore: this.sumScores(scores, "raw"),
			score,
			scores,
			timeDecayMultiplier,
			trendingMultiplier,
			weightedScore,
		} as TootScore;

		// TODO: duping the score to realToot is a hack that sucks
		post.realToot.scoreInfo = post.scoreInfo = scoreInfo;
		post.realToot.score = post.score = score;
	}

	/**
	 * Calculates the weighted score for a single scorer.
	 * @private
	 * @static
	 */
	private static calculateWeightedScore(
		rawScore: number,
		weight: number,
		scorerName: ScoreName,
		outlierDampener: number,
		trendingMultiplier: number,
	): number {
		let weightedScore = rawScore * weight;

		// Apply the TRENDING modifier
		if (TRENDING_WEIGHTS.has(scorerName)) {
			weightedScore *= trendingMultiplier;
		}

		// Apply Outlier Dampener
		const outlierExponent = 1 / outlierDampener;
		// Outlier dampener of 2 means take the square root of the score, 3 means cube root, etc.
		if (weightedScore >= 0) {
			weightedScore = Math.pow(weightedScore, outlierExponent);
		} else {
			weightedScore = -1 * Math.pow(-1 * weightedScore, outlierExponent);
		}

		return weightedScore;
	}

	/**
	 * Calculates the time decay multiplier.
	 * @private
	 * @static
	 */
	private static calculateTimeDecayMultiplier(
		ageInHours: number,
		timeDecayWeight: number,
	): number {
		// Divide by 10 to make it more user friendly (matching original logic)
		const adjustedWeight = timeDecayWeight / 10;
		const decayExponent =
			-1 * Math.pow(ageInHours, config.scoring.timeDecayExponent);
		return Math.pow(adjustedWeight + 1, decayExponent);
	}

	/**
	 * Sums the scores of all scorers for a given score type, +1 so that time decay multiplier
	 * works even with scorers giving 0s.
	 * @private
	 * @static
	 * @param {TootScores} scores - The scores object.
	 * @param {ScoreType} scoreType - The type of score to sum ("raw" or "weighted").
	 * @returns {number} The sum of the scores plus 1.
	 */
	private static sumScores(scores: TootScores, scoreType: ScoreType): number {
		return 1 + sumArray(Object.values(scores).map((s) => s[scoreType]));
	}
}
