import type Post from "../../api/objects/post";
import TagList from "../../api/tag_list";
import { ScoreName } from "../../enums";
import { sumArray } from "../../helpers/collection_helpers";
import type { StringNumberDict } from "../../types";
import PostScorer from "../post_scorer";

/**
 * Factory for creating tag-based scorer classes.
 * These scorers sum scores from tags in a post.
 * @memberof module:post_scorers
 */
const createTagScorerClass = (
	scoreName: ScoreName,
	description: string,
	tagListBuilder: () => Promise<TagList>,
	transform?: (value: number) => number,
) => {
	return class extends PostScorer {
		description = description;

		constructor() {
			super(scoreName);
		}

		async prepareScoreData(): Promise<StringNumberDict> {
			return (await tagListBuilder()).nameToNumPostsDict();
		}

		async _score(post: Post): Promise<number> {
			return sumArray(
				post.realToot.tags.map((tag) => {
					const value = this.scoreData[tag.name] || 0;
					return transform ? transform(value) : value;
				}),
			);
		}
	};
};

// Tag-based scorer classes
export default class FavouritedTagsScorer extends createTagScorerClass(
	ScoreName.FAVOURITED_TAGS,
	"Favour posts containing hashtags you favourite",
	() => TagList.buildFavouritedTags(),
) {}
