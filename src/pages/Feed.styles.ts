/**
 * Styles for the Feed page
 */
import { CSSProperties } from "react";

import { config } from "../config";
import {
	boldFont,
	linkesque,
	loadingMsgStyle,
	mildlyRoundedCorners,
	monoFont,
	roundedCorners,
	tooltipZIndex,
} from "../helpers/styles";

export const accountTooltipStyle: CSSProperties = {
	...tooltipZIndex,
	width: "500px",
};

export const bottomRefSpacer: CSSProperties = {
	marginTop: "10px",
};

export const envVarDebugPanel: CSSProperties = {
	...monoFont,
	...roundedCorners,
	color: "white",
	fontSize: 16,
	marginTop: "28px",
	paddingLeft: "60px",
};

export const loadNewTootsText: CSSProperties = {
	...loadingMsgStyle,
	fontSize: 13,
	marginTop: "8px",
	textAlign: "center",
};

export const noTootsMsgStyle: CSSProperties = {
	display: "flex",
	flex: 1,
	height: "100vh",
	alignItems: "center",
	justifyContent: "center",
	fontSize: 20,
};

export const resetLinkStyle: CSSProperties = {
	...boldFont,
	...linkesque,
	color: "red",
	fontSize: 14,
};

export const scrollStatusMsg: CSSProperties = {
	...loadingMsgStyle,
	color: "grey",
};

export const statusesColStyle: CSSProperties = {
	...mildlyRoundedCorners,
	backgroundColor: config.theme.feedBackgroundColor,
	height: "auto",
};
