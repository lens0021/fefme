import TagList from "../api/tag_list";
import { TagPostsCategory } from "../enums";
import type { TrendingData } from "../types";

export const EMPTY_TRENDING_DATA: Readonly<TrendingData> = {
	tags: new TagList([], TagPostsCategory.TRENDING),
	servers: {},
	posts: [],
};
