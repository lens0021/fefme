import { expect, test } from "@playwright/test";

type StatusAccount = Record<string, unknown>;
type Status = Record<string, unknown>;

const server = "https://example.com";
const serverKey = server;

const makeAccount = (acct: string, id: string): StatusAccount => ({
	acct,
	avatar: "",
	avatar_static: "",
	bot: false,
	created_at: new Date().toISOString(),
	discoverable: true,
	display_name: acct === "tester" ? "Tester" : "Author",
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

const makeStatus = (id: number): Status => ({
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
});

const makeStatuses = (start: number, count: number): Status[] =>
	Array.from({ length: count }, (_, index) => makeStatus(start + index));

const instanceInfo = {
	domain: "example.com",
	sourceUrl: server,
	configuration: {
		mediaAttachments: {
			supportedMimeTypes: ["image/jpeg", "image/png", "video/mp4"],
		},
	},
};

test("seen-only filter keeps visible list stable until bubble reload", async ({
	page,
}) => {
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

	let homeTimelineCalls = 0;
	const initialPosts = makeStatuses(1, 20);
	const refreshedPosts = makeStatuses(21, 20);

	await page.route("**/api/v1/**", async (route) => {
		const url = new URL(route.request().url());
		if (url.pathname.endsWith("/instance")) {
			await route.fulfill({
				contentType: "application/json",
				status: 200,
				body: JSON.stringify(instanceInfo),
			});
			return;
		}

		if (url.pathname.endsWith("/timelines/home")) {
			homeTimelineCalls += 1;
			const posts = homeTimelineCalls === 1 ? initialPosts : refreshedPosts;
			await route.fulfill({
				contentType: "application/json",
				status: 200,
				body: JSON.stringify(posts),
			});
			return;
		}

		if (url.pathname.endsWith("/accounts/verify_credentials")) {
			await route.fulfill({
				contentType: "application/json",
				status: 200,
				body: JSON.stringify(makeAccount("tester", "1")),
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
				body: JSON.stringify(instanceInfo),
			});
			return;
		}
		await route.fulfill({
			contentType: "application/json",
			status: 200,
			body: JSON.stringify([]),
		});
	});

	await page.goto("/#/");

	const statusCards = page.getByTestId("status-card");
	await expect(statusCards).toHaveCount(20, { timeout: 20_000 });

	await page.getByRole("button", { name: "Feed Filters" }).click();
	await page.getByRole("button", { name: /Type/ }).click();

	const seenRow = page
		.getByText("Seen", { exact: true })
		.locator("..")
		.locator("..");
	await seenRow.scrollIntoViewIfNeeded();
	await seenRow.getByRole("button", { name: "Exclude" }).click();

	for (let index = 0; index < 30; index += 1) {
		await page.mouse.wheel(0, 800);
		await page.waitForTimeout(100);
	}

	await page.waitForTimeout(1500);
	await expect(statusCards).toHaveCount(20, { timeout: 20_000 });

	await page.getByRole("button", { name: "Data Loading & History" }).click();
	await page.getByRole("button", { name: "Load new posts" }).first().click();

	const refreshBubble = page.getByTestId("refresh-bubble");
	await expect(refreshBubble).toBeVisible({ timeout: 20_000 });
	await refreshBubble.click();
	await page.waitForLoadState("domcontentloaded");

	await expect(statusCards).toHaveCount(20, { timeout: 20_000 });
	await expect(page.getByText("Post 1")).toHaveCount(0);
	await expect(page.getByText("Post 21")).toBeVisible();
});
