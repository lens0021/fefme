import "@testing-library/jest-dom";
import "reflect-metadata";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import {
	createMastoMockClient,
	resetMastoMockResponses,
} from "./mastoMock";

vi.mock("masto", () => ({
	createRestAPIClient: () => createMastoMockClient(),
}));

afterEach(() => {
	cleanup();
	resetMastoMockResponses();
});

if (!window.matchMedia) {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}),
	});
}

if (!window.ResizeObserver) {
	class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	}

	window.ResizeObserver = ResizeObserver;
}
