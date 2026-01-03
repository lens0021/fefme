import Storage from "../Storage";
import type Toot from "../api/objects/toot";
import type { FeedFilterSettings } from "../types";
import { logger } from "./loggers";
import type { AlgorithmState } from "./state";

export function filterFeedAndSetInApp(state: AlgorithmState): Toot[] {
	state.filteredTimeline = state.feed.filter((toot) =>
		toot.isInTimeline(state.filters),
	);

	logger.debug(
		`Filtered ${state.feed.length} toots → ${state.filteredTimeline.length} visible`,
	);

	state.setTimelineInApp(state.filteredTimeline);

	if (!state.hasProvidedAnyTootsToClient && state.feed.length > 0) {
		state.hasProvidedAnyTootsToClient = true;
		logger.logTelemetry(
			`First ${state.filteredTimeline.length} toots sent to client`,
			state.loadStartedAt,
		);
	}

	return state.filteredTimeline;
}

export function updateFilters(
	state: AlgorithmState,
	newFilters: FeedFilterSettings,
): Toot[] {
	logger.info(`updateFilters() called with newFilters:`, newFilters);
	state.filters = newFilters;
	Storage.setFilters(newFilters);
	return filterFeedAndSetInApp(state);
}
