import React, { CSSProperties, useState } from "react";

import { config } from "../config";
import { useAlgorithm } from "../hooks/useAlgorithm";
import { verticalContainer } from "../helpers/style_helpers";

/**
 * The footer that appears on the login screen when API errors and warnings were encountered
 * while retrieving Mastodon data.
 */
export default function ApiErrorsPanel(): JSX.Element {
	const { algorithm } = useAlgorithm();
	const [isExpanded, setIsExpanded] = useState(false);

	if (!algorithm?.apiErrorMsgs || algorithm.apiErrorMsgs.length === 0) {
		return null;
	}

	return (
		<div style={accordionStyle}>
			<div style={accordionStyle}>
				<div style={headerStyle}>
					<button
						type="button"
						style={buttonStyle}
						onClick={() => setIsExpanded(!isExpanded)}
					>
						{algorithm.apiErrorMsgs.length}{" "}
						{config.timeline.apiErrorsUserMsgSuffix} (click to inspect)
					</button>
				</div>

				{isExpanded && (
					<div style={bodyStyle}>
						<ul style={errorList}>
							{algorithm.apiErrorMsgs.map((msg, i) => (
								<li key={`${msg}_${i}`} style={errorItem}>
									{msg}
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}

const accordionHeaderStyle: CSSProperties = {
	backgroundColor: "#4f4f42ff",
};

const accordionStyle: CSSProperties = {
	...accordionHeaderStyle,
	...verticalContainer,
	fontFamily: "Tahoma, Geneva, sans-serif",
	marginBottom: verticalContainer.marginTop,
	borderRadius: "4px",
	overflow: "hidden",
};

const headerStyle: CSSProperties = {
	...accordionHeaderStyle,
};

const bodyStyle: CSSProperties = {
	...accordionHeaderStyle,
	padding: "12px",
};

const buttonStyle: CSSProperties = {
	...accordionHeaderStyle,
	borderWidth: "0px",
	color: "#a4a477ff",
	width: "100%",
	padding: "12px",
	cursor: "pointer",
	textAlign: "left",
};

const errorItem: CSSProperties = {
	color: "#c6d000ff",
	fontSize: 12,
	marginTop: "2px",
};

const errorList: CSSProperties = {
	listStyle: "numeric",
	paddingLeft: "25px",
};
