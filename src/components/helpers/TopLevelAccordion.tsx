/*
 * Component for setting the user's preferred weightings of various post properties.
 * Things like how much to prefer people you favorite a lot or how much to posts that
 * are trending in the Fedivers.
 */
import React, { CSSProperties, PropsWithChildren, useState } from "react";

import {
	accordionBody,
	noPadding,
	titleStyle,
} from "../../helpers/style_helpers";

interface TopLevelAccordionProps extends PropsWithChildren {
	bodyStyle?: CSSProperties;
	isActive?: boolean;
	onExited?: () => void;
	startOpen?: boolean;
	title: string;
}

export default function TopLevelAccordion(props: TopLevelAccordionProps) {
	const { bodyStyle, isActive, onExited, startOpen, title } = props;
	const [isOpen, setIsOpen] = useState(startOpen || false);

	// Invert color scheme of title if active
	const className = isActive ? "filterHeader--rounded" : "";
	const style = { ...titleStyle, color: isActive ? "white" : "black" };

	const toggleOpen = () => {
		if (isOpen && onExited) {
			onExited();
		}
		setIsOpen(!isOpen);
	};

	return (
		<div className="border border-gray-200 rounded mb-2">
			<button
				onClick={toggleOpen}
				className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors flex justify-between items-center"
				style={noPadding}
			>
				<span className={className} style={style}>
					{title}
				</span>
				<span className="text-gray-500">{isOpen ? "−" : "+"}</span>
			</button>

			{isOpen && (
				<div style={{ ...accordionBody, ...(bodyStyle || {}) }}>
					{props.children}
				</div>
			)}
		</div>
	);
}
