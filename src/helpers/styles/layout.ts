/**
 * Layout, flexbox, and spacing styles
 */
import { CSSProperties } from "react";

export const centerAlignedFlex: CSSProperties = {
	alignItems: "center",
	display: "flex",
};

export const centerAlignedFlexCol: CSSProperties = {
	...centerAlignedFlex,
	flexDirection: "column",
};

export const centerAlignedFlexRow: CSSProperties = {
	...centerAlignedFlex,
	flexDirection: "row",
};

export const flexSpaceAround: CSSProperties = {
	display: "flex",
	justifyContent: "space-around",
};

export const linkCursor: CSSProperties = {
	cursor: "pointer",
};

/** Make normal text look like a link by underlining it and changing the cursor on hover **/
export const linkesque: CSSProperties = {
	...linkCursor,
	textDecoration: "underline",
};

export const noPadding: CSSProperties = {
	padding: "0px",
};

export const paddingBorder: CSSProperties = {
	padding: "2px",
};

export const stickySwitchContainer: CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	height: "auto",
	paddingLeft: "2px",
	paddingRight: "2px",
};

export const tooltipZIndex: CSSProperties = {
	zIndex: 2000,
};

export const verticalContainer: CSSProperties = {
	marginTop: "35px",
};
