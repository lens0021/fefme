import Storage from "../Storage";
import { AlgorithmStorageKey } from "../enums";
import { truncateToLength } from "../helpers/collection_helpers";
import Scorer from "../scorer/scorer";
import ScorerCache from "../scorer/scorer_cache";
import { config } from "../config";
import type Toot from "../api/objects/toot";
import { filterFeedAndSetInApp } from "./filters";
import { logger } from "./loggers";
import type { AlgorithmState } from "./state";

export async function scoreAndFilterFeed(
	state: AlgorithmState,
): Promise<Toot[]> {
	state.feed = await Scorer.scoreToots(state.feed, true);

	state.feed = truncateToLength(
		state.feed,
		config.toots.maxTimelineLength,
		logger.tempLogger("scoreAndFilterFeed()"),
	);

	await Storage.set(AlgorithmStorageKey.TIMELINE_TOOTS, state.feed);
	return filterFeedAndSetInApp(state);
}

export async function recomputeScores(state: AlgorithmState): Promise<void> {
	await ScorerCache.prepareScorers(true);
	await scoreAndFilterFeed(state);
}
