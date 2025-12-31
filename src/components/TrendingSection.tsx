import type React from "react";
import { useMemo, useState } from "react";

import { capitalCase } from "change-case";
import {
	type TagList,
	type TagTootsCategory,
	type TagWithUsageCounts,
	type TrendingObj,
	type TrendingType,
	optionalSuffix,
} from "fedialgo";
import { Tooltip } from "react-tooltip";

import { config } from "../config";
import { getLogger } from "../helpers/log_helpers";
import {
	computeMinTootsDefaultValue,
	computeMinTootsMaxValue,
} from "../helpers/min_toots";
import { gridify } from "../helpers/ui";
import Accordion from "./helpers/Accordion";
import NewTabLink from "./helpers/NewTabLink";

export type TrendingListObj = TrendingObj | string;
export type TrendingPanelName =
	| TagTootsCategory
	| "toots"
	| TrendingType.LINKS
	| TrendingType.SERVERS;

export type LinkRenderer = {
	infoTxt?: (obj: TrendingListObj) => string;
	linkLabel: (obj: TrendingListObj) => React.ReactElement | string;
	linkUrl: (obj: TrendingListObj) => string;
	onClick: (obj: TrendingListObj, e: React.MouseEvent) => void;
};

// Either objectRenderer() OR linkRender must be provided in TrendingProps.
interface TrendingPropsBase {
	linkRenderer?: LinkRenderer;
	objRenderer?: (obj: TrendingListObj) => React.ReactElement;
}

interface TrendingTagListProps extends TrendingPropsBase {
	panelType?: never; // panelType is not used when tagList is provided
	tagList: TagList;
	trendingObjs?: never;
}

interface TrendingObjsProps extends TrendingPropsBase {
	panelType: TrendingPanelName;
	tagList?: never;
	trendingObjs: TrendingListObj[];
}

// One of tagList or trendingObjs must be provided in TrendingProps.
type TrendingProps = TrendingTagListProps | TrendingObjsProps;

