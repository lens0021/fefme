/**
 * Typography and font-related styles
 */
import { CSSProperties } from "react";

export const boldFont: CSSProperties = {
	fontWeight: "bold",
};

export const blackFont: CSSProperties = {
	color: "black",
};

export const blackBoldFont: CSSProperties = {
	...blackFont,
	...boldFont,
};

export const whiteFont: CSSProperties = {
	color: "white",
};

export const blackBackground: CSSProperties = {
	backgroundColor: "black",
};

export const whiteBackground: CSSProperties = {
	backgroundColor: "white",
};

/** Black Tahoma / Geneva / sans-serif. */
export const globalFont: CSSProperties = {
	...blackFont,
	fontFamily: "Tahoma, Geneva, sans-serif",
};

export const headerFont: CSSProperties = {
	...globalFont,
	fontSize: 15,
	fontWeight: 800,
	marginBottom: "0px",
	marginLeft: "15px",
	marginTop: "0px",
};

export const monoFont: CSSProperties = {
	fontFamily:
		"source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace",
};

export const titleStyle: CSSProperties = {
	...boldFont,
	...globalFont,
	fontSize: 17,
	marginBottom: "5px",
	marginLeft: "5px",
	marginTop: "0px",
	textDecoration: "underline",
};
