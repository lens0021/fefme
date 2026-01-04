import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import pkg from "./package.json";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	let base = "/";

	if (mode === "production" && pkg.homepage) {
		try {
			base = new URL(pkg.homepage).pathname;
		} catch {
			base = "/";
		}

		if (!base.endsWith("/")) {
			base = `${base}/`;
		}
	}

	return {
		plugins: [react(), tailwindcss()],
		base,
		resolve: {
			alias: {
				"@": fileURLToPath(new URL("./src", import.meta.url)),
			},
		},

		build: {
			outDir: env.BUILD_DIR || "docs",
			sourcemap: mode === "development",
			chunkSizeWarningLimit: 2000,
		},

		server: {
			port: 3000,
			open: true,
		},

		define: {
			"process.env.FEDIALGO_DEBUG": JSON.stringify(env.FEDIALGO_DEBUG),
			"process.env.FEDIALGO_HOMEPAGE": JSON.stringify(env.FEDIALGO_HOMEPAGE),
			"process.env.FEDIALGO_VERSION": JSON.stringify(env.FEDIALGO_VERSION),
			"process.env.QUICK_MODE": JSON.stringify(env.QUICK_MODE),
			"process.env.NODE_ENV": JSON.stringify(
				mode === "production" ? "production" : "development",
			),
		},
		test: {
			environment: "jsdom",
			setupFiles: "./src/test/setup.ts",
			globals: true,
		},
	};
});
