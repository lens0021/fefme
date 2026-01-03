import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { config } from "../../../../config";
import NumericFilters from "../NumericFilters";

let mockAlgorithm: {
	updateFilters: ReturnType<typeof vi.fn>;
	filters: {
		numericFilters: Record<string, { description: string; propertyName: string; value: number }>;
	};
};

vi.mock("../../../../hooks/useAlgorithm", () => ({
	useAlgorithm: () => ({
		algorithm: mockAlgorithm,
	}),
}));

describe("NumericFilters", () => {
	beforeEach(() => {
		mockAlgorithm = {
			updateFilters: vi.fn(),
			filters: {
				numericFilters: {
					repliesCount: {
						description: "Replies",
						propertyName: "repliesCount",
						value: 2,
					},
				},
			},
		};
	});

	it("writes the value and calls updateFilters on slider change", () => {
		render(<NumericFilters isActive={true} />);

		fireEvent.click(
			screen.getByRole("button", { name: new RegExp(config.filters.numeric.title, "i") }),
		);

		const slider = screen.getAllByRole("slider")[0];
		fireEvent.change(slider, { target: { value: "5" } });

		expect(mockAlgorithm.filters.numericFilters.repliesCount.value).toBe(5);
		expect(mockAlgorithm.updateFilters).toHaveBeenCalledWith(
			mockAlgorithm.filters,
		);
	});
});
