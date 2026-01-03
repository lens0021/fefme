import { Mutex } from "async-mutex";

import { config } from "../config";
import { LoadAction, LogAction } from "../enums";
import { buildNewFilterSettings } from "../filters/feed_filters";
import UserDataPoller from "../api/user_data_poller";
import type FeedScorer from "../scorer/feed_scorer";
import Scorer from "../scorer/scorer";
import type TootScorer from "../scorer/toot_scorer";
import type {
	ConcurrencyLockRelease,
	FeedFilterSettings,
	TrendingData,
	WeightInfoDict,
} from "../types";
import type Toot from "../api/objects/toot";
import { EMPTY_TRENDING_DATA } from "./constants";
import { buildScorerBundle } from "./scorers";

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

	feedScorers: FeedScorer[] = [];
	tootScorers: TootScorer[] = [];
	weightedScorers: Scorer[] = [];
	weightsInfo: WeightInfoDict = {} as WeightInfoDict;

	constructor(public setTimelineInApp: (feed: Toot[]) => void) {
		const scorerBundle = buildScorerBundle();
		this.feedScorers = scorerBundle.feedScorers;
		this.tootScorers = scorerBundle.tootScorers;
		this.weightedScorers = scorerBundle.weightedScorers;
		this.weightsInfo = scorerBundle.weightsInfo;
	}
}
