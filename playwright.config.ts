import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	timeout: 60_000,
	fullyParallel: true,
	use: {
		baseURL: "http://127.0.0.1:3000",
		trace: "retain-on-failure",
		video: "retain-on-failure",
	},
	webServer: {
		command: "npm run dev -- --host 127.0.0.1",
		url: "http://127.0.0.1:3000",
		reuseExistingServer: !process.env.CI,
	},
});
