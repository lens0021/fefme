/*
 * Component for collecting a list of options for a BooleanFilter and displaying
 * them as checkboxes, with a switchbar for invertSelection, sortByCount, etc.
 */
import { type ReactElement, useMemo, useState } from "react";

import { Tooltip } from "react-tooltip";
import {
	type BooleanFilter,
	BooleanFilterName,
	TagPostsCategory,
} from "../../core/index";

import { config } from "../../config";
import { getLogger } from "../../helpers/log_helpers";
import {
	computeMinPostsDefaultValue,
	computeMinPostsMaxValue,
} from "../../helpers/min_posts";
import { SwitchType } from "../../helpers/styles";
import { createSwitchFactory } from "../../helpers/ui";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Accordion from "../helpers/Accordion";
import FilterCheckboxGrid from "./filters/FilterCheckboxGrid";
import HeaderSwitch from "./filters/HeaderSwitch";

export type TagHighlightSwitchState = Record<TagPostsCategory, boolean>;

export type HeaderSwitchState = {
	readonly [SwitchType.HIGHLIGHTS_ONLY]?: boolean;
	readonly [SwitchType.SORT_BY_COUNT]?: boolean;
};

const DEFAULT_SWITCH_STATE: HeaderSwitchState = {
	[SwitchType.HIGHLIGHTS_ONLY]: false,
	[SwitchType.SORT_BY_COUNT]: false,
};

const DEFAULT_TAG_SWITCH_STATE: TagHighlightSwitchState = {
	[TagPostsCategory.FAVOURITED]: true,
	[TagPostsCategory.PARTICIPATED]: true,
	[TagPostsCategory.TRENDING]: true,
};

interface BooleanFilterAccordionProps {
	filter: BooleanFilter;
}

export default function BooleanFilterAccordionSection(
	props: BooleanFilterAccordionProps,
) {
	const { filter } = props;
	const booleanFiltersConfig = config.filters.boolean;
	const logger = getLogger(
		"BooleanFilterAccordionSection",
		filter.propertyName,
	);

	const [switchState, setSwitchState] = useLocalStorage(
		`${filter.propertyName}-switchState`,
		DEFAULT_SWITCH_STATE,
	);
	const [tagSwitchState, setTagSwitchState] = useLocalStorage(
		`${filter.propertyName}-tagSwitch`,
		DEFAULT_TAG_SWITCH_STATE,
	);
	let footerSwitches: ReactElement[] | null = null;

	const minPostsSliderDefaultValue: number = useMemo(
		() => computeMinPostsDefaultValue(filter.options, filter.propertyName),
		[filter.options, filter.options.objs, filter.propertyName],
	);
	const minPostsMaxValue = useMemo(
		() => computeMinPostsMaxValue(filter.options, filter.propertyName),
		[filter.options, filter.options.objs, filter.propertyName],
	);
	const highlightTooltips =
		booleanFiltersConfig.optionsFormatting[filter.propertyName]?.tooltips;
	const minPostsTooltipDelay =
		booleanFiltersConfig.minPostsSlider.tooltipHoverDelay;

	const minPostsState = useState<number>(minPostsSliderDefaultValue);

	if (minPostsState[0] === 0 && minPostsSliderDefaultValue > 0) {
		logger.trace(
			`Updating minPosts from default of 0 to ${minPostsSliderDefaultValue}`,
		);
		minPostsState[1](minPostsSliderDefaultValue); // equivalent of setMinPosts() if setMinPosts was a variable
	}

	const makeHeaderSwitch = createSwitchFactory(
		switchState,
		setSwitchState,
		HeaderSwitch,
	);

	const headerSwitches = useMemo(() => {
		let _headerSwitches = [makeHeaderSwitch(SwitchType.SORT_BY_COUNT)];

		// Add a highlights-only switch if there are highlighted tooltips configured for this filter
		if (highlightTooltips) {
			_headerSwitches = _headerSwitches.concat([
				makeHeaderSwitch(SwitchType.HIGHLIGHTS_ONLY),
			]);
		}

		// Add a slider and tooltip for minimum # of posts if there's enough options in the panel to justify it
		if (minPostsSliderDefaultValue > 0) {
			const tooltipAnchor = `${filter.propertyName}-min-posts-slider-tooltip`;
			const pluralizedPanelTitle = `${filter.propertyName}s`.toLowerCase();
			_headerSwitches = _headerSwitches.concat(
				<div key={`${filter.propertyName}-minPostsSlider`} className="w-full">
					<Tooltip
						className="font-normal z-[2000] max-w-[calc(100vw-2rem)] whitespace-normal break-words"
						delayShow={minPostsTooltipDelay}
						id={tooltipAnchor}
						place="bottom"
					/>

					<button
						type="button"
						className="text-left w-full"
						data-tooltip-id={tooltipAnchor}
						data-tooltip-content={`Hide ${pluralizedPanelTitle} with less than ${minPostsState[0]} posts`}
					>
						<div className="me-2">
							<div className="flex flex-col gap-2 text-xs">
								<div className="w-full">
									<input
										type="range"
										className="custom-slider w-full"
										min={1}
										max={minPostsMaxValue}
										onChange={(e) =>
											minPostsState[1](Number.parseInt(e.target.value, 10))
										}
										step={1}
										value={minPostsState[0]}
									/>
								</div>

								<div className="flex items-center justify-between text-xs">
									<span>
										<span className="font-bold mr-1">Minimum</span>
									</span>
								</div>
							</div>
						</div>
					</button>
				</div>,
			);
		}

		return _headerSwitches;
	}, [
		filter,
		highlightTooltips,
		minPostsTooltipDelay,
		makeHeaderSwitch,
		minPostsMaxValue,
		minPostsSliderDefaultValue,
		minPostsState[0],
	]);

	const makeFooterSwitch = createSwitchFactory(
		tagSwitchState,
		setTagSwitchState,
		HeaderSwitch,
	);

	if (filter.propertyName === BooleanFilterName.HASHTAG) {
		footerSwitches = Object.values(TagPostsCategory).map((k) =>
			makeFooterSwitch(k),
		);
	}

	return (
		<Accordion
			description={filter.description}
			footerSwitches={footerSwitches}
			isActive={
				filter.selectedOptions.length > 0 || filter.excludedOptions.length > 0
			}
			switchbar={headerSwitches}
			title={filter.propertyName}
		>
			<FilterCheckboxGrid
				filter={filter}
				highlightsOnly={switchState[SwitchType.HIGHLIGHTS_ONLY]}
				minPosts={minPostsState[0]}
				sortByCount={switchState[SwitchType.SORT_BY_COUNT]}
				tagSwitchState={tagSwitchState}
			/>
		</Accordion>
	);
}
