/*
 * Methods for dealing with trending link and tag objects and the history data they come with.
 *
 * Example mastodon.v1.TrendLink:
 *   {
 *       "name": "southkorea",
 *       "url": "https://journa.host/tags/southkorea",
 *       "history": [
 *           {
 *               "day": "1733184000",
 *               "accounts": "125",
 *               "uses": "374"
 *           },
 *           {
 *               "day": "1733097600",
 *               "accounts": "4",
 *               "uses": "146"
 *           },
 *           <...snip, usually 7 days of info...>
 *       ]
 *   }
 */
import type { mastodon } from "masto";

import { config } from "../../config";
import { average } from "../../helpers/collection_helpers";
import { wordRegex } from "../../helpers/string_helpers";
import type { TrendingLink, TrendingWithHistory } from "../../types";

/**
 * Decorate a Mastodon {@linkcode https://docs.joinmastodon.org/entities/PreviewCard/#trends-link TrendLink}
 * with computed history data, adding {@linkcode numPosts} & {@linkcode numAccounts} properties.
 * @param {mastodon.v1.TrendLink} link - The TrendLink object to decorate.
 * @returns {TrendingLink} The decorated TrendingLink object.
 */
export function decorateLinkHistory(link: mastodon.v1.TrendLink): TrendingLink {
	const newLink = link as TrendingLink;
	newLink.regex = wordRegex(newLink.url);
	return decorateHistoryScores(newLink);
}

/**
 * Return one of each unique trending object sorted by the number of accounts posting that object.
 * The {@linkcode numPosts} & {@linkcode numAccounts} props for each trending object are set to
 * the max value encountered.
 * @param {T[]} trendingObjs - Array of trending objects to uniquify.
 * @param {(obj: T) => string} uniqueKey - Function that returns the key to use for uniqueness.
 * @returns {T[]} Array of unique trending objects sorted by {@linkcode numAccounts}.
 */
export function uniquifyTrendingObjs<T extends TrendingWithHistory>(
	trendingObjs: T[],
	uniqueKey: (obj: T) => string,
): T[] {
	const urlObjs = trendingObjs.reduce(
		(unique, obj) => {
			const key = uniqueKey(obj).toLowerCase();

			if (unique[key]) {
				unique[key].numAccounts = Math.max(
					unique[key].numAccounts || 0,
					obj.numAccounts || 0,
				);
				unique[key].numPosts = Math.max(
					unique[key].numPosts || 0,
					obj.numPosts || 0,
				);
			} else {
				unique[key] = obj;
			}

			return unique;
		},
		{} as Record<string, TrendingWithHistory>,
	);

	// TODO: should this sort by numPosts too instead? Usually we sort things by numPosts but here we want to sort by numAccounts
	const sortedObjs = Object.values(urlObjs).sort(
		(a, b) => (b.numAccounts || 0) - (a.numAccounts || 0),
	);
	return sortedObjs as T[];
}

/**
 * Add {@linkcode numPosts} & {@linkcode numAccounts} to the trending object by summing
 * {@linkcode config.trending.daysToCountTrendingData} of 'history'.
 * @template T
 * @param {T} obj - The trending object to decorate.
 * @returns {T} The decorated trending object.
 */
function decorateHistoryScores<T extends TrendingWithHistory>(obj: T): T {
	obj.url = obj.url.toLowerCase().trim(); // TODO: not ideal for this to happen here

	if (!obj.history?.length) {
		console.warn(`decorateHistoryScores() found no history for:`, obj);
		obj.history = [];
	}

	const recentHistory = obj.history.slice(
		0,
		config.trending.daysToCountTrendingData,
	);
	obj.numPosts = recentHistory.reduce(
		(total, h) => total + Number.parseInt(h.uses),
		0,
	);
	obj.numAccounts = recentHistory.reduce(
		(total, h) => total + Number.parseInt(h.accounts),
		0,
	);
	return obj;
}
