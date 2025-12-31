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
import { Tooltip } from "react-tooltip";

import ApiErrorsPanel from "../components/ApiErrorsPanel";
import FeedFiltersAccordionSection from "../components/algorithm/FeedFiltersAccordionSection";
import WeightSetter from "../components/algorithm/WeightSetter";
import ExperimentalFeatures from "../components/experimental/ExperimentalFeatures";
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
import useOnScreen from "../hooks/useOnScreen";

const LOAD_BUTTON_SEPARATOR = " ● ";
const LOAD_BUTTON_TOOLTIP_ANCHOR = "tooltipped-link-anchor";
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
		selfTypeFilterEnabled,
		timeline,
		triggerFeedUpdate,
		triggerHomeTimelineBackFill,
		triggerMoarData,
	} = useAlgorithm();

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
		if (!selfTypeFilterEnabled || !currentUserWebfinger) return timeline;
		const shouldInvert =
			algorithm?.filters?.booleanFilters?.[BooleanFilterName.TYPE]
				?.invertSelection ?? false;
		return timeline.filter((toot) => {
			const isSelf = toot.accounts?.some(
				(account) => account.webfingerURI === currentUserWebfinger,
			);
			return shouldInvert ? !isSelf : isSelf;
		});
	}, [algorithm, currentUserWebfinger, selfTypeFilterEnabled, timeline]);

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

	// Show more posts when the user scrolls to bottom of the page
	// TODO: this triggers twice: once when isbottom changes to true and again because numDisplayedToots
	//       is increased, triggering a second evaluation of the block
	useEffect(() => {
		const showMoreToots = () => {
			if (numDisplayedToots < visibleTimeline.length) {
			const msg = `Showing ${numDisplayedToots} posts, adding ${config.timeline.numTootsToLoadOnScroll}`;
				logger.log(
					`${msg} more (${visibleTimeline.length} available in feed)`,
				);
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
						{algorithm && <ExperimentalFeatures />}

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
											Reset feed data
										</summary>
										<div className="mt-2 flex items-center justify-between gap-2">
											<span>Clears cached timeline data and reloads.</span>
											<button
												type="button"
												onClick={reset}
												className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
											>
												Reset
											</button>
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
						{algorithm && !isLoading && (
							<div className="text-center text-xs">
								<Tooltip
									border={"solid"}
									className="text-xs z-[2000] max-w-[calc(100vw-2rem)] whitespace-normal break-words"
									delayShow={config.timeline.tooltips.defaultTooltipDelayMS}
									id={LOAD_BUTTON_TOOLTIP_ANCHOR}
									opacity={0.95}
									place="bottom"
									variant="light"
								/>

								<div className="flex flex-wrap items-center justify-center gap-2">
									<button
										type="button"
										data-tooltip-content={
											config.timeline.loadTootsButtonLabels.loadNewToots
												.tooltipText
										}
										data-tooltip-id={LOAD_BUTTON_TOOLTIP_ANCHOR}
										className="cursor-pointer text-[color:var(--color-primary)] font-semibold"
										onClick={triggerFeedUpdate}
									>
										<span
											style={
												config.timeline.loadTootsButtonLabels.loadNewToots
													.labelStyle
											}
										>
											{config.timeline.loadTootsButtonLabels.loadNewToots.label}
										</span>
									</button>

									<span>{LOAD_BUTTON_SEPARATOR}</span>

									<button
										type="button"
										data-tooltip-content={
											config.timeline.loadTootsButtonLabels.loadOldToots
												.tooltipText
										}
										data-tooltip-id={LOAD_BUTTON_TOOLTIP_ANCHOR}
										className="cursor-pointer text-[color:var(--color-primary)] font-semibold"
										onClick={triggerHomeTimelineBackFill}
									>
										<span
											style={
												config.timeline.loadTootsButtonLabels.loadOldToots
													.labelStyle
											}
										>
											{config.timeline.loadTootsButtonLabels.loadOldToots.label}
										</span>
									</button>

									<span>{LOAD_BUTTON_SEPARATOR}</span>

									<button
										type="button"
										data-tooltip-content={
											config.timeline.loadTootsButtonLabels
												.loadUserDataForAlgorithm.tooltipText
										}
										data-tooltip-id={LOAD_BUTTON_TOOLTIP_ANCHOR}
										className="cursor-pointer text-[color:var(--color-primary)] font-semibold"
										onClick={triggerMoarData}
									>
										<span
											style={
												config.timeline.loadTootsButtonLabels
													.loadUserDataForAlgorithm.labelStyle
											}
										>
											{
												config.timeline.loadTootsButtonLabels
													.loadUserDataForAlgorithm.label
											}
										</span>
									</button>
								</div>
							</div>
						)}

						<div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] p-2">
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
		</div>
	);
}
