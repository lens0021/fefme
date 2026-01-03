import { config } from "../config";
import { NonScoreWeightName } from "../enums";
import DiversityFeedScorer from "../scorer/feed/diversity_feed_scorer";
import type FeedScorer from "../scorer/feed_scorer";
import Scorer from "../scorer/scorer";
import AlreadyShownScorer from "../scorer/toot/already_shown_scorer";
import AuthorFollowersScorer from "../scorer/toot/author_followers_scorer";
import ChaosScorer from "../scorer/toot/chaos_scorer";
import FollowedAccountsScorer from "../scorer/toot/followed_accounts_scorer";
import FollowedTagsScorer from "../scorer/toot/followed_tags_scorer";
import FollowersScorer from "../scorer/toot/followers_scorer";
import InteractionsScorer from "../scorer/toot/interactions_scorer";
import MentionsFollowedScorer from "../scorer/toot/mentions_followed_scorer";
import MostFavouritedAccountsScorer from "../scorer/toot/most_favourited_accounts_scorer";
import MostRepliedAccountsScorer from "../scorer/toot/most_replied_accounts_scorer";
import MostRetootedAccountsScorer from "../scorer/toot/most_retooted_accounts_scorer";
import NumFavouritesScorer, {
	ImageAttachmentScorer,
	NumRepliesScorer,
	NumRetootsScorer,
	TrendingTootScorer,
	VideoAttachmentScorer,
} from "../scorer/toot/property_scorer_factory";
import RetootsInFeedScorer from "../scorer/toot/retoots_in_feed_scorer";
import FavouritedTagsScorer, {
	HashtagParticipationScorer,
} from "../scorer/toot/tag_scorer_factory";
import TrendingTagsScorer from "../scorer/toot/trending_tags_scorer";
import type TootScorer from "../scorer/toot_scorer";
import type { WeightInfoDict } from "../types";

export type ScorerBundle = {
	feedScorers: FeedScorer[];
	tootScorers: TootScorer[];
	weightedScorers: Scorer[];
	weightsInfo: WeightInfoDict;
};

export function buildScorerBundle(): ScorerBundle {
	const feedScorers: FeedScorer[] = [new DiversityFeedScorer()];
	const tootScorers: TootScorer[] = [
		new AlreadyShownScorer(),
		new AuthorFollowersScorer(),
		new ChaosScorer(),
		new FavouritedTagsScorer(),
		new FollowedAccountsScorer(),
		new FollowedTagsScorer(),
		new FollowersScorer(),
		new HashtagParticipationScorer(),
		new ImageAttachmentScorer(),
		new InteractionsScorer(),
		new MentionsFollowedScorer(),
		new MostFavouritedAccountsScorer(),
		new MostRepliedAccountsScorer(),
		new MostRetootedAccountsScorer(),
		new NumFavouritesScorer(),
		new NumRepliesScorer(),
		new NumRetootsScorer(),
		new RetootsInFeedScorer(),
		new TrendingTagsScorer(),
		new TrendingTootScorer(),
		new VideoAttachmentScorer(),
	];

	const weightedScorers: Scorer[] = [...tootScorers, ...feedScorers];

	const weightsInfo: WeightInfoDict = weightedScorers.reduce(
		(scorerInfos, scorer) => {
			scorerInfos[scorer.name] = scorer.getInfo();
			return scorerInfos;
		},
		Object.values(NonScoreWeightName).reduce((nonScoreWeights, weightName) => {
			nonScoreWeights[weightName] = Object.assign(
				{},
				config.scoring.nonScoreWeightsConfig[weightName],
			);
			nonScoreWeights[weightName].minValue =
				config.scoring.nonScoreWeightMinValue;
			return nonScoreWeights;
		}, {} as WeightInfoDict),
	);

	return { feedScorers, tootScorers, weightedScorers, weightsInfo };
}
