/*
 * Component for setting the user's preferred weightings of various post properties.
 * Things like how much to prefer people you favorite a lot or how much to posts that
 * are trending in the Fedivers.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
	NonScoreWeightName,
	ScoreName,
	type WeightName,
	type Weights,
} from "../../core/index";
import { WeightPresetLabel } from "../../core/scorer/weight_presets";

import { getLogger } from "../../helpers/log_helpers";
import { useAlgorithm } from "../../hooks/useAlgorithm";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Accordion from "../helpers/Accordion";
import { useError } from "../helpers/ErrorHandler";
import WeightSlider from "./WeightSlider";

const logger = getLogger("WeightSetter");
const WEIGHTS_STORAGE_KEY = "fefme_user_weights";
const WEIGHTS_BACKUP_KEY = "fefme_user_weights_backup";
const ALGO_ENABLED_KEY = "fefme_algorithm_enabled";

export default function WeightSetter() {
	const { algorithm } = useAlgorithm();
	const { logAndSetError } = useError();
	const [userWeights, setUserWeights] = useState<Weights>({} as Weights);
	const [isAlgorithmEnabled, setIsAlgorithmEnabled] = useLocalStorage<boolean>(
		ALGO_ENABLED_KEY,
		true,
	);
	const didInitRef = useRef(false);

	const persistWeights = (weights: Weights) => {
		localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(weights));
	};

	const loadSavedWeights = () => {
		const savedWeights = localStorage.getItem(WEIGHTS_STORAGE_KEY);
		return savedWeights ? (JSON.parse(savedWeights) as Weights) : null;
	};

	const applyWeights = useCallback(
		async (weights: Weights): Promise<void> => {
			if (!algorithm) return;
			setUserWeights(weights);
			await algorithm.updateUserWeights(weights);
			persistWeights(weights);
		},
		[algorithm],
	);

	const disableAlgorithm = useCallback(
		async (backupWeights: Weights): Promise<void> => {
			if (!algorithm) return;
			localStorage.setItem(WEIGHTS_BACKUP_KEY, JSON.stringify(backupWeights));
			await algorithm.updateUserWeightsToPreset(WeightPresetLabel.CHRONOLOGICAL);
			const chronoWeights = await algorithm.getUserWeights();
			setUserWeights(chronoWeights);
			persistWeights(chronoWeights);
		},
		[algorithm],
	);

	const restoreAlgorithmWeights = useCallback(async (): Promise<void> => {
		if (!algorithm) return;
		const backup = localStorage.getItem(WEIGHTS_BACKUP_KEY);
		if (backup) {
			await applyWeights(JSON.parse(backup) as Weights);
			return;
		}
		const fallbackWeights = await algorithm.getUserWeights();
		await applyWeights(fallbackWeights);
	}, [algorithm, applyWeights]);

	// Load weights from localStorage or use defaults
	const initWeights = useCallback(async () => {
		if (!algorithm) return;
		if (didInitRef.current) return;
		try {
			const weights = loadSavedWeights() ?? (await algorithm.getUserWeights());
			logger.log("Loaded weights:", weights);
			if (isAlgorithmEnabled) {
				await applyWeights(weights);
			} else {
				await disableAlgorithm(weights);
			}
		} catch (error) {
			logger.error("Error loading weights from localStorage:", error);
			const fallbackWeights = await algorithm.getUserWeights();
			if (isAlgorithmEnabled) {
				await applyWeights(fallbackWeights);
			} else {
				await disableAlgorithm(fallbackWeights);
			}
		}
		didInitRef.current = true;
	}, [algorithm, applyWeights, disableAlgorithm, isAlgorithmEnabled]);

	useEffect(() => {
		if (!algorithm) return;
		didInitRef.current = false;
		initWeights();
	}, [algorithm, initWeights]);

	// Update the user weightings and save to localStorage
	const updateWeights = useCallback(
		async (newWeights: Weights): Promise<void> => {
			if (!algorithm || !isAlgorithmEnabled) return;
			try {
				logger.log("updateWeights() called with:", newWeights);
				localStorage.setItem(WEIGHTS_BACKUP_KEY, JSON.stringify(newWeights));
				await applyWeights(newWeights);
			} catch (error) {
				logAndSetError(logger, error);
			}
		},
		[algorithm, applyWeights, isAlgorithmEnabled, logAndSetError],
	);

	const makeWeightSlider = (weightName: WeightName) => (
		<WeightSlider
			disabled={!isAlgorithmEnabled}
			key={weightName}
			weightName={weightName}
			updateWeights={updateWeights}
			userWeights={userWeights}
		/>
	);

	const handleAlgorithmToggle = useCallback(
		async (nextEnabled: boolean) => {
			setIsAlgorithmEnabled(nextEnabled);
			if (!algorithm) return;
			if (nextEnabled) {
				await restoreAlgorithmWeights();
			} else {
				const backupWeights =
					Object.keys(userWeights).length > 0
						? userWeights
						: await algorithm.getUserWeights();
				await disableAlgorithm(backupWeights);
			}
		},
		[
			algorithm,
			disableAlgorithm,
			restoreAlgorithmWeights,
			setIsAlgorithmEnabled,
			userWeights,
		],
	);

	return (
		<Accordion variant="top" title={"Feed Algorithm Control Panel"}>
			{!algorithm ? (
				<div className="px-4 py-3 text-sm text-[color:var(--color-muted-fg)]">
					Loading...
				</div>
			) : (
				<>
					<div className="px-4 pt-3 pb-2">
						<label className="flex items-center gap-2 text-sm font-semibold">
							<input
								type="checkbox"
								checked={isAlgorithmEnabled}
								onChange={(e) => handleAlgorithmToggle(e.target.checked)}
							/>
							<span>Enable algorithm (uncheck for chronological feed)</span>
						</label>
						<p className="text-xs text-[color:var(--color-muted-fg)] mt-1">
							When disabled, sliders are locked and posts are shown in
							chronological order.
						</p>
					</div>
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
