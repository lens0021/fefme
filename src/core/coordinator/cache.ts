import Storage from "../Storage";
import type Post from "../api/objects/post";
import { config } from "../config";
import {
	AlgorithmStorageKey,
	CacheKey,
	FediverseCacheKey,
	STORAGE_KEYS_WITH_POSTS,
} from "../enums";
import { truncateToLength } from "../helpers/collection_helpers";
import { updateBooleanFilterOptions } from "../filters/feed_filters";
import { EMPTY_TRENDING_DATA } from "./constants";
import { filterFeedAndSetInApp } from "./filters";
import { loadCacheLogger, saveTimelineToCacheLogger } from "./loggers";
import { scoreAndFilterFeed } from "./scoring";
import type { AlgorithmState } from "./state";

export async function loadCachedData(
	state: AlgorithmState,
	shouldSetInApp = true,
): Promise<void> {
	let visibleTimeline = await Storage.getCoerced<Post>(
		AlgorithmStorageKey.VISIBLE_TIMELINE_POSTS,
	);
	const nextVisibleTimeline = await Storage.getCoerced<Post>(
		AlgorithmStorageKey.NEXT_VISIBLE_TIMELINE_POSTS,
	);
	if (nextVisibleTimeline.length > 0) {
		visibleTimeline = nextVisibleTimeline;
		await Storage.set(
			AlgorithmStorageKey.VISIBLE_TIMELINE_POSTS,
			nextVisibleTimeline,
		);
		await Storage.remove(AlgorithmStorageKey.NEXT_VISIBLE_TIMELINE_POSTS);
	}

	state.homeFeed = await Storage.getCoerced<Post>(CacheKey.HOME_TIMELINE_POSTS);
	state.feed = await Storage.getCoerced<Post>(
		AlgorithmStorageKey.TIMELINE_POSTS,
	);
	state.trendingData = EMPTY_TRENDING_DATA;

	if (state.feed.length === config.posts.maxTimelineLength) {
		const numToClear =
			config.posts.maxTimelineLength - config.posts.truncateFullTimelineToLength;
		loadCacheLogger.info(
			`Timeline cache is full (${state.feed.length}), discarding ${numToClear} old posts`,
		);
		state.feed = truncateToLength(
			state.feed,
			config.posts.truncateFullTimelineToLength,
			loadCacheLogger,
		);
		await Storage.set(AlgorithmStorageKey.TIMELINE_POSTS, state.feed);
	}

	state.filters = (await Storage.getFilters()) ?? state.filters;

	if (state.feed.length > 0) {
		await updateBooleanFilterOptions(state.filters, state.feed);
		if (visibleTimeline.length > 0) {
			state.filteredTimeline = visibleTimeline;
			if (shouldSetInApp) {
				state.setTimelineInApp(state.filteredTimeline);
			}
			loadCacheLogger.debug(
				`Loaded ${state.feed.length} cached posts (${state.filteredTimeline.length} from visible cache)`,
			);
		} else {
			if (shouldSetInApp) {
				filterFeedAndSetInApp(state);
			} else {
				state.filteredTimeline = state.feed.filter((post) =>
					post.isInTimeline(state.filters),
				);
			}
			loadCacheLogger.debug(
				`Loaded ${state.feed.length} cached posts (${state.filteredTimeline.length} after filtering)`,
			);
		}
	} else if (visibleTimeline.length > 0) {
		state.filteredTimeline = visibleTimeline;
		if (shouldSetInApp) {
			state.setTimelineInApp(state.filteredTimeline);
		}
		loadCacheLogger.debug(
			`Loaded visible timeline cache (${state.filteredTimeline.length} posts) without feed cache`,
		);
	} else {
		loadCacheLogger.debug("No cached posts found");
	}
}

export async function saveTimelineToCache(
	state: AlgorithmState,
): Promise<void> {
	const newTotalNumTimesShown = state.feed.reduce(
		(sum, post) => sum + (post.numTimesShown ?? 0),
		0,
	);
	if (
		state.loadingMutex.isLocked() ||
		state.totalNumTimesShown === newTotalNumTimesShown
	)
		return;

	try {
		const numShownPosts = state.feed.filter((post) => post.numTimesShown).length;
		const msg =
			`Saving ${state.feed.length} posts with ${newTotalNumTimesShown} times shown` +
			` on ${numShownPosts} posts (previous totalNumTimesShown: ${state.totalNumTimesShown})`;
		saveTimelineToCacheLogger.debug(msg);
		await Storage.set(AlgorithmStorageKey.TIMELINE_POSTS, state.feed);
		state.totalNumTimesShown = newTotalNumTimesShown;
	} catch (error) {
		saveTimelineToCacheLogger.error(`Error saving posts:`, error);
	}
}

export async function resetSeenState(state: AlgorithmState): Promise<void> {
	const resetPost = (post: Post) => {
		post.withBoost.forEach((item) => {
			item.numTimesShown = 0;
		});
	};

	state.feed.forEach(resetPost);
	state.homeFeed.forEach(resetPost);
	state.trendingData?.posts?.forEach(resetPost);

	state.totalNumTimesShown = 0;

	await Storage.set(AlgorithmStorageKey.TIMELINE_POSTS, state.feed);
	if (state.homeFeed.length) {
		await Storage.set(CacheKey.HOME_TIMELINE_POSTS, state.homeFeed);
	}
	if (state.trendingData?.posts?.length) {
		await Storage.set(
			FediverseCacheKey.TRENDING_POSTS,
			state.trendingData.posts,
		);
	}
	for (const key of STORAGE_KEYS_WITH_POSTS) {
		if (
			key === AlgorithmStorageKey.TIMELINE_POSTS ||
			key === CacheKey.HOME_TIMELINE_POSTS ||
			key === FediverseCacheKey.TRENDING_POSTS
		)
			continue;
		const cached = (await Storage.get(key)) as Post[] | null;
		if (!Array.isArray(cached) || cached.length === 0) continue;
		cached.forEach(resetPost);
		await Storage.set(key, cached);
	}

	await updateBooleanFilterOptions(state.filters, state.feed);
	await scoreAndFilterFeed(state);
}
