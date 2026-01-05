import type React from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getLogger } from "../helpers/log_helpers";

const logger = getLogger("NotFoundPage.tsx");

export default function NotFoundPage(): React.ReactElement {
	const navigate = useNavigate();
	const location = useLocation();
	const currentPath = location.pathname;

	logger.log(
		`<NotFoundPage> You shouldn't be here! currentPath: "${currentPath}", location:`,
		location,
	);

	useEffect(() => {
		navigate("/");
		// navigate is stable (from react-router), so this only runs once on mount
	}, [navigate]);

	return <div>Redirecting...</div>;
}
