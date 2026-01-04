import React from "react";

import { FEDIALGO } from "../core/index";
import { buildNewFilterSettings } from "../core/filters/feed_filters";
import {
	DEFAULT_WEIGHTS,
	WeightPresetLabel,
} from "../core/scorer/weight_presets";
import { VERSION } from "../version";

import { confirm } from "./helpers/Confirmation";
import { useCoordinator } from "../hooks/useCoordinator";
import { useAuthContext } from "../hooks/useAuth";

/** Header component on the feed page. */
export default function Header(): JSX.Element {
	const { user, logout, setApp } = useAuthContext();
	const {
		algorithm,
		resetAlgorithm,
		resetSeenState,
		setSelfTypeFilterMode,
		triggerFilterUpdate,
		triggerWeightPresetUpdate,
	} = useCoordinator();

	const reset = async () => {
		if (
			!(await confirm(
				"Are you sure you want to reset your feed data? (You will stay logged in)",
			))
		)
			return;
		resetAlgorithm();
	};

	const resetWeights = async () => {
		if (
			!(await confirm(
				"Reset all feed weights to defaults? Your filters and cached posts will stay.",
			))
		)
			return;
		await triggerWeightPresetUpdate?.(WeightPresetLabel.DEFAULT);
		localStorage.setItem("fefme_user_weights", JSON.stringify(DEFAULT_WEIGHTS));
		Object.keys(DEFAULT_WEIGHTS).forEach((weightName) => {
			localStorage.removeItem(`fefme_weight_disabled_${weightName}`);
			localStorage.removeItem(`fefme_weight_backup_${weightName}`);
		});
		window.dispatchEvent(new CustomEvent("fefme-weights-reset"));
	};

	const resetFilters = async () => {
		if (
			!(await confirm(
				"Reset all filters to defaults? Your weights and cached posts will stay.",
			))
		)
			return;
		localStorage.removeItem("type-filter-self");
		await triggerFilterUpdate?.(buildNewFilterSettings());
		setSelfTypeFilterMode?.("none");
	};

	const resetSeen = async () => {
		if (
			!(await confirm(
				"Reset read/seen state for all cached posts? Filters and weights will stay.",
			))
		)
			return;
		await resetSeenState?.();
	};

	const handleLogout = () => {
		logout();
	};

	const deleteAllData = async () => {
		if (
			!(await confirm(
				"Delete all data and log out? You will need to reauthenticate.",
			))
		)
			return;
		setApp(null);
		await algorithm?.reset(true);
		logout();
	};

	return (
		<div className="w-full pt-4">
			<div className="flex items-center justify-between gap-2">
				{user && (
					<div className="flex items-center gap-2">
						{user?.profilePicture && (
							<img
								alt={`${FEDIALGO} User Avatar`}
								src={user.profilePicture}
								className="h-8 w-8 rounded"
							/>
						)}
						<span className="text-sm">{user.username}</span>
					</div>
				)}

				<details className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-2 text-xs text-[color:var(--color-muted-fg)]">
					<summary className="cursor-pointer font-semibold">
						Account & data reset
					</summary>
					<div className="absolute right-4 mt-2 w-64 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] p-3 shadow-lg z-10">
						<div className="mb-2 pb-2 border-b border-[color:var(--color-border)] text-[10px] text-[color:var(--color-muted-fg)]">
							Version {VERSION}
						</div>
						<div className="flex flex-col gap-3 text-xs">
							<div className="flex flex-col gap-1">
								<span>Reset all feed weights to their defaults.</span>
								<button
									type="button"
									onClick={resetWeights}
									className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-xs font-semibold text-[color:var(--color-primary)]"
								>
									Reset weights
								</button>
							</div>
							<div className="flex flex-col gap-1">
								<span>Reset all filters to their defaults.</span>
								<button
									type="button"
									onClick={resetFilters}
									className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-xs font-semibold text-[color:var(--color-primary)]"
								>
									Reset filters
								</button>
							</div>
							<div className="flex flex-col gap-1">
								<span>Reset read/seen state for all cached posts.</span>
								<button
									type="button"
									onClick={resetSeen}
									className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-xs font-semibold text-[color:var(--color-primary)]"
								>
									Reset seen state
								</button>
							</div>
							<div className="flex flex-col gap-1">
								<span>Reset cached posts and reload the feed.</span>
								<button
									type="button"
									onClick={reset}
									className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
								>
									Reset feed data
								</button>
							</div>
							<div className="flex flex-col gap-1">
								<span>Sign out of this session.</span>
								<button
									type="button"
									onClick={handleLogout}
									className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
								>
									Log out
								</button>
							</div>
							<div className="flex flex-col gap-1">
								<span>Delete all local data, clear the app, and log out.</span>
								<button
									type="button"
									onClick={deleteAllData}
									className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
								>
									Delete all data & log out
								</button>
							</div>
						</div>
					</div>
				</details>
			</div>
		</div>
	);
}
