import type Post from "../../api/objects/post";
import { ScoreName } from "../../enums";
/**
 * @memberof module:post_scorers
 */
import PostScorer from "../post_scorer";

/**
 * Score a {@linkcode Post} based on how many followers the author has.
 * @class AuthorFollowersScorer
 * @memberof module:post_scorers
 * @augments Scorer
 */
export default class AuthorFollowersScorer extends PostScorer {
	description = "Favour accounts with a lot of followers";

	constructor() {
		super(ScoreName.AUTHOR_FOLLOWERS);
	}

	// Use log base 10 of the number of followers as the score
	async _score(post: Post): Promise<number> {
		const followerCount = post.author.followersCount;
		return followerCount > 0 ? Math.log10(followerCount) : 0;
	}
}
