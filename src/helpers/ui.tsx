/*
 * UI helpers and tooltip types.
 */
import type React from "react";
import type { CSSProperties, MouseEvent, ReactElement } from "react";

import type tinycolor from "tinycolor2";
import { type Toot, makeChunks } from "../core/index";

import { appLogger } from "./log_helpers";
import type { GradientEndpoints } from "./styles";

////////////////////////
// Navigation Helpers //
////////////////////////

// Opens in new tab. For same tab do this:  window.location.href = statusURL;
export function followUri(uri: string, e: MouseEvent): boolean {
	e.preventDefault();
	window.open(uri, "_blank");
	return false;
}

// Open the Post in a new tab, resolved to its URL on the user's home server
export async function openToot(
	toot: Toot,
	e: MouseEvent,
	isGoToSocialUser?: boolean,
): Promise<boolean> {
	e.preventDefault();
	appLogger.log("openPost() called with:", toot);
	const resolvedURL = isGoToSocialUser ? toot.url : await toot.localServerUrl();
	return followUri(resolvedURL, e);
}

///////////////////////
// Component Helpers //
///////////////////////

// Create a grid of numCols columns. If numCols is not provided either 2 or 3 columns
// will be created based on the number of 'elements' provided.
export function gridify(
	elements: ReactElement[],
	numCols?: number,
	colStyle?: CSSProperties,
): ReactElement {
	if (elements.length === 0) return <></>;
	const resolvedNumCols = numCols ?? (elements.length > 10 ? 3 : 2);
	const columns = makeChunks(elements, { numChunks: resolvedNumCols });

	return (
		<div className="flex flex-col gap-3 sm:flex-row">
			{columns.map((columnItems) => (
				<div
					key={columnItems.map((item) => String(item.key ?? "item")).join("-")}
					className="flex-1 min-w-0"
					style={colStyle || {}}
				>
					{columnItems}
				</div>
			))}
		</div>
	);
}

/**
 * Creates a factory function for generating HeaderSwitch components with state management
 * @param state The current state object
 * @param setState The setState function
 * @param HeaderSwitchComponent The HeaderSwitch component to use
 * @returns A factory function that creates HeaderSwitch components
 *
 * @example
 * import HeaderSwitch from './HeaderSwitch';
 * const switchState = { sortByCount: false, highlightsOnly: true };
 * const [state, setState] = useState(switchState);
 * const makeSwitchElement = createSwitchFactory(state, setState, HeaderSwitch);
 * const sortSwitch = makeSwitchElement('sortByCount');
 */
export function createSwitchFactory<T extends Record<string, boolean>>(
	state: T,
	setState: React.Dispatch<React.SetStateAction<T>>,
	HeaderSwitchComponent: React.ComponentType<{
		isChecked: boolean;
		label: string;
		onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	}>,
) {
	return (key: keyof T) => {
		return (
			<HeaderSwitchComponent
				isChecked={state[key]}
				key={key as string}
				label={key as string}
				onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
					setState({ ...state, [key]: e.target.checked })
				}
			/>
		);
	};
}

///////////////////////
//   Style Helpers   //
///////////////////////

/**
 * Returns a red or green <span> for a given boolean value.
 * @param {boolean} value The boolean value to represent.
 * @param {boolean} includeString Whether to include the string "true" or "false" with the icon.
 */
export function booleanIcon(
	value: boolean | null | undefined,
	includeString = true,
): ReactElement {
	const style: CSSProperties = { color: value ? "green" : "red" };
	return (
		<span style={style}>
			{includeString ? `${value.toString()} ` : ""}
			{value ? "✔" : "✘"}
		</span>
	);
}

///////////////////////
// Tooltip Typings   //
///////////////////////

export interface CheckboxGradientCfg {
	// Sometimes we want to adjust the gradient instead of using the one between the endpoints to make any of the
	// colors visible (e.g. when the user has one tag they participate in A LOT the rest will be undifferentiated)
	adjustment?: {
		adjustPctiles: number[];
		minTagsToAdjust: number;
	};
	endpoints: GradientEndpoints;
	textWithSuffix: (txt: string, n: number) => string;
}

// Two types unioned to create on XOR argument situation
type CheckboxColor = { color: CSSProperties["color"]; gradient?: never };
type CheckboxGradientColor = { color?: never; gradient: CheckboxGradientCfg };

export type CheckboxTooltipConfig = {
	anchor?: string;
	highlight?: CheckboxColor | CheckboxGradientColor; // Union type forces exactly one of 'color' or 'gradient'
	text: string;
};

// Same as CheckboxTooltipConfig but with the actual array of colors for the gradient
export interface CheckboxGradientTooltipConfig extends CheckboxTooltipConfig {
	colors: tinycolor.Instance[];
}

export type GuiCheckboxLabel = {
	readonly anchor?: string; // Optional anchor for the tooltip
	readonly defaultValue: boolean;
	readonly label: string;
	readonly tooltipText: string;
};

export type LinkWithTooltipCfg = {
	readonly label: string;
	readonly labelStyle?: React.CSSProperties;
	readonly tooltipText: string;
};
