import { expect, test } from "@playwright/test";
import {
	defaultFilters,
	instanceInfo,
	makeAccount,
	makeStatus,
	makeStatuses,
	mockMasto,
	mockUserPreferences,
} from "./fixtures/mockData";

test.describe("Score stability", () => {
	test.beforeEach(async ({ page }) => {
		await mockUserPreferences(page);
		// Mock with 20 statuses, all having score 100
		const statuses = makeStatuses(1, 20).map(s => ({
			...s,
			score: 100,
			scoreInfo: {
				rawScore: 100,
				score: 100,
				scores: {},
				timeDecayMultiplier: 1,
				trendingMultiplier: 1,
				weightedScore: 100,
			}
		}));

		await mockMasto(page, {
			...defaultFilters,
			timeline: statuses,
		});

		await page.goto("/#/");
		await page.waitForSelector('[data-testid="status-card"]');
	});

	test("does not change the displayed score when a post becomes seen", async ({
		page,
	}) => {
		// 1. Get the first post's score button text
		const firstPost = page.locator('[data-testid="status-card"]').first();
		const scoreButton = firstPost.getByRole("button", { name: "Show Score" });
		
		await expect(scoreButton).toBeVisible();
		const initialScoreText = await scoreButton.textContent();

		// 2. Scroll down to trigger seen updates
		// We need to scroll enough to trigger 'isOnScreen' for subsequent posts and potentially trigger the debounce logic
		for (let index = 0; index < 5; index += 1) {
			await page.mouse.wheel(0, 500);
			await page.waitForTimeout(200);
		}

		// Wait for potential debounce (SEEN_REFRESH_DEBOUNCE_MS = 1000)
		await page.waitForTimeout(1500);

		// 3. Scroll back up to the first post
		await firstPost.scrollIntoViewIfNeeded();

		// 4. Verify score is still the same
		await expect(scoreButton).toHaveText(initialScoreText!);
		
		// Check that the post is marked as seen (optional, to verify logic ran)
		// The "Already Seen" icon should be visible (faEye icon)
		const seenIcon = firstPost.locator('svg[data-icon="eye"]');
		await expect(seenIcon).toBeVisible();
	});
});