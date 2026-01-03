import MastoApi from "../../api/api";
import type Post from "../../api/objects/post";
import { ScoreName } from "../../enums";
import { countValues, sumArray } from "../../helpers/collection_helpers";
import type { StringNumberDict } from "../../types";
import PostScorer from "../post_scorer";

/**
 * Score how many times the user has replied to the creator of the {@linkcode Post}.
 * @memberof module:post_scorers
 * @augments Scorer
 */
export default class MostRepliedAccountsScorer extends PostScorer {
	description = "Favour accounts you often reply to";

	constructor() {
		super(ScoreName.MOST_REPLIED_ACCOUNTS);
	}

	// Count replied per user. Note that this does NOT pull the Account object because that
	// would require a lot of API calls, so it's just working with the account ID which is NOT
	// unique across all servers.
	async prepareScoreData(): Promise<StringNumberDict> {
		const recentPosts = await MastoApi.instance.getRecentUserPosts();
		const recentReplies = recentPosts.filter(
			(post) => post?.inReplyToAccountId && !post.isDM,
		);
		return countValues<Post>(recentReplies, (post) => post?.inReplyToAccountId);
	}

	async _score(post: Post) {
		return sumArray(post.withBoost.map((t) => this.scoreData[t.account.id]));
	}
}
