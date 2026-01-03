import { earliestTootedAt, mostRecentTootedAt } from "../api/objects/toot";
import { computeMinMax } from "../helpers/collection_helpers";
import { AgeIn, timeString, toISOFormatIfExists } from "../helpers/time_helpers";
import { logger } from "./loggers";
import type { AlgorithmState } from "./state";
import type { TootSource } from "../types";
import { getSourceStats, type SourceStats } from "./source_stats";

export function mostRecentHomeTootAt(state: AlgorithmState): Date | null {
	if (state.homeFeed.length === 0 && state.numTriggers > 1) {
		logger.warn(
			`mostRecentHomeTootAt() homeFeed is empty, falling back to full feed`,
		);
		return mostRecentTootedAt(state.feed);
	}

	return mostRecentTootedAt(state.homeFeed);
}

export function mostRecentHomeTootAgeInSeconds(
	state: AlgorithmState,
): number | null {
	const mostRecentAt = mostRecentHomeTootAt(state);
	if (!mostRecentAt) return null;
	logger.trace(
		`feed is ${AgeIn.minutes(mostRecentAt).toFixed(2)} min old, most recent home toot: ${timeString(mostRecentAt)}`,
	);
	return AgeIn.seconds(mostRecentAt);
}

export function getDataStats(state: AlgorithmState): {
	feedTotal: number;
	homeFeedTotal: number;
	unseenTotal: number;
	oldestCachedTime: Date | null;
	mostRecentCachedTime: Date | null;
	sourceStats: Record<TootSource, SourceStats>;
} {
	const unseenTotal = state.feed.reduce(
		(sum, toot) => sum + ((toot.numTimesShown ?? 0) > 0 ? 0 : 1),
		0,
	);

	let oldestCachedTime: Date | null = null;
	let mostRecentCachedTime: Date | null = null;

	if (state.feed.length > 0) {
		const dates = state.feed.map((toot) => new Date(toot.createdAt));
		mostRecentCachedTime = dates.reduce((latest, current) =>
			current > latest ? current : latest,
		);
		oldestCachedTime = dates.reduce((earliest, current) =>
			current < earliest ? current : earliest,
		);
	}

	return {
		feedTotal: state.feed.length,
		homeFeedTotal: state.homeFeed.length,
		unseenTotal,
		oldestCachedTime,
		mostRecentCachedTime,
		sourceStats: getSourceStats(state),
	};
}

export function statusDict(state: AlgorithmState): Record<string, unknown> {
	const mostRecentTootAt = mostRecentHomeTootAt(state);
	const oldestTootAt = earliestTootedAt(state.homeFeed);
	let numHoursInHomeFeed: number | null = null;

	if (mostRecentTootAt && oldestTootAt) {
		numHoursInHomeFeed = AgeIn.hours(oldestTootAt, mostRecentTootAt);
	}

	return {
		feedNumToots: state.feed.length,
		homeFeedNumToots: state.homeFeed.length,
		homeFeedMostRecentAt: toISOFormatIfExists(mostRecentTootAt),
		homeFeedOldestAt: toISOFormatIfExists(oldestTootAt),
		homeFeedTimespanHours: numHoursInHomeFeed
			? Number(numHoursInHomeFeed.toPrecision(2))
			: null,
		isLoading: state.loadingMutex.isLocked(),
		loadingStatus: state.loadingStatus,
		loadStartedAt: toISOFormatIfExists(state.loadStartedAt),
		minMaxScores: computeMinMax(state.feed, (toot) => toot.score),
	};
}
