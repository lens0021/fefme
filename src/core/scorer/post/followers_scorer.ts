import MastoApi from "../../api/api";
import Account from "../../api/objects/account";
import { ScoreName } from "../../enums";
import type { StringNumberDict } from "../../types";
import AccountScorer from "./acccount_scorer";

/**
 * One point for accounts that follow the Fedialgo user.
 * @memberof module:post_scorers
 * @augments Scorer
 */
export default class FollowersScorer extends AccountScorer {
	description = "Favour accounts who follow you";

	constructor() {
		super(ScoreName.FOLLOWERS);
	}

	async prepareScoreData(): Promise<StringNumberDict> {
		return Account.countAccounts(await MastoApi.instance.getFollowers());
	}
}
