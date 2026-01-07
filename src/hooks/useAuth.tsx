/**
 * @fileoverview Authorization context for the app.
 */
import React, {
	type PropsWithChildren,
	createContext,
	useContext,
	useCallback,
	useMemo,
} from "react";
import { useNavigate } from "react-router-dom";

import axios from "axios";

import { useError } from "../components/helpers/ErrorHandler";
import { getLogger } from "../helpers/log_helpers";
import type { User } from "../types";
import {
	useAppStorage,
	useServerUserStorage,
	useUserStorage,
} from "./useLocalStorage";

const logger = getLogger("AuthProvider");

const AuthContext = createContext({
	logout: (_preserveAppErrors?: boolean) => {},
	setApp: (_app: object) => undefined,
	setLoggedInUser: (_user: User, _redirectTo?: string) => {},
	setUser: (_user: User | null) => undefined,
	user: null,
});

export default function AuthProvider(props: PropsWithChildren) {
	const { resetErrors } = useError();
	const navigate = useNavigate();

	const serverUserState = useServerUserStorage();
	const [app, setApp] = useAppStorage(serverUserState);
	const [user, setUser] = useUserStorage(serverUserState);

	// User object looks like this:
	// {
	//     access_token: "xyssdsfdnffdwf"
	//     id: "10936317990452342342"
	//     profilePicture: "https://files.mastodon.social/accounts/avatars/000/000/000/000/000/000/original/example.jpg"
	//     server: "https://mastodon.social"
	//     username: "cryptadamus"
	// }
	const setLoggedInUser = useCallback(
		async (user: User, redirectTo = "/") => {
			setUser(user);
			logger.debug(`Logged in user "${user.username}", redirecting to "${redirectTo}"`);
			navigate(redirectTo, { replace: true });
		},
		[navigate, setUser],
	);

	// Call this function to sign out logged in user (revoke their OAuth token) and reset the app state.
	// If preserveAppErrors is true, which happens during forced logouts because of API errors,
	// don't reset the app's error state, so that the error modal can be shown after logout.
	const logout = useCallback(
		async (preserveAppErrors = false): Promise<void> => {
			if (!user || !app) {
				logger.warn("logout() called without user or app");
				return;
			}
			logger.log("logout() called with preserveAppErrors:", preserveAppErrors);
			const body = new FormData();
			body.append("token", user.access_token);
			body.append("client_id", app.clientId ?? "");
			body.append("client_secret", app.clientSecret ?? "");
			const oauthRevokeURL = `${user.server}/oauth/revoke`;

			// POST to oauthRevokeURL throws error but log shows "Status code: 200" so I think it works? Hard to
			// get at the actual status code variable (it's only in the low level logs).
			// Error: "Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://mastodon.social/oauth/revoke. (Reason: CORS header ‘Access-Control-Allow-Origin’ missing). Status code: 200.""
			try {
				const _logoutResponse = await axios.post(oauthRevokeURL, body);
			} catch (error) {
				logger.warn(
					`(Probably innocuous) error while trying to logout "${error}":`,
					error,
				);
			}

			!preserveAppErrors && resetErrors();
			setUser(null);
			navigate("/#/login", { replace: true });
		},
		[app?.clientId, app?.clientSecret, navigate, resetErrors, setUser, user],
	);

	const value = useMemo(
		() => ({ logout, setLoggedInUser, setApp, setUser, user }),
		[logout, setApp, setLoggedInUser, setUser, user],
	);

	return (
		<AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
	);
}

export const useAuthContext = () => {
	return useContext(AuthContext);
};
