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
import { getLogger } from "../../helpers/log_helpers";
import { useAlgorithm } from "../../hooks/useAlgorithm";
import Accordion from "../helpers/Accordion";
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
		if (!algorithm) return;
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
			if (!algorithm) {
				return;
			}
			try {
				logger.log("updateWeights() called with:", newWeights);
				setUserWeights(newWeights);
				await algorithm.updateUserWeights(newWeights);
				// Save to localStorage
				localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(newWeights));
			} catch (error) {
				logAndSetError(logger, error);
			}
		},
		[algorithm, logAndSetError],
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
						{Object.values(NonScoreWeightName).map((weight) =>
							makeWeightSlider(weight),
						)}
					</div>
					<div className="h-3" />

					<div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted)] px-4 pb-3 pt-3">
						<p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted-fg)] mt-0 mb-2">
							Weightings
						</p>

						{Object.values(ScoreName)
							.sort()
							.map((scoreName) => makeWeightSlider(scoreName))}
					</div>
				</>
			)}
		</Accordion>
	);
}
