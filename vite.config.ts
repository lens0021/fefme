import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import pkg from "./package.json";
import { defineConfig, loadEnv } from "vite";

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

		build: {
			outDir: env.BUILD_DIR || "docs",
			sourcemap: mode === "development",
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
		resolve: {
			alias: {
				fedialgo: resolve(__dirname, "src/fedialgo"),
			},
		},
	};
});
