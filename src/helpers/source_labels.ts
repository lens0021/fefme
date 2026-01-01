import {
	AlgorithmStorageKey,
	CacheKey,
	FediverseCacheKey,
	FEDERATED_TIMELINE_SOURCE,
	LoadAction,
	TagTootsCategory,
	UNKNOWN_SOURCE,
} from "../core/enums";

const SOURCE_LABELS: Record<string, string> = {
	[AlgorithmStorageKey.TIMELINE_TOOTS]: "Cached timeline",
	[CacheKey.FAVOURITED_TOOTS]: "Favourited posts",
	[CacheKey.HASHTAG_TOOTS]: "Hashtag timeline",
	[CacheKey.HOME_TIMELINE_TOOTS]: "Home timeline",
	[CacheKey.RECENT_USER_TOOTS]: "Your posts",
	[FediverseCacheKey.TRENDING_TOOTS]: "Trending posts",
	[TagTootsCategory.FAVOURITED]: "Favourited hashtags",
	[TagTootsCategory.PARTICIPATED]: "Hashtags you posted",
	[TagTootsCategory.TRENDING]: "Trending hashtags",
	[LoadAction.GET_CONVERSATION]: "Conversation",
	[FEDERATED_TIMELINE_SOURCE]: "Federated timeline",
	[UNKNOWN_SOURCE]: "Unknown",
};

const normalizeSourceKey = (source: string): string =>
	source.replace(/[^a-z0-9]/gi, "").toLowerCase();

const NORMALIZED_SOURCE_LABELS = Object.entries(SOURCE_LABELS).reduce(
	(labels, [key, label]) => {
		labels[normalizeSourceKey(key)] = label;
		return labels;
	},
	{} as Record<string, string>,
);

export const formatSourceLabel = (source: string): string => {
	const normalized = normalizeSourceKey(source);
	return (
		SOURCE_LABELS[source] ??
		NORMALIZED_SOURCE_LABELS[normalized] ??
		source.replace(/([a-z])([A-Z])/g, "$1 $2")
	);
};
