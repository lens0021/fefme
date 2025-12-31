import TagList from "../../api/tag_list";
import TootScorer from "../toot_scorer";
import type Toot from "../../api/objects/toot";
import { ScoreName } from "../../enums";
import { sumArray } from "../../helpers/collection_helpers";
import { type StringNumberDict } from "../../types";

/**
 * Factory for creating tag-based scorer classes.
 * These scorers sum scores from tags in a toot.
 * @memberof module:toot_scorers
 */
const createTagScorerClass = (
	scoreName: ScoreName,
	description: string,
	tagListBuilder: () => Promise<TagList>,
	transform?: (value: number) => number,
) => {
	return class extends TootScorer {
		description = description;

		constructor() {
			super(scoreName);
		}

		async prepareScoreData(): Promise<StringNumberDict> {
			return (await tagListBuilder()).nameToNumTootsDict();
		}

		async _score(toot: Toot): Promise<number> {
			return sumArray(
				toot.realToot.tags.map((tag) => {
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
	"Favour toots containing hashtags you favourite",
	() => TagList.buildFavouritedTags(),
) {}

export class HashtagParticipationScorer extends createTagScorerClass(
	ScoreName.PARTICIPATED_TAGS,
	"Favour hastags you've tooted about",
	() => TagList.buildParticipatedTags(),
	Math.sqrt, // Use square root to prevent runaway scores for hashtags like #uspol
) {}
