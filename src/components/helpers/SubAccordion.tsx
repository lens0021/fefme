/*
 * Generic omponent to display a set of filter options with a switchbar at the top.
 */
import React, { CSSProperties, PropsWithChildren, useState } from "react";

import { capitalCase } from "change-case";

import { accordionBody, globalFont } from "../../helpers/style_helpers";
import { hasAnyCapitalLetters } from "../../helpers/string_helpers";

export interface SubAccordionProps extends PropsWithChildren {
	description?: string;
	isActive?: boolean;
	title: string;
}

export default function SubAccordion(props: SubAccordionProps) {
	const { description, isActive, title } = props;
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className="border-b border-gray-200" key={title}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="w-full text-left py-2 hover:bg-gray-50 transition-colors flex justify-between items-center"
			>
				<label style={subHeaderLabel} className="cursor-pointer">
					<span
						className={`filterHeader ${isActive ? "filterHeader--active" : ""}`}
						key={1}
					>
						{/* // TODO janky workaround bc capitalCase() turns apostrophes into spaces */}
						{hasAnyCapitalLetters(title) ? title : capitalCase(title)}
					</span>

					{description && (
						<span style={descriptionStyle} key={2}>
							{"  "}({description})
						</span>
					)}
				</label>
				<span className="text-gray-500 px-2">{isOpen ? "−" : "+"}</span>
			</button>

			{isOpen && <div style={accordionBodyDiv}>{props.children}</div>}
		</div>
	);
}

const accordionBodyDiv: CSSProperties = {
	...accordionBody,
	paddingTop: "7px",
};

const descriptionStyle: CSSProperties = {
	...globalFont,
	fontSize: 13,
	fontWeight: 500,
};

const subHeaderLabel: CSSProperties = {
	// color: "#2c2e2d",
	marginBottom: "-5px",
	marginTop: "-5px",
};
