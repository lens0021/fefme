import type Post from "../../api/objects/post";
import { ScoreName } from "../../enums";
import PostScorer from "../post_scorer";

/**
 * Factory for creating simple property accessor scorer classes.
 * These scorers return a single numeric property value from the post.
 * @memberof module:post_scorers
 */
const createPropertyScorerClass = (
	scoreName: ScoreName,
	description: string,
	accessor: (post: Post) => number | undefined | null,
) => {
	return class extends PostScorer {
		description = description;

		constructor() {
			super(scoreName);
		}

		async _score(post: Post) {
			return accessor(post) || 0;
		}
	};
};

// Property accessor scorer classes
export default class NumFavouritesScorer extends createPropertyScorerClass(
	ScoreName.NUM_FAVOURITES,
	"Favour posts favourited by your server's users",
	(post) => post.realToot.favouritesCount,
) {}

export class NumRepliesScorer extends createPropertyScorerClass(
	ScoreName.NUM_REPLIES,
	"Favour posts with lots of replies",
	(post) => post.realToot.repliesCount,
) {}

export class NumBoostsScorer extends createPropertyScorerClass(
	ScoreName.NUM_BOOSTS,
	"Favour posts that are reposted a lot",
	(post) => post.realToot.reblogsCount,
) {}

export class ImageAttachmentScorer extends createPropertyScorerClass(
	ScoreName.IMAGE_ATTACHMENTS,
	"Favour posts with images",
	(post) => post.realToot.imageAttachments.length,
) {}

export class VideoAttachmentScorer extends createPropertyScorerClass(
	ScoreName.VIDEO_ATTACHMENTS,
	"Favour video attachments",
	(post) => post.realToot.videoAttachments.length,
) {}

export class TrendingPostScorer extends createPropertyScorerClass(
	ScoreName.TRENDING_POSTS,
	"Favour posts that are trending in the Fediverse",
	(post) => post.realToot.trendingRank,
) {}
