import React from "react";

import { config } from "../config";

/** The footer that appears on the login screen. */
export default function Footer(): JSX.Element {
	return (
		<footer className="bg-gray-900 text-white mt-12 p-4">
			<div className="max-w-7xl mx-auto flex gap-6">
				<a
					href={config.app.repoUrl}
					className="flex items-center gap-2 hover:text-gray-300 transition-colors"
				>
					<img
						alt="Github Logo"
						src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
						className="h-5 w-5 rounded"
					/>
					<span>Fefme</span>
				</a>

				<a
					href="https://github.com/michelcrypt4d4mus/fedialgo"
					className="flex items-center gap-2 hover:text-gray-300 transition-colors"
				>
					<img
						alt="Github Logo"
						src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
						className="h-5 w-5 rounded"
					/>
					<span>FediAlgo</span>
				</a>
			</div>
		</footer>
	);
}
