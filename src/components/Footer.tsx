import React from "react";

import { config } from "../config";

/** The footer that appears at the bottom of the page. */
export default function Footer(): JSX.Element {
	return (
		<footer className="bg-[color:var(--color-muted)] text-[color:var(--color-muted-fg)] mt-10 p-4 rounded border border-[color:var(--color-border)]">
			<div className="flex flex-col gap-3 text-sm">
				<a
					href={config.app.repoUrl}
					className="flex items-center gap-2 hover:text-[color:var(--color-fg)] transition-colors"
				>
					<img
						alt="Github Logo"
						src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
						className="h-5 w-5 rounded-full bg-white"
					/>
					<span>Fefme</span>
				</a>
			</div>
		</footer>
	);
}
