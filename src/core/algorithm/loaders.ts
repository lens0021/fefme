import MastoApi from "../api/api";
import { FEDERATED_TIMELINE_SOURCE } from "../enums";
import type Toot from "../api/objects/toot";
import type { AlgorithmState } from "./state";
import { getSourceBounds } from "./stats";
import { mergeExternalStatuses } from "./feed";
import type { Logger } from "../helpers/logger";

export async function getHomeTimeline(
	mergeTootsToFeed: (toots: Toot[], logger: Logger) => Promise<void>,
	moreOldToots?: boolean,
): Promise<Toot[]> {
	return await MastoApi.instance.fetchHomeFeed({
		mergeTootsToFeed,
		moar: moreOldToots,
	});
}

export async function mergeFederatedTimeline(
	state: AlgorithmState,
	direction: "newer" | "older",
	limit = 40,
): Promise<void> {
	const { minId, maxId } = getSourceBounds(
		state,
		FEDERATED_TIMELINE_SOURCE,
	);
	const statuses = await MastoApi.instance.getFederatedTimelineStatuses({
		limit,
		minId: direction === "newer" ? maxId : null,
		maxId: direction === "older" ? minId : null,
	});
	await mergeExternalStatuses(state, statuses, FEDERATED_TIMELINE_SOURCE);
}
