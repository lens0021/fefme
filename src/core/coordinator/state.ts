import { Mutex } from "async-mutex";

import { config } from "../config";
import { LoadAction, LogAction } from "../enums";
import { buildNewFilterSettings } from "../filters/feed_filters";
import UserDataPoller from "../api/user_data_poller";
import type FeedScorer from "../scorer/feed_scorer";
import Scorer from "../scorer/scorer";
import type PostScorer from "../scorer/post_scorer";
import type {
	ConcurrencyLockRelease,
	FeedFilterSettings,
	TrendingData,
	WeightInfoDict,
} from "../types";
import type Post from "../api/objects/post";
import { EMPTY_TRENDING_DATA } from "./constants";
import { buildScorerBundle } from "./scorers";

export class CoordinatorState {
	filters: FeedFilterSettings = buildNewFilterSettings();
	lastLoadTimeInSeconds?: number;
	loadingStatus: string | null =
		config.locale.messages[LogAction.INITIAL_LOADING_STATUS];
	trendingData: TrendingData = EMPTY_TRENDING_DATA;

	feed: Post[] = [];
	filteredTimeline: Post[] = [];
	homeFeed: Post[] = [];
	hasProvidedAnyPostsToClient = false;
	loadStartedAt: Date | undefined = new Date();
	totalNumTimesShown = 0;

	loadingMutex = new Mutex();
	mergeMutex = new Mutex();
	numUnscannedPosts = 0;
	numTriggers = 0;
	currentAction?: LoadAction;
	releaseLoadingMutex?: ConcurrencyLockRelease;
	deferTimelineUpdates = false;
	deferredTimeline: Post[] | null = null;

	cacheUpdater?: ReturnType<typeof setInterval>;
	userDataPoller = new UserDataPoller();

	feedScorers: FeedScorer[] = [];
	postScorers: PostScorer[] = [];
	weightedScorers: Scorer[] = [];
	weightsInfo: WeightInfoDict = {} as WeightInfoDict;

	constructor(public setTimelineInApp: (feed: Post[]) => void) {
		const scorerBundle = buildScorerBundle();
		this.feedScorers = scorerBundle.feedScorers;
		this.postScorers = scorerBundle.postScorers;
		this.weightedScorers = scorerBundle.weightedScorers;
		this.weightsInfo = scorerBundle.weightsInfo;
	}
}
