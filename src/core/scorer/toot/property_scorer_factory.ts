import type Toot from "../../api/objects/toot";
import { ScoreName } from "../../enums";
import TootScorer from "../toot_scorer";

/**
 * Factory for creating simple property accessor scorer classes.
 * These scorers return a single numeric property value from the toot.
 * @memberof module:toot_scorers
 */
const createPropertyScorerClass = (
	scoreName: ScoreName,
	description: string,
	accessor: (toot: Toot) => number | undefined | null,
) => {
	return class extends TootScorer {
		description = description;

		constructor() {
			super(scoreName);
		}

		async _score(toot: Toot) {
			return accessor(toot) || 0;
		}
	};
};

// Property accessor scorer classes
export default class NumFavouritesScorer extends createPropertyScorerClass(
	ScoreName.NUM_FAVOURITES,
	"Favour posts favourited by your server's users",
	(toot) => toot.realToot.favouritesCount,
) {}

export class NumRepliesScorer extends createPropertyScorerClass(
	ScoreName.NUM_REPLIES,
	"Favour posts with lots of replies",
	(toot) => toot.realToot.repliesCount,
) {}

export class NumRetootsScorer extends createPropertyScorerClass(
	ScoreName.NUM_RETOOTS,
	"Favour posts that are reposted a lot",
	(toot) => toot.realToot.reblogsCount,
) {}

export class ImageAttachmentScorer extends createPropertyScorerClass(
	ScoreName.IMAGE_ATTACHMENTS,
	"Favour posts with images",
	(toot) => toot.realToot.imageAttachments.length,
) {}

export class VideoAttachmentScorer extends createPropertyScorerClass(
	ScoreName.VIDEO_ATTACHMENTS,
	"Favour video attachments",
	(toot) => toot.realToot.videoAttachments.length,
) {}

export class TrendingTootScorer extends createPropertyScorerClass(
	ScoreName.TRENDING_TOOTS,
	"Favour posts that are trending in the Fediverse",
	(toot) => toot.realToot.trendingRank,
) {}
