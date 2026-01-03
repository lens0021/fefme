import type { ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import Status from "../Status";

const mockUpdateFilters = vi.fn();
const mockSaveTimelineToCache = vi.fn();

vi.mock("../../../hooks/useAlgorithm", () => ({
	useAlgorithm: () => ({
		algorithm: {
			updateFilters: mockUpdateFilters,
			saveTimelineToCache: mockSaveTimelineToCache,
			filters: {
				booleanFilters: {
					type: {
						excludedOptions: ["seen"],
					},
				},
				numericFilters: {},
			},
			weightsInfo: {},
		},
		isGoToSocialUser: false,
		isLoading: false,
	}),
}));

vi.mock("../../../hooks/useOnScreen", () => ({
	default: () => true,
}));

vi.mock("../../helpers/ErrorHandler", () => ({
	useError: () => ({
		logAndSetFormattedError: vi.fn(),
	}),
}));

vi.mock("react-tooltip", () => ({
	Tooltip: () => null,
}));

vi.mock("react-lazy-load-image-component", () => ({
	LazyLoadImage: (props: { alt?: string; src?: string }) => (
		<img alt={props.alt} src={props.src} />
	),
}));

vi.mock("@fortawesome/react-fontawesome", () => ({
	FontAwesomeIcon: () => null,
}));

vi.mock("../ActionButton", () => ({
	default: () => <button type="button">Action</button>,
	TootAction: {
		Bookmark: "Bookmark",
		Favourite: "Favourite",
		Reblog: "Reblog",
		Score: "Score",
	},
}));

vi.mock("../MultimediaNode", () => ({
	default: () => <div data-testid="multimedia-node" />,
}));

vi.mock("../Poll", () => ({
	default: () => <div data-testid="poll" />,
}));

vi.mock("../PreviewCard", () => ({
	default: () => <div data-testid="preview-card" />,
}));

vi.mock("../../helpers/NewTabLink", () => ({
	default: ({
		children,
		href,
	}: {
		children: ReactNode;
		href: string;
	}) => <a href={href}>{children}</a>,
}));

const buildStatus = () => {
	const account = {
		avatar: "https://example.com/avatar.png",
		bot: false,
		displayName: "Tester",
		fields: [],
		localServerUrl: "https://example.com/@tester",
		note: "",
		webfingerURI: "tester@example.com",
		displayNameFullHTML: () => "Tester",
		displayNameWithEmojis: () => "Tester",
	};

	const baseToot = {
		account,
		accounts: [account],
		audioAttachments: [],
		card: null,
		containsTagsMsg: () => "",
		containsUserMention: () => false,
		contentNonTagsParagraphs: () => "Hello world",
		contentTagsParagraph: "",
		createdAt: new Date().toISOString(),
		editedAt: null,
		followedTags: [],
		imageAttachments: [],
		inReplyToAccountId: null,
		isDM: false,
		language: "en",
		mediaAttachments: [],
		numTimesShown: 0,
		poll: null,
		reblog: null,
		reblogsBy: [],
		repliesCount: 0,
		sources: [],
		trendingRank: 0,
		trendingTags: [],
		url: "https://example.com/post/1",
		videoAttachments: [],
		scoreInfo: {
			rawScore: 0,
			score: 0,
			scores: {},
			timeDecayMultiplier: 1,
			trendingMultiplier: 1,
			weightedScore: 0,
		},
	};

	const toot = { ...baseToot, realToot: null };
	toot.realToot = toot;
	const status = { ...baseToot, realToot: toot };

	return status;
};

describe("Status seen filter", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("reapplies filters when seen posts should be excluded", async () => {
		const status = buildStatus();
		render(<Status status={status as never} />);

		await waitFor(() =>
			expect(mockUpdateFilters).toHaveBeenCalledWith(
				expect.objectContaining({
					booleanFilters: expect.any(Object),
				}),
			),
		);
		expect(status.numTimesShown).toBe(1);
	});
});
