/*
 * Modal that allows for inspection of tooted images etc upon clicking.
 */
import { useEffect } from "react";

import { MediaCategory, Toot, VIDEO_TYPES } from "fedialgo";

import { blackFont } from "../../helpers/style_helpers";
import { getLogger } from "../../helpers/log_helpers";

const logger = getLogger("AttachmentsModal");

interface AttachmentsModalProps {
	mediaInspectionIdx: number;
	setMediaInspectionIdx: (mediaInspectionIdx: number) => void;
	toot: Toot;
}

export default function AttachmentsModal(props: AttachmentsModalProps) {
	const { mediaInspectionIdx, setMediaInspectionIdx, toot } = props;
	const shouldShowModal = mediaInspectionIdx >= 0;
	let element: JSX.Element = <></>;

	if (shouldShowModal) {
		const media = toot.mediaAttachments[mediaInspectionIdx];

		if (!media?.url) {
			logger.warn(
				`<AttachmentsModal> Invalid media.url at idx ${mediaInspectionIdx}. toot:`,
				toot,
			);
		} else if (media.type == MediaCategory.IMAGE) {
			element = (
				<img alt={media.description ?? ""} src={media.url} width={"100%"} />
			);
		} else if (VIDEO_TYPES.includes(media.type)) {
			element = (
				<video controls width={"100%"}>
					<source src={media.url} type="video/mp4" />
					Your browser does not support the video tag.
				</video>
			);
		} else {
			logger.warn(
				`<AttachmentsModal> Unknown type at toot.mediaAttachments[${mediaInspectionIdx}]`,
				toot,
			);
		}
	}

	// Increase mediaInspectionIdx on Right Arrow, decrease on Left Arrow.
	useEffect(() => {
		if (toot.imageAttachments.length <= 1) return;

		const handleKeyDown = (e: KeyboardEvent): void => {
			if (mediaInspectionIdx < 0) return;
			let newIndex = mediaInspectionIdx;

			if (e.key === "ArrowRight") {
				newIndex += 1;
			} else if (e.key === "ArrowLeft") {
				newIndex -= 1;
				if (newIndex < 0) newIndex = toot.mediaAttachments.length - 1;
			}

			setMediaInspectionIdx(newIndex % toot.mediaAttachments.length);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [mediaInspectionIdx, toot.imageAttachments]);

	if (!shouldShowModal) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
			onClick={() => setMediaInspectionIdx(-1)}
		>
			<div
				className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="p-4 border-b flex justify-between items-center">
					<h3 className="text-lg font-semibold" style={blackFont}>
						{toot.contentShortened()}
					</h3>
					<button
						onClick={() => setMediaInspectionIdx(-1)}
						className="text-2xl leading-none hover:text-gray-600"
						aria-label="Close"
					>
						×
					</button>
				</div>

				<div className="p-4">{element}</div>
			</div>
		</div>
	);
}
