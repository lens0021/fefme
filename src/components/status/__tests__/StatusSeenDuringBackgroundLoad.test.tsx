import { render, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import Status from "@/components/status/Status";
import type { Post } from "@/core/index";

let isOnScreen = false;

vi.mock("@/hooks/useOnScreen", () => ({
	default: () => isOnScreen,
}));

const mockScheduleSeenRefresh = vi.fn();
const mockSaveTimelineToCache = vi.fn();

vi.mock("@/hooks/useCoordinator", () => ({
	useCoordinator: () => ({
		algorithm: { saveTimelineToCache: mockSaveTimelineToCache },
		isGoToSocialUser: false,
		isLoading: true,
		scheduleSeenRefresh: mockScheduleSeenRefresh,
	}),
}));

vi.mock("@/components/helpers/ErrorHandler", () => ({
	useError: () => ({
		logAndSetFormattedError: vi.fn(),
	}),
}));

vi.mock("@/components/status/ActionButton", () => ({
	default: () => <div data-testid="action-button" />,
	TootAction: {},
}));

vi.mock("@/components/status/MultimediaNode", () => ({
	default: () => <div data-testid="media" />,
}));

vi.mock("@/components/status/Poll", () => ({
	default: () => <div data-testid="poll" />,
}));

vi.mock("@/components/status/PreviewCard", () => ({
	default: () => <div data-testid="preview-card" />,
}));

vi.mock("react-lazy-load-image-component", () => ({
	LazyLoadImage: (props: Record<string, unknown>) => <img alt="" {...props} />,
}));

const makePost = () => {
	const account = {
		displayName: "Tester",
		note: "",
		webfingerURI: "tester@example.com",
		avatar: "",
		localServerUrl: "https://example.com/@tester",
		bot: false,
		fields: [],
		displayNameFullHTML: () => "Tester",
		displayNameWithEmojis: () => "Tester",
	};

	const post: {
		account: typeof account;
		card: null;
		content: string;
		contentNonTagsParagraphs: () => string;
		contentTagsParagraph: string | null;
		containsTagsMsg: () => string | undefined;
		containsUserMention: () => boolean;
		createdAt: string;
		editedAt: string | null;
		id: string;
		inReplyToAccountId: string | null;
		isDM: boolean;
		language: string;
		mediaAttachments: unknown[];
		numTimesShown: number;
		poll: null;
		reblogsBy: unknown[];
		repliesCount: number;
		realToot: unknown;
		scoreInfo: {
			rawScore: number;
			score: number;
			scores: Record<string, number>;
			timeDecayMultiplier: number;
			trendingMultiplier: number;
			weightedScore: number;
		};
		sources: string[];
		trendingRank: number;
		uri: string;
		url: string;
	} = {
		account,
		card: null,
		content: "<p>Hello</p>",
		contentNonTagsParagraphs: () => "Hello",
		contentTagsParagraph: null,
		containsTagsMsg: () => undefined,
		containsUserMention: () => false,
		createdAt: new Date().toISOString(),
		editedAt: null,
		id: "1",
		inReplyToAccountId: null,
		isDM: false,
		language: "en",
		mediaAttachments: [],
		numTimesShown: 0,
		poll: null,
		reblogsBy: [],
		repliesCount: 0,
		realToot: null,
		scoreInfo: {
			rawScore: 0,
			score: 0,
			scores: {},
			timeDecayMultiplier: 1,
			trendingMultiplier: 1,
			weightedScore: 0,
		},
		sources: [],
		trendingRank: 0,
		uri: "https://example.com/@tester/1",
		url: "https://example.com/@tester/1",
	};

	post.realToot = post;
	return post;
};

describe("Status seen during background loading", () => {
	beforeEach(() => {
		isOnScreen = false;
		mockScheduleSeenRefresh.mockClear();
		mockSaveTimelineToCache.mockClear();
	});

	it("marks the post as seen once it scrolls on screen even while loading", async () => {
		const post = makePost();

		const { container, rerender } = render(
			<Status status={post as unknown as Post} />,
		);

		expect(
			container.querySelector('[data-tooltip-content="Already Seen"]'),
		).toBeNull();

		isOnScreen = true;
		rerender(<Status status={post as unknown as Post} />);

		await waitFor(() => {
			expect(post.numTimesShown).toBeGreaterThan(0);
		});

		rerender(<Status status={post as unknown as Post} />);

		await waitFor(() => {
			expect(
				container.querySelector('[data-tooltip-content="Already Seen"]'),
			).toBeInTheDocument();
		});

		expect(mockScheduleSeenRefresh).toHaveBeenCalled();
		expect(mockSaveTimelineToCache).toHaveBeenCalled();
	});
});
