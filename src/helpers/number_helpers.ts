import { isNil, isNumber, mapValues, omitBy, round } from "lodash";
import { config } from "../config";
/*
 * Help with numbers.
 */
import { appLogger } from "./log_helpers";

// Remove scores with a raw score of 0
export function formatScores(scores: object | number): object | number {
	if (typeof scores === "number") return formatScore(scores);

	const filtered = omitBy(
		scores,
		(v) => typeof v === "object" && v !== null && v.raw === 0,
	);
	return mapValues(filtered, (v) => formatScores(v as object | number));
}

// Round a number to a given number of digits
export function formatScore(score: number): number {
	if (!isNumber(score)) {
		appLogger.warn("formatScore() called with non-number:", score);
		return score;
	}

	if (Math.abs(score) < 10 ** (-1 * config.posts.scoreDigits)) return score;
	return round(score, config.posts.scoreDigits);
}
