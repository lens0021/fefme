/*
 * Simple component for links that open in a new tab.
 */

import type React from "react";
import type { CSSProperties, PropsWithChildren, ReactElement } from "react";

interface NewTabLinkProps extends PropsWithChildren {
	className?: string;
	href: string;
	onClick?: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
	style?: CSSProperties;
}

export default function NewTabLink(props: NewTabLinkProps): ReactElement {
	const { className, href, onClick, style } = props;

	return (
		<a
			className={className || ""}
			href={href}
			onClick={(e) => {
				if (onClick) {
					onClick(e);
				}
			}}
			rel="noreferrer noopener"
			style={style || {}}
			target="_blank"
		>
			{props.children}
		</a>
	);
}
