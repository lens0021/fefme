import type Post from "../api/objects/post";
import type { StringNumberDict } from "../types";
import Scorer from "./scorer";

/**
 * Base class for scorers that require processing external data before they can score anything.
 * For example {@linkcode DiversityFeedScorer} has to count how many posts by each user are in
 * your feed before it knows how much to penalize prolific tooters.
 */
export default abstract class FeedScorer extends Scorer {
	// Take an array of Posts and extract the scoreData needed to score a post
	extractScoreDataFromFeed(feed: Post[]): void {
		this.scoreData = this.extractScoringData(feed);
		this.logger.trace(
			`extractScoringData() returned scoreData:`,
			this.scoreData,
		);
		this.isReady = true;
	}

	// Required implementation of the feed extractor function called in setFeed()
	abstract extractScoringData(feed: Post[]): StringNumberDict;
}
