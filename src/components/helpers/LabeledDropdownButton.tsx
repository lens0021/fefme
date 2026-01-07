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
			className="border border-[color:var(--color-border)] rounded-md px-3 py-1.5 bg-[color:var(--color-card-bg)] text-[color:var(--color-fg)] cursor-pointer text-sm font-medium focus:ring-2 focus:ring-[color:var(--color-primary)] focus:outline-none transition-shadow"
			style={style || {}}
		>
			<option value={initialLabel} disabled className="text-[color:var(--color-muted-fg)]">
				{initialLabel}
			</option>
			{options.map((value) => (
				<option key={value} value={value} className="bg-[color:var(--color-card-bg)] text-[color:var(--color-fg)]">
					{value}
				</option>
			))}
		</select>
	);
}
