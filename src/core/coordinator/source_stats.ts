import type Toot from "../api/objects/toot";
import { CacheKey, FEDERATED_TIMELINE_SOURCE, TagTootsCategory } from "../enums";
import { findMinMaxId } from "../helpers/collection_helpers";
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
