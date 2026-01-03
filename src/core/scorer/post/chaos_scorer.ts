import type Post from "../../api/objects/post";
import { ScoreName } from "../../enums";
/**
 * @memberof module:post_scorers
 */
import PostScorer from "../post_scorer";

/**
 * Random number generator to mix up the feed.
 * @class ChaosScorer
 * @memberof module:post_scorers
 * @augments Scorer
 */
export default class ChaosScorer extends PostScorer {
	description = "Insert Chaos into the scoring (social media ist krieg)";

	constructor() {
		super(ScoreName.CHAOS);
	}

	async _score(post: Post) {
		// Return the existing score if it exists
		if (post.scoreInfo?.scores) {
			const existingScore = post.getIndividualScore("raw", this.name);
			if (existingScore) return existingScore;
		}

		try {
			return this.decimalHash(post.realToot.content);
		} catch (e) {
			console.warn(
				`Error in _score() for ${this.name}:`,
				e,
				`\nToot with error in ChaosScorer:`,
				post,
			);
			return 0;
		}
	}

	// Use a hash to get a deterministic score between 0 and 1
	private decimalHash(s: string): number {
		let hash = 0;

		for (let i = 0; i < s.length; i++) {
			hash = s.charCodeAt(i) + ((hash << 5) - hash);
		}

		return (hash & hash) / Math.pow(2, 31);
	}
}
