/*
 * Component for setting the user's preferred weightings of various post properties.
 * Things like how much to prefer people you favorite a lot or how much to posts that
 * are trending in the Fedivers.
 */
import { useCallback, useEffect, useState } from "react";

import {
	NonScoreWeightName,
	ScoreName,
	type WeightName,
	type Weights,
} from "../../core/index";
import { isWeightName } from "../../core/enums";
import { getLogger } from "../../helpers/log_helpers";
import { useCoordinator } from "../../hooks/useCoordinator";
import Accordion from "../helpers/Accordion";
import { useError } from "../helpers/ErrorHandler";
import WeightSlider from "./WeightSlider";

const logger = getLogger("WeightSetter");
const WEIGHTS_STORAGE_KEY = "fefme_user_weights";
export default function WeightSetter() {
	const { algorithm, triggerWeightUpdate } = useCoordinator();
	const { logAndSetError } = useError();
	const [userWeights, setUserWeights] = useState<Weights>({} as Weights);

	// Load weights from localStorage or use defaults
	const initWeights = useCallback(async () => {
		if (!algorithm) return;
		try {
			const savedWeights = localStorage.getItem(WEIGHTS_STORAGE_KEY);
			if (savedWeights) {
				const storedWeights = JSON.parse(savedWeights) as Weights;
				const baseWeights = await algorithm.getUserWeights();
				const weights = Object.entries(storedWeights).reduce(
					(cleaned, [key, value]) => {
						if (!isWeightName(key)) return cleaned;
						if (Number.isFinite(value)) {
							cleaned[key as WeightName] = Number(value);
						}
						return cleaned;
					},
					{ ...baseWeights },
				);
				logger.log("Loaded weights from localStorage:", weights);
				algorithm.updateUserWeights(weights);
				setUserWeights(weights);
			} else {
				// Use default weights from algorithm
				setUserWeights(await algorithm.getUserWeights());
			}
		} catch (error) {
			logger.error("Error loading weights from localStorage:", error);
			setUserWeights(await algorithm.getUserWeights());
		}
	}, [algorithm]);

	useEffect(() => {
		initWeights();
	}, [initWeights]);

	useEffect(() => {
		const handleReset = () => {
			initWeights();
		};
		window.addEventListener("fefme-weights-reset", handleReset);
		return () => window.removeEventListener("fefme-weights-reset", handleReset);
	}, [initWeights]);

	// Update the user weightings and save to localStorage
	const updateWeights = useCallback(
		async (newWeights: Weights): Promise<void> => {
			if (!algorithm || !triggerWeightUpdate) {
				return;
			}
			try {
				logger.log("updateWeights() called with:", newWeights);
				setUserWeights(newWeights);
				await triggerWeightUpdate(newWeights);
				// Save to localStorage
				localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(newWeights));
			} catch (error) {
				logAndSetError(logger, error);
			}
		},
		[algorithm, logAndSetError, triggerWeightUpdate],
	);

	const makeWeightSlider = (weightName: WeightName) => (
		<WeightSlider
			key={weightName}
			weightName={weightName}
			updateWeights={updateWeights}
			userWeights={userWeights}
		/>
	);

	return (
		<Accordion variant="top" title={"Feed Algorithm Control Panel"}>
			{!algorithm ? (
				<div className="px-4 py-3 text-sm text-[color:var(--color-muted-fg)]">
					Loading...
				</div>
			) : (
				<>
					<div className="px-4">
						{(Object.values(NonScoreWeightName) as NonScoreWeightName[]).map(
							(weight) => makeWeightSlider(weight),
						)}
					</div>
					<div className="h-3" />

					<div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted)] px-4 pb-3 pt-3">
						<p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted-fg)] mt-0 mb-2">
							Weightings
						</p>

						{(Object.values(ScoreName) as ScoreName[])
							.sort()
							.map((scoreName) => makeWeightSlider(scoreName))}
					</div>
				</>
			)}
		</Accordion>
	);
}
