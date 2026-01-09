import Storage from "../Storage";
import type Post from "../api/objects/post";
import type { FeedFilterSettings } from "../types";
import { logger } from "./loggers";
import type { CoordinatorState } from "./state";

export function filterFeedAndSetInApp(state: CoordinatorState): Post[] {
	state.filteredTimeline = state.feed.filter((post) =>
		post.isInTimeline(state.filters),
	);

	logger.debug(
		`Filtered ${state.feed.length} posts → ${state.filteredTimeline.length} visible`,
	);

	if (state.deferTimelineUpdates) {
		// Copy array to avoid shared reference mutations
		state.deferredTimeline = [...state.filteredTimeline];
	} else {
		state.setTimelineInApp(state.filteredTimeline);
	}

	if (!state.hasProvidedAnyPostsToClient && state.feed.length > 0) {
		state.hasProvidedAnyPostsToClient = true;
		logger.logTelemetry(
			`First ${state.filteredTimeline.length} posts sent to client`,
			state.loadStartedAt,
		);
	}

	return state.filteredTimeline;
}

export function flushDeferredTimeline(state: CoordinatorState): void {
	if (!state.deferredTimeline) return;
	state.setTimelineInApp(state.deferredTimeline);
	state.deferredTimeline = null;
}

export async function updateFilters(
	state: CoordinatorState,
	newFilters: FeedFilterSettings,
): Promise<Post[]> {
	logger.info(`updateFilters() called with newFilters:`, newFilters);
	state.filters = newFilters;
	await Storage.setFilters(newFilters);
	return filterFeedAndSetInApp(state);
}
