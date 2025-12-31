/*
 * Unified checkbox component with optional tooltips and persistence helpers.
 */
import type React from "react";
import type { CSSProperties, ReactElement } from "react";

import { capitalCase } from "change-case";
import { Tooltip } from "react-tooltip";

import { type GuiCheckboxName, config } from "../../config";
import { followUri } from "../../helpers/ui";
import type { CheckboxTooltipConfig } from "../../helpers/ui";
import { useAlgorithm } from "../../hooks/useAlgorithm";
import { useLocalStorage } from "../../hooks/useLocalStorage";

export const DEFAULT_TOOLTIP_ANCHOR = "checkbox-tooltip-anchor";
export const FILTER_TOOLTIP_ANCHOR = "user-hashtag-anchor";
export const HIGHLIGHTED_TOOLTIP_ANCHOR = "user-hashtag-anchor-highlighted";

export const HIGHLIGHTED_TOOLTIP = (
	<Tooltip className="z-[2000]" id={HIGHLIGHTED_TOOLTIP_ANCHOR} place="top" />
);

interface CheckboxProps {
	label: string;
	isChecked: boolean;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	disabled?: boolean;
	capitalize?: boolean;
	labelExtra?: string;
	maxLabelLength?: number;
	tooltip?: CheckboxTooltipConfig;
	tooltipAnchor?: string;
	highlightedTooltipAnchor?: string;
	url?: string;
	updateFilters?: boolean;
}

export default function Checkbox(props: CheckboxProps) {
	let {
		capitalize,
		disabled,
		isChecked,
		label,
		labelExtra,
		maxLabelLength,
		onChange,
		tooltip,
		tooltipAnchor,
		highlightedTooltipAnchor,
		updateFilters,
		url,
	} = props;
	const { algorithm } = useAlgorithm();

	let labelClasses = "font-bold";
	let checkboxClasses = "text-black";
	let highlightStyle: CSSProperties = {};

	const highlightColor = tooltip?.highlight?.color;
	const baseTooltipAnchor =
		tooltip?.anchor || tooltipAnchor || DEFAULT_TOOLTIP_ANCHOR;
	let resolvedTooltipAnchor = baseTooltipAnchor;

	if (highlightColor) {
		highlightStyle = { backgroundColor: highlightColor };
		checkboxClasses += " rounded-2xl";
		resolvedTooltipAnchor = highlightedTooltipAnchor || baseTooltipAnchor;
	}

	if (capitalize) {
		label = capitalCase(label);
		labelClasses += " text-sm";
	}

	maxLabelLength ??= config.filters.boolean.maxLabelLength;
	if (label.length > maxLabelLength) {
		label = `${label.slice(0, maxLabelLength)}...`;
	}

	let labelNode: React.ReactNode = (
		<span className={labelClasses}>{label}</span>
	);

	if (url) {
		labelNode = (
			<a
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				className={`${labelClasses} underline cursor-pointer text-black`}
				onClick={(e) => followUri(url, e)}
			>
				{label}
			</a>
		);
	}

	const checkbox = (
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
					if (updateFilters) {
						algorithm?.updateFilters(algorithm.filters);
					}
				}}
				className="cursor-pointer"
			/>
			<span>
				{labelNode}
				{labelExtra && ` (${labelExtra})`}
			</span>
		</label>
	);

	if (!tooltip?.text) return checkbox;

	return (
		<span
			data-tooltip-id={resolvedTooltipAnchor}
			data-tooltip-content={tooltip.text}
		>
			{checkbox}
		</span>
	);
}

type StateWithComponent = [boolean, ReactElement, ReturnType<typeof Tooltip>];

/**
 * Build a checkbox whose state will be preserved in browser storage. The tooltip component returned
 * must be included somewhere in the component tree for the tooltip to work.
 * @param {GuiCheckboxName} checkboxName - Name of the checkbox as defined in config.timeline.guiCheckboxLabels
 * @returns {StateWithComponent} Tuple of [value, checkbox component, tooltip component]
 */
export function persistentCheckbox(
	checkboxName: GuiCheckboxName,
): StateWithComponent {
	const labelAndTooltip = config.timeline.guiCheckboxLabels[checkboxName];
	const tooltipAnchor = labelAndTooltip.anchor || DEFAULT_TOOLTIP_ANCHOR;
	const [value, setValue] = useLocalStorage(
		labelAndTooltip.label,
		labelAndTooltip.defaultValue,
	);

	const checkbox = (
		<Checkbox
			isChecked={value}
			label={labelAndTooltip.label}
			onChange={(e) => {
				setValue(e.target.checked);
			}}
			tooltip={
				labelAndTooltip.tooltipText
					? { text: labelAndTooltip.tooltipText, anchor: tooltipAnchor }
					: undefined
			}
			tooltipAnchor={tooltipAnchor}
		/>
	);

	return [
		value,
		checkbox,
		<Tooltip
			key={tooltipAnchor}
			className="z-[2000]"
			delayShow={config.timeline.tooltips.defaultTooltipDelayMS}
			id={tooltipAnchor}
			place="bottom"
		/>,
	];
}
