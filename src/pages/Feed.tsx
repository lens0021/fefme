/**
 * @fileoverview Class for retrieving and sorting the user's feed based on their chosen
 * weighting values.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";

import TheAlgorithm, {
	READY_TO_LOAD_MSG,
	BooleanFilterName,
	type Toot,
	optionalSuffix,
} from "../core/index";
import { buildNewFilterSettings } from "../core/filters/feed_filters";
import { Tooltip } from "react-tooltip";

import ApiErrorsPanel from "../components/ApiErrorsPanel";
import FeedFiltersAccordionSection from "../components/algorithm/FeedFiltersAccordionSection";
import WeightSetter from "../components/algorithm/WeightSetter";
import Accordion from "../components/helpers/Accordion";
import { persistentCheckbox } from "../components/helpers/Checkbox";
import { confirm } from "../components/helpers/Confirmation";
import StatusComponent, {
	TOOLTIP_ACCOUNT_ANCHOR,
} from "../components/status/Status";
import { GuiCheckboxName, config } from "../config";
import { getLogger } from "../helpers/log_helpers";
import { booleanIcon } from "../helpers/ui";
import { useAlgorithm } from "../hooks/useAlgorithm";
import { useAuthContext } from "../hooks/useAuth";
import useOnScreen from "../hooks/useOnScreen";

const logger = getLogger("Feed");

/** Component to display the FediAlgo user's timeline. */
export default function Feed() {
	const {
		algorithm,
		hideSensitiveCheckbox,
		isLoading,
		lastLoadDurationSeconds,
		currentUserWebfinger,
		resetAlgorithm,
		selfTypeFilterMode,
		timeline,
		triggerFeedUpdate,
		triggerHomeTimelineBackFill,
		triggerMoarData,
		triggerPullAllUserData,
		setSelfTypeFilterMode,
	} = useAlgorithm();
	const { logout, setApp } = useAuthContext();

	// State variables
	const [isLoadingThread, setIsLoadingThread] = useState(false);
	const [numDisplayedToots, setNumDisplayedToots] = useState<number>(
		config.timeline.defaultNumDisplayedToots,
	);
	const [scrollPercentage, setScrollPercentage] = useState(0);
	const [thread, setThread] = useState<Toot[]>([]);
	const lastAutoBackfillSize = useRef<number | null>(null);

	// Checkboxes for persistent user settings state variables
	// TODO: the returned checkboxTooltip is shared by all tooltips which kind of sucks
	// TODO: kind of sucks that these checkboxes are instantiated here and the others are in useAlgorithm
	const [showLinkPreviews, showLinkPreviewsCheckbox, checkboxTooltip] =
		persistentCheckbox(GuiCheckboxName.showLinkPreviews);

	// Computed variables etc.
	const bottomRef = useRef<HTMLDivElement>(null);
	const isBottom = useOnScreen(bottomRef);
	const numShownToots = Math.max(
		config.timeline.defaultNumDisplayedToots,
		numDisplayedToots,
	);
	const visibleTimeline = useMemo(() => {
		if (selfTypeFilterMode === "none" || !currentUserWebfinger) return timeline;
		const shouldInvert = selfTypeFilterMode === "exclude";
		return timeline.filter((toot) => {
			const isSelf = toot.accounts?.some(
				(account) => account.webfingerURI === currentUserWebfinger,
			);
			return shouldInvert ? !isSelf : isSelf;
		});
	}, [currentUserWebfinger, selfTypeFilterMode, timeline]);

	// Reset all state except for the user and server
	const reset = async () => {
		if (
			!(await confirm(
				"Are you sure you want to reset your feed data? (You will stay logged in)",
			))
		)
			return;
		setNumDisplayedToots(config.timeline.defaultNumDisplayedToots);
		resetAlgorithm();
	};
	const resetToDefaults = async () => {
		if (
			!(await confirm(
				"Reset weights and filters to defaults? Your cached posts will stay.",
			))
		)
			return;
		localStorage.removeItem("fefme_user_weights");
		localStorage.removeItem("type-filter-self");
		await algorithm?.updateUserWeightsToPreset("default");
		algorithm?.updateFilters(buildNewFilterSettings());
		setSelfTypeFilterMode?.("none");
	};
	const handleLogout = () => {
		logout();
	};
	const deleteAllData = async () => {
		if (
			!(await confirm(
				"Delete all data and log out? You will need to reauthenticate.",
			))
		)
			return;
		setApp(null);
		await algorithm?.reset(true);
		logout();
	};

	// Show more posts when the user scrolls to bottom of the page
	// TODO: this triggers twice: once when isbottom changes to true and again because numDisplayedToots
	//       is increased, triggering a second evaluation of the block
	useEffect(() => {
		const showMoreToots = () => {
			if (numDisplayedToots < visibleTimeline.length) {
				const msg = `Showing ${numDisplayedToots} posts, adding ${config.timeline.numTootsToLoadOnScroll}`;
				logger.log(`${msg} more (${visibleTimeline.length} available in feed)`);
				setNumDisplayedToots(
					numDisplayedToots + config.timeline.numTootsToLoadOnScroll,
				);
			}
		};

		// If the user scrolls to the bottom of the page, show more posts
		if (isBottom && visibleTimeline.length) showMoreToots();
		if (
			isBottom &&
			!isLoading &&
			visibleTimeline.length &&
			numDisplayedToots >= visibleTimeline.length &&
			lastAutoBackfillSize.current !== visibleTimeline.length
		) {
			lastAutoBackfillSize.current = visibleTimeline.length;
			triggerHomeTimelineBackFill?.();
		}
		// If there's less than numDisplayedToots in the feed set numDisplayedToots to the # of posts in the feed
		if (visibleTimeline.length && visibleTimeline.length < numDisplayedToots)
			setNumDisplayedToots(visibleTimeline.length);

		const handleScroll = () => {
			const scrollHeight = document.documentElement.scrollHeight; // Total height
			const scrollPosition =
				document.documentElement.scrollTop || window.scrollY; // Current scroll position
			const viewportHeight = document.documentElement.clientHeight; // Visible viewport height
			const totalScrollableHeight = scrollHeight - viewportHeight; // Scrollable distance
			const percentage = (scrollPosition / totalScrollableHeight) * 100;
			setScrollPercentage(percentage);

			if (
				percentage <= 50 &&
				numDisplayedToots > config.timeline.defaultNumDisplayedToots * 2
			) {
				const newNumDisplayedToots = Math.floor(numDisplayedToots * 0.7);
				logger.log(
					`Scroll pctage less than 50%, lowering numDisplayedToots to ${newNumDisplayedToots}`,
				);
				setNumDisplayedToots(newNumDisplayedToots);
			}
		};

		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, [
		isBottom,
		isLoading,
		numDisplayedToots,
		triggerHomeTimelineBackFill,
		visibleTimeline.length,
	]);

	// TODO: probably easier to not rely on fedialgo's measurement of the last load time; we can easily track it ourselves.
	let footerMsg = `Scored ${(visibleTimeline.length || 0).toLocaleString()} posts`;
	footerMsg += optionalSuffix(
		lastLoadDurationSeconds,
		(seconds) => `in ${seconds.toFixed(1)} seconds`,
	);
	const dataStats = useMemo(() => {
		if (!algorithm) return null;
		return algorithm.getDataStats();
	}, [algorithm, lastLoadDurationSeconds, numDisplayedToots, timeline.length]);

	return (
		<div className="flex flex-col gap-4">
			<div style={{ cursor: isLoadingThread ? "wait" : "default" }}>
				{/* Tooltip options: https://react-tooltip.com/docs/options */}
				<Tooltip
					border={"solid"}
					className="z-[2000] max-w-[calc(100vw-2rem)] whitespace-normal break-words"
					clickable={true}
					delayShow={config.timeline.tooltips.accountTooltipDelayMS}
					id={TOOLTIP_ACCOUNT_ANCHOR}
					opacity={0.95}
					place="bottom"
					variant="light"
				/>

				{checkboxTooltip}

				<div className="flex flex-col gap-4">
					{/* Controls section */}
					<div className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] p-3">
						<div className="flex flex-col gap-2 text-xs">
							{showLinkPreviewsCheckbox}
							{hideSensitiveCheckbox}
						</div>

						{algorithm && <WeightSetter />}
						{algorithm && <FeedFiltersAccordionSection />}
						{algorithm && (
							<Accordion variant="top" title="Data Loading & History">
								<div className="flex flex-col gap-3 p-3 text-xs text-[color:var(--color-muted-fg)]">
									<p>
										Use these tools to pull newer posts, older posts, or more
										history for scoring. Each action updates the same weighted
										feed.
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
											Fetches posts created after your most recent cached post,
											then re-scores the feed.
										</span>

										<button
											type="button"
											onClick={triggerHomeTimelineBackFill}
											className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-left font-semibold text-[color:var(--color-primary)]"
										>
											Load older posts
										</button>
										<span>
											Backfills older home-timeline posts starting from your
											current oldest cached post.
										</span>

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
												Visible now:{" "}
												{visibleTimeline.length.toLocaleString()} posts (
												{Math.min(numShownToots, visibleTimeline.length).toLocaleString()}{" "}
												displayed)
											</div>
										</div>
									)}
								</div>
							</Accordion>
						)}

						{thread.length > 0 && (
							<Accordion
								variant="top"
								onExited={() => setThread([])}
								defaultOpen={true}
								title="Thread"
							>
								{thread.map((toot) => (
									<StatusComponent
										fontColor="black"
										key={toot.uri}
										showLinkPreviews={showLinkPreviews}
										status={toot}
									/>
								))}
							</Accordion>
						)}

						<div className="flex flex-col gap-1 text-xs text-[color:var(--color-muted-fg)]">
							{isLoading ? (
								<div className="flex items-center gap-3">
									<div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
									<p>{`${algorithm?.loadingStatus || READY_TO_LOAD_MSG}...`}</p>
								</div>
							) : (
								<>
									<p>{footerMsg}</p>
									<details className="mt-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-2 text-xs text-[color:var(--color-muted-fg)]">
										<summary className="cursor-pointer font-semibold">
											Account & data reset
										</summary>
										<div className="mt-2 flex flex-col gap-3 text-xs">
											<div className="flex flex-col gap-1">
												<span>Reset cached posts and reload the feed.</span>
												<button
													type="button"
													onClick={reset}
													className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
												>
													Reset feed data
												</button>
											</div>
											<div className="flex flex-col gap-1">
												<span>
													Reset all feed weights and filters to their defaults.
												</span>
												<button
													type="button"
													onClick={resetToDefaults}
													className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-xs font-semibold text-[color:var(--color-primary)]"
												>
													Reset to defaults
												</button>
											</div>
											<div className="flex flex-col gap-1">
												<span>Sign out of this session.</span>
												<button
													type="button"
													onClick={handleLogout}
													className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-xs font-semibold text-[color:var(--color-primary)]"
												>
													Log out
												</button>
											</div>
											<div className="flex flex-col gap-1">
												<span>
													Delete all local data, clear the app, and log out.
												</span>
												<button
													type="button"
													onClick={deleteAllData}
													className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
												>
													Delete all data & log out
												</button>
											</div>
										</div>
									</details>
								</>
							)}

							<p>
								{TheAlgorithm.isDebugMode ? (
									`Displaying ${numDisplayedToots} Posts (Scroll: ${scrollPercentage.toFixed(1)}%)`
								) : (
									<>
										Report bugs on{" "}
										<a
											href={config.app.issuesUrl}
											className="text-[color:var(--color-primary)] no-underline"
											target="_blank"
											rel="noopener noreferrer"
										>
											GitHub
										</a>
									</>
								)}
							</p>
						</div>

						{algorithm && <ApiErrorsPanel />}

						{TheAlgorithm.isDebugMode && (
							<div className="font-mono rounded-2xl bg-slate-800 text-slate-200 text-sm p-4">
								<ul>
									<li>
										<strong>NODE_ENV:</strong> {import.meta.env.MODE}
									</li>
									<li>
										<strong>Debug Mode:</strong>{" "}
										{booleanIcon(TheAlgorithm.isDebugMode)}
									</li>
									<li>
										<strong>Deep Debug:</strong>{" "}
										{booleanIcon(TheAlgorithm.isDeepDebug)}
									</li>
									<li>
										<strong>Load Test:</strong>{" "}
										{booleanIcon(TheAlgorithm.isLoadTest)}
									</li>
									<li>
										<strong>Quick Mode:</strong>{" "}
										{booleanIcon(TheAlgorithm.isQuickMode)}
									</li>
								</ul>
							</div>
						)}
					</div>

					{/* Feed column */}
					<div className="flex flex-col gap-3">
						{visibleTimeline.slice(0, numShownToots).map((toot) => (
							<StatusComponent
								isLoadingThread={isLoadingThread}
								key={toot.uri}
								setThread={setThread}
								setIsLoadingThread={setIsLoadingThread}
								showLinkPreviews={showLinkPreviews}
								status={toot}
							/>
						))}

						{visibleTimeline.length === 0 &&
							(isLoading ? (
								<div className="flex min-h-[40vh] items-center justify-center gap-3">
									<div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
									<p>{`${config.timeline.defaultLoadingMsg}...`}</p>
								</div>
							) : (
								<div className="flex min-h-[40vh] items-center justify-center text-lg">
									<p>{config.timeline.noTootsMsg}</p>
								</div>
							))}

						<div ref={bottomRef} className="mt-2.5" />
					</div>
				</div>
			</div>
		</div>
	);
}
