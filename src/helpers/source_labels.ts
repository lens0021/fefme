import {
	AlgorithmStorageKey,
	CacheKey,
	FediverseCacheKey,
	FEDERATED_TIMELINE_SOURCE,
	LoadAction,
	TagTootsCategory,
} from "../core/enums";

const SOURCE_LABELS: Record<string, string> = {
	[AlgorithmStorageKey.TIMELINE_TOOTS]: "Cached timeline",
	[CacheKey.FAVOURITED_TOOTS]: "Favourited posts",
	[CacheKey.HASHTAG_TOOTS]: "Hashtag timeline",
	[CacheKey.HOME_TIMELINE_TOOTS]: "Home timeline",
	[CacheKey.RECENT_USER_TOOTS]: "Your posts",
	[FediverseCacheKey.TRENDING_TOOTS]: "Trending posts",
	[TagTootsCategory.FAVOURITED]: "Favourited hashtags",
	[TagTootsCategory.PARTICIPATED]: "Participated hashtags",
	[TagTootsCategory.TRENDING]: "Trending hashtags",
	[LoadAction.GET_CONVERSATION]: "Conversation",
	[FEDERATED_TIMELINE_SOURCE]: "Federated timeline",
};

export const formatSourceLabel = (source: string): string =>
	SOURCE_LABELS[source] ?? source.replace(/([a-z])([A-Z])/g, "$1 $2");
