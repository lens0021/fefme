/**
 * Styles for the TrendingSection component
 */
import { CSSProperties } from "react";

import { config } from "../config";
import {
	boldFont,
	flexSpaceAround,
	globalFont,
	linkesque,
	monoFont,
	roundedBox,
} from "../helpers/styles";

export const boldTagLinkStyle: CSSProperties = {
	...boldFont,
	...globalFont,
	fontSize: config.theme.trendingObjFontSize - 2,
};

export const colStyle: CSSProperties = {
	marginLeft: "1px",
	marginRight: "1px",
};

export const descriptionStyle: CSSProperties = {
	...globalFont,
	fontSize: config.theme.trendingObjFontSize,
	marginBottom: "18px",
	marginTop: "3px",
};

export const footerContainer: CSSProperties = {
	...flexSpaceAround,
	marginBottom: "5px",
	width: "100%",
};

export const footerLinkText: CSSProperties = {
	...boldFont,
	...linkesque,
	...monoFont,
	color: "#1b5b61",
	fontSize: config.theme.trendingObjFontSize - 1,
};

export const infoTxtStyle: CSSProperties = {
	fontSize: config.theme.trendingObjFontSize - 4,
	marginLeft: "6px",
};

export const linkFont: CSSProperties = {
	...globalFont,
	fontSize: config.theme.trendingObjFontSize - 1,
};

export const listItemStyle: CSSProperties = {
	marginBottom: "4px",
};

export const listStyle: CSSProperties = {
	fontSize: config.theme.trendingObjFontSize,
	listStyle: "numeric",
	paddingBottom: "10px",
	paddingLeft: "25px",
};

export const trendingListContainer: CSSProperties = {
	...roundedBox,
	paddingTop: "20px",
};

export const singleColumn: CSSProperties = {
	...trendingListContainer,
	paddingLeft: "22px",
};

export const singleColumnPadded: CSSProperties = {
	...singleColumn,
	paddingLeft: "40px",
};
