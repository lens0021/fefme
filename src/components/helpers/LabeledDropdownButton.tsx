/*
 * Drop down button that starts with a default but updates to take a value.
 */
import React, { type CSSProperties } from "react";

interface LabeledDropdownButton {
	id?: string;
	initialLabel: string;
	onClick: (value: string) => void;
	style?: CSSProperties;
	variant?: string;
	options: string[];
	optionStyle?: CSSProperties;
}

export default function LabeledDropdownButton(props: LabeledDropdownButton) {
	const { initialLabel, onClick, options, style } = props;
	let { id } = props;
	id ??= initialLabel.replace(/\s+/g, "-");

	const [currentValue, setCurrentValue] = React.useState(initialLabel);

	const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const value = e.target.value;
		setCurrentValue(value);
		onClick(value);
	};

	return (
		<select
			id={id}
			value={currentValue}
			onChange={handleChange}
			className="border border-gray-300 rounded px-3 py-2 bg-white cursor-pointer"
			style={style || {}}
		>
			<option value={initialLabel} disabled>
				{initialLabel}
			</option>
			{options.map((value) => (
				<option key={value} value={value}>
					{value}
				</option>
			))}
		</select>
	);
}
