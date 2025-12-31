/*
 * Component for the switches in the header of filter sections (invert selection,
 * sort by count, etc.).
 */
import type { ChangeEvent } from "react";

import { TagTootsCategory } from "../../../core/index";
import { Tooltip } from "react-tooltip";

import { config } from "../../../config";
import { getLogger } from "../../../helpers/log_helpers";
import { SwitchType } from "../../../helpers/styles";
import type { CheckboxTooltipConfig } from "../../../helpers/ui";
import { useAlgorithm } from "../../../hooks/useAlgorithm";
import Checkbox from "../../helpers/Checkbox";

const HEADER_SWITCH_TOOLTIP_ANCHOR = "header-switch-tooltip-anchor";

const TAG_HIGHLIGHT_LABELS: Record<TagTootsCategory, string> = {
	[TagTootsCategory.FAVOURITED]: "Colour Favourites",
	[TagTootsCategory.PARTICIPATED]: "Colour Participated",
	[TagTootsCategory.TRENDING]: "Colour Trending",
};

// Only invert selection requires a call to fedialgo's updateFilters() method
const SKIP_UPDATE_FILTERS_SWITCHES = [
	...Object.values(TagTootsCategory),
	SwitchType.HIGHLIGHTS_ONLY,
	SwitchType.SORT_BY_COUNT,
];

const logger = getLogger("HeaderSwitch");

// This must appear somewhere in the component tree for the header switch tooltips to work
export const HEADER_SWITCH_TOOLTIP = (
	<Tooltip
		className="z-[2000] max-w-[calc(100vw-2rem)] whitespace-normal break-words"
		delayShow={config.filters.headerSwitches.tooltipHoverDelay}
		id={HEADER_SWITCH_TOOLTIP_ANCHOR}
		place="top"
	/>
);

interface HeaderSwitchProps {
	isChecked: boolean;
	label: SwitchType | TagTootsCategory;
	onChange: (e: ChangeEvent<HTMLInputElement>) => void;
	tooltipText?: string;
	tooltip?: CheckboxTooltipConfig;
}

export default function HeaderSwitch(props: HeaderSwitchProps) {
	let { isChecked, label, onChange, tooltip, tooltipText } = props;
	const { showFilterHighlights } = useAlgorithm();

	if (tooltipText && tooltip) {
		logger.warn(
			`HeaderSwitch received both tooltipText and tooltip props, ignoring tooltipText: ${tooltipText}`,
		);
	}

	tooltip ||= {
		anchor: HEADER_SWITCH_TOOLTIP_ANCHOR,
		text: tooltipText || config.filters.headerSwitches.tooltipText[label],
	};

	return (
		<Checkbox
			capitalize={true}
			disabled={label === SwitchType.HIGHLIGHTS_ONLY && !showFilterHighlights}
			isChecked={isChecked}
			label={TAG_HIGHLIGHT_LABELS[label] || label}
			onChange={onChange}
			updateFilters={!SKIP_UPDATE_FILTERS_SWITCHES.includes(label)}
			tooltip={tooltip}
		/>
	);
}
