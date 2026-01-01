/*
 * Slider that sets a weight for the algorithm.
 */
import React, { type ChangeEvent, CSSProperties } from "react";

import { config } from "../../config";

interface SliderProps {
	description?: string;
	disabled?: boolean;
	hideValueBox?: boolean;
	label: string;
	minValue: number;
	maxValue: number;
	onChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
	Addon?: React.ReactNode;
	stepSize?: number;
	value: number;
}

export default function Slider(props: SliderProps) {
	const {
		description,
		disabled,
		hideValueBox,
		label,
		minValue,
		maxValue,
		onChange,
		Addon: rightAddon,
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

	return (
		<div className="mb-4" key={`${label}_sliderForm`}>
			<div className={`${disabled ? "opacity-60" : ""}`}>
				<div className="flex items-center gap-2 mb-2">
					<span className="font-semibold text-sm">{label}</span>
					{rightAddon && <div>{rightAddon}</div>}
					{description && (
						<span className="text-xs text-[color:var(--color-muted-fg)]">
							{description}
						</span>
					)}
				</div>
				<div className="flex items-center gap-3">
					<div className="flex-1 min-w-[6rem]">
						<input
							type="range"
							className="custom-slider w-full"
							disabled={disabled}
							id={label}
							min={minValue}
							max={maxValue}
							onChange={onChange}
							step={step}
							value={value}
						/>
					</div>
					{!hideValueBox && (
						<div className="rounded bg-[color:var(--color-card-bg)] border border-[color:var(--color-border)] px-2 py-1 min-w-[3.5rem]">
							<span className="font-mono text-xs text-center block">
								{value?.toFixed(decimals)}
							</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
