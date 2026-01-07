import { type TagPostsConfig, config } from "../config";
import { TagPostsCategory } from "../enums";
import {
	resolvePromiseDict,
	truncateToLength,
	zipPromiseCalls,
} from "../helpers/collection_helpers";
import { Logger } from "../helpers/logger";
import type { TagWithUsageCounts } from "../types";
/*
 * Helper class for fetching posts for a list of tags, e.g. trending or particiapted tags.
 */
import MastoApi from "./api";
import Storage from "../Storage";
import { tagInfoStr } from "./objects/tag";
import Post from "./objects/post";
import TagList from "./tag_list";

type TagPostsBuildConfig = {
	buildTagList: () => Promise<TagList>;
	config: TagPostsConfig;
};

const HASHTAG_POSTS_CONFIG: Record<TagPostsCategory, TagPostsBuildConfig> = {
	[TagPostsCategory.FAVOURITED]: {
		buildTagList: async () => await TagList.buildFavouritedTags(),
		config: config.favouritedTags,
	},
	[TagPostsCategory.TRENDING]: {
		buildTagList: async () => new TagList([], TagPostsCategory.TRENDING),
		config: config.trending.tags,
	},
};

export default class TagsForFetchingPosts {
	cacheKey: TagPostsCategory;
	config: TagPostsConfig;
	logger: Logger;
	tagList: TagList;

	/** Alternate async constructor. */
	static async create(
		cacheKey: TagPostsCategory,
	): Promise<TagsForFetchingPosts> {
		const postsConfig = HASHTAG_POSTS_CONFIG[cacheKey];
		const tagList = await postsConfig.buildTagList();
		const tagsForPostsList = new TagsForFetchingPosts(
			cacheKey,
			postsConfig.config,
			tagList,
		);
		await tagsForPostsList.removeUnwantedTags();
		return tagsForPostsList;
	}

	private constructor(
		cacheKey: TagPostsCategory,
		tagsConfig: TagPostsConfig,
		tagList: TagList,
	) {
		this.cacheKey = cacheKey;
		this.config = tagsConfig;
		this.tagList = tagList;
		this.logger = new Logger(cacheKey);
	}

	/** Get {@linkcode Post}s for the list of tags, caching the results. */
	async getPosts(): Promise<Post[]> {
		return await MastoApi.instance.getCacheablePosts(
			async () => {
				const tags = this.topTags();
				this.logger.log(
					`getPosts() called for ${tags.length} tags:`,
					tags.map((t) => t.name),
				);

				const results = await zipPromiseCalls(
					tags.map((tag) => tag.name),
					async (tagName) => {
						return await MastoApi.instance.getStatusesForTag(
							tagName,
							this.logger,
							this.config.numPostsPerTag,
						);
					},
					this.logger,
				);

				return Object.values(results).flat();
			},
			this.cacheKey,
			this.config.maxPosts,
		);
	}

	/** Get older {@linkcode Post}s for the list of tags and merge them into the cache. */
	async getOlderPosts(maxId: string | number | null): Promise<Post[]> {
		if (!maxId) return [];
		const tags = this.topTags();
		this.logger.log(
			`getOlderPosts() called for ${tags.length} tags with maxId ${maxId}`,
		);

		const results = await zipPromiseCalls(
			tags.map((tag) => tag.name),
			async (tagName) => {
				return await MastoApi.instance.getStatusesForTag(
					tagName,
					this.logger,
					this.config.numPostsPerTag,
					{ maxId },
				);
			},
			this.logger,
		);

		const statuses = Object.values(results).flat();
		const newPosts = await Post.buildPosts(statuses, this.cacheKey);
		let cachedPosts = await Storage.get(this.cacheKey);
		if (!cachedPosts) {
			cachedPosts = [];
		} else if (!Array.isArray(cachedPosts)) {
			this.logger.logAndThrowError(
				`Expected array at '${this.cacheKey}' but got`,
				cachedPosts,
			);
		}
		cachedPosts = Post.dedupePosts(
			[...newPosts, ...(cachedPosts as Post[])],
			this.logger,
		);
		cachedPosts = truncateToLength(
			cachedPosts,
			this.config.maxPosts,
			this.logger,
		);
		await Storage.set(this.cacheKey, cachedPosts);
		return newPosts;
	}

	/** Strip out tags we don't want to fetch posts for, e.g. followed, muted, invalid, or trending tags. */
	private async removeUnwantedTags(): Promise<void> {
		await this.tagList.removeFollowedTags();
		await this.tagList.removeInvalidTrendingTags();
		this.tagList.removeKeywords(this.config.invalidTags || []);
	}

	/**
	 * Return {@linkcode numTags} tags sorted by {@linkcode numPosts} then by {@linkcode name}
	 * @param {number} [numTags] - Optional maximum number of tags to return.
	 */
	topTags(numTags?: number): TagWithUsageCounts[] {
		numTags ||= this.config.numTags;
		const tags = truncateToLength(this.tagList.topObjs(), numTags, this.logger);
		this.logger.debug(
			`topTags:\n`,
			tags.map((t, i) => `${i + 1}: ${tagInfoStr(t)}`).join("\n"),
		);
		return tags;
	}

	/** Return the tag lists used to search for posts (participated/trending/etc) in their raw unfiltered form. */
	static async rawTagLists(): Promise<Record<TagPostsCategory, TagList>> {
		return await resolvePromiseDict(
			{
				[TagPostsCategory.FAVOURITED]: TagList.buildFavouritedTags(),
				[TagPostsCategory.TRENDING]: Promise.resolve(
					new TagList([], TagPostsCategory.TRENDING),
				),
			},
			new Logger("TagsForFetchingPosts.rawTagLists()"),
			(failedKey: TagPostsCategory) => new TagList([], failedKey),
		);
	}
}
