import type Post from "../../api/objects/post";
import { ScoreName } from "../../enums";
import PostScorer from "../post_scorer";

/**
 * Populate the {@linkcode Post.followedTags} property on {@linkcode Post} object and return
 * the number of tags on the {@linkcode Post} that the user is following.
 * @memberof module:post_scorers
 * @augments Scorer
 */
export default class FollowedTagsScorer extends PostScorer {
	description = "Favour posts containing hashtags you follow";

	constructor() {
		super(ScoreName.FOLLOWED_TAGS);
	}

	// Sets the followedTags property on the Post object before returning the score
	async _score(post: Post) {
		return post.realToot.followedTags?.length || 0;
	}
}
