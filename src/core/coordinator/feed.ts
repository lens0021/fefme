import type { mastodon } from "masto";

import { config } from "../config";
import { CacheKey, LoadAction, LogAction } from "../enums";
import { updateBooleanFilterOptions } from "../filters/feed_filters";
import { lockExecution } from "../helpers/mutex_helpers";
import { AgeIn, ageString } from "../helpers/time_helpers";
import { Logger } from "../helpers/logger";
import Toot from "../api/objects/toot";
import { throwIfAccessTokenRevoked } from "../api/errors";
import { scoreAndFilterFeed } from "./scoring";
import { loggers, logger } from "./loggers";
import { launchBackgroundPollers } from "./background";
import { mostRecentHomeTootAt } from "./stats";
import type { AlgorithmState } from "./state";

export async function fetchAndMergeToots(
	state: AlgorithmState,
	tootFetcher: Promise<Toot[]>,
	logger: Logger,
): Promise<Toot[]> {
	const startedAt = new Date();
	let newToots: Toot[] = [];

	try {
		newToots = await tootFetcher;
		logger.logTelemetry(
			`Got ${newToots.length} toots for ${CacheKey.HOME_TIMELINE_TOOTS}`,
			startedAt,
		);
	} catch (e) {
		throwIfAccessTokenRevoked(
			logger,
			e,
			`Error fetching toots ${ageString(startedAt)}`,
		);
	}

	await lockedMergeToFeed(state, newToots, logger);
	return newToots;
}

export async function mergeExternalStatuses(
	state: AlgorithmState,
	statuses: mastodon.v1.Status[],
	source: string,
): Promise<void> {
	if (!statuses?.length) return;
	const toots = await Toot.buildToots(statuses, source);
	await lockedMergeToFeed(state, toots, new Logger(source));
}

export async function lockedMergeToFeed(
	state: AlgorithmState,
	newToots: Toot[],
	logger: Logger,
): Promise<void> {
	const hereLogger = logger.tempLogger("lockedMergeToFeed");
	const releaseMutex = await lockExecution(state.mergeMutex, hereLogger);

	try {
		await mergeTootsToFeed(state, newToots, logger);
		hereLogger.trace(`Merged ${newToots.length} newToots, released mutex`);
	} finally {
		releaseMutex();
	}
}

export async function mergeTootsToFeed(
	state: AlgorithmState,
	newToots: Toot[],
	inLogger: Logger,
): Promise<void> {
	const hereLogger = inLogger.tempLogger("mergeTootsToFeed");
	const numTootsBefore = state.feed.length;
	const startedAt = new Date();

	state.feed = Toot.dedupeToots([...state.feed, ...newToots], hereLogger);
	state.numUnscannedToots += newToots.length;

	if (
		state.feed.length < config.toots.minToSkipFilterUpdates ||
		state.numUnscannedToots > config.toots.filterUpdateBatchSize
	) {
		await updateBooleanFilterOptions(state.filters, state.feed);
		state.numUnscannedToots = 0;
	} else {
		logger.trace(
			`Skipping filter update, feed length: ${state.feed.length}, unscanned toots: ${state.numUnscannedToots}`,
		);
	}

	await scoreAndFilterFeed(state);
	if (state.currentAction !== LoadAction.TIMELINE_BACKFILL) {
		const statusMsgFxn = config.locale.messages[LoadAction.FEED_UPDATE];
		state.loadingStatus = statusMsgFxn(state.feed, mostRecentHomeTootAt(state));
	}
	hereLogger.logTelemetry(
		`Merged ${newToots.length} new toots into ${numTootsBefore} timeline toots`,
		startedAt,
	);
}

export async function finishFeedUpdate(state: AlgorithmState): Promise<void> {
	const action = LogAction.FINISH_FEED_UPDATE;
	const hereLogger = loggers[action];
	state.loadingStatus = config.locale.messages[action];

	hereLogger.debug(`${state.loadingStatus}...`);

	await Toot.completeToots(state.feed, hereLogger);
	state.feed = await Toot.removeInvalidToots(state.feed, hereLogger);

	await updateBooleanFilterOptions(state.filters, state.feed, true);
	await scoreAndFilterFeed(state);

	if (state.loadStartedAt) {
		hereLogger.logTelemetry(
			`finished home TL load w/ ${state.feed.length} toots`,
			state.loadStartedAt,
		);
		state.lastLoadTimeInSeconds = AgeIn.seconds(state.loadStartedAt);
	} else {
		hereLogger.warn(`finished but loadStartedAt is null!`);
	}

	state.loadStartedAt = undefined;
	state.loadingStatus = null;
	launchBackgroundPollers(state);
}
