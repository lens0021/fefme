import type React from "react";
import { useCallback, useMemo, useState } from "react";

import "react-lazy-load-image-component/src/effects/blur.css"; // For blur effect
import { faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
	const [isContentVisible, setIsContentVisible] = useState(
		!hideSensitive || !hasSpoilerText,
	);

	const showContent = isContentVisible;
	const filterStyle = useMemo(
		() => ({ filter: showContent ? "none" : "blur(1.5rem)" }),
		[showContent],
	);
	const spoilerText = hasSpoilerText
		? `Click to view sensitive content (${post?.spoilerText})`
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

	// Calculate grid columns/rows based on image count
	const getGridClass = (count: number) => {
		switch (count) {
			case 1:
				return "grid-cols-1";
			case 2:
				return "grid-cols-2";
			case 3:
				return "grid-cols-2 grid-rows-2";
			case 4:
				return "grid-cols-2 grid-rows-2";
			default:
				return "grid-cols-2"; // Fallback for 5+ images (though usually max 4)
		}
	};

	const getImageClass = (index: number, count: number) => {
		let base = "relative h-full w-full overflow-hidden";
		if (count === 3 && index === 0) {
			return `${base} row-span-2`; // First image takes full height on left
		}
		return base;
	};

	// Make a LazyLoadImage element for displaying an image within a Post.
	const makeImage = useCallback(
		(image: mastodon.v1.MediaAttachment, idx: number): React.ReactElement => (
			<div className={getImageClass(idx, images.length)} key={image.previewUrl}>
				{removeMediaAttachment && (
					<button
						type="button"
						onClick={() => removeMediaAttachment(image.id)}
						className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full text-black font-bold cursor-pointer border-0 z-10"
						aria-label="Close"
					>
						×
					</button>
				)}

				<LazyLoadImage
					alt={showContent ? image.description : spoilerText}
					effect="blur"
					onClick={() => {
						if (removeMediaAttachment) return;
						if (!showContent) {
							setIsContentVisible(true);
							return;
						}
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
					className="h-full w-full bg-[color:var(--color-card-bg)] object-cover"
					title={showContent ? image.description : spoilerText}
					wrapperProps={{
						style: {
							position: "static",
							height: "100%",
							width: "100%",
							display: "block",
						},
					}}
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

	const SensitiveOverlay = () => (
		<div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-200">
			<FontAwesomeIcon
				icon={faEyeSlash}
				className="mb-3 text-4xl text-white drop-shadow-md"
			/>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					setIsContentVisible(true);
				}}
				className="rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black/80 border border-white/20"
			>
				Show Content
			</button>
			{hasSpoilerText && (
				<span className="mt-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
					{post?.spoilerText}
				</span>
			)}
		</div>
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
					className={`relative grid gap-[2px] overflow-hidden rounded-xl border border-[color:var(--color-border)] ${getGridClass(images.length)}`}
					style={{
						height:
							images.length > 1 ? `${config.posts.imageHeight}px` : "auto",
						maxHeight:
							images.length === 1 ? `${config.posts.imageHeight}px` : undefined,
						aspectRatio: images.length === 1 ? "auto" : "16/9",
					}}
				>
					{!showContent && <SensitiveOverlay />}
					{images.map((image, i) => makeImage(image, i))}
				</div>
			</>
		);
	}
	if (videos.length > 0) {
		return (
			<div
				className="relative flex overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-black"
				style={{ height: `${VIDEO_HEIGHT}px` }}
			>
				{!showContent && <SensitiveOverlay />}
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
