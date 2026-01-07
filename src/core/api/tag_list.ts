import { config } from "../config";
import { TagPostsCategory } from "../enums";
import { Logger } from "../helpers/logger";
import type {
	CountedListSource,
	Hashtag,
	NamedTootCount,
	TagWithUsageCounts,
} from "../types";
/*
 * CountedList subclass for TagWithUsageCounts objects.
 */
import MastoApi from "./api";
import CountedList from "./counted_list";
import { repairTag } from "./objects/tag";
import type Post from "./objects/post";
import UserData from "./user_data";

const logger = new Logger("TagList");

/**
 * Subclass of {@linkcode CountedList} for lists of {@linkcode TagWithUsageCounts} objects.
 * @augments CountedList
 */
export default class TagList extends CountedList<TagWithUsageCounts> {
	constructor(tags: TagWithUsageCounts[], label: CountedListSource) {
		super(tags.map(repairTag), label);
	}

	/** Alternate constructor to build tags where numPosts is set to the # of times user favourited that tag. */
	static async buildFavouritedTags(): Promise<TagList> {
		return TagList.fromUsageCounts(
			await MastoApi.instance.getFavouritedPosts(),
			TagPostsCategory.FAVOURITED,
		);
	}

	/**
	 * Alternate constructor that populates {@linkcode this.objs} with {@linkcode TagWithUsageCounts} objects
	 * with {@linkcode numPosts} set to the # of times the tag appears in the {@linkcode posts} array.
	 * Note the special handling of boosters.
	 * @param {Post[]} posts - Array of Post objects to count tags from.
	 * @param {CountedListSource} source - Source of the list (for logging/context).
	 * @returns {TagList} A new TagList instance with tags counted from the posts.
	 */
	static fromUsageCounts(
		posts: Post[],
		source: CountedListSource,
		includeBoosts?: boolean,
	): TagList {
		posts = includeBoosts ? posts.map((post) => post.realToot) : posts;
		const tagList = new TagList([], source);
		const tags = posts.flatMap((post) => post.tags);
		tagList.populateByCountingProps(tags, (tag) => tag);
		return tagList;
	}

	// Same as the superclass method. Only exists because typescript is missing a few features
	// when it comes to alternate constructors in generic classes (can't call "new TagList()" and retain
	// this subclass's methods w/out this override)
	filter(predicate: (tag: TagWithUsageCounts) => boolean): TagList {
		return new TagList(this.objs.filter(predicate), this.source);
	}

	/**
	 * Like {@linkcode CountedList.getObj} but takes a {@linkcode MastodonTag} argument.
	 * @param {Hashtag} tag - Tag whose name we want to locate the object for.
	 * @returns {NamedTootCount|undefined} The {@linkcode NamedTootCount} obj with the same name (if it exists).
	 */
	getTag(tag: Hashtag): NamedTootCount | undefined {
		return this.getObj(tag.name);
	}

	/** Remove any hashtags that are followed by the Fefme user. */
	async removeFollowedTags(): Promise<void> {
		const followedKeywords = (await MastoApi.instance.getFollowedTags()).map(
			(t) => t.name,
		);
		this.removeKeywords(followedKeywords);
	}

	/** Remove the configured list of invalid trending tags as well as japanese/korean etc. tags. */
	async removeInvalidTrendingTags(): Promise<void> {
		this.removeKeywords(await UserData.getMutedKeywords());
		this.removeKeywords(config.trending.tags.invalidTags);
		this.objs = this.objs.filter(
			(tag) => !tag.language || tag.language == config.locale.language,
		);
	}
}
