import { config } from "../config";
import type { CoordinatorState } from "./state";
import { logger } from "./loggers";
import { saveTimelineToCache } from "./cache";

export function launchBackgroundPollers(state: CoordinatorState): void {
	state.userDataPoller.start();

	if (state.cacheUpdater) {
		logger.trace(`cacheUpdater already exists, not starting another one`);
	} else {
		state.cacheUpdater = setInterval(
			async () => await saveTimelineToCache(state),
			config.posts.saveChangesIntervalSeconds * 1000,
		);
	}
}
