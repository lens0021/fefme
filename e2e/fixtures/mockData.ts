import { type Page, expect } from "@playwright/test";

export type StatusAccount = Record<string, unknown>;
export type Status = Record<string, unknown>;

export const server = "https://example.com";
export const serverKey = server;

export const makeAccount = (
	acct: string,
	id: string,
	display_name?: string,
): StatusAccount => ({
	acct,
	avatar: "",
	avatar_static: "",
	bot: false,
	created_at: new Date().toISOString(),
	discoverable: true,
	display_name: display_name || (acct === "tester" ? "Tester" : "Author"),
	emojis: [],
	fields: [],
	followers_count: 1,
	following_count: 1,
	group: false,
	header: "",
	header_static: "",
	id,
	last_status_at: new Date().toISOString(),
	locked: false,
	noindex: false,
	note: "",
	roles: [],
	statuses_count: 1,
	url: `${server}/@${acct}`,
	username: acct,
});

export const makeStatus = (
	id: number,
	overrides: Partial<Status> = {},
): Status => ({
	account: makeAccount("author", "2"),
	application: { name: "Web", website: null },
	bookmarked: false,
	card: null,
	content: `<p>Post ${id}</p>`,
	created_at: new Date(Date.now() - id * 1000).toISOString(),
	edited_at: null,
	emojis: [],
	favourited: false,
	favourites_count: 0,
	filtered: [],
	id: String(id),
	in_reply_to_account_id: null,
	in_reply_to_id: null,
	language: "en",
	media_attachments: [],
	mentions: [],
	muted: false,
	pinned: false,
	poll: null,
	reblog: null,
	reblogged: false,
	reblogs_count: 0,
	replies_count: 0,
	sensitive: false,
	spoiler_text: "",
	tags: [],
	text: null,
	uri: `${server}/@tester/${id}`,
	url: `${server}/@tester/${id}`,
	visibility: "public",
	score: 100,
	scoreInfo: {
		rawScore: 100,
		score: 100,
		scores: {},
		timeDecayMultiplier: 1,
		trendingMultiplier: 1,
		weightedScore: 100,
	},
	...overrides,
});

export const makeStatuses = (start: number, count: number): Status[] =>
	Array.from({ length: count }, (_, index) => makeStatus(start + index));

export const instanceInfo = {
	domain: "example.com",
	sourceUrl: server,
	configuration: {
		mediaAttachments: {
			supportedMimeTypes: ["image/jpeg", "image/png", "video/mp4"],
		},
	},
};

export const defaultFilters = {
	booleanFilterArgs: [],
	numericFilterArgs: [],
};

export async function mockUserPreferences(page: Page) {
	const user = {
		access_token: "test-token",
		id: "1",
		profilePicture: "",
		server,
		username: "tester",
	};

	await page.addInitScript(
		({ serverKey, user }) => {
			window.localStorage.setItem("server", serverKey);
			window.localStorage.setItem(
				"serverUsers",
				JSON.stringify({
					[serverKey]: {
						app: null,
						user,
					},
				}),
			);
		},
		{ serverKey, user },
	);
}

interface MockMastoOptions {
	timeline?: Status[];
	account?: StatusAccount;
	instance?: typeof instanceInfo;
}

export async function mockMasto(page: Page, options: MockMastoOptions = {}) {
	const {
		timeline = [],
		account = makeAccount("tester", "1"),
		instance = instanceInfo,
	} = options;

	await page.route("**/api/v1/**", async (route) => {
		const url = new URL(route.request().url());
		if (url.pathname.endsWith("/instance")) {
			await route.fulfill({
				contentType: "application/json",
				status: 200,
				body: JSON.stringify(instance),
			});
			return;
		}

		if (url.pathname.endsWith("/timelines/home")) {
			await route.fulfill({
				contentType: "application/json",
				status: 200,
				body: JSON.stringify(timeline),
			});
			return;
		}

		if (url.pathname.endsWith("/accounts/verify_credentials")) {
			await route.fulfill({
				contentType: "application/json",
				status: 200,
				body: JSON.stringify(account),
			});
			return;
		}

		await route.fulfill({
			contentType: "application/json",
			status: 200,
			body: JSON.stringify([]),
		});
	});

	await page.route("**/api/v2/**", async (route) => {
		const url = new URL(route.request().url());
		if (url.pathname.endsWith("/instance")) {
			await route.fulfill({
				contentType: "application/json",
				status: 200,
				body: JSON.stringify(instance),
			});
			return;
		}
		await route.fulfill({
			contentType: "application/json",
			status: 200,
			body: JSON.stringify([]),
		});
	});
}
