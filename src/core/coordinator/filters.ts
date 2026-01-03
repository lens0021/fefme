import Storage from "../Storage";
import type Post from "../api/objects/post";
import type { FeedFilterSettings } from "../types";
import { logger } from "./loggers";
import type { AlgorithmState } from "./state";

export function filterFeedAndSetInApp(state: AlgorithmState): Post[] {
	state.filteredTimeline = state.feed.filter((post) =>
		post.isInTimeline(state.filters),
	);

	logger.debug(
		`Filtered ${state.feed.length} posts → ${state.filteredTimeline.length} visible`,
	);

	state.setTimelineInApp(state.filteredTimeline);

	if (!state.hasProvidedAnyPostsToClient && state.feed.length > 0) {
		state.hasProvidedAnyPostsToClient = true;
		logger.logTelemetry(
			`First ${state.filteredTimeline.length} posts sent to client`,
			state.loadStartedAt,
		);
	}

	return state.filteredTimeline;
}

export function updateFilters(
	state: AlgorithmState,
	newFilters: FeedFilterSettings,
): Post[] {
	logger.info(`updateFilters() called with newFilters:`, newFilters);
	state.filters = newFilters;
	Storage.setFilters(newFilters);
	return filterFeedAndSetInApp(state);
}
