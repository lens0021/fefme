import { config } from "../config";
/*
 * Help with numbers.
 */
import { appLogger } from "./log_helpers";

// Remove scores with a raw score of 0
export function formatScores(scores: object | number): object | number {
	if (typeof scores === "number") return formatScore(scores);

	return Object.entries(scores).reduce((acc, [k, v]) => {
		// Guard against null before accessing properties (typeof null === "object")
		if (typeof v === "object" && v !== null && v.raw === 0) {
			return acc;
		}

		acc[k] = formatScores(v);
		return acc;
	}, {} as object);
}

// Round a number to a given number of digits
export function formatScore(score: number): number {
	if (typeof score !== "number") {
		appLogger.warn("formatScore() called with non-number:", score);
		return score;
	}

	if (Math.abs(score) < 10 ** (-1 * config.posts.scoreDigits)) return score;
	return Number(score.toPrecision(config.posts.scoreDigits));
}
