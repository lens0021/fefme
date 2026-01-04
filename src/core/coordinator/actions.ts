import { config } from "../config";
import { LoadAction } from "../enums";
import { lockExecution } from "../helpers/mutex_helpers";
import { isQuickMode } from "../helpers/environment_helpers";
import ScorerCache from "../scorer/scorer_cache";
import { loggers, logger } from "./loggers";
import type { CoordinatorState } from "./state";
import {
	mostRecentHomeTootAt,
	mostRecentHomeTootAgeInSeconds,
	statusDict as buildStatusDict,
} from "./stats";
import { filterFeedAndSetInApp } from "./filters";

export async function startAction(
	state: CoordinatorState,
	logPrefix: LoadAction,
): Promise<void> {
	const hereLogger = loggers[logPrefix];
	const status = config.locale.messages[logPrefix];
	hereLogger.debugWithTraceObjs(`called`, buildStatusDict(state));

	if (state.loadingMutex.isLocked()) {
		hereLogger.warn(`Load in progress already!`, buildStatusDict(state));
		throw new Error(config.locale.messages.isBusy);
	}

	state.currentAction = logPrefix;
	state.deferTimelineUpdates = logPrefix === LoadAction.FEED_UPDATE;
	state.deferredTimeline = null;
	state.loadStartedAt = new Date();
	state.releaseLoadingMutex = await lockExecution(state.loadingMutex, logger);
	state.loadingStatus =
		typeof status === "string"
			? status
			: status(state.feed, mostRecentHomeTootAt(state));
}

export function releaseLoadingMutex(
	state: CoordinatorState,
	logPrefix: LoadAction,
): void {
	state.loadingStatus = null;
	state.currentAction = undefined;
	state.deferTimelineUpdates = false;
	state.deferredTimeline = null;

	if (state.releaseLoadingMutex) {
		loggers[logPrefix].info(`Finished, releasing mutex...`);
		state.releaseLoadingMutex();
	} else {
		loggers[logPrefix].warn(
			`releaseLoadingMutex() called but no mutex to release!`,
		);
	}
}

export function shouldSkip(state: CoordinatorState): boolean {
	const hereLogger = loggers[LoadAction.FEED_UPDATE];
	hereLogger.debugWithTraceObjs(
		`${++state.numTriggers} triggers so far, state:`,
		buildStatusDict(state),
	);
	let feedAgeInMinutes = mostRecentHomeTootAgeInSeconds(state);
	if (feedAgeInMinutes) feedAgeInMinutes /= 60;
	const maxAgeMinutes = config.minTrendingMinutesUntilStale();

	if (
		isQuickMode &&
		feedAgeInMinutes &&
		feedAgeInMinutes < maxAgeMinutes &&
		state.numTriggers <= 1
	) {
		hereLogger.debug(
			`isQuickMode=${isQuickMode}, feed's ${feedAgeInMinutes.toFixed(0)}s old, skipping`,
		);
		ScorerCache.prepareScorers().then(() => {
			filterFeedAndSetInApp(state);
		});
		return true;
	}

	return false;
}
