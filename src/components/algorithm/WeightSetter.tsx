/*
 * Component for setting the user's preferred weightings of various post properties.
 * Things like how much to prefer people you favorite a lot or how much to posts that
 * are trending in the Fedivers.
 */
import React, { useState, useCallback, useEffect } from "react";

import TheAlgorithm, {
	NonScoreWeightName,
	ScoreName,
	type WeightName,
	type Weights,
} from "../../core/index";

import { config } from "../../config";
import { getLogger } from "../../helpers/log_helpers";
import { useAlgorithm } from "../../hooks/useAlgorithm";
import Accordion from "../helpers/Accordion";
import { confirm } from "../helpers/Confirmation";
import { useError } from "../helpers/ErrorHandler";
import WeightSlider from "./WeightSlider";

const logger = getLogger("WeightSetter");
const WEIGHTS_STORAGE_KEY = "fefme_user_weights";

export default function WeightSetter() {
	const { algorithm } = useAlgorithm();
	const { logAndSetError } = useError();
	const [userWeights, setUserWeights] = useState<Weights>({} as Weights);

	// Load weights from localStorage or use defaults
	const initWeights = useCallback(async () => {
		try {
			const savedWeights = localStorage.getItem(WEIGHTS_STORAGE_KEY);
			if (savedWeights) {
				const weights = JSON.parse(savedWeights);
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

	// Update the user weightings and save to localStorage
	const updateWeights = useCallback(
		async (newWeights: Weights): Promise<void> => {
			try {
				logger.log("updateWeights() called with:", newWeights);
				setUserWeights(newWeights);
				algorithm.updateUserWeights(newWeights);
				// Save to localStorage
				localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(newWeights));
			} catch (error) {
				logAndSetError(logger, error);
			}
		},
		[algorithm, logAndSetError],
	);

	// Reset to default weights
	const resetToDefaults = useCallback(async (): Promise<void> => {
		if (
			!(await confirm(
				"Are you sure you want to reset all weights to their default values?",
			))
		)
			return;

		try {
			logger.log("Resetting weights to defaults");
			// Clear localStorage
			localStorage.removeItem(WEIGHTS_STORAGE_KEY);
			// Reset algorithm to defaults
			await algorithm.updateUserWeightsToPreset("default");
			const defaultWeights = await algorithm.getUserWeights();
			setUserWeights(defaultWeights);
		} catch (error) {
			logAndSetError(logger, error);
		}
	}, [algorithm, logAndSetError]);

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
			<div className="flex justify-center mb-4">
				<button
					type="button"
					onClick={resetToDefaults}
					className="rounded-md cursor-pointer px-3 py-1.5 text-xs font-semibold border border-red-300 text-red-600 hover:bg-red-50"
				>
					Reset to Defaults
				</button>
			</div>

			{Object.values(NonScoreWeightName).map((weight) =>
				makeWeightSlider(weight),
			)}
			<div className="h-3" />

			<div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted)] px-4 pb-3 pt-3">
				<p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted-fg)] mt-0 mb-2">
					Weightings
				</p>

				{Object.values(ScoreName)
					.sort()
					.map((scoreName) => makeWeightSlider(scoreName))}
			</div>
		</Accordion>
	);
}
