import { describe, expect, it, vi } from "vitest";

vi.mock("@/core/api/api", () => ({
	default: {
		instance: {
			tagUrl: () => "",
		},
	},
}));

import { TypeFilterName } from "@/core/enums";
import { TYPE_FILTERS } from "@/core/filters/boolean_filter";
import type Post from "@/core/api/objects/post";

const makeBasePost = (): Post =>
	({
		numTimesShown: 0,
		favourited: false,
		reblogged: false,
		realToot: {
			numTimesShown: 0,
			favourited: false,
			reblogged: false,
		},
	}) as Post;

describe("TypeFilterName.SEEN", () => {
	it("treats favourited posts as seen", () => {
		const post = makeBasePost();
		post.favourited = true;

		expect(TYPE_FILTERS[TypeFilterName.SEEN](post)).toBe(true);
	});

	it("treats boosts as seen", () => {
		const post = makeBasePost();
		post.reblogged = true;

		expect(TYPE_FILTERS[TypeFilterName.SEEN](post)).toBe(true);
	});

	it("treats favourited reblogs as seen", () => {
		const post = makeBasePost();
		post.realToot.favourited = true;

		expect(TYPE_FILTERS[TypeFilterName.SEEN](post)).toBe(true);
	});

	it("treats boosted reblogs as seen", () => {
		const post = makeBasePost();
		post.realToot.reblogged = true;

		expect(TYPE_FILTERS[TypeFilterName.SEEN](post)).toBe(true);
	});
});
