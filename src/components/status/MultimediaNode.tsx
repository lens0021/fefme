import type React from "react";
import { useCallback, useMemo, useState } from "react";

import "react-lazy-load-image-component/src/effects/blur.css"; // For blur effect
import type { mastodon } from "masto";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { GIFV, MediaCategory, type Post } from "../../core/index";

import { config } from "../../config";
import { getLogger } from "../../helpers/log_helpers";
import { isEmptyStr } from "../../helpers/string_helpers";
import { useCoordinator } from "../../hooks/useCoordinator";
import AttachmentsModal from "./AttachmentsModal";

const VIDEO_HEIGHT = Math.floor(config.posts.imageHeight * 1.7);

const logger = getLogger("MultimediaNode");

interface MultimediaNodeProps {
	mediaAttachments?: mastodon.v1.MediaAttachment[];
	removeMediaAttachment?: (mediaID: string) => void;
	post?: Post;
}

/**
 * Component to display multimedia content (images, videos, audios) in a single pane.
 * Either post or mediaAttachments must be given. If post is not provided the image will not be clickable.
 * @param {MultimediaNodeProps} props
 * @param {Post} [props.post] - Optional Post object whose images / video / audio will be displayed
 * @param {mastodon.v1.MediaAttachment[]} [props.mediaAttachments] - Images or videos
 * @param {string} [props.removeMediaAttachment] - Function to delete attachments
 */
export default function MultimediaNode(
	props: MultimediaNodeProps,
): React.ReactElement {
	const { mediaAttachments, removeMediaAttachment, post } = props;
	const { hideSensitive } = useCoordinator();
	const hasSpoilerText = !isEmptyStr(post?.spoilerText);
	const [mediaInspectionIdx, setMediaInspectionIdx] = useState<number>(-1);

	const showContent = hideSensitive ? !hasSpoilerText : true;
	const filterStyle = useMemo(
		() => ({ filter: showContent ? "none" : "blur(1.5rem)" }),
		[showContent],
	);
	const spoilerText = hasSpoilerText
		? `Click to view sensitive content (${post.spoilerText})`
		: "";
	let audios: mastodon.v1.MediaAttachment[];
	let images: mastodon.v1.MediaAttachment[];
	let videos: mastodon.v1.MediaAttachment[];
	let imageHeight = config.posts.imageHeight;

	// If there's a `post` argument use its mediaAttachments
	if (post) {
		audios = post.audioAttachments;
		images = post.imageAttachments;
		videos = post.videoAttachments;
	} else if (mediaAttachments) {
		audios = mediaAttachments.filter((m) => m.type === MediaCategory.AUDIO);
		images = mediaAttachments.filter((m) => m.type === MediaCategory.IMAGE);
		videos = mediaAttachments.filter((m) => m.type === MediaCategory.VIDEO);
	} else {
		logger.error("Called without mediaAttachments or status", props);
		return <></>;
	}

	const hasImageAttachments = images.length > 0;

	// If there's one image try to show it full size; If there's more than one use old image handler.
	if (images.length === 1) {
		imageHeight = images[0].meta?.small?.height || config.posts.imageHeight;
	} else {
		imageHeight = Math.min(
			config.posts.imageHeight,
			...images.map((i) => i.meta?.small?.height || config.posts.imageHeight),
		);
	}

	// Make a LazyLoadImage element for displaying an image within a Post.
	const makeImage = useCallback(
		(image: mastodon.v1.MediaAttachment, idx: number): React.ReactElement => (
			<div
				className="relative h-full pr-2 last:pr-0"
				key={image.previewUrl}
				style={{ width: `${(1 / images.length) * 100}%` }}
			>
				{removeMediaAttachment && (
					<button
						type="button"
						onClick={() => removeMediaAttachment(image.id)}
						className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full text-black font-bold cursor-pointer border-0"
						aria-label="Close"
					>
						×
					</button>
				)}

				<LazyLoadImage
					alt={showContent ? image.description : spoilerText}
					effect="blur"
					onClick={() => {
						if (removeMediaAttachment) return; // Don't open modal if removing media
						logger.debug(
							`Opening modal for idx=${idx}, hasImageAttachments=${hasImageAttachments}`,
						);
						setMediaInspectionIdx(idx);
					}}
					src={image.previewUrl}
					style={{
						...filterStyle,
						cursor: removeMediaAttachment ? "default" : "pointer",
					}}
					className={
						images.length === 1
							? "h-full w-full rounded-[15px] bg-[color:var(--color-card-bg)] object-contain object-center"
							: "h-full w-full rounded-[15px] bg-black object-contain object-top"
					}
					title={showContent ? image.description : spoilerText}
					wrapperProps={{ style: { position: "static" } }} // Required to center properly with blur
				/>
			</div>
		),
		[
			filterStyle,
			hasImageAttachments,
			images.length,
			removeMediaAttachment,
			showContent,
			spoilerText,
		],
	);

	if (images.length > 0) {
		return (
			<>
				{post && (
					<AttachmentsModal
						mediaInspectionIdx={mediaInspectionIdx}
						setMediaInspectionIdx={setMediaInspectionIdx}
						post={post}
					/>
				)}

				<div
					className="flex overflow-hidden rounded-xl border border-[color:var(--color-border)]"
					style={{
						height:
							images.length > 1 || imageHeight < 200
								? "100%"
								: `${imageHeight}px`,
					}}
				>
					{images.map((image, i) => makeImage(image, i))}
				</div>
			</>
		);
	}
	if (videos.length > 0) {
		return (
			<div
				className="flex overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-black"
				style={{ height: `${VIDEO_HEIGHT}px` }}
			>
				{videos.map((video, i) => {
					const sourceTag = (
						<source src={video?.remoteUrl || video?.url} type="video/mp4" />
					);
					const videoKey = video.id ?? video.url ?? video.remoteUrl ?? "video";
					const videoStyle = { ...filterStyle };
					let videoTag: React.ReactElement;

					// GIFs autoplay play in a loop; mp4s are controlled by the user.
					if (video.type === GIFV) {
						videoTag = (
							<video
								autoPlay
								height={"100%"}
								loop
								playsInline
								style={videoStyle}
								className="block mx-auto"
							>
								{sourceTag}
								<track
									kind="captions"
									src={video?.remoteUrl || video?.url || ""}
								/>
							</video>
						);
					} else {
						videoTag = (
							<video
								controls
								height={"100%"}
								playsInline
								style={videoStyle}
								className="block mx-auto"
							>
								{sourceTag}
								<track
									kind="captions"
									src={video?.remoteUrl || video?.url || ""}
								/>
							</video>
						);
					}

					return (
						<div
							className="relative h-full w-full rounded-[15px] bg-black"
							key={videoKey}
						>
							{videoTag}
						</div>
					);
				})}
			</div>
		);
	}
	if (audios.length > 0) {
		return (
			<div
				className="flex overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-black/10"
				style={{ height: `${imageHeight / 4}px` }}
			>
				<audio controls className="w-full">
					<source src={audios[0].remoteUrl} type="audio/mpeg" />
					<track kind="captions" src={audios[0].remoteUrl || ""} />
				</audio>
			</div>
		);
	}
	logger.warn(
		"Unknown media type for status:",
		post,
		"\nmediaAttachments:",
		mediaAttachments,
	);
}
