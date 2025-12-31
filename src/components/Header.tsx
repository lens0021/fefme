import React from "react";

import { FEDIALGO } from "../core/index";

import { useAuthContext } from "../hooks/useAuth";

/** Header component on the feed page. */
export default function Header(): JSX.Element {
	const { user } = useAuthContext();

	return (
		<div className="w-full pt-4">
			<div className="flex flex-col gap-2">
				{user && (
					<div className="flex items-center gap-2">
						{user?.profilePicture && (
							<img
								alt={`${FEDIALGO} User Avatar`}
								src={user.profilePicture}
								className="h-8 w-8 rounded"
							/>
						)}
						<span className="text-sm">{user.username}</span>
					</div>
				)}
			</div>
		</div>
	);
}
