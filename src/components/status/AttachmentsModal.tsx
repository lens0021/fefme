/*
 * Modal that allows for inspection of posted images etc upon clicking.
 */
import { useEffect } from "react";

import { MediaCategory, type Post, VIDEO_TYPES } from "../../core/index";

import { getLogger } from "../../helpers/log_helpers";

const logger = getLogger("AttachmentsModal");

interface AttachmentsModalProps {
	mediaInspectionIdx: number;
	setMediaInspectionIdx: (mediaInspectionIdx: number) => void;
	post: Post;
}

export default function AttachmentsModal(props: AttachmentsModalProps) {
	const { mediaInspectionIdx, setMediaInspectionIdx, post } = props;
	const shouldShowModal = mediaInspectionIdx >= 0;
	let element: JSX.Element = <></>;

	if (shouldShowModal) {
		const media = post.mediaAttachments[mediaInspectionIdx];

		if (!media?.url) {
			logger.warn(
				`<AttachmentsModal> Invalid media.url at idx ${mediaInspectionIdx}. post:`,
				post,
			);
		} else if (media.type === MediaCategory.IMAGE) {
			element = (
				<img alt={media.description ?? ""} src={media.url} width={"100%"} />
			);
		} else if (VIDEO_TYPES.includes(media.type)) {
			element = (
				<video controls width={"100%"}>
					<source src={media.url} type="video/mp4" />
					<track kind="captions" src={media.url} />
					Your browser does not support the video tag.
				</video>
			);
		} else {
			logger.warn(
				`<AttachmentsModal> Unknown type at post.mediaAttachments[${mediaInspectionIdx}]`,
				post,
			);
		}
	}

	// Handle keyboard navigation and closing
	useEffect(() => {
		if (mediaInspectionIdx < 0) return;

		const handleKeyDown = (e: KeyboardEvent): void => {
			if (e.key === "Escape") {
				setMediaInspectionIdx(-1);
				return;
			}

			if (post.mediaAttachments.length <= 1) return;

			let newIndex = mediaInspectionIdx;
			if (e.key === "ArrowRight") {
				newIndex += 1;
			} else if (e.key === "ArrowLeft") {
				newIndex -= 1;
				if (newIndex < 0) newIndex = post.mediaAttachments.length - 1;
			}

			if (newIndex !== mediaInspectionIdx) {
				setMediaInspectionIdx(newIndex % post.mediaAttachments.length);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [mediaInspectionIdx, setMediaInspectionIdx, post.mediaAttachments.length]);

	if (!shouldShowModal) return null;

	return (
		<div
			className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
			role="dialog"
			aria-modal="true"
		>
			<button
				type="button"
				aria-label="Close dialog"
				onClick={() => setMediaInspectionIdx(-1)}
				className="absolute inset-0 h-full w-full cursor-default"
			/>
			<div className="relative z-10 bg-[color:var(--color-card-bg)] text-[color:var(--color-fg)] rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[95vh] overflow-hidden flex flex-col border border-[color:var(--color-border)] animate-in zoom-in duration-200">
				<div className="p-4 border-b border-[color:var(--color-border)] flex justify-between items-center bg-[color:var(--color-muted)]">
					<h3 className="text-sm font-bold truncate pr-8">
						{post.contentShortened()}
					</h3>
					<button
						type="button"
						onClick={() => setMediaInspectionIdx(-1)}
						className="text-2xl leading-none hover:text-[color:var(--color-primary)] transition-colors p-1"
						aria-label="Close"
					>
						×
					</button>
				</div>

				<div className="flex-1 overflow-auto flex items-center justify-center bg-black/20">
					{element}
				</div>
			</div>
		</div>
	);
}
