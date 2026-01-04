/*
 * Render an action button for a status (post).
 * The action button can be a favourite, reblog, bookmark, reply, or score button.
 */
import React from "react";

import {
	type IconDefinition,
	faBalanceScale,
	faBookmark,
	faReply,
	faRetweet,
	faStar,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { capitalCase } from "change-case";
import type { Post } from "../../core/index";

import { getLogger } from "../../helpers/log_helpers";
import { NETWORK_ERROR, scoreString } from "../../helpers/string_helpers";
import { useCoordinator } from "../../hooks/useCoordinator";
import { OAUTH_ERROR_MSG } from "../experimental/ExperimentalFeatures";
import { useError } from "../helpers/ErrorHandler";

export enum TootAction {
	Bookmark = "bookmark",
	Favourite = "favourite",
	Reblog = "reblog",
	Reply = "reply",
	Score = "score",
}

export type ButtonAction = TootAction;
type TootBoolean = "bookmarked" | "favourited" | "reblogged";
type TootCount = "reblogsCount" | "favouritesCount" | "repliesCount";

type ActionInfo = {
	booleanName?: TootBoolean;
	countName?: TootCount;
	icon: IconDefinition;
	label?: string;
};

const ACTION_INFO: Record<ButtonAction, ActionInfo> = {
	[TootAction.Bookmark]: {
		booleanName: "bookmarked",
		icon: faBookmark,
	},
	[TootAction.Favourite]: {
		booleanName: "favourited",
		countName: `${TootAction.Favourite}sCount`,
		icon: faStar,
	},
	[TootAction.Reblog]: {
		booleanName: "reblogged",
		countName: "reblogsCount",
		icon: faRetweet,
	},
	[TootAction.Reply]: {
		countName: "repliesCount",
		icon: faReply,
	},
	[TootAction.Score]: {
		icon: faBalanceScale,
		label: "Show Score",
	},
};

const logger = getLogger("ActionButton");

interface ActionButtonProps {
	action: ButtonAction;
	onClick?: (e: React.MouseEvent) => void;
	post: Post;
}

export default function ActionButton(props: ActionButtonProps) {
	const { action, onClick, post } = props;
	const { api } = useCoordinator();
	const { logAndSetFormattedError } = useError();

	const actionInfo = ACTION_INFO[action];
	const label = actionInfo.label || capitalCase(action);
	let buttonText: string;
	const icon = actionInfo.icon;

	if (actionInfo.countName && post[actionInfo.countName] > 0) {
		buttonText = post[actionInfo.countName]?.toLocaleString();
	} else if (action === TootAction.Score) {
		buttonText = scoreString(post.scoreInfo?.score);
	}

	const [currentState, setCurrentState] = React.useState<boolean>(
		post[actionInfo.booleanName],
	);

	const isActive = Boolean(actionInfo.booleanName && currentState);

	// Returns a function that's called when state changes for faves, bookmarks, reposts
	const performAction = () => {
		return () => {
			const startingCount = post[actionInfo.countName] || 0;
			const startingState = !!post[actionInfo.booleanName];
			const newState = !startingState;
			logger.log(
				`${action}() post (startingState: ${startingState}, count: ${startingCount}): `,
				post,
			);
			// Optimistically update the GUI (we will reset to original state if the server call fails later)
			post[actionInfo.booleanName as TootBoolean] = newState;
			setCurrentState(newState);

			if (newState && actionInfo.countName && action !== TootAction.Reply) {
				post[actionInfo.countName] = startingCount + 1;
			} else {
				post[actionInfo.countName] = startingCount ? startingCount - 1 : 0; // Avoid count going below 0
			}

			(async () => {
				try {
					const selected = api.v1.statuses.$select(await post.resolveID());

					if (action === TootAction.Bookmark) {
						await (newState ? selected.bookmark() : selected.unbookmark());
					} else if (action === TootAction.Favourite) {
						await (newState ? selected.favourite() : selected.unfavourite());
					} else if (action === TootAction.Reblog) {
						await (newState ? selected.reblog() : selected.unreblog());
					} else {
						throw new Error(`Unknown action: ${action}`);
					}

					logger.log(`Successfully changed ${action} bool to ${newState}`);
				} catch (error) {
					// If there's an error, roll back the change to the original state
					setCurrentState(startingState);
					post[actionInfo.booleanName as TootBoolean] = startingState;
					let errorMsg = "";

					if (actionInfo.countName) {
						post[actionInfo.countName] = startingCount;
						errorMsg = `Resetting count to ${startingCount}`;
					}

					logAndShowError(error, newState, errorMsg);
				}
			})();
		};
	};

	// The user will see an entirely generated message. If you want to add something to the logs put it in 'args'.
	const logAndShowError = (
		error?: Error,
		desiredState?: boolean,
		...args: unknown[]
	) => {
		const actionMsg = (desiredState === false ? "un" : "") + action.toString();
		let msg = `Failed to ${actionMsg} `;
		const note = error?.message.includes(NETWORK_ERROR)
			? undefined
			: OAUTH_ERROR_MSG;

		msg = `${msg}post`;

		logAndSetFormattedError({
			args,
			logger,
			msg: `${msg}!`,
			errorObj: error,
			note,
		});
	};

	const actionColor = (() => {
		switch (action) {
			case TootAction.Favourite:
				return { active: "text-pink-400", hover: "hover:text-pink-400" };
			case TootAction.Reblog:
				return { active: "text-emerald-400", hover: "hover:text-emerald-400" };
			case TootAction.Bookmark:
				return { active: "text-amber-400", hover: "hover:text-amber-400" };
			case TootAction.Score:
				return { active: "text-cyan-400", hover: "hover:text-cyan-400" };
			case TootAction.Reply:
				return { active: "text-blue-400", hover: "hover:text-blue-400" };
			default:
				return { active: "text-blue-400", hover: "hover:text-blue-400" };
		}
	})();
	const toneClass = isActive
		? actionColor.active
		: `text-[color:var(--color-muted-fg)] ${actionColor.hover}`;
	const buttonClassName = [
		"inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors",
		"hover:bg-[color:var(--color-light-shade)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]",
		toneClass,
		"text-xs",
	].join(" ");
	const iconClassName = "text-sm";

	return (
		<button
			aria-hidden="false"
			aria-label={label}
			className={buttonClassName}
			onClick={onClick || performAction()}
			title={label}
			type="button"
		>
			<FontAwesomeIcon
				aria-hidden="true"
				className={iconClassName}
				icon={icon}
			/>

			{buttonText && (
				<span className="text-[11px] leading-none">{buttonText}</span>
			)}
		</button>
	);
}
