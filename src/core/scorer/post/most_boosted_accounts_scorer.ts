import MastoApi from "../../api/api";
import Account from "../../api/objects/account";
import Post from "../../api/objects/post";
import { ScoreName } from "../../enums";
import type { StringNumberDict } from "../../types";
import AccountScorer from "./acccount_scorer";

/**
 * Score a {@linkcode Post} based on how many times the user has boosted the author and booster
 * (if it's a boost).
 * @memberof module:post_scorers
 * @augments Scorer
 */
export default class MostBoostedAccountsScorer extends AccountScorer {
	description = "Favour accounts you often repost";

	constructor() {
		super(ScoreName.MOST_BOOSTED_ACCOUNTS);
	}

	async prepareScoreData(): Promise<StringNumberDict> {
		const recentPosts = await MastoApi.instance.getRecentUserPosts();
		const boostedAccounts = Post.onlyBoosts(recentPosts).map(
			(post) => post.reblog!.account,
		);
		return Account.countAccounts(boostedAccounts);
	}
}
