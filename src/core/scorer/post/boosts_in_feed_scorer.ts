import type Post from "../../api/objects/post";
import { ScoreName } from "../../enums";
import PostScorer from "../post_scorer";

/**
 * Score how many times a {@linkcode Post} has been boosted by other accounts in the feed.
 * @memberof module:post_scorers
 * @augments Scorer
 */
export default class BoostsInFeedScorer extends PostScorer {
	description = "Favour posts reposted by accounts you follow";

	constructor() {
		super(ScoreName.BOOSTED_IN_FEED);
	}

	async _score(post: Post) {
		if (!post.reblog) return 0;

		// add 1 if both reblog & post are followed accounts
		const reblog = post.reblog;
		let boostCount = reblog.account.isFollowed ? 1 : 0;
		// Guard against missing reblogsBy (can be undefined for incomplete posts)
		const reblogsBy = reblog.reblogsBy ?? [];
		const nonAuthorBoosts = reblogsBy.filter(
			(account) => account.webfingerURI != reblog.account.webfingerURI,
		);
		boostCount += nonAuthorBoosts.length;

		// If boostsCount is 1 that's a normal boost so we score it zero, otherwise return the square of boostCount
		return boostCount <= 1 ? 0 : Math.pow(boostCount, 2);
	}
}
