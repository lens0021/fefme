/*
 * Component for setting the user's preferred weightings of various post properties.
 * Things like how much to prefer people you favorite a lot or how much to posts that
 * are trending in the Fedivers.
 */
import React, { CSSProperties, useState, useCallback, useEffect } from "react";

import TheAlgorithm, {
	NonScoreWeightName,
	ScoreName,
	type WeightName,
	type Weights,
} from "fedialgo";

import TopLevelAccordion from "../helpers/TopLevelAccordion";
import WeightSlider from "./WeightSlider";
import { confirm } from "../helpers/Confirmation";
import { getLogger } from "../../helpers/log_helpers";
import { roundedBox, titleStyle } from "../../helpers/styles";
import { useAlgorithm } from "../../hooks/useAlgorithm";
import { useError } from "../helpers/ErrorHandler";

const logger = getLogger("WeightSetter");
const WEIGHTS_STORAGE_KEY = "fefme_user_weights";

export default function WeightSetter() {
	const { algorithm } = useAlgorithm();
	const { logAndSetError } = useError();
	const [userWeights, setUserWeights] = useState<Weights>({} as Weights);

	// Load weights from localStorage or use defaults
	const initWeights = async () => {
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
	};

	useEffect(() => {
		initWeights();
	}, []);

	// Update the user weightings and save to localStorage
	const updateWeights = useCallback(
		async (newWeights: Weights): Promise<void> => {
			try {
				logger.log(`updateWeights() called with:`, newWeights);
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
	const resetToDefaults = useCallback(
		async (): Promise<void> => {
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
		<TopLevelAccordion title={"Feed Algorithm Control Panel"}>
			<div style={resetButtonContainer}>
				<button onClick={resetToDefaults} style={resetButton}>
					Reset to Defaults
				</button>
			</div>

			{Object.values(NonScoreWeightName).map((weight) =>
				makeWeightSlider(weight),
			)}
			<div style={{ height: "12px" }} />

			<div style={roundedBox}>
				<p style={weightingsStyle}>Weightings</p>

				{Object.values(ScoreName)
					.sort()
					.map((scoreName) => makeWeightSlider(scoreName))}
			</div>
		</TopLevelAccordion>
	);
}

const resetButtonContainer: CSSProperties = {
	display: "flex",
	justifyContent: "center",
	marginBottom: "16px",
};

const resetButton: CSSProperties = {
	backgroundColor: "#ef4444",
	color: "white",
	border: "none",
	padding: "8px 16px",
	borderRadius: "6px",
	cursor: "pointer",
	fontSize: "14px",
	fontWeight: "500",
	transition: "background-color 0.2s",
};

const weightingsStyle: CSSProperties = {
	...titleStyle,
	marginBottom: "10px",
};
