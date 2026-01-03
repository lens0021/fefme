import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { config } from "../../../../config";
import NumericFilters from "../NumericFilters";

let mockAlgorithm: {
	filters: {
		numericFilters: Record<string, { description: string; propertyName: string; value: number }>;
	};
};
let mockTriggerFilterUpdate: ReturnType<typeof vi.fn>;

vi.mock("../../../../hooks/useAlgorithm", () => ({
	useAlgorithm: () => ({
		algorithm: mockAlgorithm,
		triggerFilterUpdate: mockTriggerFilterUpdate,
	}),
}));

describe("NumericFilters", () => {
	beforeEach(() => {
		mockAlgorithm = {
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
		mockTriggerFilterUpdate = vi.fn();
	});

	it("writes the value and calls triggerFilterUpdate on slider change", () => {
		render(<NumericFilters isActive={true} />);

		fireEvent.click(
			screen.getByRole("button", { name: new RegExp(config.filters.numeric.title, "i") }),
		);

		const slider = screen.getAllByRole("slider")[0];
		fireEvent.change(slider, { target: { value: "5" } });

		expect(mockAlgorithm.filters.numericFilters.repliesCount.value).toBe(5);
		expect(mockTriggerFilterUpdate).toHaveBeenCalledWith(
			mockAlgorithm.filters,
		);
	});
});
