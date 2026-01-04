import Storage from "../Storage";
import { CoordinatorStorageKey } from "../enums";
import { truncateToLength } from "../helpers/collection_helpers";
import Scorer from "../scorer/scorer";
import ScorerCache from "../scorer/scorer_cache";
import { config } from "../config";
import type Post from "../api/objects/post";
import { filterFeedAndSetInApp } from "./filters";
import { logger } from "./loggers";
import type { CoordinatorState } from "./state";

export async function scoreAndFilterFeed(
	state: CoordinatorState,
): Promise<Post[]> {
	state.feed = await Scorer.scorePosts(state.feed, true);

	state.feed = truncateToLength(
		state.feed,
		config.posts.maxTimelineLength,
		logger.tempLogger("scoreAndFilterFeed()"),
	);

	await Storage.set(CoordinatorStorageKey.TIMELINE_POSTS, state.feed);
	return filterFeedAndSetInApp(state);
}

export async function recomputeScores(state: CoordinatorState): Promise<void> {
	await ScorerCache.prepareScorers(true);
	await scoreAndFilterFeed(state);
}
