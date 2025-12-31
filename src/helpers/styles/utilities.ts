/**
 * Style utilities, helper functions, and constants
 */
import { CSSProperties } from "react";

// TODO: Can't live in FilterCheckbox.tsx because of circular dependency
export enum SwitchType {
	HIGHLIGHTS_ONLY = "highlightsOnly",
	INVERT_SELECTION = "invertSelection",
	SORT_BY_COUNT = "sortByCount",
}

/** If isWaiting is true, cursor is 'wait', otherwise 'defaultCursor' arg's value if provided or 'default' if not. */
export function waitOrDefaultCursor(
	isWaiting: boolean,
	defaultCursor: CSSProperties["cursor"] = "default",
): CSSProperties {
	return { cursor: isWaiting ? "wait" : defaultCursor };
}

//////////////////////////////////////
// React Boostrap Layout classNames //
//////////////////////////////////////

export const TEXT_CENTER = "text-center";
export const TEXT_CENTER_P2 = `${TEXT_CENTER} p-2`;
