import MastoApi from "../../api/api";
import Account from "../../api/objects/account";
import type Post from "../../api/objects/post";
import { ScoreName } from "../../enums";
import type { StringNumberDict } from "../../types";
import PostScorer from "../post_scorer";

/**
 * Score how many accounts that the user follows are mentioned in the post.
 * @memberof module:post_scorers
 * @augments Scorer
 */
export default class MentionsFollowedScorer extends PostScorer {
	description = "Favour posts that mention accounts you follow";

	constructor() {
		super(ScoreName.MENTIONS_FOLLOWED);
	}

	// Build simple dictionary of followed accounts (key is webfingerURI, value is 1)
	async prepareScoreData(): Promise<StringNumberDict> {
		// TODO: this is duplicative of the followedAccounts prop in UserData (wastes some memory, but not much)
		return Account.countAccounts(await MastoApi.instance.getFollowedAccounts());
	}

	// Post.repair() already made StatusMention.acct fields equivalent to Account.webfingerURI
	async _score(post: Post) {
		return post.realToot.mentions.filter((m) => m.acct in this.scoreData)
			.length;
	}
}
