/*
 * Functions for dealing with Mastodon API and data structures.
 */
import { keyBy, mapValues } from "lodash";
import type { mastodon } from "masto";
import { MediaCategory } from "../core/index";

import { appLogger } from "./log_helpers";
import { mimeTypeExtension } from "./string_helpers";

export interface MastodonServer extends mastodon.v2.Instance {
	mimeExtensions: MimeExtensions;
}

// Map of server's allowed MIME types to file extensions
type MimeExtensions = Record<string, string[]>;

const MIME_GROUPS = mapValues(MediaCategory, (v) => `${v}/*`);

// Populate our mimeExtensions field in the mastodon.v2.Instance object based on the server's configuration.
export function addMimeExtensionsToServer(
	server: mastodon.v2.Instance,
): MastodonServer {
	try {
		const mimeExtensions = buildMimeExtensions(
			server.configuration.mediaAttachments.supportedMimeTypes,
		);
		return { ...server, mimeExtensions };
	} catch (error) {
		appLogger.error(
			`Failed to add MIME extensions to server: ${server.domain}`,
			error,
			"\nserver info:",
			server,
		);
		return { ...server, mimeExtensions: {} };
	}
}

/** Return file extensions for an audio MIME type. */
function audioExtensions(mimeType: string): string[] {
	return [mimeTypeExtension(mimeType)];
}

/** Return file extensions for an image MIME type (adds .jpg alias for jpeg). */
function imageExtensions(mimeType: string, fileType: string): string[] {
	const exts = [mimeTypeExtension(mimeType)];
	if (fileType === "jpeg") exts.push(".jpg");
	return exts;
}

/** Return file extensions for a video MIME type (adds .mov alias for quicktime). */
function videoExtensions(mimeType: string): string[] {
	return mimeType === "video/quicktime"
		? [".mov"]
		: [mimeTypeExtension(mimeType)];
}

// Build a map of MIME types to file extensions used for media uploads.
function buildMimeExtensions(mimeTypes: string[]): MimeExtensions {
	const mimeExtensions = mimeTypes.reduce((acc, mimeType) => {
		const [category, fileType] = mimeType.split("/");
		if (fileType.startsWith("x-") || fileType.includes(".")) return acc; // skip invalid file extensions

		if (category === MediaCategory.AUDIO) {
			acc[MIME_GROUPS[MediaCategory.AUDIO]] ||= [];
			acc[MIME_GROUPS[MediaCategory.AUDIO]].push(...audioExtensions(mimeType));
		} else if (category === MediaCategory.IMAGE) {
			acc[MIME_GROUPS[MediaCategory.IMAGE]] ||= [];
			acc[MIME_GROUPS[MediaCategory.IMAGE]].push(
				...imageExtensions(mimeType, fileType),
			);
		} else if (category === MediaCategory.VIDEO) {
			acc[MIME_GROUPS[MediaCategory.VIDEO]] ||= [];
			acc[MIME_GROUPS[MediaCategory.VIDEO]].push(...videoExtensions(mimeType));
		} else {
			appLogger.warn(
				`Unknown MIME type in home server's attachmentsConfig: ${mimeType}`,
			);
		}

		return acc;
	}, {} as MimeExtensions);

	appLogger.trace("Server accepted MIME types:", mimeExtensions);
	return mimeExtensions;
}
