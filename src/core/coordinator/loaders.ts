import MastoApi from "../api/api";
import { FEDERATED_TIMELINE_SOURCE } from "../enums";
import type Post from "../api/objects/post";
import type { AlgorithmState } from "./state";
import { getSourceBounds } from "./stats";
import { mergeExternalStatuses } from "./feed";
import type { Logger } from "../helpers/logger";

export async function getHomeTimeline(
	mergePostsToFeed: (posts: Post[], logger: Logger) => Promise<void>,
	moreOldPosts?: boolean,
): Promise<Post[]> {
	return await MastoApi.instance.fetchHomeFeed({
		mergePostsToFeed,
		moar: moreOldPosts,
	});
}

export async function mergeFederatedTimeline(
	state: AlgorithmState,
	direction: "newer" | "older",
	limit = 40,
): Promise<void> {
	const { minId, maxId } = getSourceBounds(state, FEDERATED_TIMELINE_SOURCE);
	const statuses = await MastoApi.instance.getFederatedTimelineStatuses({
		limit,
		minId: direction === "newer" ? maxId : null,
		maxId: direction === "older" ? minId : null,
	});
	await mergeExternalStatuses(state, statuses, FEDERATED_TIMELINE_SOURCE);
}
