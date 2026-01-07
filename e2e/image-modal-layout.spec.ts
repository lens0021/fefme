import { expect, test } from "@playwright/test";
import {
	defaultFilters,
	instanceInfo,
	makeStatus,
	mockMasto,
	mockUserPreferences,
} from "./fixtures/mockData";

test.describe("Image Modal Layout", () => {
	test.beforeEach(async ({ page }) => {
		await mockUserPreferences(page);

		const largeImagePost = makeStatus(1, {
			media_attachments: [
				{
					id: "img1",
					type: "image",
					url: "https://example.com/large-image-1.jpg",
					preview_url: "https://example.com/large-image-1-preview.jpg",
					description: "Large Image 1",
					meta: {
						original: { width: 2000, height: 2000, aspect: 1 },
					},
				},
				{
					id: "img2",
					type: "image",
					url: "https://example.com/large-image-2.jpg",
					preview_url: "https://example.com/large-image-2-preview.jpg",
					description: "Large Image 2",
					meta: {
						original: { width: 2000, height: 2000, aspect: 1 },
					},
				},
				{
					id: "img3",
					type: "image",
					url: "https://example.com/large-image-3.jpg",
					preview_url: "https://example.com/large-image-3-preview.jpg",
					description: "Large Image 3",
					meta: {
						original: { width: 2000, height: 2000, aspect: 1 },
					},
				},
				{
					id: "img4",
					type: "image",
					url: "https://example.com/large-image-4.jpg",
					preview_url: "https://example.com/large-image-4-preview.jpg",
					description: "Large Image 4",
					meta: {
						original: { width: 2000, height: 2000, aspect: 1 },
					},
				},
			],
		});

		await mockMasto(page, {
			...defaultFilters,
			timeline: [largeImagePost],
		});

		await page.goto("/#/");
		await page.waitForSelector('[data-testid="status-card"]');
	});

	test("does not cause horizontal scroll when opening image modal", async ({
		page,
	}) => {
		// Set a mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Mock image loading to avoid errors
		await page.route("**/*.jpg", (route) =>
			route.fulfill({
				status: 200,
				contentType: "image/jpeg",
				body: Buffer.from(
					"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
					"base64",
				),
			}),
		);

		// Check before clicking
		const scrollWidthBefore = await page.evaluate(() => document.body.scrollWidth);
		const clientWidthBefore = await page.evaluate(() => document.body.clientWidth);

		// Click the first image
		const firstImage = page.locator('img[alt="Large Image 1"]');
		await firstImage.click();

		// Wait for modal to appear
		const modal = page.locator('div[role="dialog"]');
		await expect(modal).toBeVisible();

		// Check for horizontal scroll on body
		const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
		const clientWidth = await page.evaluate(() => document.body.clientWidth);

		// Allow a tiny margin of error for scrollbars themselves, but generally they shouldn't differ significantly if no overflow
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

		// Also verify the modal container width doesn't exceed viewport
		const modalBox = modal.locator("> div.relative");
		const modalBoxWidth = await modalBox.evaluate((el) => el.clientWidth);
		const viewportWidth = await page.evaluate(() => window.innerWidth);

		expect(modalBoxWidth).toBeLessThanOrEqual(viewportWidth);
	});
});
