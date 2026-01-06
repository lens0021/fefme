import type React from "react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getLogger } from "../helpers/log_helpers";

const logger = getLogger("NotFoundPage.tsx");

export default function NotFoundPage(): React.ReactElement {
	const navigate = useNavigate();
	const location = useLocation();
	const currentPath = location.pathname;
	const [countdown, setCountdown] = useState(3);

	logger.log(
		`<NotFoundPage> You shouldn't be here! currentPath: "${currentPath}", location:`,
		location,
	);

	useEffect(() => {
		const timer = setInterval(() => {
			setCountdown((prev) => prev - 1);
		}, 1000);

		const timeout = setTimeout(() => {
			navigate("/");
		}, 3000);

		return () => {
			clearInterval(timer);
			clearTimeout(timeout);
		};
	}, [navigate]);

	return (
		<div className="flex flex-col items-center justify-center h-[50vh] text-center p-4">
			<h1 className="text-2xl font-bold mb-4">Page Not Found (404)</h1>
			<p className="mb-4">
				The page <code className="bg-gray-100 p-1 rounded">{currentPath}</code>{" "}
				does not exist.
			</p>
			<p className="text-gray-500">Redirecting to home in {countdown}...</p>
		</div>
	);
}