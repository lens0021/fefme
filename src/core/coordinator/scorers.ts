import { config } from "../config";
import { NonScoreWeightName } from "../enums";
import DiversityFeedScorer from "../scorer/feed/diversity_feed_scorer";
import type FeedScorer from "../scorer/feed_scorer";
import Scorer from "../scorer/scorer";
import AlreadyShownScorer from "../scorer/post/already_shown_scorer";
import AuthorFollowersScorer from "../scorer/post/author_followers_scorer";
import ChaosScorer from "../scorer/post/chaos_scorer";
import FollowedAccountsScorer from "../scorer/post/followed_accounts_scorer";
import FollowedTagsScorer from "../scorer/post/followed_tags_scorer";
import FollowersScorer from "../scorer/post/followers_scorer";
import InteractionsScorer from "../scorer/post/interactions_scorer";
import MentionsFollowedScorer from "../scorer/post/mentions_followed_scorer";
import MostFavouritedAccountsScorer from "../scorer/post/most_favourited_accounts_scorer";
import MostRepliedAccountsScorer from "../scorer/post/most_replied_accounts_scorer";
import MostBoostedAccountsScorer from "../scorer/post/most_boosted_accounts_scorer";
import NumFavouritesScorer, {
	ImageAttachmentScorer,
	NumRepliesScorer,
	NumBoostsScorer,
	TrendingPostScorer,
	VideoAttachmentScorer,
} from "../scorer/post/property_scorer_factory";
import BoostsInFeedScorer from "../scorer/post/boosts_in_feed_scorer";
import FavouritedTagsScorer from "../scorer/post/tag_scorer_factory";
import TrendingTagsScorer from "../scorer/post/trending_tags_scorer";
import type PostScorer from "../scorer/post_scorer";
import type { WeightInfoDict } from "../types";

export type ScorerBundle = {
	feedScorers: FeedScorer[];
	postScorers: PostScorer[];
	weightedScorers: Scorer[];
	weightsInfo: WeightInfoDict;
};

export function buildScorerBundle(): ScorerBundle {
	const feedScorers: FeedScorer[] = [new DiversityFeedScorer()];
	const postScorers: PostScorer[] = [
		new AlreadyShownScorer(),
		new AuthorFollowersScorer(),
		new ChaosScorer(),
		new FavouritedTagsScorer(),
		new FollowedAccountsScorer(),
		new FollowedTagsScorer(),
		new FollowersScorer(),
		new ImageAttachmentScorer(),
		new InteractionsScorer(),
		new MentionsFollowedScorer(),
		new MostFavouritedAccountsScorer(),
		new MostRepliedAccountsScorer(),
		new MostBoostedAccountsScorer(),
		new NumFavouritesScorer(),
		new NumRepliesScorer(),
		new NumBoostsScorer(),
		new BoostsInFeedScorer(),
		new TrendingTagsScorer(),
		new TrendingPostScorer(),
		new VideoAttachmentScorer(),
	];

	const weightedScorers: Scorer[] = [...postScorers, ...feedScorers];

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

	return { feedScorers, postScorers, weightedScorers, weightsInfo };
}
