/*
 * Component for checkboxes that drive the user's filter settings.
 */
import React, { CSSProperties } from "react";

import { capitalCase } from "change-case";
import { Tooltip } from "react-tooltip";
import { type BooleanFilterOption } from "fedialgo";

import { CheckboxTooltipConfig } from "../../../helpers/tooltip_helpers";
import { config } from "../../../config";
import { followUri } from "../../../helpers/react_helpers";
import { THEME, tooltipZIndex } from "../../../helpers/styles";
import { useAlgorithm } from "../../../hooks/useAlgorithm";

const HASHTAG_ANCHOR = "user-hashtag-anchor";
const HIGHLIGHT = "highlighted";
const HIGHLIGHTED_TOOLTIP_ANCHOR = `${HASHTAG_ANCHOR}-${HIGHLIGHT}`;

export const HIGHLIGHTED_TOOLTIP = (
	<Tooltip id={HIGHLIGHTED_TOOLTIP_ANCHOR} place="top" style={tooltipZIndex} />
);

interface FilterCheckboxProps {
	capitalize?: boolean;
	disabled?: boolean;
	isChecked: boolean;
	label: string;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	option?: BooleanFilterOption;
	skipUpdateFilters?: boolean;
	tooltip?: CheckboxTooltipConfig;
	url?: string;
}

export default function FilterCheckbox(props: FilterCheckboxProps) {
	let {
		capitalize,
		disabled,
		isChecked,
		label,
		option,
		onChange,
		skipUpdateFilters,
		tooltip,
		url,
	} = props;
	const { algorithm } = useAlgorithm();

	const labelExtra = option?.numToots?.toLocaleString();
	let labelClasses = "font-bold";
	let checkboxClasses = "text-black";
	let tooltipAnchor = tooltip?.anchor || HASHTAG_ANCHOR;
	let highlightStyle: CSSProperties = {};

	if (tooltip?.highlight?.color) {
		highlightStyle = { backgroundColor: tooltip.highlight.color };
		checkboxClasses += " rounded-2xl";
		tooltipAnchor = HIGHLIGHTED_TOOLTIP_ANCHOR;
	}

	if (capitalize) {
		label = capitalCase(label);
		labelClasses += " text-sm";
	}

	if (label.length > config.filters.boolean.maxLabelLength) {
		label = `${label.slice(0, config.filters.boolean.maxLabelLength)}...`;
	}

	let labelNode = <span className={labelClasses}>{label}</span>;

	if (url) {
		// Use a span because you can't use an <a> tag inside the <a> tag we need for the tooltip
		labelNode = (
			<span
				onClick={(e) => followUri(url, e)}
				className={`${labelClasses} underline cursor-pointer text-black`}
			>
				{label}
			</span>
		);
	}

	return (
		<a
			data-tooltip-id={tooltipAnchor}
			data-tooltip-content={tooltip?.text}
			key={label}
		>
			<label
				className={`flex items-center gap-2 cursor-pointer p-1 ${checkboxClasses}`}
				style={highlightStyle}
			>
				<input
					type="checkbox"
					checked={isChecked}
					disabled={disabled}
					id={label}
					onChange={(e) => {
						onChange(e);
						!skipUpdateFilters && algorithm?.updateFilters(algorithm.filters);
					}}
					className="cursor-pointer"
				/>
				<span>
					{labelNode}
					{labelExtra && ` (${labelExtra})`}
				</span>
			</label>
		</a>
	);
}
