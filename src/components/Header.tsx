import React from "react";

import { FEDIALGO } from "fedialgo";

import { useAuthContext } from "../hooks/useAuth";

/** Header component on the feed page. */
export default function Header(): JSX.Element {
	const { logout, user } = useAuthContext();

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

				{user && (
					<button
						type="button"
						onClick={() => logout()}
						className="text-xs border border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-3 py-1 rounded transition-colors self-start"
					>
						Logout
					</button>
				)}
			</div>
		</div>
	);
}
