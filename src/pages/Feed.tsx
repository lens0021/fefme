/**
 * @fileoverview Class for retrieving and sorting the user's feed based on their chosen
 * weighting values.
 */
import React, { useEffect, useRef, useState } from "react";

import TheAlgorithm, { READY_TO_LOAD_MSG, Toot, optionalSuffix } from "fedialgo";
import { Tooltip } from "react-tooltip";

import ApiErrorsPanel from "../components/ApiErrorsPanel";
import ExperimentalFeatures from "../components/experimental/ExperimentalFeatures";
import FeedFiltersAccordionSection from "../components/algorithm/FeedFiltersAccordionSection";
import { persistentCheckbox } from "../components/helpers/Checkbox";
import StatusComponent, {
	TOOLTIP_ACCOUNT_ANCHOR,
} from "../components/status/Status";
import Accordion from "../components/helpers/Accordion";
import useOnScreen from "../hooks/useOnScreen";
import WeightSetter from "../components/algorithm/WeightSetter";
import { booleanIcon } from "../helpers/react_helpers";
import { confirm } from "../components/helpers/Confirmation";
import { getLogger } from "../helpers/log_helpers";
import { GuiCheckboxName, config } from "../config";
import { useAlgorithm } from "../hooks/useAlgorithm";

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
		resetAlgorithm,
		shouldAutoUpdateCheckbox,
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
	const [prevScrollY, setPrevScrollY] = useState(0);
	const [scrollPercentage, setScrollPercentage] = useState(0);
	const [thread, setThread] = useState<Toot[]>([]);

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

	// Reset all state except for the user and server
	const reset = async () => {
		if (!(await confirm(`Are you sure you want to reset your feed data? (You will stay logged in)`)))
			return;
		setNumDisplayedToots(config.timeline.defaultNumDisplayedToots);
		resetAlgorithm();
	};

	// Show more toots when the user scrolls to bottom of the page
	// TODO: this triggers twice: once when isbottom changes to true and again because numDisplayedToots
	//       is increased, triggering a second evaluation of the block
	useEffect(() => {
		const showMoreToots = () => {
			if (numDisplayedToots < timeline.length) {
				const msg = `Showing ${numDisplayedToots} toots, adding ${config.timeline.numTootsToLoadOnScroll}`;
				logger.log(`${msg} more (${timeline.length} available in feed)`);
				setNumDisplayedToots(
					numDisplayedToots + config.timeline.numTootsToLoadOnScroll,
				);
			}
		};

		// If the user scrolls to the bottom of the page, show more toots
		if (isBottom && timeline.length) showMoreToots();
		// If there's less than numDisplayedToots in the feed set numDisplayedToots to the # of toots in the feed
		if (timeline?.length && timeline.length < numDisplayedToots)
			setNumDisplayedToots(timeline.length);

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
		numDisplayedToots,
		prevScrollY,
		setNumDisplayedToots,
		setPrevScrollY,
		timeline,
	]);

	// TODO: probably easier to not rely on fedialgo's measurement of the last load time; we can easily track it ourselves.
	let footerMsg = `Scored ${(timeline?.length || 0).toLocaleString()} toots`;
	footerMsg += optionalSuffix(
		lastLoadDurationSeconds,
		(seconds) => `in ${seconds.toFixed(1)} seconds`,
	);

		return (
			<div className="h-auto">
				<div
					style={{ cursor: isLoadingThread ? "wait" : "default" }}
				>
				{/* Tooltip options: https://react-tooltip.com/docs/options */}
				<Tooltip
					border={"solid"}
					className="z-[2000] w-[500px]"
					clickable={true}
					delayShow={config.timeline.tooltips.accountTooltipDelayMS}
					id={TOOLTIP_ACCOUNT_ANCHOR}
					opacity={0.95}
					place="left"
					variant="light"
				/>

					{checkboxTooltip}

				<div className="w-full">
					{/* Controls section */}
					<div>
						<div className="flex justify-between h-auto px-[2px]">
							{showLinkPreviewsCheckbox}
							{hideSensitiveCheckbox}
							{shouldAutoUpdateCheckbox}
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

						<div className="flex justify-between h-auto px-[2px]">
							{isLoading ? (
								<div
									className="flex h-5 items-center mt-1.5"
									style={{ fontSize: 16, height: "auto", marginTop: "6px" }}
								>
									<div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
									<div className="ml-3">
										<p>{`${algorithm?.loadingStatus || READY_TO_LOAD_MSG}...`}</p>
									</div>
								</div>
							) : (
								<p className="text-base h-auto mt-1.5">
									{footerMsg} (
									{
										<a onClick={reset} className="font-bold underline cursor-pointer text-red-600 text-sm">
											Reset Feed Data
										</a>
									}
									)
								</p>
							)}

							<p className="text-base h-auto mt-1.5 text-gray-500 d-none d-sm-block">
								{TheAlgorithm.isDebugMode ? (
									`Displaying ${numDisplayedToots} Toots (Scroll: ${scrollPercentage.toFixed(1)}%)`
								) : (
									<>
										Report bugs:{" "}
										<a
											href={config.app.issuesUrl}
											className="text-gray-300 no-underline"
											target="_blank"
											rel="noopener noreferrer"
										>
											GitHub Issues
										</a>
									</>
								)}
							</p>
						</div>

						{algorithm && <ApiErrorsPanel />}

						{TheAlgorithm.isDebugMode && (
							<div className="font-mono rounded-2xl bg-slate-800 text-slate-200 text-base mt-7 p-5 pl-15">
								<ul>
									<li>
										<strong>NODE_ENV:</strong> {process.env.NODE_ENV}
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
				</div>

				{/* Feed column */}
				<div className="w-full">
					{algorithm && !isLoading && (
						<div className="text-base h-auto mt-2 text-center text-[13px]">
							<Tooltip
								border={"solid"}
								className="text-base z-[2000]"
								delayShow={config.timeline.tooltips.defaultTooltipDelayMS}
								id={LOAD_BUTTON_TOOLTIP_ANCHOR}
								opacity={0.95}
								place="bottom"
								variant="light"
							/>

							<a
								data-tooltip-content={
									config.timeline.loadTootsButtonLabels.loadNewToots.tooltipText
								}
								data-tooltip-id={LOAD_BUTTON_TOOLTIP_ANCHOR}
							>
								<span
									onClick={triggerFeedUpdate}
									className="cursor-pointer underline"
									style={
										config.timeline.loadTootsButtonLabels.loadNewToots.labelStyle
									}
								>
									{config.timeline.loadTootsButtonLabels.loadNewToots.label}
								</span>
							</a>

							{LOAD_BUTTON_SEPARATOR}

							<a
								data-tooltip-content={
									config.timeline.loadTootsButtonLabels.loadOldToots.tooltipText
								}
								data-tooltip-id={LOAD_BUTTON_TOOLTIP_ANCHOR}
							>
								<span
									onClick={triggerHomeTimelineBackFill}
									className="cursor-pointer underline"
									style={
										config.timeline.loadTootsButtonLabels.loadOldToots.labelStyle
									}
								>
									{config.timeline.loadTootsButtonLabels.loadOldToots.label}
								</span>
							</a>

							{LOAD_BUTTON_SEPARATOR}

							<a
								data-tooltip-content={
									config.timeline.loadTootsButtonLabels.loadUserDataForAlgorithm
										.tooltipText
								}
								data-tooltip-id={LOAD_BUTTON_TOOLTIP_ANCHOR}
							>
								<span
									onClick={triggerMoarData}
									className="cursor-pointer underline"
									style={
										config.timeline.loadTootsButtonLabels.loadUserDataForAlgorithm
											.labelStyle
									}
								>
									{
										config.timeline.loadTootsButtonLabels.loadUserDataForAlgorithm
											.label
									}
								</span>
							</a>
						</div>
					)}

					<div
						className="rounded h-auto"
						style={{ backgroundColor: config.theme.feedBackgroundColor }}
					>
						{timeline.slice(0, numShownToots).map((toot) => (
							<StatusComponent
								isLoadingThread={isLoadingThread}
								key={toot.uri}
								setThread={setThread}
								setIsLoadingThread={setIsLoadingThread}
								showLinkPreviews={showLinkPreviews}
								status={toot}
							/>
						))}

						{timeline.length == 0 &&
							(isLoading ? (
								<div className="flex flex-1 h-screen items-center justify-center">
									<div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
									<div className="ml-3">
										<p>{`${config.timeline.defaultLoadingMsg}...`}</p>
									</div>
								</div>
							) : (
								<div className="flex flex-1 h-screen items-center justify-center text-xl">
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
