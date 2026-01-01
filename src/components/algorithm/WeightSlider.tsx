/*
 * Slider that sets a weight for the algorithm.
 */
import isFiniteNumber from "lodash/isFinite";
import { useCallback, useEffect, useMemo } from "react";
import type { StringNumberDict, WeightName } from "../../core/index";
import { isNonScoreWeightName } from "../../core/enums";

import { config } from "../../config";
import { useAlgorithm } from "../../hooks/useAlgorithm";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Slider from "./Slider";

interface WeightSliderProps {
	updateWeights: (newWeights: StringNumberDict) => Promise<void>;
	userWeights: StringNumberDict;
	weightName: WeightName;
}

export default function WeightSlider(props: WeightSliderProps) {
	const { updateWeights, userWeights, weightName } = props;
	const { algorithm } = useAlgorithm();

	if (!isFiniteNumber(userWeights[weightName])) return <></>;
	const info = algorithm.weightsInfo[weightName];

	const weightValues = Object.values(userWeights).filter(
		(x) => !Number.isNaN(x),
	) ?? [0];
	const defaultMin =
		Math.min(...weightValues) - 1 * config.weights.scalingMultiplier;
	const defaultMax =
		Math.max(...weightValues) + 1 * config.weights.scalingMultiplier;
	const minValue = info.minValue ?? defaultMin;
	const disabledValue = isNonScoreWeightName(weightName) ? minValue : 0;
	const disabledKey = `fefme_weight_disabled_${weightName}`;
	const backupKey = `fefme_weight_backup_${weightName}`;
	const [isDisabled, setIsDisabled] = useLocalStorage<boolean>(
		disabledKey,
		false,
	);
	const sliderLabel = useMemo(
		() => weightName,
		[isDisabled, weightName],
	);

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
		if (currentValue !== disabledValue) {
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
					<span className="relative inline-flex h-5 w-9 items-center rounded-full border border-[color:var(--color-primary)] bg-[color:var(--color-primary)] transition-colors peer-checked:border-[color:var(--color-border)] peer-checked:bg-[color:var(--color-muted)]">
						<span className="h-4 w-4 translate-x-4 rounded-full bg-[color:var(--color-card-bg)] shadow-sm transition-transform peer-checked:translate-x-0.5" />
					</span>
				</label>
			}
		/>
	);
}
