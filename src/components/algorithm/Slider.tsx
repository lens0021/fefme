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
	width?: string;
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
		width,
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
				<div
					className="rounded bg-white self-end border border-black mr-2.5 pl-2 pr-2 pt-0.5"
					id="innerest_doop"
				>
					<span className="font-mono text-xs">{value?.toFixed(decimals)}</span>
				</div>
			)}

			<span>
				<span className="font-bold mr-1">{`${label}${hideValueBox ? "" : ":"}`}</span>

				{description && <span>{description}</span>}
			</span>
		</div>,

		<div key={`${label}_slider`} className="flex w-full justify-end">
			<input
				type="range"
				className="custom-slider"
				id={label}
				min={minValue}
				max={maxValue}
				onChange={onChange}
				step={step}
				style={{ width: width || "100%" }}
				value={value}
			/>
		</div>,
	];

	return (
		<div className="me-2" key={`${label}_sliderForm`}>
			<div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
				{hideValueBox ? divs.reverse() : divs}
			</div>
		</div>
	);
}
