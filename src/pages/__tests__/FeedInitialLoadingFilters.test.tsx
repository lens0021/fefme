import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { config } from "../../config";
import Feed from "../Feed";

vi.mock("../../hooks/useAlgorithm", () => ({
	useAlgorithm: () => ({
		algorithm: undefined,
		applyPendingTimeline: vi.fn(),
		hasInitialCache: false,
		hasPendingTimeline: false,
		hideSensitiveCheckbox: undefined,
		isLoading: true,
		lastLoadDurationSeconds: undefined,
		currentUserWebfinger: undefined,
		selfTypeFilterMode: "none",
		timeline: [{ uri: "unfiltered-1" }],
		triggerFeedUpdate: vi.fn(),
		triggerHomeTimelineBackFill: vi.fn(),
		triggerFederatedTimelineBackFill: vi.fn(),
		triggerFavouritedTagBackFill: vi.fn(),
		triggerParticipatedTagBackFill: vi.fn(),
		triggerMoarData: vi.fn(),
		triggerPullAllUserData: vi.fn(),
	}),
}));

vi.mock("../../components/algorithm/FeedFiltersAccordionSection", () => ({
	default: () => <div data-testid="feed-filters" />,
}));

vi.mock("../../components/algorithm/WeightSetter", () => ({
	default: () => <div data-testid="weight-setter" />,
}));

vi.mock("../../components/status/Status", () => ({
	default: () => <div data-testid="status-card" />,
}));

describe("Feed initial loading filters", () => {
	it("does not render timeline posts during initial load without cache", async () => {
		render(<Feed />);

		const loadingTextMatcher = (content: string) =>
			content.includes(config.timeline.defaultLoadingMsg);
		expect(await screen.findByText(loadingTextMatcher)).toBeInTheDocument();
		expect(screen.queryAllByTestId("status-card")).toHaveLength(0);
	});
});
