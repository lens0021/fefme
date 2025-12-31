/**
 * Component-specific styles
 */
import { CSSProperties } from "react";

import { blackBackground, monoFont } from "./typography";

export const accordionBody: CSSProperties = {
	backgroundColor: "#b2bfd4",
};

export const accordionSubheader: CSSProperties = {
	marginLeft: "7px",
	padding: "7px",
};

export const loadingMsgStyle: CSSProperties = {
	fontSize: 16,
	height: "auto",
	marginTop: "6px",
};

export const mildlyRoundedCorners: CSSProperties = {
	borderRadius: 3,
};

export const rawErrorContainer: CSSProperties = {
	...blackBackground,
	...monoFont,
	borderRadius: 10,
	marginTop: "15px",
	minHeight: "120px",
	padding: "35px",
};

export const roundedBox: CSSProperties = {
	borderRadius: 20,
	background: "lightgrey",
	paddingLeft: "25px",
	paddingRight: "20px",
	paddingBottom: "13px",
	paddingTop: "15px",
};

// TODO: could roundedBox use this borderRadius value?
export const roundedCorners: CSSProperties = {
	borderRadius: 15,
};

/**
 * Base button style - common properties for all buttons
 * Extend this with specific colors and sizes
 */
export const baseButton: CSSProperties = {
	border: "none",
	borderRadius: "6px",
	cursor: "pointer",
	fontSize: "14px",
	fontWeight: "500",
	padding: "8px 16px",
	transition: "background-color 0.2s",
};

/**
 * Create a vertical spacer div with specified height
 * Usage: <div style={verticalSpacer("12px")} />
 */
export function verticalSpacer(height: string): CSSProperties {
	return { height };
}
