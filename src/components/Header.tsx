import React from "react";

import { FEDIALGO } from "fedialgo";

import { useAuthContext } from "../hooks/useAuth";

/** Header component on the feed page. */
export default function Header(): JSX.Element {
	const { logout, user } = useAuthContext();

	return (
		<div className="w-full p-4">
			<div className="flex justify-between items-center w-full">
				<div className="flex items-center gap-2">
					{user && (
						<>
							{user?.profilePicture && (
								<img
									alt={`${FEDIALGO} User Avatar`}
									src={user.profilePicture}
									className="h-8 w-8 rounded"
								/>
							)}
							<span className="text-[15px] px-2">{user.username}</span>
						</>
					)}
				</div>

				<div>
					{user && (
						<button
							type="button"
							onClick={() => logout()}
							className="text-sm border border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-3 py-1 rounded transition-colors"
						>
							Logout
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
