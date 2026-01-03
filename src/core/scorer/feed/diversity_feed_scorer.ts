/**
 * @module feed_scorers
 */

import CountedList from "../../api/counted_list";
import type Post from "../../api/objects/post";
import { sortByCreatedAt } from "../../api/objects/post";
import { config } from "../../config";
import { ScoreName } from "../../enums";
import { incrementCount } from "../../helpers/collection_helpers";
import type { NamedTootCount, StringNumberDict } from "../../types";
import FeedScorer from "../feed_scorer";

interface PenalizedObj extends NamedTootCount {
	numSeen?: number; // How many of this object have been seen during the scoring process
	numToPenalize?: number;
	penaltyIncrement?: number;
}

/**
 * Scores based on how many times each author or trending tag appears in the feed. Has a
 * negative weighting by default so that accounts that post a lot don't dominate the feed.
 * @memberof module:post_scorers
 * @augments Scorer
 */
export default class DiversityFeedScorer extends FeedScorer {
	description = "Favour accounts that are posting a lot right now";

	constructor() {
		super(ScoreName.DIVERSITY);
	}

	/**
	 * Compute a score for each {@linkcode Post} in the feed based on how many times the
	 * {@linkcode Account} has tooted and which trending tags it contains.
	 *
	 * @param {Post[]} feed - The feed of posts to score.
	 * @returns {StringNumberDict} Dictionary mapping post URIs to their diversity scores.
	 */
	extractScoringData(feed: Post[]): StringNumberDict {
		const sortedPosts = sortByCreatedAt(feed) as Post[];
		// Initialize empty CountedLists for accounts and trending tags
		const accountsInFeed = new CountedList<PenalizedObj>(
			[],
			ScoreName.DIVERSITY,
		);
		const trendingTagsInFeed = new CountedList<PenalizedObj>(
			[],
			ScoreName.DIVERSITY,
		);

		// Count how many times each account and each trending tag are seen in the feed
		sortedPosts.forEach((post) => {
			post.withBoost.forEach((t) =>
				accountsInFeed.incrementCount(t.account.webfingerURI),
			);

			// Penalties for trending tags are similar to those for accounts but we base the max penalty
			// on the TrendingTag's numAccounts property (the fediverse-wide number of accounts using that tag)
			(post.realToot.trendingTags ?? []).forEach((tag) => {
				const penalizedTag = trendingTagsInFeed.incrementCount(tag.name);
				penalizedTag.numAccounts = Math.max(
					tag.numAccounts || 0,
					penalizedTag.numAccounts || 0,
				);
				penalizedTag.penaltyIncrement =
					penalizedTag.numAccounts / penalizedTag.numPosts!;
				penalizedTag.numToPenalize =
					penalizedTag.numPosts! -
					config.scoring.diversityScorerMinTrendingTagPostsForPenalty;
			});
		});

		this.logger.trace(`accountsInFeed:`, accountsInFeed);
		this.logger.trace(`trendingTagsInFeed:`, trendingTagsInFeed);

		// Create a dict with a score for each post, keyed by uri (mutates accountScores in the process)
		// The biggest penalties are applied to posts encountered first. We want to penalize the oldest posts the most.
		return sortedPosts.reduce((tootScores, post) => {
			post.withBoost.forEach((t) => {
				const penalty = this.computePenalty(
					accountsInFeed,
					t.account.webfingerURI,
				);
				incrementCount(tootScores, post.uri, penalty);
			});

			// Additional penalties for trending tags
			(post.realToot.trendingTags || []).forEach((tag) => {
				const penalty = this.computePenalty(trendingTagsInFeed, tag.name);

				// Don't apply trending tag penalty to followed accounts/tags
				if (!post.isFollowed) {
					incrementCount(tootScores, post.uri, penalty);
				}
			});

			return tootScores;
		}, {} as StringNumberDict);
	}

	async _score(post: Post) {
		const score = this.scoreData[post.uri] || 0;

		if (score < 0) {
			if (score > -0.2) {
				this.scoreData[post.uri] = 0; // Handle floating point noise yielding mildly negative score
			} else {
				console.warn(
					`Negative diversity score of ${score.toFixed(2)} for post: ${post.description}:`,
					post,
				);
			}

			return 0;
		}

		return post.reblog
			? score * config.scoring.diversityScorerBoostMultiplier
			: score;
	}

	// The more often we see an object, the less we want to penalize it
	private computePenalty(
		penalizedObjs: CountedList<PenalizedObj>,
		name: string,
	): number {
		const obj = penalizedObjs.getObj(name)!;
		obj.numSeen = (obj.numSeen || 0) + 1;

		// Don't penalize if we've already dispensed enough penalties
		if (obj.numToPenalize && obj.numSeen > obj.numToPenalize) {
			return 0;
		} else {
			return (obj.numPosts! - obj.numSeen!) * (obj.penaltyIncrement || 1);
		}
	}
}
