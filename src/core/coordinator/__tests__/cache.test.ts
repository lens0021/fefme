import { describe, expect, it, vi } from "vitest";

import {
	AlgorithmStorageKey,
	BooleanFilterName,
	CacheKey,
	TypeFilterName,
} from "../../enums";
import { buildNewFilterSettings } from "../../filters/feed_filters";
import Storage from "../../Storage";
import { loadCachedData } from "../cache";
import { AlgorithmState } from "../state";

vi.mock("../../Storage", () => ({
	default: {
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

		vi.mocked(Storage.getCoerced).mockImplementation(async (key) => {
			switch (key) {
				case AlgorithmStorageKey.VISIBLE_TIMELINE_POSTS:
					return visibleTimeline;
				case AlgorithmStorageKey.NEXT_VISIBLE_TIMELINE_POSTS:
					return [];
				case CacheKey.HOME_TIMELINE_POSTS:
					return [];
				case AlgorithmStorageKey.TIMELINE_POSTS:
					return feedTimeline;
				default:
					return [];
			}
		});
		vi.mocked(Storage.getFilters).mockResolvedValue(filters);

		const setTimelineInApp = vi.fn();
		const state = new AlgorithmState(setTimelineInApp);

		await loadCachedData(state, true);

		expect(setTimelineInApp).toHaveBeenCalledWith(feedTimeline);
		expect(setTimelineInApp).not.toHaveBeenCalledWith(visibleTimeline);
	});
});
