import React, { useState } from "react";

import { config } from "../config";
import { useCoordinator } from "../hooks/useCoordinator";

/**
 * The footer that appears on the login screen when API errors and warnings were encountered
 * while retrieving Mastodon data.
 */
export default function ApiErrorsPanel(): JSX.Element {
	const { algorithm } = useCoordinator();
	const [isExpanded, setIsExpanded] = useState(false);

	if (!algorithm?.apiErrorMsgs || algorithm.apiErrorMsgs.length === 0) {
		return null;
	}

	return (
		<div className="bg-[#4f4f42] mt-[35px] font-[Tahoma,Geneva,sans-serif] rounded overflow-hidden">
			<div className="bg-[#4f4f42]">
				<div className="bg-[#4f4f42]">
					<button
						type="button"
						className="bg-[#4f4f42] border-0 text-[#a4a477] w-full p-3 cursor-pointer text-left"
						onClick={() => setIsExpanded(!isExpanded)}
					>
						{algorithm.apiErrorMsgs.length}{" "}
						{config.timeline.apiErrorsUserMsgSuffix} (click to inspect)
					</button>
				</div>

				{isExpanded && (
					<div className="bg-[#4f4f42] p-3">
						<ul className="list-decimal pl-[25px]">
							{algorithm.apiErrorMsgs.map((msg) => (
								<li key={msg} className="text-[#c6d000] text-xs mt-[2px]">
									{msg}
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}
