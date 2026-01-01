import MastoApi from "../../api/api";
import Account from "../../api/objects/account";
import Toot from "../../api/objects/toot";
import { ScoreName } from "../../enums";
import type { StringNumberDict } from "../../types";
import AccountScorer from "./acccount_scorer";

/**
 * Score a {@linkcode Toot} based on how many times the user has retooted the author and retooter
 * (if it's a retoot).
 * @memberof module:toot_scorers
 * @augments Scorer
 */
export default class MostRetootedAccountsScorer extends AccountScorer {
	description = "Favour accounts you often repost";

	constructor() {
		super(ScoreName.MOST_RETOOTED_ACCOUNTS);
	}

	async prepareScoreData(): Promise<StringNumberDict> {
		const recentToots = await MastoApi.instance.getRecentUserToots();
		const retootedAccounts = Toot.onlyRetoots(recentToots).map(
			(toot) => toot.reblog!.account,
		);
		return Account.countAccounts(retootedAccounts);
	}
}
