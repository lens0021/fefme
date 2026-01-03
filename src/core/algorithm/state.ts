import { Mutex } from "async-mutex";

import { config } from "../config";
import { LoadAction, LogAction, NonScoreWeightName } from "../enums";
import { buildNewFilterSettings } from "../filters/feed_filters";
import UserDataPoller from "../api/user_data_poller";
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
import type {
	ConcurrencyLockRelease,
	FeedFilterSettings,
	TrendingData,
	WeightInfoDict,
} from "../types";
import type Toot from "../api/objects/toot";
import { EMPTY_TRENDING_DATA } from "./constants";

export class AlgorithmState {
	filters: FeedFilterSettings = buildNewFilterSettings();
	lastLoadTimeInSeconds?: number;
	loadingStatus: string | null =
		config.locale.messages[LogAction.INITIAL_LOADING_STATUS];
	trendingData: TrendingData = EMPTY_TRENDING_DATA;

	feed: Toot[] = [];
	filteredTimeline: Toot[] = [];
	homeFeed: Toot[] = [];
	hasProvidedAnyTootsToClient = false;
	loadStartedAt: Date | undefined = new Date();
	totalNumTimesShown = 0;

	loadingMutex = new Mutex();
	mergeMutex = new Mutex();
	numUnscannedToots = 0;
	numTriggers = 0;
	currentAction?: LoadAction;
	releaseLoadingMutex?: ConcurrencyLockRelease;

	cacheUpdater?: ReturnType<typeof setInterval>;
	userDataPoller = new UserDataPoller();

	feedScorers: FeedScorer[] = [new DiversityFeedScorer()];
	tootScorers: TootScorer[] = [
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

	weightedScorers: Scorer[] = [
		...this.tootScorers,
		...this.feedScorers,
	];

	weightsInfo: WeightInfoDict = this.weightedScorers.reduce(
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

	constructor(public setTimelineInApp: (feed: Toot[]) => void) {}
}
