import React, { type ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuthContext } from "../hooks/useAuth";

/**
 * Redirect to /login if the user is not authenticated.
 * Includes the current location in the redirect state to allow returning after login.
 */
export default function ProtectedRoute(props: {
	children: ReactElement;
}): ReactElement {
	const { user } = useAuthContext();
	const location = useLocation();

	if (!user) {
		// then user is not authenticated, redirect to login but save where they were going
		return <Navigate to="/login" state={{ from: location }} replace />;
	}

	return props.children;
}
