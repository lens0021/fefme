/*
 * React component to display preview cards for links.
 * https://docs.joinmastodon.org/entities/PreviewCard/
 */
import type React from "react";

import parse from "html-react-parser";
import type { mastodon } from "masto";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { extractDomain } from "../../core/index";

import { config } from "../../config";
import NewTabLink from "../helpers/NewTabLink";

interface PreviewCardProps {
	card: mastodon.v1.PreviewCard;
	showLinkPreviews: boolean;
}

export default function PreviewCard(
	props: PreviewCardProps,
): React.ReactElement {
	const { card, showLinkPreviews } = props;
	const altText = card.title || card.description;

	const headline = (
		<>
			<span className="text-[#4b427a]">
				[{card.providerName || extractDomain(card.url)}]
			</span>{" "}
			<span>{parse(card.title)}</span>
		</>
	);

	// If link previews are disabled just return a link with the headline
	if (!showLinkPreviews) {
		return (
			<NewTabLink
				className="inline-flex items-center gap-2 text-sm text-[color:var(--color-primary)] underline underline-offset-2"
				href={card.url}
			>
				{headline}
			</NewTabLink>
		);
	}

	return (
		<NewTabLink
			className="block overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] hover:border-[color:var(--color-primary)]/40"
			href={card.url}
		>
			<div className="flex flex-col sm:flex-row">
				<div className="w-full shrink-0 bg-black/5 sm:w-48">
					<canvas className="hidden" height="32" width="32" />

					<LazyLoadImage
						alt={altText}
						className="h-full w-full object-cover"
						src={card.image}
						title={altText}
					/>
				</div>

				<div className="flex flex-1 flex-col gap-1 p-3">
					<div className="text-sm font-medium text-[color:var(--color-fg)]">
						{headline}
					</div>

					<p className="text-xs text-[color:var(--color-muted-fg)]">
						{card.description.slice(0, config.toots.maxPreviewCardLength)}
					</p>
				</div>
			</div>
		</NewTabLink>
	);
}
