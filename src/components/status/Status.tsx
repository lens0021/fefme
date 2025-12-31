/**
 * @fileoverview Render a Status, also known as a Toot.
 */
import React, {
	CSSProperties,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";

import parse from "html-react-parser";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { Toot } from "fedialgo";
import {
	IconDefinition,
	faBolt,
	faCheckCircle,
	faFireFlameCurved,
	faHashtag,
	faLink,
	faLock,
	faPencil,
	faReply,
	faRetweet,
	faRobot,
	faUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";

import ActionButton, {
	AccountAction,
	ButtonAction,
	TootAction,
} from "./ActionButton";
import JsonModal from "../helpers/JsonModal";
import MultimediaNode from "./MultimediaNode";
import NewTabLink from "../helpers/NewTabLink";
import Poll from "./Poll";
import PreviewCard from "./PreviewCard";
import useOnScreen from "../../hooks/useOnScreen";
import { config } from "../../config";
import { executeWithLoadingState } from "../../helpers/async_helpers";
import { getLogger } from "../../helpers/log_helpers";
import { formatScore, formatScores } from "../../helpers/number_helpers";
import { openToot } from "../../helpers/react_helpers";
import { timestampString } from "../../helpers/string_helpers";
import { useAlgorithm } from "../../hooks/useAlgorithm";
import { useError } from "../helpers/ErrorHandler";

export const TOOLTIP_ACCOUNT_ANCHOR = "user-account-anchor";
const logger = getLogger("StatusComponent");

type IconInfo = {
	icon: IconDefinition;
	color?: string;
};

enum InfoIconType {
	Bot = "Bot Account",
	DM = "Direct Message",
	Edited = "Edited",
	Hashtags = "Hashtags",
	Mention = "You're Mentioned",
	Reply = "Reply",
	ShowToot = "Show Raw Toot JSON",
	TrendingLink = "Contains Trending Link",
	TrendingToot = "Trending Toot",
}

const INFO_ICONS: Record<InfoIconType, IconInfo> = {
	[InfoIconType.Bot]: { icon: faRobot, color: config.theme.light.info },
	[InfoIconType.DM]: { icon: faLock, color: config.theme.light.secondary },
	[InfoIconType.Edited]: { icon: faPencil },
	[InfoIconType.Hashtags]: {
		icon: faHashtag,
		color: config.theme.participatedTagColor,
	},
	[InfoIconType.Mention]: { icon: faBolt, color: config.theme.light.success },
	[InfoIconType.Reply]: { icon: faReply, color: config.theme.light.primary },
	[InfoIconType.ShowToot]: { icon: faUpRightFromSquare },
	[InfoIconType.TrendingLink]: {
		icon: faLink,
		color: config.theme.trendingTagColor,
	},
	[InfoIconType.TrendingToot]: {
		icon: faFireFlameCurved,
		color: config.theme.trendingTagColor,
	},
};

interface StatusComponentProps {
	fontColor?: CSSProperties["color"];
	isLoadingThread?: boolean;
	setIsLoadingThread?: (isLoading: boolean) => void;
	setThread?: (toots: Toot[]) => void;
	showLinkPreviews?: boolean;
	status: Toot;
}

export default function StatusComponent(props: StatusComponentProps) {
	const {
		fontColor,
		isLoadingThread,
		setIsLoadingThread,
		setThread,
		showLinkPreviews,
		status,
	} = props;
	const { isGoToSocialUser, isLoading } = useAlgorithm();
	const { logAndSetFormattedError } = useError();
	const contentClass = fontColor ? "status__content__alt" : "status__content";
	const fontStyle = fontColor ? { color: fontColor } : {};

	// If it's a retoot set 'toot' to the original toot
	const toot = status.realToot;

	if (!toot.mediaAttachments) {
		logger.error(
			`StatusComponent received toot with no mediaAttachments:`,
			toot,
		);
	}

	const hasAttachments = (toot.mediaAttachments?.length || 0) > 0;
	const isReblog = toot.reblogsBy.length > 0;
	const authorNameHTML = toot.account.displayNameFullHTML(
		config.theme.defaultFontSize,
	);
	const ariaLabel = `${toot.account.displayName}, ${toot.account.note} ${toot.account.webfingerURI}`;
	const style = toot.isDM
		? { backgroundColor: config.timeline.dmBackgroundColor }
		: {};
	// Ref for detecting if the status is on screen
	const statusRef = useRef<HTMLDivElement>(null);
	const isOnScreen = useOnScreen(statusRef);

	const [showScoreModal, setShowScoreModal] = React.useState<boolean>(false);
	const [showTootModal, setShowTootModal] = React.useState<boolean>(false);

	// useEffect to handle things we want to do when the toot makes its first appearnace on screen
	useEffect(() => {
		if (isLoading || !isOnScreen) return;

		// Pre-emptively resolve the toot ID as it appears on screen to speed up future interactions
		// TODO: disabled this for now as it increases storage demands for small instances
		// toot.resolveID().catch((e) => logger.error(`Error resolving toot ID: ${toot.description}`, e));
		toot.numTimesShown = (toot.numTimesShown || 0) + 1;
	}, [isLoading, isOnScreen]);

	// Build the account link(s) for the reblogger(s) that appears at top of a retoot
	const rebloggersLinks = useMemo(
		() => (
			<span>
				{toot.reblogsBy.map((account, i) => {
					const rebloggerLink = (
						<NewTabLink
							className="status__display-name muted"
							href={account.localServerUrl}
							key={i}
						>
							<bdi>
								<strong>
									{parse(
										account.displayNameWithEmojis(
											config.theme.retooterFontSize,
										),
									)}
								</strong>
							</bdi>
						</NewTabLink>
					);

					return i < toot.reblogsBy.length - 1
						? [rebloggerLink, ", "]
						: rebloggerLink;
				})}{" "}
				boosted
			</span>
		),
		[toot.reblogsBy],
	);

	// Construct a colored font awesome icon to indicate some kind of property of the toot
	const infoIcon = useCallback(
		(iconType: InfoIconType): React.ReactElement => {
			const iconInfo = INFO_ICONS[iconType];
			let title = iconType as string;
			let color = iconInfo.color;

			if (iconType == InfoIconType.Edited) {
				title += ` ${timestampString(toot.editedAt)}`;
			} else if (iconType == InfoIconType.Hashtags) {
				title = toot.containsTagsMsg();

				if (toot.followedTags?.length) {
					color = config.theme.followedTagColor;
				} else if (toot.trendingTags?.length) {
					color = config.theme.trendingTagColor;
				}
			}

			const style = color ? { color } : undefined;
			return (
				<FontAwesomeIcon
					className="mr-[3px]"
					icon={iconInfo.icon}
					style={style}
					title={title}
				/>
			);
		},
		[toot, toot.editedAt, toot.followedTags, toot.trendingTags],
	);

	// Build an action button (reply, reblog, fave, etc) that appears at the bottom of a toot
	const buildActionButton = (
		action: ButtonAction,
		onClick?: (e: React.MouseEvent) => void,
	) => {
		return <ActionButton action={action} onClick={onClick} toot={toot} />;
	};

	return (
		<div style={style}>
			<JsonModal
				infoTxt="Scoring categories where the unweighted score is zero are not shown."
				json={toot.scoreInfo ? (formatScores(toot.scoreInfo) as object) : {}}
				jsonViewProps={{
					collapsed: 3,
					name: "toot.scoreInfo",
					style: scoreJsonStyle,
				}}
				setShow={setShowScoreModal}
				show={showScoreModal}
				subtitle={
					<ul>
						<li>
							{"Poster:"}{" "}
							<span className="font-medium">{parse(authorNameHTML)}</span>
						</li>
						<li>
							{"Final Score:"} <code>{formatScore(toot.scoreInfo.score)}</code>
						</li>
					</ul>
				}
				title="This Toot's Score"
			/>

			<JsonModal
				dialogClassName="modal-xl"
				json={status}
				jsonViewProps={{
					collapsed: 1,
					displayArrayKey: true,
					indentWidth: 8,
					name: "toot",
					style: rawTootJson,
					theme: "brewer",
				}}
				setShow={setShowTootModal}
				show={showTootModal}
				title="Raw Toot Object"
			/>

			<div
				aria-label={ariaLabel}
				className="status__wrapper status__wrapper-public focusable"
			>
				{/* Names of accounts that reblogged the toot (if any) */}
				{isReblog && (
					<div className="status__prepend">
						<div className="status__prepend-icon-wrapper">
							<FontAwesomeIcon
								className="status__prepend-icon fa-fw"
								icon={faRetweet}
							/>
						</div>

						{rebloggersLinks}
					</div>
				)}

				<div className={`status ${isReblog ? "pt-[10px]" : ""}`}>
					{/* Top bar with account and info icons */}
					<div className="status__info">
						{/* Top right icons + timestamp that link to the toot */}
						<div className="status__relative-time inline-block">
							<NewTabLink
								className="status__relative-time-icons"
								href={toot.realURL}
								onClick={(e) => {
									openToot(toot, e, isGoToSocialUser).catch((err) => {
										logAndSetFormattedError({
											errorObj: err,
											msg: "Failed to resolve toot ID!",
											note: "Could be connectivity issues or a deleted/suspended toot.",
										});
									});
								}}
							>
								<span className="status__visibility-icon">
									{toot.editedAt && infoIcon(InfoIconType.Edited)}
									{toot.inReplyToAccountId && infoIcon(InfoIconType.Reply)}
									{(toot.trendingRank || 0) > 0 &&
										infoIcon(InfoIconType.TrendingToot)}
									{(toot.trendingLinks?.length || 0) > 0 &&
										infoIcon(InfoIconType.TrendingLink)}
									{toot.containsUserMention() && infoIcon(InfoIconType.Mention)}
									{toot.containsTagsMsg() && infoIcon(InfoIconType.Hashtags)}
									{toot.isDM && infoIcon(InfoIconType.DM)}
									{toot.account.bot && infoIcon(InfoIconType.Bot)}
								</span>

								<time dateTime={toot.createdAt} title={toot.createdAt}>
									{timestampString(toot.createdAt)}
								</time>
							</NewTabLink>

							<span
								onClick={(e) => {
									e.preventDefault();
									setShowTootModal(true);
								}}
								className="ml-[10px] cursor-pointer"
							>
								{infoIcon(InfoIconType.ShowToot)}
							</span>
						</div>

						{/* Account name + avatar */}
						<div
							title={toot.account.webfingerURI}
							className="status__display-name"
						>
							<a
								data-tooltip-id={TOOLTIP_ACCOUNT_ANCHOR}
								data-tooltip-html={toot.account.noteWithAccountInfo(
									config.theme.accountBioFontSize,
								)}
							>
								<div className="status__avatar">
									<div className="account__avatar h-[46px] w-[46px]">
										<LazyLoadImage
											src={toot.account.avatar}
											alt={`${toot.account.webfingerURI}`}
										/>
									</div>
								</div>
							</a>

							<span className="display-name">
								<bdi>
									<strong key="internalBDI" className="display-name__html">
										<NewTabLink
											href={toot.account.localServerUrl}
											className="text-white no-underline"
											style={fontStyle}
										>
											{parse(
												toot.account.displayNameWithEmojis(
													config.theme.defaultFontSize,
												),
											)}
										</NewTabLink>

										{toot.account.fields
											.filter((f) => f.verifiedAt)
											.map((f, i) => (
												<span
													className="verified-badge text-sky-300 px-[5px]"
													key={`${f.name}_${i}`}
													title={f.value.replace(/<[^>]*>?/gm, "")}
												>
													<FontAwesomeIcon
														aria-hidden="true"
														icon={faCheckCircle}
													/>
												</span>
											))}
									</strong>
								</bdi>

								<span key="acctdisplay" className="display-name__account">
									@{toot.account.webfingerURI}
									<span className="inline-block w-[5px]"> </span>
									{buildActionButton(AccountAction.Follow)}
									{buildActionButton(AccountAction.Mute)}
								</span>
							</span>
						</div>
					</div>

					{/* Text content of the toot */}
					<div className={contentClass} style={fontStyle}>
						<div
							className="status__content__text status__content__text--visible translate"
							lang={toot.language}
						>
							{parse(
								toot.contentNonTagsParagraphs(config.theme.defaultFontSize),
							)}
						</div>
					</div>

					{/* Preview card and attachment display (media attachments are preferred over preview cards) */}
					{toot.card && !hasAttachments && (
						<PreviewCard card={toot.card} showLinkPreviews={showLinkPreviews} />
					)}
					{hasAttachments && <MultimediaNode toot={toot} />}
					{toot.poll && <Poll poll={toot.poll} />}

					{/* Tags in smaller font, if they make up the entirety of the last paragraph */}
					{toot.contentTagsParagraph && (
						<div className={`${contentClass} pt-[12px]`}>
							<span
								className="text-[#636f7a]"
								style={{ fontSize: config.theme.footerHashtagsFontSize }}
							>
								{parse(toot.contentTagsParagraph)}
							</span>
						</div>
					)}

					{setThread &&
						(toot.repliesCount > 0 || !!toot.inReplyToAccountId) && (
							<p className="pt-2">
								<a
									onClick={async () => {
										logger.debug(
											`Loading thread for toot: ${toot.description}`,
										);

										const toots = await executeWithLoadingState(
											() => toot.getConversation(),
											setIsLoadingThread,
										);
										setThread(toots);
									}}
									className="text-gray-500 text-[11px]"
									style={{
										cursor: isLoadingThread ? "wait" : "pointer",
									}}
								>
									⇇ View the Thread
								</a>
							</p>
						)}

					{/* Actions (retoot, favorite, show score, etc) that appear in bottom panel of toot */}
					<div className="status__action-bar" ref={statusRef}>
						{buildActionButton(TootAction.Reply, () => window.open(toot.realURL, '_blank'))}
						{!toot.isDM && buildActionButton(TootAction.Reblog)}
						{buildActionButton(TootAction.Favourite)}
						{buildActionButton(TootAction.Bookmark)}
						{buildActionButton(TootAction.Score, () => setShowScoreModal(true))}
					</div>
				</div>
			</div>
		</div>
	);
}

const rawTootJson: CSSProperties = {
	fontSize: 13,
};

const scoreJsonStyle: CSSProperties = {
	fontSize: 16,
};
