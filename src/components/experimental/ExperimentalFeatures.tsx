/*
 * WIP: Component for displaying the trending hashtags in the Fediverse.
 */
import { FEDIALGO } from "fedialgo";

import { useAlgorithm } from "../../hooks/useAlgorithm";
import { useAuthContext } from "../../hooks/useAuth";
import Accordion from "../helpers/Accordion";
import { confirm } from "../helpers/Confirmation";

const DELETE_ALL = "Delete All Data & Logout";
const LOAD_COMPLETE_USER_HISTORY = "Load Complete User History";

const BUTTON_TEXT = {
	[DELETE_ALL]:
		"Wipe all user data including the registered app. Necessary to handle OAuth permissions errors." +
		" You'll need to reauthenticate afterwards.",
	[LOAD_COMPLETE_USER_HISTORY]:
		"Load all your toots and favourites. May improve scoring of your feed." +
		" Takes time & resources proportional to the number of times you've tooted.",
};

export const OAUTH_ERROR_MSG = `If you were trying to bookmark, mute, or reply with an image you may have used ${FEDIALGO} before it requested the appropriate permissions to perform those actions. This can be fixed with the "${DELETE_ALL}" button in the Experimental Features section or by manually clearing your browser's local storage (cookies and everything else) for this site. and then logging back in.`;

export default function ExperimentalFeatures() {
	const { algorithm, isLoading, triggerPullAllUserData } = useAlgorithm();
	const { logout, setApp } = useAuthContext();

	// Reset all state except for the user and server
	const wipeAll = async () => {
		if (
			!(await confirm(
				"Are you sure you want to delete everything? You will be logged out and need to re-authenticate.",
			))
		)
			return;
		setApp(null);
		await algorithm?.reset(true);
		logout();
	};

	const makeLabeledButton = (
		label: keyof typeof BUTTON_TEXT,
		onClick: () => void,
		variant?: string,
	) => {
		const isDanger = variant === "danger";
		const buttonClass = isDanger
			? "bg-red-600 hover:bg-red-700 text-white"
			: "bg-blue-600 hover:bg-blue-700 text-white";

		return (
			<li
				key={label}
				className="flex flex-row items-center text-[18px] mb-[2px]"
			>
				<button
					type="button"
					className={`${buttonClass} px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center flex-[2] my-[5px]`}
					disabled={isLoading}
					onClick={onClick}
				>
					{isLoading ? "Loading..." : label}
				</button>

				<div className="flex-[4] text-sm ml-[10px]">{BUTTON_TEXT[label]}</div>
			</li>
		);
	};

	return (
		<Accordion variant="top" title="Experimental Features">
			<p className="ml-[7px] p-[7px] pt-[2px]">Use with caution.</p>

			<div className="rounded-[20px] bg-[#d3d3d3] pl-[20px] pr-[20px] pt-[15px] pb-[20px]">
				<ul>
					{makeLabeledButton(
						LOAD_COMPLETE_USER_HISTORY,
						triggerPullAllUserData,
					)}
					<hr className="my-2 border-gray-300" />
					{makeLabeledButton(DELETE_ALL, wipeAll, "danger")}
				</ul>
			</div>
		</Accordion>
	);
}
