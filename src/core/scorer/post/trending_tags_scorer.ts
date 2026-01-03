import type Post from "../../api/objects/post";
import { config } from "../../config";
import { ScoreName } from "../../enums";
import { sumArray } from "../../helpers/collection_helpers";
import PostScorer from "../post_scorer";

/**
 * Scores with the number of accounts that have posted a {@linkcode Post} with the trending tag
 * across the Fediverse.
 * @memberof module:post_scorers
 * @augments Scorer
 */
export default class TrendingTagsScorer extends PostScorer {
	description = "Favour hashtags that are trending in the Fediverse";

	constructor() {
		super(ScoreName.TRENDING_TAGS);
	}

	async _score(post: Post) {
		const tags = post.realToot.trendingTags || [];
		const tagScores = tags.map((tag) => tag.numAccounts || 0);
		let score = sumArray(tagScores);

		// If the post is tag spam reduce the score
		if (score > 0 && post.tags.length >= config.scoring.excessiveTags) {
			this.logger.deep(
				`Penalizing excessive tags (${post.tags.length}) in ${post.description}`,
			);
			score *= config.scoring.excessiveTagsPenalty;
		}

		return score;
	}
}
