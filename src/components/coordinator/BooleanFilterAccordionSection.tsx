/*
 * Component for collecting a list of options for a BooleanFilter and displaying
 * them as checkboxes, with a switchbar for invertSelection, sortByCount, etc.
 */
import { type ReactElement, useEffect, useMemo, useState } from "react";

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
import MinimumPostsSlider from "./filters/MinimumPostsSlider";

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
		[filter.options, filter.propertyName],
	);
	const minPostsMaxValue = useMemo(
		() => computeMinPostsMaxValue(filter.options, filter.propertyName),
		[filter.options, filter.propertyName],
	);
	const highlightTooltips =
		booleanFiltersConfig.optionsFormatting[filter.propertyName]?.tooltips;
	const minPostsTooltipDelay =
		booleanFiltersConfig.minPostsSlider.tooltipHoverDelay;

	const [minPosts, setMinPosts] = useState<number>(minPostsSliderDefaultValue);

	// Update minPosts when default value changes
	useEffect(() => {
		if (minPosts === 0 && minPostsSliderDefaultValue > 0) {
			logger.trace(
				`Updating minPosts from default of 0 to ${minPostsSliderDefaultValue}`,
			);
			setMinPosts(minPostsSliderDefaultValue);
		}
	}, [minPosts, minPostsSliderDefaultValue, logger]);

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
			_headerSwitches = _headerSwitches.concat(
				<MinimumPostsSlider
					key={`${filter.propertyName}-minPostsSlider`}
					filterPropertyName={filter.propertyName}
					minPosts={minPosts}
					minPostsMaxValue={minPostsMaxValue}
					onMinPostsChange={setMinPosts}
					tooltipDelay={minPostsTooltipDelay}
				/>,
			);
		}

		return _headerSwitches;
	}, [
		filter.propertyName,
		highlightTooltips,
		minPostsTooltipDelay,
		makeHeaderSwitch,
		minPostsMaxValue,
		minPostsSliderDefaultValue,
		minPosts,
		setMinPosts,
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
				minPosts={minPosts}
				sortByCount={switchState[SwitchType.SORT_BY_COUNT]}
				tagSwitchState={tagSwitchState}
			/>
		</Accordion>
	);
}
