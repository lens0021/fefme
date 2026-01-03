import { act, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { config } from "../../config";
import { AlgorithmStorageKey } from "../../core/enums";
import FeedCoordinator from "../../core/index";
import Storage from "../../core/Storage";
import AlgorithmProvider from "../../hooks/useAlgorithm";
import Feed from "../Feed";

vi.mock("../../core/Storage", () => ({
	default: {
		set: vi.fn().mockResolvedValue(undefined),
		remove: vi.fn().mockResolvedValue(undefined),
	},
}));

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

vi.mock("../../components/coordinator/FeedFiltersAccordionSection", () => ({
	default: () => <div data-testid="feed-filters" />,
}));

vi.mock("../../components/coordinator/WeightSetter", () => ({
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

	it("keeps cached timeline visible while initial load refreshes in the background", async () => {
		let setTimelineInApp: ((feed: Array<{ uri: string }>) => void) | undefined;
		let resolveTrigger: (() => void) | undefined;
		const cachedTimeline = [{ uri: "cached-1" }, { uri: "cached-2" }];
		const refreshedTimeline = [{ uri: "new-1" }];
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
			timeline: cachedTimeline,
			triggerFeedUpdate: vi.fn(
				() =>
					new Promise<void>((resolve) => {
						resolveTrigger = resolve;
						setTimelineInApp?.(refreshedTimeline);
					}),
			),
		};

		vi.spyOn(FeedCoordinator, "create").mockImplementation(async (params) => {
			setTimelineInApp = params.setTimelineInApp;
			setTimelineInApp?.(cachedTimeline);
			return mockAlgorithm as unknown as FeedCoordinator;
		});

		render(
			<AlgorithmProvider>
				<Feed />
			</AlgorithmProvider>,
		);

		expect(await screen.findAllByTestId("status-card")).toHaveLength(2);
		expect(mockAlgorithm.triggerFeedUpdate).toHaveBeenCalledTimes(1);
		expect(Storage.set).toHaveBeenCalledWith(
			AlgorithmStorageKey.VISIBLE_TIMELINE_POSTS,
			cachedTimeline,
		);

		await act(async () => {
			resolveTrigger?.();
		});

		expect(screen.getAllByTestId("status-card")).toHaveLength(2);
		expect(mockAlgorithm.triggerFeedUpdate).toHaveBeenCalledTimes(1);
		expect(Storage.set).toHaveBeenCalledWith(
			AlgorithmStorageKey.NEXT_VISIBLE_TIMELINE_POSTS,
			refreshedTimeline,
		);
		expect(screen.getByTestId("refresh-bubble")).toBeInTheDocument();
	});

	it("shows only the loading screen until the first load completes when there is no cache", async () => {
		let setTimelineInApp: ((feed: Array<{ uri: string }>) => void) | undefined;
		let resolveTrigger: (() => void) | undefined;
		const refreshedTimeline = [{ uri: "new-1" }];
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
						setTimelineInApp?.(refreshedTimeline);
					}),
			),
		};

		vi.spyOn(FeedCoordinator, "create").mockImplementation(async (params) => {
			setTimelineInApp = params.setTimelineInApp;
			return mockAlgorithm as unknown as FeedCoordinator;
		});

		render(
			<AlgorithmProvider>
				<Feed />
			</AlgorithmProvider>,
		);

		const loadingTextMatcher = (content: string) =>
			content.includes(config.timeline.defaultLoadingMsg);
		expect(await screen.findByText(loadingTextMatcher)).toBeInTheDocument();
		expect(screen.queryAllByTestId("status-card")).toHaveLength(0);

		await act(async () => {
			resolveTrigger?.();
		});

		await waitFor(() =>
			expect(screen.getAllByTestId("status-card")).toHaveLength(1),
		);
		expect(screen.queryByTestId("refresh-bubble")).not.toBeInTheDocument();
	});
});
