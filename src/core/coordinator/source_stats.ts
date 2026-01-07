import type Post from "../api/objects/post";
import {
	CacheKey,
	FEDERATED_TIMELINE_SOURCE,
	TagPostsCategory,
} from "../enums";
import { findMinMaxId } from "../helpers/collection_helpers";
import type { CoordinatorState } from "./state";
import type { PostSource } from "../types";

export type SourceStats = {
	source: PostSource;
	total: number;
	oldestCreatedAt: Date | null;
	mostRecentCreatedAt: Date | null;
	oldestId: string | null;
	oldestIdCreatedAt: Date | null;
};

export function getSourceBounds(
	state: CoordinatorState,
	source: PostSource,
): { minId?: string; maxId?: string } {
	const sourcePosts = getPostsForSource(state, source);
	const minMaxId = findMinMaxId(sourcePosts);
	if (!minMaxId) return {};
	return { minId: minMaxId.min, maxId: minMaxId.max };
}

export function getSourceStats(
	state: CoordinatorState,
): Record<PostSource, SourceStats> {
	const sourcesToTrack: PostSource[] = [
		CacheKey.HOME_TIMELINE_POSTS,
		FEDERATED_TIMELINE_SOURCE,
		TagPostsCategory.FAVOURITED,
	];

	return sourcesToTrack.reduce(
		(stats, source) => {
			stats[source] = buildSourceStats(state, source);
			return stats;
		},
		{} as Record<PostSource, SourceStats>,
	);
}

function getPostsForSource(
	state: CoordinatorState,
	source: PostSource,
): Post[] {
	if (source === CacheKey.HOME_TIMELINE_POSTS) {
		return state.homeFeed;
	}
	return state.feed.filter((post) => post.sources?.includes(source));
}

function buildSourceStats(
	state: CoordinatorState,
	source: PostSource,
): SourceStats {
	const sourcePosts = getPostsForSource(state, source);
	const total = sourcePosts.length;
	let oldestCreatedAt: Date | null = null;
	let mostRecentCreatedAt: Date | null = null;
	let oldestId: string | null = null;
	let oldestIdCreatedAt: Date | null = null;

	if (total > 0) {
		const dates = sourcePosts.map((post) => new Date(post.createdAt));
		mostRecentCreatedAt = dates.reduce((latest, current) =>
			current > latest ? current : latest,
		);
		oldestCreatedAt = dates.reduce((earliest, current) =>
			current < earliest ? current : earliest,
		);

		const bounds = getSourceBounds(state, source);
		oldestId = bounds.minId ?? null;
		if (oldestId) {
			const oldestById = sourcePosts.find(
				(post) => `${post.id}` === `${oldestId}`,
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
