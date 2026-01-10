import type Post from "../../api/objects/post";
import { ScoreName } from "../../enums";
import { sumArray } from "../../helpers/collection_helpers";
/**
 * @memberof module:post_scorers
 */
import PostScorer from "../post_scorer";

/**
 * Score based on the {@linkcode numTimesShown}, which is managed by the client app.
 * @class AlreadyShownScorer
 * @memberof module:post_scorers
 * @augments Scorer
 */
export default class AlreadyShownScorer extends PostScorer {
	description = "Favour posts marked as already seen";

	constructor() {
		super(ScoreName.ALREADY_SHOWN);
	}

	// Sets the followedTags property on the Post object before returning the score
	async _score(post: Post) {
		// Default to 0 for posts without numTimesShown to prevent undefined in array
		return sumArray(post.withBoost.map((t) => t.numTimesShown ?? 0));
	}
}
