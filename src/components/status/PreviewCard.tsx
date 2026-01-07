/*
 * React component to display preview cards for links.
 * https://docs.joinmastodon.org/entities/PreviewCard/
 */
import React, { useState } from "react";

import { faLink } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
	const [imageError, setImageError] = useState(false);
	const altText = card.title || card.description;

	const headline = (
		<>
			<span className="text-[color:var(--color-primary)] font-bold opacity-80">
				[{card.providerName || extractDomain(card.url)}]
			</span>{" "}
			<span>{parse(card.title)}</span>
		</>
	);

	// If link previews are disabled just return a link with the headline
	if (!showLinkPreviews) {
		return (
			<NewTabLink
				className="inline-flex items-center gap-2 text-sm text-[color:var(--color-primary)] underline underline-offset-2 hover:text-[color:var(--color-primary-hover)] transition-colors"
				href={card.url}
			>
				{headline}
			</NewTabLink>
		);
	}

	return (
		<NewTabLink
			className="group block overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] transition-colors hover:border-[color:var(--color-primary)]/50 hover:shadow-sm"
			href={card.url}
		>
			<div className="flex flex-col sm:flex-row">
				<div className="relative w-full shrink-0 bg-[color:var(--color-muted)] sm:w-48 flex items-center justify-center overflow-hidden">
					{!imageError && card.image ? (
						<LazyLoadImage
							alt={altText}
							className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
							src={card.image}
							title={altText}
							onError={() => setImageError(true)}
							wrapperClassName="!block h-full w-full"
						/>
					) : (
						<div className="flex h-32 w-full items-center justify-center text-[color:var(--color-muted-fg)] sm:h-full">
							<FontAwesomeIcon icon={faLink} size="2x" />
						</div>
					)}
				</div>

				<div className="flex flex-1 flex-col justify-center gap-1 p-3">
					<div className="text-sm font-medium text-[color:var(--color-fg)] line-clamp-2">
						{headline}
					</div>

					<p className="text-xs text-[color:var(--color-muted-fg)] line-clamp-3">
						{card.description.slice(0, config.posts.maxPreviewCardLength)}
					</p>
				</div>
			</div>
		</NewTabLink>
	);
}
