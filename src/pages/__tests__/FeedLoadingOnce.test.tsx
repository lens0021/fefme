import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { config } from "../../config";
import TheAlgorithm from "../../core/index";
import AlgorithmProvider from "../../hooks/useAlgorithm";
import Feed from "../Feed";

const mockUser = {
	access_token: "test-token",
	id: "1",
	server: "https://example.com",
	username: "tester",
};
const mockLogout = vi.fn();
const mockLogAndSetFormattedError = vi.fn();
const mockResetErrors = vi.fn();

vi.mock("../../hooks/useAuth", () => ({
	useAuthContext: () => ({
		user: mockUser,
		logout: mockLogout,
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

vi.mock("../../components/helpers/ErrorHandler", () => ({
	useError: () => ({
		logAndSetFormattedError: mockLogAndSetFormattedError,
		resetErrors: mockResetErrors,
	}),
}));

describe("Feed loading", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("shows the loading screen only once on initial load with no user actions", async () => {
		let resolveTrigger: (() => void) | undefined;
		const mockAlgorithm = {
			getDataStats: vi.fn().mockReturnValue(null),
			isGoToSocialUser: vi.fn().mockResolvedValue(false),
			serverInfo: vi.fn().mockResolvedValue({
				configuration: {
					mediaAttachments: {
						supportedMimeTypes: ["image/jpeg", "image/png", "video/mp4"],
					},
				},
				domain: "example.com",
			}),
			timeline: [],
			triggerFeedUpdate: vi.fn(
				() =>
					new Promise<void>((resolve) => {
						resolveTrigger = resolve;
					}),
			),
		};

		vi.spyOn(TheAlgorithm, "create").mockResolvedValue(
			mockAlgorithm as unknown as TheAlgorithm,
		);

		render(
			<AlgorithmProvider>
				<Feed />
			</AlgorithmProvider>,
		);

		const loadingTextMatcher = (content: string) =>
			content.includes(config.timeline.defaultLoadingMsg);
		expect(await screen.findByText(loadingTextMatcher)).toBeInTheDocument();
		expect(screen.queryAllByText(loadingTextMatcher)).toHaveLength(1);
		expect(mockAlgorithm.triggerFeedUpdate).toHaveBeenCalledTimes(1);

		resolveTrigger?.();

		await screen.findByText(config.timeline.noTootsMsg);
		await waitFor(() =>
			expect(screen.queryByText(loadingTextMatcher)).not.toBeInTheDocument(),
		);

		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(mockAlgorithm.triggerFeedUpdate).toHaveBeenCalledTimes(1);
	});
});
