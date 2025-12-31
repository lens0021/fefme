import MastoApi from "../../api/api";
import Account from "../../api/objects/account";
import { ScoreName } from "../../enums";
import type { StringNumberDict } from "../../types";
import AccountScorer from "./acccount_scorer";

/**
 * Gives higher weight to posts from users that have often interacted with your toots.
 * @memberof module:toot_scorers
 * @augments Scorer
 */
export default class InteractionsScorer extends AccountScorer {
	description = "Favour accounts that interact with your toots";

	constructor() {
		super(ScoreName.INTERACTIONS);
	}

	async prepareScoreData(): Promise<StringNumberDict> {
		const notifications = await MastoApi.instance.getNotifications();
		const accounts = notifications.map((notification) =>
			Account.build(notification.account),
		);
		return Account.countAccounts(accounts);
	}
}
