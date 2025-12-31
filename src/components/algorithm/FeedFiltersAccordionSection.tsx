import React from "react";

import { config } from "../../config";
import { useAlgorithm } from "../../hooks/useAlgorithm";
import Accordion from "../helpers/Accordion";
import { HIGHLIGHTED_TOOLTIP } from "../helpers/Checkbox";
import BooleanFilterAccordionSection from "./BooleanFilterAccordionSection";
import { HEADER_SWITCH_TOOLTIP } from "./filters/HeaderSwitch";
import NumericFilters from "./filters/NumericFilters";

/**
 * Component for setting the user's preferred weightings of various post properties.
 * Things like how much to prefer people you favorite a lot or how much to posts that
 * are trending in the Fediverse.
 */
export default function FeedFiltersAccordionSection() {
	const {
		algorithm,
		alwaysShowFollowedCheckbox,
		selfTypeFilterEnabled,
		showFilterHighlightsCheckbox,
	} = useAlgorithm();

	const booleanFiltersCfg = config.filters.boolean.optionsFormatting;
	// Filter for 'visible' because the APP filters are currently hidden
	const booleanFilters = Object.values(algorithm.filters.booleanFilters).filter(
		(f) => !booleanFiltersCfg[f.propertyName].hidden,
	);
	const numericFilters = Object.values(algorithm.filters.numericFilters);
	const hasActiveBooleanFilter = booleanFilters.some(
		(f) => f.selectedOptions.length,
	);
	const hasActiveNumericFilter = numericFilters.some((f) => f.value > 0);
	const hasAnyActiveFilter =
		hasActiveNumericFilter || hasActiveBooleanFilter || !!selfTypeFilterEnabled;

	// Sort the filter sections based on configured 'position' value
	const filterPositions = booleanFilters.reduce(
		(filters, f) => {
			const position = booleanFiltersCfg[f.propertyName].position;
			filters[position] = (
				<BooleanFilterAccordionSection filter={f} key={f.propertyName} />
			);
			return filters;
		},
		{
			[config.filters.numeric.position]: (
				<NumericFilters isActive={hasActiveNumericFilter} key={"numeric"} />
			),
		},
	);

	return (
		<Accordion
			variant="top"
			bodyStyle={{ padding: 0 }}
			isActive={hasAnyActiveFilter}
			title="Feed Filters"
		>
			{HEADER_SWITCH_TOOLTIP}
			{HIGHLIGHTED_TOOLTIP}

			<div>
				<div className="flex justify-around h-auto px-[2px] pt-[4.5px] text-base font-bold">
					{showFilterHighlightsCheckbox}
					{alwaysShowFollowedCheckbox}
				</div>

				{Object.keys(filterPositions)
					.sort()
					.map((position) => filterPositions[position])}
			</div>
		</Accordion>
	);
}
