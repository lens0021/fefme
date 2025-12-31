/*
 * React component to display preview cards for links.
 * https://docs.joinmastodon.org/entities/PreviewCard/
 */
import React from "react";

import parse from "html-react-parser";
import { extractDomain } from "fedialgo";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { mastodon } from "masto";

import NewTabLink from "../helpers/NewTabLink";
import { config } from "../../config";

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
			<NewTabLink className="status-card compact py-1.5 px-2.5 underline" href={card.url}>
				{headline}
			</NewTabLink>
		);
	}

	return (
		<NewTabLink className="status-card compact" href={card.url}>
			<div className="status-card__image">
				{/* TODO: WTF is this and do we need it? */}
				<canvas
					className="status-card__image-preview status-card__image-preview--hidden"
					height="32"
					width="32"
				/>

				<LazyLoadImage
					alt={altText}
					className="status-card__image-image max-h-[40vh] object-top"
					src={card.image}
					title={altText}
				/>
			</div>

			<div className="status-card__content">
				{headline}

				<p className="status-card__description mt-[2px]">
					{card.description.slice(0, config.toots.maxPreviewCardLength)}
				</p>
			</div>
		</NewTabLink>
	);
}
