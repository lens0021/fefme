import "@testing-library/jest-dom";
import "reflect-metadata";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { createMastoMockClient, resetMastoMockResponses } from "./mastoMock";

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

if (!window.localStorage || typeof window.localStorage.getItem !== "function") {
	const storage = new Map<string, string>();
	const localStorageMock = {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => {
			storage.set(key, String(value));
		},
		removeItem: (key: string) => {
			storage.delete(key);
		},
		clear: () => {
			storage.clear();
		},
		key: (index: number) => Array.from(storage.keys())[index] ?? null,
		get length() {
			return storage.size;
		},
	};

	Object.defineProperty(window, "localStorage", {
		value: localStorageMock,
		configurable: true,
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

if (!window.IntersectionObserver) {
	class IntersectionObserver {
		root = null;
		rootMargin = "";
		thresholds: number[] = [];
		observe() {}
		unobserve() {}
		disconnect() {}
		takeRecords() {
			return [];
		}
	}

	window.IntersectionObserver = IntersectionObserver;
}