/** Component for displaying a list of trending links, posts, or hashtags. */
export default function TrendingSection(props: TrendingProps) {
	const { linkRenderer, objRenderer, tagList, trendingObjs } = props;
	const panelType = props.panelType ?? (tagList?.source as TrendingPanelName);
	const logger = useMemo(
		() => getLogger("TrendingSection", panelType),
		[panelType],
	);
	logger.trace("Rendering...");

	if (!objRenderer && !linkRenderer) {
		logger.error(
			"TrendingSection must have either objRenderer() or linkRenderer! props:",
			props,
		);
		throw new Error(
			"TrendingSection needs either objRenderer() or linkRenderer! props:",
		);
	}

	const panelCfg = config.trending.panels[panelType];
	const objTypeLabel = panelCfg.objTypeLabel || panelType;
	const title = panelCfg.title || capitalCase(objTypeLabel);
	// const trendObjs = trendingObjs ?? tagList.topObjs();

	const trendObjs = useMemo(
		() => trendingObjs ?? tagList.topObjs(),
		[tagList, trendingObjs],
	);

	const minTootsSliderDefaultValue: number = useMemo(
		() =>
			tagList
				? computeMinTootsDefaultValue(
						tagList,
						panelType,
						panelCfg.initialNumShown,
					)
				: 0,
		[panelCfg.initialNumShown, panelType, tagList],
	);
	const minTootsMaxValue = useMemo(
		() => (tagList ? computeMinTootsMaxValue(tagList, panelType) : 0),
		[panelType, tagList],
	);

	const minTootsState = useState<number>(minTootsSliderDefaultValue);
	const [numShown, setNumShown] = useState(
		trendObjs.length
			? Math.min(panelCfg.initialNumShown, trendObjs.length)
			: panelCfg.initialNumShown,
	);

	// Memoize because react profiler says trending panels are most expensive to render
	const footer: React.ReactNode = useMemo(() => {
		// TagList uses the min-toots slider; other displays have a link to show all vs. show initialNumShown
		if (tagList || trendingObjs.length <= panelCfg.initialNumShown) return null;

		const toggleShown = () => {
			if (numShown === panelCfg.initialNumShown) {
				setNumShown(trendingObjs.length);
			} else {
				setNumShown(panelCfg.initialNumShown);
			}
		};

		return (
			<div key={`footer-${title}`} className="flex justify-center w-full">
				{"("}
				<button
					type="button"
					onClick={toggleShown}
					className="font-bold underline cursor-pointer font-mono text-[#1b5b61]"
					style={{ fontSize: config.theme.trendingObjFontSize - 1 }}
				>
					{numShown === panelCfg.initialNumShown
						? `show all ${trendingObjs.length} ${objTypeLabel}`
						: `show fewer ${objTypeLabel}`}
				</button>
				{")"}
			</div>
		);
	}, [
		numShown,
		tagList,
		trendingObjs.length,
		objTypeLabel,
		panelCfg.initialNumShown,
		title,
	]);

	// Memoize because react profiler says trending panels are most expensive to render
	const trendingItemList = useMemo(() => {
		let objs: TrendingListObj[] = trendObjs;
		logger.trace(`Rerendering list of ${objs.length} trending items...`);

		// TagList uses the min-toots slider; other displays have a link to show all vs. show initialNumShown
		if (tagList) {
			if (minTootsState[0] > 0) {
				objs = trendObjs.filter(
					(obj: TagWithUsageCounts) => obj.numToots >= minTootsState[0],
				);
			}
		} else {
			objs = objs.slice(0, numShown);
		}

		// Short circuit the rendering for custom object renderers (so far that's means just Posts)
		if (objRenderer) {
			return (
				<>
					{objs.map(objRenderer)}
					<div key={`trending-footer-${panelType}`} className="h-5 w-full" />
					{footer}
				</>
			);
		}

		if (!linkRenderer) return null;

		logger.trace(
			`Sliced trendObjs to ${objs.length} items (minTootsState=${minTootsState[0]}, numShown=${numShown})`,
		);
		const { infoTxt, linkLabel, linkUrl, onClick } = linkRenderer;
		const labels = objs.map(
			(o) => `${linkLabel(o)}${optionalSuffix(infoTxt, infoTxt(o))}`,
		);
		const maxLength = Math.max(...labels.map((label) => label.length));
		const longestLabel =
			labels.find((label) => label.length === maxLength) || "";
		const isSingleCol =
			panelCfg.hasCustomStyle ||
			maxLength > config.trending.maxLengthForMulticolumn;
		logger.trace(
			`Rebuilding trendingItemList, longest label="${longestLabel}" (len=${maxLength}, isSingleCol=${isSingleCol})`,
		);
		const containerClassName = "rounded-2xl bg-[#d3d3d3] p-4";

		const elements = objs.map((obj) => (
			<li key={linkUrl(obj)} className="mb-[4px]">
				<NewTabLink
					href={linkUrl(obj)}
					onClick={(e) => onClick(obj, e)}
					className={
						panelCfg.hasCustomStyle
							? "text-black font-[Tahoma,Geneva,sans-serif]"
							: "font-bold text-black font-[Tahoma,Geneva,sans-serif]"
					}
					style={{
						fontSize: panelCfg.hasCustomStyle
							? config.theme.trendingObjFontSize - 1
							: config.theme.trendingObjFontSize - 2,
					}}
				>
					{linkLabel(obj)}
				</NewTabLink>

				{infoTxt && (
					<span
						className="ml-[6px]"
						style={{ fontSize: config.theme.trendingObjFontSize - 4 }}
					>
						({infoTxt(obj)})
					</span>
				)}
			</li>
		));

		return (
			<div className={containerClassName}>
				{panelCfg.description && (
					<p
						className="text-black font-[Tahoma,Geneva,sans-serif] mt-1 mb-4"
						style={{ fontSize: config.theme.trendingObjFontSize }}
					>
						{panelCfg.description}
					</p>
				)}

				<ol className="list-decimal pl-5" style={{ fontSize: config.theme.trendingObjFontSize }}>
					{isSingleCol
						? elements
						: gridify(elements, 2, { marginLeft: "1px", marginRight: "1px" })}
				</ol>

				{footer}
			</div>
		);
	}, [
		footer,
		linkRenderer,
		logger,
		minTootsState[0],
		numShown,
		objRenderer,
		panelCfg,
		panelType,
		tagList,
		trendObjs,
	]);

	const slider = useMemo(() => {
		if (!tagList) return null;

		const tooltipAnchor = `${panelType}-min-toots-slider-tooltip`;
		const pluralizedPanelTitle = title.toLowerCase();

		return (
			<div key={`${panelType}-minTootsSlider`} className="w-full">
				<Tooltip
					className="font-normal z-[2000]"
					delayShow={config.filters.boolean.minTootsSlider.tooltipHoverDelay}
					id={tooltipAnchor}
					place="bottom"
				/>

				<button
					type="button"
					className="text-left"
					data-tooltip-id={tooltipAnchor}
					data-tooltip-content={`Hide ${pluralizedPanelTitle} with less than ${minTootsState[0]} posts`}
				>
					<div className="flex items-center gap-3 text-sm">
						<input
							type="range"
							className="custom-slider w-full"
							min={1}
							max={minTootsMaxValue}
							onChange={(e) =>
								minTootsState[1](Number.parseInt(e.target.value, 10))
							}
							step={1}
							value={minTootsState[0]}
						/>
						<span className="font-bold">Minimum</span>
					</div>
				</button>
			</div>
		);
	}, [minTootsMaxValue, minTootsState[0], panelType, tagList, title]);

	if (tagList) {
		return (
			<Accordion isActive={false} switchbar={[slider]} title={title}>
				{trendingItemList}
			</Accordion>
		);
	}
	return (
		<Accordion key={panelType} title={title}>
			{trendingItemList}
		</Accordion>
	);
}
