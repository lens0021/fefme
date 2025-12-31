/*
 * Slider that sets a weight for the algorithm.
 */
import React, { type ChangeEvent, CSSProperties } from "react";

import { config } from "../../config";

interface SliderProps {
	description?: string;
	hideValueBox?: boolean;
	label: string;
	minValue: number;
	maxValue: number;
	onChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
	stepSize?: number;
	value: number;
}

export default function Slider(props: SliderProps) {
	const {
		description,
		hideValueBox,
		label,
		minValue,
		maxValue,
		onChange,
		stepSize,
		value,
	} = props;
	if (!value && value !== 0) return;

	const step = stepSize ?? (minValue >= 0 ? config.weights.defaultStepSize : 1);
	let decimals = 2;

	if (stepSize === 1) {
		decimals = 0;
	} else if (minValue > 0 && minValue < 0.01) {
		decimals = 3;
	} else if (value >= 10.0) {
		decimals = 1;
	}

	const divs = [
		<div
			key={`${label}_label`}
			className="flex flex-wrap items-center gap-2 text-sm"
		>
			{!hideValueBox && (
				<div className="rounded bg-[color:var(--color-card-bg)] self-end border border-[color:var(--color-border)] mr-2.5 px-2 pt-0.5 min-w-[3.5rem]">
					<span className="font-mono text-xs text-right block">{value?.toFixed(decimals)}</span>
				</div>
			)}

			<span>
				<span className="font-bold mr-1">{`${label}${hideValueBox ? "" : ":"}`}</span>

				{description && <span>{description}</span>}
			</span>
		</div>,

		<div key={`${label}_slider`} className="w-full">
			<input
				type="range"
				className="custom-slider w-full"
				id={label}
				min={minValue}
				max={maxValue}
				onChange={onChange}
				step={step}
				value={value}
			/>
		</div>,
	];

	return (
		<div className="me-2" key={`${label}_sliderForm`}>
			<div className="flex flex-col gap-2 text-sm">
				{hideValueBox ? divs.reverse() : divs}
			</div>
		</div>
	);
}
