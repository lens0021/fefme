import { describe, expect, it, vi } from "vitest";

import {
	CoordinatorStorageKey,
	BooleanFilterName,
	CacheKey,
	TypeFilterName,
} from "@/core/enums";
import { buildNewFilterSettings } from "@/core/filters/feed_filters";
import Storage from "@/core/Storage";
import { loadCachedData } from "@/core/coordinator/cache";
import { CoordinatorState } from "@/core/coordinator/state";

vi.mock("../../Storage", () => ({
	default: {
		get: vi.fn(),
		getCoerced: vi.fn(),
		getFilters: vi.fn(),
		set: vi.fn(),
		remove: vi.fn(),
	},
}));

vi.mock("../../filters/feed_filters", async () => {
	const actual = await vi.importActual<
		typeof import("../../filters/feed_filters")
	>("../../filters/feed_filters");
	return {
		...actual,
		updateBooleanFilterOptions: vi.fn(async () => {}),
	};
});

vi.mock("../filters", () => ({
	filterFeedAndSetInApp: vi.fn((state) => {
		state.filteredTimeline = state.feed;
		state.setTimelineInApp(state.filteredTimeline);
		return state.filteredTimeline;
	}),
}));

describe("loadCachedData", () => {
	it("ignores visible timeline cache when seen is excluded", async () => {
		const visibleTimeline = [{ uri: "visible-1" }];
		const feedTimeline = [{ uri: "feed-1" }];
		const filters = buildNewFilterSettings();
		filters.booleanFilters[BooleanFilterName.TYPE].excludedOptions = [
			TypeFilterName.SEEN,
		];

		vi.mocked(Storage.get).mockResolvedValue(null);
		vi.mocked(Storage.getCoerced).mockImplementation(async (key) => {
			switch (key) {
				case CoordinatorStorageKey.VISIBLE_TIMELINE_POSTS:
					return visibleTimeline;
				case CoordinatorStorageKey.NEXT_VISIBLE_TIMELINE_POSTS:
					return [];
				case CacheKey.HOME_TIMELINE_POSTS:
					return [];
				case CoordinatorStorageKey.TIMELINE_POSTS:
					return feedTimeline;
				default:
					return [];
			}
		});
		vi.mocked(Storage.getFilters).mockResolvedValue(filters);

		const setTimelineInApp = vi.fn();
		const state = new CoordinatorState(setTimelineInApp);

		await loadCachedData(state, true);

		expect(setTimelineInApp).toHaveBeenCalledWith(feedTimeline);
		expect(setTimelineInApp).not.toHaveBeenCalledWith(visibleTimeline);
	});

	it("promotes pending timeline when visible cache is stale", async () => {
		const visibleTimeline = [{ uri: "visible-1" }];
		const pendingTimeline = [{ uri: "pending-1" }];
		const feedTimeline = [{ uri: "feed-1" }];

		vi.mocked(Storage.get).mockResolvedValue(1);
		vi.mocked(Storage.getCoerced).mockImplementation(async (key) => {
			switch (key) {
				case CoordinatorStorageKey.VISIBLE_TIMELINE_POSTS:
					return visibleTimeline;
				case CoordinatorStorageKey.NEXT_VISIBLE_TIMELINE_POSTS:
					return pendingTimeline;
				case CacheKey.HOME_TIMELINE_POSTS:
					return [];
				case CoordinatorStorageKey.TIMELINE_POSTS:
					return feedTimeline;
				default:
					return [];
			}
		});
		vi.mocked(Storage.getFilters).mockResolvedValue(buildNewFilterSettings());

		const setTimelineInApp = vi.fn();
		const state = new CoordinatorState(setTimelineInApp);

		await loadCachedData(state, true);

		expect(setTimelineInApp).toHaveBeenCalledWith(pendingTimeline);
		expect(Storage.set).toHaveBeenCalledWith(
			CoordinatorStorageKey.VISIBLE_TIMELINE_POSTS,
			pendingTimeline,
		);
		expect(Storage.remove).toHaveBeenCalledWith(
			CoordinatorStorageKey.NEXT_VISIBLE_TIMELINE_POSTS,
		);
		expect(Storage.remove).toHaveBeenCalledWith(
			CoordinatorStorageKey.VISIBLE_TIMELINE_STALE,
		);
	});
});
