import Storage from "../Storage";
import type Toot from "../api/objects/toot";
import { config } from "../config";
import {
	AlgorithmStorageKey,
	CacheKey,
	FediverseCacheKey,
	STORAGE_KEYS_WITH_TOOTS,
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
	let visibleTimeline = await Storage.getCoerced<Toot>(
		AlgorithmStorageKey.VISIBLE_TIMELINE_TOOTS,
	);
	const nextVisibleTimeline = await Storage.getCoerced<Toot>(
		AlgorithmStorageKey.NEXT_VISIBLE_TIMELINE_TOOTS,
	);
	if (nextVisibleTimeline.length > 0) {
		visibleTimeline = nextVisibleTimeline;
		await Storage.set(
			AlgorithmStorageKey.VISIBLE_TIMELINE_TOOTS,
			nextVisibleTimeline,
		);
		await Storage.remove(AlgorithmStorageKey.NEXT_VISIBLE_TIMELINE_TOOTS);
	}

	state.homeFeed = await Storage.getCoerced<Toot>(CacheKey.HOME_TIMELINE_TOOTS);
	state.feed = await Storage.getCoerced<Toot>(
		AlgorithmStorageKey.TIMELINE_TOOTS,
	);
	state.trendingData = EMPTY_TRENDING_DATA;

	if (state.feed.length === config.toots.maxTimelineLength) {
		const numToClear =
			config.toots.maxTimelineLength - config.toots.truncateFullTimelineToLength;
		loadCacheLogger.info(
			`Timeline cache is full (${state.feed.length}), discarding ${numToClear} old toots`,
		);
		state.feed = truncateToLength(
			state.feed,
			config.toots.truncateFullTimelineToLength,
			loadCacheLogger,
		);
		await Storage.set(AlgorithmStorageKey.TIMELINE_TOOTS, state.feed);
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
				`Loaded ${state.feed.length} cached toots (${state.filteredTimeline.length} from visible cache)`,
			);
		} else {
			if (shouldSetInApp) {
				filterFeedAndSetInApp(state);
			} else {
				state.filteredTimeline = state.feed.filter((toot) =>
					toot.isInTimeline(state.filters),
				);
			}
			loadCacheLogger.debug(
				`Loaded ${state.feed.length} cached toots (${state.filteredTimeline.length} after filtering)`,
			);
		}
	} else if (visibleTimeline.length > 0) {
		state.filteredTimeline = visibleTimeline;
		if (shouldSetInApp) {
			state.setTimelineInApp(state.filteredTimeline);
		}
		loadCacheLogger.debug(
			`Loaded visible timeline cache (${state.filteredTimeline.length} toots) without feed cache`,
		);
	} else {
		loadCacheLogger.debug("No cached toots found");
	}
}

export async function saveTimelineToCache(
	state: AlgorithmState,
): Promise<void> {
	const newTotalNumTimesShown = state.feed.reduce(
		(sum, toot) => sum + (toot.numTimesShown ?? 0),
		0,
	);
	if (
		state.loadingMutex.isLocked() ||
		state.totalNumTimesShown === newTotalNumTimesShown
	)
		return;

	try {
		const numShownToots = state.feed.filter((toot) => toot.numTimesShown).length;
		const msg =
			`Saving ${state.feed.length} toots with ${newTotalNumTimesShown} times shown` +
			` on ${numShownToots} toots (previous totalNumTimesShown: ${state.totalNumTimesShown})`;
		saveTimelineToCacheLogger.debug(msg);
		await Storage.set(AlgorithmStorageKey.TIMELINE_TOOTS, state.feed);
		state.totalNumTimesShown = newTotalNumTimesShown;
	} catch (error) {
		saveTimelineToCacheLogger.error(`Error saving toots:`, error);
	}
}

export async function resetSeenState(state: AlgorithmState): Promise<void> {
	const resetToot = (toot: Toot) => {
		toot.withRetoot.forEach((item) => {
			item.numTimesShown = 0;
		});
	};

	state.feed.forEach(resetToot);
	state.homeFeed.forEach(resetToot);
	state.trendingData?.toots?.forEach(resetToot);

	state.totalNumTimesShown = 0;

	await Storage.set(AlgorithmStorageKey.TIMELINE_TOOTS, state.feed);
	if (state.homeFeed.length) {
		await Storage.set(CacheKey.HOME_TIMELINE_TOOTS, state.homeFeed);
	}
	if (state.trendingData?.toots?.length) {
		await Storage.set(
			FediverseCacheKey.TRENDING_TOOTS,
			state.trendingData.toots,
		);
	}
	for (const key of STORAGE_KEYS_WITH_TOOTS) {
		if (
			key === AlgorithmStorageKey.TIMELINE_TOOTS ||
			key === CacheKey.HOME_TIMELINE_TOOTS ||
			key === FediverseCacheKey.TRENDING_TOOTS
		)
			continue;
		const cached = (await Storage.get(key)) as Toot[] | null;
		if (!Array.isArray(cached) || cached.length === 0) continue;
		cached.forEach(resetToot);
		await Storage.set(key, cached);
	}

	await updateBooleanFilterOptions(state.filters, state.feed);
	await scoreAndFilterFeed(state);
}
