import type { StringNumberDict, WeightName } from "fedialgo";
/*
 * Slider that sets a weight for the algorithm.
 */
import isFiniteNumber from "lodash/isFinite";

import { config } from "../../config";
import { useAlgorithm } from "../../hooks/useAlgorithm";
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

	return (
		<Slider
			description={info.description}
			key={weightName}
			label={weightName}
			minValue={minValue}
			maxValue={defaultMax}
			onChange={async (e) => {
				const newWeights = Object.assign({}, userWeights);
				newWeights[weightName] = Number(e.target.value);
				await updateWeights(newWeights);
			}}
			stepSize={
				info.minValue && info.minValue < config.weights.defaultStepSize
					? minValue
					: config.weights.defaultStepSize
			}
			value={userWeights[weightName]}
		/>
	);
}
