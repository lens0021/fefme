/*
 * Component for collecting a list of options for a BooleanFilter and displaying
 * them as checkboxes, with a switchbar for invertSelection, sortByCount, etc.
 */
import { type ReactElement, useMemo, useState } from "react";

import {
	type BooleanFilter,
	BooleanFilterName,
	TagTootsCategory,
} from "../../core/index";
import { Tooltip } from "react-tooltip";

import { config } from "../../config";
import { getLogger } from "../../helpers/log_helpers";
import {
	computeMinTootsDefaultValue,
	computeMinTootsMaxValue,
} from "../../helpers/min_toots";
import { createSwitchFactory } from "../../helpers/ui";
import { SwitchType } from "../../helpers/styles";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Accordion from "../helpers/Accordion";
import FilterCheckboxGrid from "./filters/FilterCheckboxGrid";
import HeaderSwitch from "./filters/HeaderSwitch";

export type TagHighlightSwitchState = Record<TagTootsCategory, boolean>;

export type HeaderSwitchState = {
	readonly [SwitchType.HIGHLIGHTS_ONLY]?: boolean;
	readonly [SwitchType.SORT_BY_COUNT]?: boolean;
};

const DEFAULT_SWITCH_STATE: HeaderSwitchState = {
	[SwitchType.HIGHLIGHTS_ONLY]: false,
	[SwitchType.SORT_BY_COUNT]: false,
};

const DEFAULT_TAG_SWITCH_STATE: TagHighlightSwitchState = {
	[TagTootsCategory.FAVOURITED]: true,
	[TagTootsCategory.PARTICIPATED]: true,
	[TagTootsCategory.TRENDING]: true,
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

	const minTootsSliderDefaultValue: number = useMemo(
		() => computeMinTootsDefaultValue(filter.options, filter.propertyName),
		[filter.options, filter.options.objs, filter.propertyName],
	);
	const minTootsMaxValue = useMemo(
		() => computeMinTootsMaxValue(filter.options, filter.propertyName),
		[filter.options, filter.options.objs, filter.propertyName],
	);
	const highlightTooltips =
		booleanFiltersConfig.optionsFormatting[filter.propertyName]?.tooltips;
	const minTootsTooltipDelay =
		booleanFiltersConfig.minTootsSlider.tooltipHoverDelay;

	const minTootsState = useState<number>(minTootsSliderDefaultValue);

	if (minTootsState[0] === 0 && minTootsSliderDefaultValue > 0) {
		logger.trace(
			`Updating minToots from default of 0 to ${minTootsSliderDefaultValue}`,
		);
		minTootsState[1](minTootsSliderDefaultValue); // equivalent of setMinToots() if setMinToots was a variable
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
		if (minTootsSliderDefaultValue > 0) {
			const tooltipAnchor = `${filter.propertyName}-min-toots-slider-tooltip`;
			const pluralizedPanelTitle = `${filter.propertyName}s`.toLowerCase();
			_headerSwitches = _headerSwitches.concat(
				<div key={`${filter.propertyName}-minTootsSlider`} className="w-full">
					<Tooltip
						className="font-normal z-[2000] max-w-[calc(100vw-2rem)] whitespace-normal break-words"
						delayShow={minTootsTooltipDelay}
						id={tooltipAnchor}
						place="bottom"
					/>

					<button
						type="button"
						className="text-left w-full"
						data-tooltip-id={tooltipAnchor}
						data-tooltip-content={`Hide ${pluralizedPanelTitle} with less than ${minTootsState[0]} posts`}
					>
						<div className="me-2">
							<div className="flex flex-col gap-2 text-xs">
								<div className="w-full">
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
		minTootsTooltipDelay,
		makeHeaderSwitch,
		minTootsMaxValue,
		minTootsSliderDefaultValue,
		minTootsState[0],
	]);

	const makeFooterSwitch = createSwitchFactory(
		tagSwitchState,
		setTagSwitchState,
		HeaderSwitch,
	);

	if (filter.propertyName === BooleanFilterName.HASHTAG) {
		footerSwitches = Object.values(TagTootsCategory).map((k) =>
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
				minToots={minTootsState[0]}
				sortByCount={switchState[SwitchType.SORT_BY_COUNT]}
				tagSwitchState={tagSwitchState}
			/>
		</Accordion>
	);
}
