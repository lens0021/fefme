/*
 * WIP: Component for displaying the trending hashtags in the Fediverse.
 */
import { CSSProperties } from "react";

import { FEDIALGO } from "fedialgo";

import TopLevelAccordion from "../helpers/TopLevelAccordion";
import {
	accordionSubheader,
	centerAlignedFlexRow,
	roundedBox,
	TEXT_CENTER_P2,
} from "../../helpers/style_helpers";
import { confirm } from "../helpers/Confirmation";
import { useAlgorithm } from "../../hooks/useAlgorithm";
import { useAuthContext } from "../../hooks/useAuth";

const DELETE_ALL = "Delete All User Data";
const LOAD_COMPLETE_USER_HISTORY = "Load Complete User History";

const BUTTON_TEXT = {
	[DELETE_ALL]:
		"Wipe all user data including the registered app. Necessary to handle OAuth permissions errors." +
		" You'll need to reauthenticate afterwards.",
	[LOAD_COMPLETE_USER_HISTORY]:
		"Load all your toots and favourites. May improve scoring of your feed." +
		" Takes time & resources proportional to the number of times you've tooted.",
};

export const OAUTH_ERROR_MSG =
	`If you were trying to bookmark, mute, or reply with an image you may have used` +
	` ${FEDIALGO} before it requested the appropriate permissions to perform those actions.` +
	` This can be fixed with the "${DELETE_ALL}" button in the Experimental Features` +
	` section or by manually clearing your browser's local storage (cookies and everything else) for this site.` +
	` and then logging back in.`;

export default function ExperimentalFeatures() {
	const { algorithm, isLoading, triggerPullAllUserData } = useAlgorithm();
	const { logout, setApp } = useAuthContext();

	// Reset all state except for the user and server
	const wipeAll = async () => {
		if (
			!(await confirm(
				`Are you sure you want to completely wipe all FediAlgo data and start over?`,
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
			<li key={label} style={buttonListItem}>
				<button
					className={`${buttonClass} px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center`}
					disabled={isLoading}
					onClick={onClick}
					style={buttonStyle}
				>
					{isLoading ? "Loading..." : label}
				</button>

				<div style={buttonDescription}>{BUTTON_TEXT[label]}</div>
			</li>
		);
	};

	return (
		<TopLevelAccordion title="Experimental Features">
			<p style={{ ...accordionSubheader, paddingTop: "2px" }}>
				Use with caution.
			</p>

			<div style={container}>
				<ul>
					{makeLabeledButton(
						LOAD_COMPLETE_USER_HISTORY,
						triggerPullAllUserData,
					)}
					<hr className="hr hr-narrow" />
					{makeLabeledButton(DELETE_ALL, wipeAll, "danger")}
				</ul>
			</div>
		</TopLevelAccordion>
	);
}

const buttonDescription: CSSProperties = {
	flex: 4,
	fontSize: 14,
	marginLeft: "10px",
};

const buttonListItem: CSSProperties = {
	...centerAlignedFlexRow,
	fontSize: 18,
	marginBottom: "2px",
};

const buttonStyle: CSSProperties = {
	flex: 2,
	marginBottom: "5px",
	marginTop: "5px",
};

const container: CSSProperties = {
	...roundedBox,
	paddingBottom: "20px",
	paddingLeft: "20px",
};
