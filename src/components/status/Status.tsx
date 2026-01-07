/**
 * @fileoverview Render a Status, also known as a Post.
 */
import React, {
	type CSSProperties,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";

import {
	type IconDefinition,
	faBolt,
	faCheckCircle,
	faDatabase,
	faEye,
	faFireFlameCurved,
	faHashtag,
	faLock,
	faPencil,
	faReply,
	faRetweet,
	faRobot,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import parse from "html-react-parser";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { Tooltip } from "react-tooltip";
import { AgeIn, type Post, timeString } from "../../core/index";

import { config } from "../../config";
import { executeWithLoadingState } from "../../helpers/async_helpers";
import { getLogger } from "../../helpers/log_helpers";
import { formatScore } from "../../helpers/number_helpers";
import { formatSourceLabel } from "../../helpers/source_labels";
import { openToot } from "../../helpers/ui";
import { useCoordinator } from "../../hooks/useCoordinator";
import useOnScreen from "../../hooks/useOnScreen";
import { useError } from "../helpers/ErrorHandler";
import NewTabLink from "../helpers/NewTabLink";
import ActionButton, { type ButtonAction, TootAction } from "./ActionButton";
import MultimediaNode from "./MultimediaNode";
import Poll from "./Poll";
import PreviewCard from "./PreviewCard";

const logger = getLogger("StatusComponent");

const ICON_TOOLTIP_ANCHOR = "status-icon-tooltip";

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
	Read = "Already Seen",
	Reply = "Reply",
	TrendingToot = "Trending Post",
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
	[InfoIconType.Read]: { icon: faEye, color: config.theme.light.info },
	[InfoIconType.Reply]: { icon: faReply, color: config.theme.light.primary },
	[InfoIconType.TrendingToot]: {
		icon: faFireFlameCurved,
		color: config.theme.trendingTagColor,
	},
};

const formatRelativeTime = (timestamp: string): string => {
	const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
	const seconds = Math.round(AgeIn.seconds(new Date(timestamp)));
	const absSeconds = Math.abs(seconds);

	if (absSeconds < 60) return rtf.format(-seconds, "second");
	const minutes = Math.round(seconds / 60);
	if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");
	const hours = Math.round(minutes / 60);
	if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
	const days = Math.round(hours / 24);
	if (Math.abs(days) < 30) return rtf.format(-days, "day");
	const months = Math.round(days / 30);
	if (Math.abs(months) < 12) return rtf.format(-months, "month");
	const years = Math.round(months / 12);
	return rtf.format(-years, "year");
};

interface StatusComponentProps {
	fontColor?: CSSProperties["color"];
	isLoadingThread?: boolean;
	setIsLoadingThread?: (isLoading: boolean) => void;
	setThread?: (posts: Post[]) => void;
	showLinkPreviews?: boolean;
	status: Post;
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
	const { algorithm, isGoToSocialUser, isLoading, scheduleSeenRefresh } =
		useCoordinator();
	const { logAndSetFormattedError } = useError();
	const contentClass =
		"text-[15px] leading-relaxed text-[color:var(--color-fg)] break-words [&_a]:text-[color:var(--color-primary)] [&_a]:break-all [&_a:hover]:underline [&_p]:mb-2 [&_p:last-child]:mb-0";
	const fontStyle = fontColor ? { color: fontColor } : {};

	// If it's a boost set 'post' to the original post
	const post = status.realToot;
	const sourceLabels = useMemo(() => {
		const sources = post.sources ?? [];
		const uniqueSources = Array.from(new Set(sources));
		return uniqueSources.map(formatSourceLabel);
	}, [post.sources]);

	if (!post.mediaAttachments) {
		logger.error(
			"StatusComponent received post with no mediaAttachments:",
			post,
		);
	}

	const hasAttachments = (post.mediaAttachments?.length || 0) > 0;
	const isReblog = post.reblogsBy.length > 0;
	const authorNameHTML = post.account.displayNameFullHTML(
		config.theme.defaultFontSize,
	);
	const ariaLabel = `${post.account.displayName}, ${post.account.note} ${post.account.webfingerURI}`;
	const style: CSSProperties = {
		backgroundColor: post.isDM
			? config.timeline.dmBackgroundColor
			: "var(--color-card-bg)",
		borderColor: "var(--color-border)",
	};
	// Ref for detecting if the status is on screen
	const statusRef = useRef<HTMLDivElement>(null);
	const isOnScreen = useOnScreen(statusRef);

	const [showScoreModal, setShowScoreModal] = React.useState<boolean>(false);
	const [showZeroScores, setShowZeroScores] = React.useState<boolean>(false);
	const [isContentVisible, setIsContentVisible] = React.useState<boolean>(
		!post.spoilerText,
	);

	// useEffect to handle things we want to do when the post makes its first appearnace on screen
	useEffect(() => {
		if (!isOnScreen) return;

		// Pre-emptively resolve the post ID as it appears on screen to speed up future interactions
		// TODO: disabled this for now as it increases storage demands for small instances
		// post.resolveID().catch((e) => logger.error(`Error resolving post ID: ${post.description}`, e));
		const incrementSeen = (target: Post) => {
			target.numTimesShown = (target.numTimesShown || 0) + 1;
		};
		incrementSeen(status);
		if (status !== post) {
			incrementSeen(post);
		}

		algorithm?.saveTimelineToCache?.();
		scheduleSeenRefresh?.();
	}, [algorithm, isOnScreen, status, post, scheduleSeenRefresh]);

	const scoreEntries = useMemo(() => {
		const all = Object.entries(post.scoreInfo?.scores ?? {}).filter(
			([_key, value]) => !(value.raw === 0 && (value.weight ?? 0) === 0),
		);
		const active = all.filter(([_key, value]) => value.weighted !== 0);
		const zero = all.filter(([_key, value]) => value.weighted === 0);
		return { active, zero };
	}, [post.scoreInfo?.scores]);

	// Build the account link(s) for the reblogger(s) that appears at top of a boost
	const rebloggersLinks = useMemo(
		() => (
			<span>
				{post.reblogsBy.map((account, i) => {
					const rebloggerKey = account.id ?? account.webfingerURI;
					const rebloggerLink = (
						<NewTabLink
							className="text-[color:var(--color-muted-fg)] hover:text-[color:var(--color-fg)] hover:underline"
							href={account.localServerUrl}
							key={rebloggerKey}
						>
							<bdi>
								<strong>
									{parse(
										account.displayNameWithEmojis(config.theme.boosterFontSize),
									)}
								</strong>
							</bdi>
						</NewTabLink>
					);

					return i < post.reblogsBy.length - 1
						? [rebloggerLink, ", "]
						: rebloggerLink;
				})}{" "}
				boosted
			</span>
		),
		[post.reblogsBy],
	);

	// Construct a colored font awesome icon to indicate some kind of property of the post
	const infoIcon = useCallback(
		(iconType: InfoIconType): React.ReactElement => {
			const iconInfo = INFO_ICONS[iconType];
			let title = iconType as string;
			let color = iconInfo.color;

			if (iconType === InfoIconType.Edited) {
				title += ` ${timeString(post.editedAt)}`;
			} else if (iconType === InfoIconType.Hashtags) {
				title = post.containsTagsMsg();

				if (post.followedTags?.length) {
					color = config.theme.followedTagColor;
				} else if (post.trendingTags?.length) {
					color = config.theme.trendingTagColor;
				}
			}

			const style = color ? { color } : undefined;
			return (
				<span
					className="cursor-help"
					data-tooltip-id={ICON_TOOLTIP_ANCHOR}
					data-tooltip-content={title}
				>
					<FontAwesomeIcon
						className="mr-[3px]"
						icon={iconInfo.icon}
						style={style}
					/>
				</span>
			);
		},
		[post, post.editedAt, post.followedTags, post.trendingTags],
	);

	// Build an action button (reply, reblog, fave, etc) that appears at the bottom of a post
	const buildActionButton = (
		action: ButtonAction,
		onClick?: (e: React.MouseEvent) => void,
	) => {
		return <ActionButton action={action} onClick={onClick} post={post} />;
	};

	const renderScoreEntry = ([key, value]: [string, any]) => {
		const weightInfo = algorithm?.weightsInfo[key];
		const description = weightInfo?.description || key;
		const isDisabled = (value.weight ?? 0) === 0;

		return (
			<div
				key={key}
				className={`rounded-lg border border-[color:var(--color-border)] p-4 ${isDisabled || value.weighted === 0 ? "bg-[color:var(--color-bg)] opacity-60" : "bg-[color:var(--color-muted)]"}`}
			>
				<div className="mb-2 flex items-start justify-between">
					<div className="flex-1">
						<h3 className="font-semibold text-[color:var(--color-fg)]">
							{key} {isDisabled && "(Disabled)"}
						</h3>
						<p className="text-sm text-[color:var(--color-muted-fg)]">
							{description}
						</p>
					</div>
					<div className="ml-4 text-right">
						<div
							className={`text-lg font-bold ${isDisabled || value.weighted === 0 ? "text-[color:var(--color-muted-fg)]" : "text-[color:var(--color-primary)]"}`}
						>
							{formatScore(value.weighted)}
						</div>
					</div>
				</div>
				<div className="flex items-center justify-end gap-4 text-xs text-[color:var(--color-muted-fg)]">
					<div>Raw: {formatScore(value.raw)}</div>
					<div>×</div>
					<div>Weight: {formatScore(value.weight ?? 0)}</div>
					<div>=</div>
					<div>{formatScore(value.weighted)}</div>
				</div>
			</div>
		);
	};

	return (
		<div>
			<Tooltip
				id={ICON_TOOLTIP_ANCHOR}
				place="top"
				clickable
				openOnClick
				className="z-[2000] max-w-xs"
			/>

			{/* Score Modal */}
			{showScoreModal && (
				<div
					className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
					onClick={() => {
						setShowScoreModal(false);
						setShowZeroScores(false);
					}}
					role="dialog"
					aria-modal="true"
				>
					<div
						className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] p-6 shadow-2xl animate-in zoom-in duration-200"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="mb-4 flex items-start justify-between border-b border-[color:var(--color-border)] pb-4">
							<div>
								<h2 className="text-xl font-bold text-[color:var(--color-fg)]">
									Post Score Breakdown
								</h2>
								<div className="mt-2 space-y-1 text-sm text-[color:var(--color-muted-fg)]">
									<div>
										<strong>Poster:</strong> {parse(authorNameHTML)}
									</div>
									<div>
										<strong>Final Score:</strong>{" "}
										<code className="rounded bg-[color:var(--color-muted)] px-2 py-1 text-[color:var(--color-fg)] border border-[color:var(--color-border)]">
											{formatScore(post.scoreInfo.score)}
										</code>
									</div>
								</div>
							</div>
							<button
								type="button"
								onClick={() => {
									setShowScoreModal(false);
									setShowZeroScores(false);
								}}
								className="text-2xl text-[color:var(--color-muted-fg)] hover:text-[color:var(--color-fg)] transition-colors p-1"
								aria-label="Close"
							>
								×
							</button>
						</div>

						<div className="space-y-3">
							{scoreEntries.active.map(renderScoreEntry)}

							{scoreEntries.zero.length > 0 && (
								<div className="pt-2">
									<button
										type="button"
										onClick={() => setShowZeroScores(!showZeroScores)}
										className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-muted-fg)] hover:text-[color:var(--color-fg)] transition-colors"
									>
										{showZeroScores ? "− Hide" : "+ Show"}{" "}
										{scoreEntries.zero.length} categories with 0 score
									</button>

									{showZeroScores && (
										<div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
											{scoreEntries.zero.map(renderScoreEntry)}
										</div>
									)}
								</div>
							)}
						</div>

						<div className="mt-6 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-4">
							<h3 className="mb-3 font-bold text-[color:var(--color-fg)]">
								Final Calculation
							</h3>
							<div className="space-y-2 text-sm text-[color:var(--color-fg)]">
								<div className="flex justify-between">
									<span>Sum of Weighted Scores:</span>
									<span className="font-mono">
										{formatScore(post.scoreInfo.weightedScore)}
									</span>
								</div>
								<div className="flex justify-between text-[color:var(--color-muted-fg)]">
									<span>Time Decay Multiplier:</span>
									<span className="font-mono">
										× {formatScore(post.scoreInfo.timeDecayMultiplier)}
									</span>
								</div>
								<div className="mt-2 flex justify-between border-t border-[color:var(--color-border)] pt-2 font-bold">
									<span>Final Score:</span>
									<span className="font-mono text-[color:var(--color-primary)]">
										{formatScore(post.scoreInfo.score)}
									</span>
								</div>
							</div>
							<div className="mt-3 text-xs text-[color:var(--color-muted-fg)]">
								Raw Sum: {formatScore(post.scoreInfo.rawScore)} · Trending:{" "}
								{formatScore(post.scoreInfo.trendingMultiplier)}
							</div>
						</div>
					</div>
				</div>
			)}

			<div
				aria-label={ariaLabel}
				className="mb-4 rounded-2xl border p-4 shadow-sm focus-within:ring-2 focus-within:ring-[color:var(--color-primary)]"
				data-testid="status-card"
				ref={statusRef}
				style={style}
				tabIndex={0}
			>
				{/* Names of accounts that reblogged the post (if any) */}
				{isReblog && (
					<div className="mb-2 flex items-center gap-2 text-xs text-[color:var(--color-muted-fg)]">
						<FontAwesomeIcon className="text-emerald-400" icon={faRetweet} />

						{rebloggersLinks}
					</div>
				)}

				<div className={`space-y-3 ${isReblog ? "pt-2" : ""}`}>
					{/* Top bar with account and info icons */}
					<div className="flex flex-wrap items-start justify-between gap-3">
						{/* Account name + avatar (now on left) */}
						<div
							title={post.account.webfingerURI}
							className="flex items-center gap-3"
						>
							<NewTabLink
								href={post.account.localServerUrl}
								className="block h-12 w-12 overflow-hidden rounded-full bg-[color:var(--color-muted)]"
							>
								<LazyLoadImage
									src={post.account.avatar}
									alt={`${post.account.webfingerURI}`}
								/>
							</NewTabLink>

							<span className="flex flex-col">
								<bdi>
									<strong
										key="internalBDI"
										className="flex items-center gap-1 text-sm font-semibold"
									>
										<NewTabLink
											href={post.account.localServerUrl}
											className="text-[color:var(--color-fg)] no-underline"
											style={fontStyle}
										>
											{parse(
												post.account.displayNameWithEmojis(
													config.theme.defaultFontSize,
												),
											)}
										</NewTabLink>

										{post.account.fields
											.filter((f) => f.verifiedAt)
											.map((f, i) => (
												<span
													className="verified-badge text-[color:var(--color-primary)] px-[5px]"
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

								<span
									key="acctdisplay"
									className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted-fg)]"
								>
									@{post.account.webfingerURI}
								</span>
							</span>
						</div>

						{/* Top right icons + timestamp that link to the post (now on right) */}
						<div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 text-xs text-[color:var(--color-muted-fg)] w-full sm:w-auto sm:ml-auto mt-1 sm:mt-0">
							<span className="inline-flex items-center gap-1">
								{post.editedAt && infoIcon(InfoIconType.Edited)}
								{(post.numTimesShown || 0) > 0 && infoIcon(InfoIconType.Read)}
								{post.inReplyToAccountId && infoIcon(InfoIconType.Reply)}
								{(post.trendingRank || 0) > 0 &&
									infoIcon(InfoIconType.TrendingToot)}
								{post.containsUserMention() && infoIcon(InfoIconType.Mention)}
								{post.containsTagsMsg() && infoIcon(InfoIconType.Hashtags)}
								{post.isDM && infoIcon(InfoIconType.DM)}
								{post.account.bot && infoIcon(InfoIconType.Bot)}
							</span>

							{sourceLabels.length > 0 && (
								<span className="flex flex-wrap items-center gap-1 text-[11px] text-[color:var(--color-muted-fg)]">
									<FontAwesomeIcon
										icon={faDatabase}
										className="mr-1"
										title="Sources"
									/>
									{sourceLabels.map((source, index) => (
										<span
											key={`${source}-${index}`}
											className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-muted)] px-2 py-[1px]"
										>
											{source}
										</span>
									))}
								</span>
							)}

							<button
								type="button"
								className="inline-flex items-center gap-2 hover:text-[color:var(--color-fg)] whitespace-nowrap"
								onClick={(e) => {
									openToot(post, e, isGoToSocialUser).catch((err) => {
										logAndSetFormattedError({
											errorObj: err,
											msg: "Failed to resolve post ID!",
											note: "Could be connectivity issues or a deleted/suspended post.",
										});
									});
								}}
								title={timeString(post.createdAt)}
							>
								<time dateTime={post.createdAt}>
									{timeString(post.createdAt)}
								</time>
								<span className="text-[color:var(--color-muted-fg)]">
									({formatRelativeTime(post.createdAt)})
								</span>
							</button>
						</div>
					</div>

					{/* Content Warning (Spoiler Text) */}
					{post.spoilerText && (
						<div className="flex items-center justify-between gap-2 rounded-lg bg-[color:var(--color-muted)] px-3 py-2">
							<span className="text-sm font-medium">{post.spoilerText}</span>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setIsContentVisible(!isContentVisible);
								}}
								className="text-xs font-bold uppercase text-[color:var(--color-primary)] hover:underline"
							>
								{isContentVisible ? "Show Less" : "Show More"}
							</button>
						</div>
					)}

					{/* Text content of the post */}
					{isContentVisible && (
						<div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
							<div className={contentClass} style={fontStyle}>
								<div className={contentClass} lang={post.language}>
									{parse(
										post.contentNonTagsParagraphs(config.theme.defaultFontSize),
									)}
								</div>
							</div>

							{/* Preview card and attachment display (media attachments are preferred over preview cards) */}
							{post.card && !hasAttachments && (
								<PreviewCard
									card={post.card}
									showLinkPreviews={showLinkPreviews}
								/>
							)}
							{hasAttachments && <MultimediaNode post={post} />}
							{post.poll && <Poll poll={post.poll} />}

							{/* Tags in smaller font, if they make up the entirety of the last paragraph */}
							{post.contentTagsParagraph && (
								<div className={`${contentClass} pt-[12px]`}>
									<span
										className="text-[color:var(--color-muted-fg)]"
										style={{ fontSize: config.theme.footerHashtagsFontSize }}
									>
										{parse(post.contentTagsParagraph)}
									</span>
								</div>
							)}

							{(post.repliesCount > 0 || !!post.inReplyToAccountId) && (
								<p className="pt-2">
									<button
										type="button"
										onClick={(e) => {
											openToot(post, e, isGoToSocialUser).catch((err) => {
												logger.warn(
													"Failed to resolve post, opening original URL instead:",
													err,
												);
												window.open(post.url, "_blank");
											});
										}}
										className="text-[color:var(--color-muted-fg)] text-[11px] p-0 border-0 bg-transparent cursor-pointer hover:text-[color:var(--color-fg)] hover:underline transition-colors"
									>
										↗ Open Thread
									</button>
								</p>
							)}
						</div>
					)}

					{/* Actions (boost, favorite, show score, etc) that appear in bottom panel of post */}
					<div className="flex flex-wrap items-center justify-between gap-2 pt-1">
						<div className="flex flex-wrap items-center gap-2">
							{!post.isDM && buildActionButton(TootAction.Reblog)}
							{buildActionButton(TootAction.Favourite)}
							{buildActionButton(TootAction.Bookmark)}
						</div>
						{buildActionButton(TootAction.Score, () => setShowScoreModal(true))}
					</div>
				</div>
			</div>
		</div>
	);
}
