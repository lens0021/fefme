import type Toot from "../api/objects/toot";
import { earliestTootedAt, mostRecentTootedAt } from "../api/objects/toot";
import { CacheKey, FEDERATED_TIMELINE_SOURCE, TagTootsCategory } from "../enums";
import { findMinMaxId, computeMinMax } from "../helpers/collection_helpers";
import { AgeIn, timeString, toISOFormatIfExists } from "../helpers/time_helpers";
import { logger } from "./loggers";
import type { AlgorithmState } from "./state";
import type { TootSource } from "../types";

export type SourceStats = {
	source: TootSource;
	total: number;
	oldestCreatedAt: Date | null;
	mostRecentCreatedAt: Date | null;
	oldestId: string | null;
	oldestIdCreatedAt: Date | null;
};

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

export function getSourceBounds(
	state: AlgorithmState,
	source: TootSource,
): { minId?: string; maxId?: string } {
	const sourceToots = getTootsForSource(state, source);
	const minMaxId = findMinMaxId(sourceToots);
	if (!minMaxId) return {};
	return { minId: minMaxId.min, maxId: minMaxId.max };
}

export function getSourceStats(
	state: AlgorithmState,
): Record<TootSource, SourceStats> {
	const sourcesToTrack: TootSource[] = [
		CacheKey.HOME_TIMELINE_TOOTS,
		FEDERATED_TIMELINE_SOURCE,
		TagTootsCategory.FAVOURITED,
		TagTootsCategory.PARTICIPATED,
	];

	return sourcesToTrack.reduce(
		(stats, source) => {
			stats[source] = buildSourceStats(state, source);
			return stats;
		},
		{} as Record<TootSource, SourceStats>,
	);
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

function getTootsForSource(state: AlgorithmState, source: TootSource): Toot[] {
	if (source === CacheKey.HOME_TIMELINE_TOOTS) {
		return state.homeFeed;
	}
	return state.feed.filter((toot) => toot.sources?.includes(source));
}

function buildSourceStats(state: AlgorithmState, source: TootSource): SourceStats {
	const sourceToots = getTootsForSource(state, source);
	const total = sourceToots.length;
	let oldestCreatedAt: Date | null = null;
	let mostRecentCreatedAt: Date | null = null;
	let oldestId: string | null = null;
	let oldestIdCreatedAt: Date | null = null;

	if (total > 0) {
		const dates = sourceToots.map((toot) => new Date(toot.createdAt));
		mostRecentCreatedAt = dates.reduce((latest, current) =>
			current > latest ? current : latest,
		);
		oldestCreatedAt = dates.reduce((earliest, current) =>
			current < earliest ? current : earliest,
		);

		const bounds = getSourceBounds(state, source);
		oldestId = bounds.minId ?? null;
		if (oldestId) {
			const oldestById = sourceToots.find(
				(toot) => `${toot.id}` === `${oldestId}`,
			);
			oldestIdCreatedAt = oldestById ? new Date(oldestById.createdAt) : null;
		}
	}

	return {
		source,
		total,
		oldestCreatedAt,
		mostRecentCreatedAt,
		oldestId,
		oldestIdCreatedAt,
	};
}
