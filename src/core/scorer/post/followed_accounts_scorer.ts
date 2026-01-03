import MastoApi from "../../api/api";
import Account from "../../api/objects/account";
import type Post from "../../api/objects/post";
import { ScoreName } from "../../enums";
import type { StringNumberDict } from "../../types";
import PostScorer from "../post_scorer";

/**
 * One point if you follow the author (followed boosts are picked up by the {@linkcode BoostsInFeedScorer}).
 * @memberof module:post_scorers
 * @augments Scorer
 */
export default class FollowedAccountsScorer extends PostScorer {
	description = "Favour accounts you follow";

	constructor() {
		super(ScoreName.FOLLOWED_ACCOUNTS);
	}

	async prepareScoreData(): Promise<StringNumberDict> {
		return Account.countAccounts(await MastoApi.instance.getFollowedAccounts());
	}

	async _score(post: Post): Promise<number> {
		return this.scoreData[post.account.webfingerURI] ?? 0;
	}
}
