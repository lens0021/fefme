import React, { useState } from "react";

import { config } from "../config";
import { useCoordinator } from "../hooks/useCoordinator";

/**
 * The footer that appears on the login screen when API errors and warnings were encountered
 * while retrieving Mastodon data.
 */
export default function ApiErrorsPanel(): JSX.Element | null {
	const { algorithm } = useCoordinator();
	const [isExpanded, setIsExpanded] = useState(false);

	if (!algorithm?.apiErrorMsgs || algorithm.apiErrorMsgs.length === 0) {
		return null;
	}

	return (
		<div
			className="mt-[35px] font-[Tahoma,Geneva,sans-serif] rounded overflow-hidden"
			style={{ backgroundColor: "var(--color-warning-bg)" }}
		>
			<button
				type="button"
				className="border-0 w-full p-3 cursor-pointer text-left"
				style={{
					backgroundColor: "var(--color-warning-bg)",
					color: "var(--color-warning-fg)",
				}}
				onClick={() => setIsExpanded(!isExpanded)}
			>
				{algorithm.apiErrorMsgs.length}{" "}
				{config.timeline.apiErrorsUserMsgSuffix} (click to inspect)
			</button>

			{isExpanded && (
				<div className="p-3" style={{ backgroundColor: "var(--color-warning-bg)" }}>
					<ul className="list-decimal pl-[25px]">
						{algorithm.apiErrorMsgs.map((msg, index) => (
							<li
								key={index}
								className="text-xs mt-[2px]"
								style={{ color: "var(--color-warning-text)" }}
							>
								{msg}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
