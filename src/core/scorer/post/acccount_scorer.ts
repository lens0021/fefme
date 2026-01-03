import type Post from "../../api/objects/post";
import { sumArray } from "../../helpers/collection_helpers";
/*
 * Abstract extension of FeatureScorer to score a post based on the account that created it.
 * Requires that the scoreData is a map of webfingerURIs to scores.
 */
import PostScorer from "../post_scorer";

/**
 * @private
 */
export default abstract class AccountScorer extends PostScorer {
	async _score(post: Post) {
		return sumArray(
			post.withBoost.map((t) => this.scoreData[t.account.webfingerURI]),
		);
	}
}
