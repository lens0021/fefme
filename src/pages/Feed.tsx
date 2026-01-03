/**
 * @fileoverview Class for retrieving and sorting the user's feed based on their chosen
 * weighting values.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";

import FeedCoordinator, {
	READY_TO_LOAD_MSG,
	type Post,
	optionalSuffix,
	timeString,
} from "../core/index";
import {
	CacheKey,
	FEDERATED_TIMELINE_SOURCE,
	TagPostsCategory,
} from "../core/enums";

import ApiErrorsPanel from "../components/ApiErrorsPanel";
import FeedFiltersAccordionSection from "../components/coordinator/FeedFiltersAccordionSection";
import WeightSetter from "../components/coordinator/WeightSetter";
import Accordion from "../components/helpers/Accordion";
import { persistentCheckbox } from "../components/helpers/Checkbox";
import StatusComponent from "../components/status/Status";
import { GuiCheckboxName, config } from "../config";
import { getLogger } from "../helpers/log_helpers";
import { booleanIcon } from "../helpers/ui";
import { reloadPage } from "../helpers/navigation";
import { useAlgorithm } from "../hooks/useAlgorithm";
import useOnScreen from "../hooks/useOnScreen";

const logger = getLogger("Feed");

/** Component to display the Fefme user's timeline. */
export default function Feed() {
	const {
		algorithm,
		hideSensitiveCheckbox,
		hasInitialCache,
		hasPendingTimeline,
		isRebuildLoading,
		isLoading,
		lastLoadDurationSeconds,
		currentUserWebfinger,
		pendingTimelineReasons,
		selfTypeFilterMode,
		timeline,
		triggerFeedUpdate,
		triggerHomeTimelineBackFill,
		triggerFederatedTimelineBackFill,
		triggerFavouritedTagBackFill,
		triggerParticipatedTagBackFill,
		triggerMoarData,
		triggerPullAllUserData,
	} = useAlgorithm();
	const { defaultNumDisplayedPosts, numPostsToLoadOnScroll } = config.timeline;

	// State variables
	const [isLoadingThread, setIsLoadingThread] = useState(false);
	const [numDisplayedPosts, setNumDisplayedPosts] = useState<number>(
		defaultNumDisplayedPosts,
	);
	const [scrollPercentage, setScrollPercentage] = useState(0);
	const [thread, setThread] = useState<Post[]>([]);
	const dataLoadingRef = useRef<HTMLDivElement>(null);

	// Checkboxes for persistent user settings state variables
	// TODO: the returned checkboxTooltip is shared by all tooltips which kind of sucks
	// TODO: kind of sucks that these checkboxes are instantiated here and the others are in useAlgorithm
	const [showLinkPreviews, showLinkPreviewsCheckbox, checkboxTooltip] =
		persistentCheckbox(GuiCheckboxName.showLinkPreviews);

	// Computed variables etc.
	const bottomRef = useRef<HTMLDivElement>(null);
	const isBottom = useOnScreen(bottomRef);
	const numShownPosts = Math.max(defaultNumDisplayedPosts, numDisplayedPosts);
	const showInitialLoading = !hasInitialCache && (isLoading || !algorithm);
	const showRebuildLoading = isRebuildLoading && hasInitialCache;
	const hasFilterReason = pendingTimelineReasons?.includes("filters") ?? false;
	const hasWeightReason = pendingTimelineReasons?.includes("weights") ?? false;
	const bubbleLabel =
		hasFilterReason || hasWeightReason
			? hasFilterReason && !hasWeightReason
				? "Apply filters"
				: "Update feed"
			: "New posts";
	const visibleTimeline = useMemo(() => {
		if (selfTypeFilterMode === "none" || !currentUserWebfinger) return timeline;
		const shouldInvert = selfTypeFilterMode === "exclude";
		return timeline.filter((post) => {
			const isSelf = post.accounts?.some(
				(account) => account.webfingerURI === currentUserWebfinger,
			);
			return shouldInvert ? !isSelf : isSelf;
		});
	}, [currentUserWebfinger, selfTypeFilterMode, timeline]);

	// Note: Auto-fetch is disabled when visible timeline is empty due to filters
	// User can manually load using buttons shown in the empty state

	// Show more posts when the user scrolls to bottom of the page
	// TODO: this triggers twice: once when isBottom changes to true and again because numDisplayedPosts
	//       is increased, triggering a second evaluation of the block
	useEffect(() => {
		const showMorePosts = () => {
			if (numDisplayedPosts < visibleTimeline.length) {
				logger.log(
					`Showing ${numDisplayedPosts} posts, adding ${numPostsToLoadOnScroll} more (${visibleTimeline.length} available in feed)`,
				);
				setNumDisplayedPosts((prev) => prev + numPostsToLoadOnScroll);
			}
		};

		// If the user scrolls to the bottom of the page, show more posts
		if (isBottom && visibleTimeline.length) showMorePosts();
		// If there's less than numDisplayedPosts in the feed set numDisplayedPosts to the # of posts in the feed
		if (visibleTimeline.length && visibleTimeline.length < numDisplayedPosts)
			setNumDisplayedPosts(visibleTimeline.length);

		const handleScroll = () => {
			const scrollHeight = document.documentElement.scrollHeight; // Total height
			const scrollPosition =
				document.documentElement.scrollTop || window.scrollY; // Current scroll position
			const viewportHeight = document.documentElement.clientHeight; // Visible viewport height
			const totalScrollableHeight = scrollHeight - viewportHeight; // Scrollable distance
			const percentage = totalScrollableHeight
				? (scrollPosition / totalScrollableHeight) * 100
				: 0;
			setScrollPercentage(percentage);

			if (
				percentage <= 10 &&
				numDisplayedPosts > defaultNumDisplayedPosts * 3
			) {
				const newNumDisplayedPosts = Math.floor(numDisplayedPosts * 0.8);
				logger.log(
					`Scroll pctage less than 10%, lowering numDisplayedPosts to ${newNumDisplayedPosts}`,
				);
				setNumDisplayedPosts(newNumDisplayedPosts);
			}
		};

		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, [
		isBottom,
		isLoading,
		numDisplayedPosts,
		visibleTimeline.length,
		defaultNumDisplayedPosts,
		numPostsToLoadOnScroll,
	]);

	// TODO: probably easier to not rely on fefme's measurement of the last load time; we can easily track it ourselves.
	const footerMsg = useMemo(() => {
		const base = `Scored ${(visibleTimeline.length || 0).toLocaleString()} posts`;
		return (
			base +
			optionalSuffix(
				lastLoadDurationSeconds,
				(seconds) => `in ${seconds.toFixed(1)} seconds`,
			)
		);
	}, [lastLoadDurationSeconds, visibleTimeline.length]);
	const dataStats = useMemo(() => {
		if (!algorithm) return null;
		return algorithm.getDataStats();
	}, [algorithm, lastLoadDurationSeconds, numDisplayedPosts, timeline.length]);

	const mostRecentCachedTime = useMemo(() => {
		if (!dataStats?.oldestCachedTime || !dataStats.mostRecentCachedTime) {
			return "N/A";
		}
		return timeString(dataStats.mostRecentCachedTime);
	}, [dataStats]);
	const hasCachedPosts = (dataStats?.feedTotal ?? 0) > 0;
	const sourceStats = dataStats?.sourceStats ?? {};
	const isEndOfCachedFeed =
		isBottom &&
		!showInitialLoading &&
		visibleTimeline.length > 0 &&
		numDisplayedPosts >= visibleTimeline.length;
	const formatSourceOldest = (sourceKey: string, usesId: boolean): string => {
		const stats = sourceStats[sourceKey];
		if (!stats || stats.total === 0)
			return "No cached posts for this source yet.";
		const oldestDate = stats.oldestCreatedAt
			? timeString(stats.oldestCreatedAt)
			: "N/A";
		if (!usesId) return `Oldest: ${oldestDate}.`;
		const oldestId = stats.oldestId || "N/A";
		const oldestIdDate = stats.oldestIdCreatedAt
			? timeString(stats.oldestIdCreatedAt)
			: oldestDate;
		return `Oldest id: ${oldestId} (${oldestIdDate}).`;
	};
	const sourceBackfills = useMemo(
		() => [
			{
				key: CacheKey.HOME_TIMELINE_POSTS,
				label: "home timeline",
				onClick: triggerHomeTimelineBackFill,
				usesId: true,
			},
			{
				key: FEDERATED_TIMELINE_SOURCE,
				label: "federated timeline",
				onClick: triggerFederatedTimelineBackFill,
				usesId: true,
			},
			{
				key: TagPostsCategory.FAVOURITED,
				label: "favourited tags",
				onClick: triggerFavouritedTagBackFill,
				usesId: true,
			},
			{
				key: TagPostsCategory.PARTICIPATED,
				label: "participated tags",
				onClick: triggerParticipatedTagBackFill,
				usesId: true,
			},
		],
		[
			triggerFavouritedTagBackFill,
			triggerFederatedTimelineBackFill,
			triggerHomeTimelineBackFill,
			triggerParticipatedTagBackFill,
		],
	);

	return (
		<div className="flex flex-col gap-4">
			<div style={{ cursor: isLoadingThread ? "wait" : "default" }}>
				{checkboxTooltip}

				<div className="flex flex-col gap-4">
					{/* Controls section */}
					<div className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] p-3">
						<WeightSetter />
						<FeedFiltersAccordionSection />
						<Accordion
							variant="top"
							title="Display Settings"
							defaultOpen={false}
						>
							<div className="flex flex-col gap-2 p-3 text-xs">
								{showLinkPreviewsCheckbox}
								{hideSensitiveCheckbox}
							</div>
						</Accordion>
						<div ref={dataLoadingRef}>
							<Accordion variant="top" title="Data Loading & History">
								<div className="flex flex-col gap-3 p-3 text-xs text-[color:var(--color-muted-fg)]">
									{dataStats && (
										<div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] p-2 text-[11px] text-[color:var(--color-fg)]">
											<div>
												Feed cache: {dataStats.feedTotal.toLocaleString()} posts
											</div>
											<div>
												Home timeline cache:{" "}
												{dataStats.homeFeedTotal.toLocaleString()} posts
											</div>
											<div>
												Unseen in cache:{" "}
												{dataStats.unseenTotal.toLocaleString()} posts
											</div>
											<div>
												Visible now: {visibleTimeline.length.toLocaleString()}{" "}
												posts (
												{Math.min(
													numShownPosts,
													visibleTimeline.length,
												).toLocaleString()}{" "}
												displayed)
											</div>
											{!isLoading && <div>{footerMsg}</div>}
											{FeedCoordinator.isDebugMode && (
												<div>
													Displaying {numDisplayedPosts} Posts (Scroll:{" "}
													{scrollPercentage.toFixed(1)}%)
												</div>
											)}
										</div>
									)}

									<p>
										{hasCachedPosts
											? "Use these tools to pull newer posts, older posts, or more history for scoring. Each action updates the same weighted feed."
											: "No cached posts yet. Load your timeline to get started."}
									</p>

									<div className="flex flex-col gap-3 text-xs">
										<button
											type="button"
											onClick={triggerFeedUpdate}
											className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-left font-semibold text-[color:var(--color-primary)]"
										>
											Load new posts
										</button>
										<span>
											{hasCachedPosts
												? `Fetches posts created after your most recent cached post (${mostRecentCachedTime}), then re-scores the feed.`
												: "Fetches your home timeline, federated timeline, and tag posts, then scores and sorts them."}
										</span>

										<div className="pt-1 text-[11px] font-semibold text-[color:var(--color-fg)]">
											Load older posts by source
										</div>
										{sourceBackfills.map((source) => {
											const stats = sourceStats[source.key];
											const isDisabled = !stats || stats.total === 0;
											const buttonClass = isDisabled
												? "rounded-md border border-[color:var(--color-border)] px-2 py-1 text-left font-semibold text-[color:var(--color-muted-fg)] opacity-60"
												: "rounded-md border border-[color:var(--color-border)] px-2 py-1 text-left font-semibold text-[color:var(--color-primary)]";
											return (
												<React.Fragment key={source.key}>
													<button
														type="button"
														onClick={source.onClick}
														disabled={isDisabled}
														className={buttonClass}
													>
														Load older {source.label} posts
													</button>
													<span>
														{`Backfills older ${source.label} posts. ${formatSourceOldest(
															source.key,
															source.usesId,
														)}`}
													</span>
												</React.Fragment>
											);
										})}

										<button
											type="button"
											onClick={triggerMoarData}
											className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-left font-semibold text-[color:var(--color-primary)]"
										>
											Load more algorithm data
										</button>
										<span>
											Pulls extra user data (recent posts, favourites,
											notifications) to improve scoring accuracy.
										</span>

										<button
											type="button"
											onClick={triggerPullAllUserData}
											className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-left font-semibold text-[color:var(--color-primary)]"
										>
											Load complete user history
										</button>
										<span>
											Fetches all your posts and favourites to refine scoring.
											This can take a while on large accounts.
										</span>
									</div>
								</div>
							</Accordion>
						</div>

						{thread.length > 0 && (
							<Accordion
								variant="top"
								onExited={() => setThread([])}
								defaultOpen={true}
								title="Thread"
							>
								{thread.map((post) => (
									<StatusComponent
										fontColor="black"
										key={post.uri}
										showLinkPreviews={showLinkPreviews}
										status={post}
									/>
								))}
							</Accordion>
						)}

						{(showInitialLoading || showRebuildLoading) && (
							<div className="flex items-center gap-3 mb-2">
								<div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
								<p>
									{showRebuildLoading
										? "Rebuilding feed..."
										: `${algorithm?.loadingStatus || READY_TO_LOAD_MSG}...`}
								</p>
							</div>
						)}

						<ApiErrorsPanel />

						{FeedCoordinator.isDebugMode && (
							<div className="font-mono rounded-2xl bg-slate-800 text-slate-200 text-sm p-4">
								<ul>
									<li>
										<strong>NODE_ENV:</strong> {import.meta.env.MODE}
									</li>
									<li>
										<strong>Debug Mode:</strong>{" "}
										{booleanIcon(FeedCoordinator.isDebugMode)}
									</li>
									<li>
										<strong>Deep Debug:</strong>{" "}
										{booleanIcon(FeedCoordinator.isDeepDebug)}
									</li>
									<li>
										<strong>Load Test:</strong>{" "}
										{booleanIcon(FeedCoordinator.isLoadTest)}
									</li>
									<li>
										<strong>Quick Mode:</strong>{" "}
										{booleanIcon(FeedCoordinator.isQuickMode)}
									</li>
								</ul>
							</div>
						)}
					</div>

					{/* Feed column */}
					<div className="flex flex-col gap-3">
						{showInitialLoading ? (
							<div className="flex min-h-[40vh] items-center justify-center gap-3">
								<div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
								<p>{`${config.timeline.defaultLoadingMsg}...`}</p>
							</div>
						) : (
							<>
								{visibleTimeline.slice(0, numShownPosts).map((post) => (
									<StatusComponent
										isLoadingThread={isLoadingThread}
										key={post.uri}
										setThread={setThread}
										setIsLoadingThread={setIsLoadingThread}
										showLinkPreviews={showLinkPreviews}
										status={post}
									/>
								))}

								{isEndOfCachedFeed && (
									<div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] p-4 text-sm text-[color:var(--color-muted-fg)]">
										You have reached the end of cached posts. Use{" "}
										<button
											type="button"
											className="font-semibold text-[color:var(--color-primary)] underline underline-offset-2"
											onClick={() =>
												dataLoadingRef.current?.scrollIntoView({
													behavior: "smooth",
													block: "start",
												})
											}
										>
											Data Loading & History
										</button>{" "}
										to backfill more.
									</div>
								)}

								{visibleTimeline.length === 0 && (
									<div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
										<p className="text-lg">{config.timeline.noPostsMsg}</p>
										<div className="flex flex-col gap-2 text-sm">
											<button
												type="button"
												onClick={triggerFeedUpdate}
												className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] px-4 py-2 font-semibold text-[color:var(--color-primary)] hover:bg-[color:var(--color-muted)]"
											>
												Load new posts
											</button>
											<div className="pt-1 text-xs text-[color:var(--color-muted-fg)]">
												Load older posts by source (requires cached posts)
											</div>
											{sourceBackfills.map((source) => {
												const stats = sourceStats[source.key];
												const isDisabled = !stats || stats.total === 0;
												const buttonClass = isDisabled
													? "rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] px-4 py-2 font-semibold text-[color:var(--color-muted-fg)] opacity-60"
													: "rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] px-4 py-2 font-semibold text-[color:var(--color-primary)] hover:bg-[color:var(--color-muted)]";
												return (
													<button
														key={source.key}
														type="button"
														onClick={source.onClick}
														disabled={isDisabled}
														className={buttonClass}
													>
														Load older {source.label} posts
													</button>
												);
											})}
										</div>
									</div>
								)}

								<div ref={bottomRef} className="mt-2.5" />
							</>
						)}
					</div>

					{hasPendingTimeline && !showInitialLoading && (
						<div className="pointer-events-none fixed top-6 left-1/2 z-50 -translate-x-1/2">
							<button
								type="button"
								onClick={() => {
									reloadPage();
								}}
								aria-label={bubbleLabel}
								className="pointer-events-auto rounded-full bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02]"
								data-testid="refresh-bubble"
							>
								{bubbleLabel}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
