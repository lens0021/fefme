import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { BooleanFilterOptionList } from "../../../../core/api/counted_list";
import BooleanFilter from "../../../../core/filters/boolean_filter";
import { BooleanFilterName } from "../../../../core/enums";
import type { BooleanFilterOption } from "../../../../core/types";

vi.mock("/usr/local/git/lens/fefme/src/core/api/tag_list.ts", () => ({
	default: class TagListMock {
		length = 0;
		static async buildFavouritedTags() {
			return new TagListMock();
		}
		static async buildParticipatedTags() {
			return new TagListMock();
		}
		static fromUsageCounts() {
			return new TagListMock();
		}
		static fromParticipations() {
			return new TagListMock();
		}
	},
}));

let mockAlgorithm: {
	filters: Record<string, unknown>;
	timeline: unknown[];
};
let mockTriggerFilterUpdate: ReturnType<typeof vi.fn>;

vi.mock("../../../../hooks/useAlgorithm", () => ({
	useAlgorithm: () => ({
		algorithm: mockAlgorithm,
		alwaysShowFollowed: false,
		currentUserWebfinger: null,
		selfTypeFilterMode: "none",
		setSelfTypeFilterMode: vi.fn(),
		showFilterHighlights: true,
		triggerFilterUpdate: mockTriggerFilterUpdate,
	}),
}));

function buildLanguageFilter() {
	const filter = new BooleanFilter({ propertyName: BooleanFilterName.LANGUAGE });
	const options: BooleanFilterOption[] = [
		{ name: "en", displayName: "English", numToots: 5 },
		{ name: "fr", displayName: "French", numToots: 3 },
	];
	filter.options = new BooleanFilterOptionList(options, filter.propertyName);
	return filter;
}

describe("FilterCheckboxGrid", () => {
	let FilterCheckboxGrid: typeof import("../FilterCheckboxGrid").default;

	beforeEach(() => {
		vi.resetModules();
		mockAlgorithm = {
			filters: {},
			timeline: [],
		};
		mockTriggerFilterUpdate = vi.fn();
	});

	it("updates filter state and calls triggerFilterUpdate when Include is clicked", async () => {
		FilterCheckboxGrid = (await import("../FilterCheckboxGrid")).default;
		const filter = buildLanguageFilter();
		const user = userEvent.setup();

		render(
			<FilterCheckboxGrid
				filter={filter}
				highlightsOnly={false}
				sortByCount={false}
			/>,
		);

		const row = screen.getByText("English").closest("div")?.parentElement;
		const includeButton = within(row as HTMLElement).getByRole("button", {
			name: "Include",
		});

		await user.click(includeButton);

		expect(filter.selectedOptions).toContain("en");
		expect(mockTriggerFilterUpdate).toHaveBeenCalledWith(
			mockAlgorithm.filters,
		);
	});
});
