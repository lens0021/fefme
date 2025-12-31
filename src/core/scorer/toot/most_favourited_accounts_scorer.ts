import MastoApi from "../../api/api";
import Account from "../../api/objects/account";
import { ScoreName } from "../../enums";
import type { StringNumberDict } from "../../types";
import AccountScorer from "./acccount_scorer";

/**
 * Score how many times the current user has favourited the tooter in the past.
 * @memberof module:toot_scorers
 * @augments Scorer
 */
export default class MostFavouritedAccountsScorer extends AccountScorer {
	description = "Favour accounts you often favourite";

	constructor() {
		super(ScoreName.FAVOURITED_ACCOUNTS);
	}

	async prepareScoreData(): Promise<StringNumberDict> {
		let favouritedToots = await MastoApi.instance.getFavouritedToots();
		favouritedToots = favouritedToots.filter((toot) => !toot.isDM); // Ignore DMs
		return Account.countAccounts(favouritedToots.map((toot) => toot.account));
	}
}
