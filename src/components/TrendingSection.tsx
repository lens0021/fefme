import React, { useMemo, useState } from "react";

import { capitalCase } from "change-case";
import {
	TagTootsCategory,
	TrendingType,
	optionalSuffix,
	type TagList,
	type TagWithUsageCounts,
	type TrendingObj,
} from "fedialgo";
import { Tooltip } from "react-tooltip";

import Accordion from "./helpers/Accordion";
import NewTabLink from "./helpers/NewTabLink";
import { config } from "../config";
import {
	computeMinTootsDefaultValue,
	computeMinTootsMaxValue,
} from "../helpers/min_toots";
import { getLogger } from "../helpers/log_helpers";
import { gridify } from "../helpers/react_helpers";
import { useAlgorithm } from "../hooks/useAlgorithm";

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

/** Component for displaying a list of trending links, toots, or hashtags. */
export default function TrendingSection(props: TrendingProps) {
	const { linkRenderer, objRenderer, tagList, trendingObjs } = props;
	const { isLoading } = useAlgorithm();

	const panelType = props.panelType ?? (tagList?.source as TrendingPanelName);
	const logger = useMemo(() => getLogger("TrendingSection", panelType), []);
	logger.trace(`Rendering...`);

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
			<div key={`footer-${title}`} className="flex justify-around w-full mb-[5px]">
				<div className="w-[40%]">
					{"("}
					<a
						onClick={toggleShown}
						className="font-bold underline cursor-pointer font-mono text-[#1b5b61]"
						style={{ fontSize: config.theme.trendingObjFontSize - 1 }}
					>
						{numShown == panelCfg.initialNumShown
							? `show all ${trendingObjs.length} ${objTypeLabel}`
							: `show fewer ${objTypeLabel}`}
					</a>
					{")"}
				</div>
			</div>
		);
	}, [
		isLoading,
		minTootsState[0],
		numShown,
		panelType,
		tagList,
		trendObjs,
		trendObjs.length,
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

		// Short circuit the rendering for custom object renderers (so far that's means just Toots)
		if (objRenderer) {
			return (
				<>
					{objs.map(objRenderer)}
					<div key={`trending-footer-${panelType}`} className="h-5 w-full" />
					{footer}
				</>
			);
		}

		logger.trace(
			`Sliced trendObjs to ${objs.length} items (minTootsState=${minTootsState[0]}, numShown=${numShown})`,
		);
		const { infoTxt, linkLabel, linkUrl, onClick } = linkRenderer!;
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
		let containerClassName: string;

		if (panelCfg.hasCustomStyle) {
			containerClassName =
				"rounded-[20px] bg-[#d3d3d3] pl-[22px] pr-[20px] pt-[20px] pb-[13px]";
		} else if (isSingleCol) {
			containerClassName =
				"rounded-[20px] bg-[#d3d3d3] pl-[40px] pr-[20px] pt-[20px] pb-[13px]";
		} else {
			containerClassName =
				"rounded-[20px] bg-[#d3d3d3] pl-[25px] pr-[20px] pt-[20px] pb-[13px]";
		}

		const elements = objs.map((obj, i) => (
			<li key={`${title}-${i}-list-item`} className="mb-[4px]">
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
						className="text-black font-[Tahoma,Geneva,sans-serif] mt-[3px] mb-[18px]"
						style={{ fontSize: config.theme.trendingObjFontSize }}
					>
						{panelCfg.description}
					</p>
				)}

				<ol
					className="list-decimal pb-[10px] pl-[25px]"
					style={{ fontSize: config.theme.trendingObjFontSize }}
				>
					{isSingleCol
						? elements
						: gridify(elements, 2, { marginLeft: "1px", marginRight: "1px" })}
				</ol>

				{footer}
			</div>
		);
	}, [
		isLoading,
		minTootsState[0],
		numShown,
		panelCfg,
		panelType,
		tagList,
		trendObjs,
		trendObjs.length,
	]);

	const slider = useMemo(() => {
		if (!tagList) return null;

		const tooltipAnchor = `${panelType}-min-toots-slider-tooltip`;
		const pluralizedPanelTitle = title.toLowerCase();

		return (
			<div key={`${panelType}-minTootsSlider`} className="w-[23%]">
				<Tooltip
					className="font-normal z-[2000]"
					delayShow={config.filters.boolean.minTootsSlider.tooltipHoverDelay}
					id={tooltipAnchor}
					place="bottom"
				/>

				<a
					data-tooltip-id={tooltipAnchor}
					data-tooltip-content={`Hide ${pluralizedPanelTitle} with less than ${minTootsState[0]} toots`}
				>
					<div className="me-2">
						<div className="flex flex-row items-center text-sm justify-between whitespace-nowrap">
							<div className="flex flex-row justify-end">
								<input
									type="range"
									className="custom-slider"
									min={1}
									max={minTootsMaxValue}
									onChange={(e) =>
										minTootsState[1](parseInt(e.target.value, 10))
									}
									step={1}
									style={{ width: "80%" }}
									value={minTootsState[0]}
								/>
							</div>

							<div className="flex flex-row items-center text-sm justify-between whitespace-nowrap">
								<span>
									<span className="font-bold mr-1">Minimum</span>
								</span>
							</div>
						</div>
					</div>
				</a>
			</div>
		);
	}, [minTootsMaxValue, minTootsState[0], panelType, tagList, title]);

	if (tagList) {
		return (
			<Accordion isActive={false} switchbar={[slider]} title={title}>
				{trendingItemList}
			</Accordion>
		);
	} else {
		return (
			<Accordion key={panelType} title={title}>
				{trendingItemList}
			</Accordion>
		);
	}
}
