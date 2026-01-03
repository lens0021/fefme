/*
 * Slider that sets a weight for the algorithm.
 */
import isFiniteNumber from "lodash/isFinite";
import { useCallback, useEffect, useMemo } from "react";
import type { StringNumberDict, WeightName } from "../../core/index";
import { NonScoreWeightName, isNonScoreWeightName } from "../../core/enums";

import { config } from "../../config";
import { useAlgorithm } from "../../hooks/useAlgorithm";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Slider from "./Slider";

interface WeightSliderProps {
	updateWeights: (newWeights: StringNumberDict) => Promise<void>;
	userWeights: StringNumberDict;
	weightName: WeightName;
}

/**
 * Neutral values for NonScoreWeights when disabled.
 * These values result in no effect on the final score:
 * - TIME_DECAY: 0 → timeDecayMultiplier = 1 (no time decay)
 * - TRENDING: 1 → trendingMultiplier = 1 (no trending bonus/penalty)
 * - OUTLIER_DAMPENER: 1 → exponent = 1 (no dampening)
 */
const NEUTRAL_VALUES: Record<NonScoreWeightName, number> = {
	[NonScoreWeightName.TIME_DECAY]: 0,
	[NonScoreWeightName.TRENDING]: 1,
	[NonScoreWeightName.OUTLIER_DAMPENER]: 1,
};

export default function WeightSlider(props: WeightSliderProps) {
	const { updateWeights, userWeights, weightName } = props;
	const { algorithm } = useAlgorithm();

	// Calculate values needed for hooks
	const info = algorithm?.weightsInfo[weightName];
	const weightValues = Object.values(userWeights).filter(
		(x) => !Number.isNaN(x),
	) ?? [0];
	const defaultMin =
		Math.min(...weightValues) - 1 * config.weights.scalingMultiplier;
	const defaultMax =
		Math.max(...weightValues) + 1 * config.weights.scalingMultiplier;
	const minValue = info?.minValue ?? defaultMin;
	const disabledValue = isNonScoreWeightName(weightName)
		? NEUTRAL_VALUES[weightName as NonScoreWeightName]
		: 0;
	const disabledKey = `fefme_weight_disabled_${weightName}`;
	const backupKey = `fefme_weight_backup_${weightName}`;

	// All hooks MUST be called before any early returns
	const [isDisabled, setIsDisabled] = useLocalStorage<boolean>(
		disabledKey,
		false,
	);
	const sliderLabel = useMemo(() => weightName, [isDisabled, weightName]);

	const applyWeightValue = useCallback(
		async (nextValue: number) => {
			const newWeights = Object.assign({}, userWeights);
			newWeights[weightName] = nextValue;
			await updateWeights(newWeights);
		},
		[updateWeights, userWeights, weightName],
	);

	useEffect(() => {
		if (!isDisabled) return;
		const currentValue = userWeights[weightName];
		// Only apply disabled value if current value is defined and different
		// This prevents unnecessary updates that could hide other sliders
		if (
			currentValue !== undefined &&
			currentValue !== disabledValue &&
			Math.abs(currentValue - disabledValue) > 0.0001
		) {
			applyWeightValue(disabledValue).catch(() => {});
		}
	}, [applyWeightValue, disabledValue, isDisabled, userWeights, weightName]);

	const handleToggleDisabled = useCallback(
		async (nextDisabled: boolean) => {
			setIsDisabled(nextDisabled);
			const currentValue = userWeights[weightName];
			if (nextDisabled) {
				if (currentValue !== disabledValue) {
					localStorage.setItem(backupKey, JSON.stringify(currentValue));
				}
				await applyWeightValue(disabledValue);
			} else {
				const backupValueRaw = localStorage.getItem(backupKey);
				const backupValue = backupValueRaw
					? Number(JSON.parse(backupValueRaw))
					: undefined;
				const restoredValue = Number.isFinite(backupValue)
					? backupValue
					: currentValue;
				await applyWeightValue(restoredValue);
			}
		},
		[
			applyWeightValue,
			backupKey,
			disabledValue,
			setIsDisabled,
			userWeights,
			weightName,
		],
	);

	useEffect(() => {
		const handleReset = () => {
			setIsDisabled(false);
		};
		window.addEventListener("fefme-weights-reset", handleReset);
		return () => window.removeEventListener("fefme-weights-reset", handleReset);
	}, [setIsDisabled]);

	// Early return check AFTER all hooks
	// Only return null if we genuinely don't have info - don't hide sliders just because weights aren't loaded yet
	if (!info) {
		return null;
	}

	// If userWeights hasn't loaded this weight yet, don't render (but don't hide enabled weights)
	if (!isFiniteNumber(userWeights[weightName])) {
		return null;
	}

	return (
		<Slider
			disabled={isDisabled}
			description={info.description}
			key={weightName}
			label={sliderLabel}
			minValue={minValue}
			maxValue={defaultMax}
			onChange={async (e) => {
				await applyWeightValue(Number(e.target.value));
			}}
			stepSize={
				info.minValue && info.minValue < config.weights.defaultStepSize
					? minValue
					: config.weights.defaultStepSize
			}
			value={userWeights[weightName]}
			Addon={
				<label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--color-muted-fg)] whitespace-nowrap">
					<input
						type="checkbox"
						className="sr-only peer"
						checked={isDisabled}
						onChange={(e) => handleToggleDisabled(e.target.checked)}
					/>
					<span className="relative inline-flex h-5 w-9 items-center rounded-full border border-[color:var(--color-primary)] bg-[color:var(--color-primary)] transition-colors duration-200 ease-in-out peer-checked:border-[color:var(--color-border)] peer-checked:bg-[color:var(--color-muted)]">
						<span className="h-4 w-4 translate-x-4 rounded-full bg-[color:var(--color-card-bg)] shadow-sm transition-transform duration-200 ease-in-out peer-checked:translate-x-0.5" />
					</span>
				</label>
			}
		/>
	);
}
