/**
 * @fileoverview Handles the incoming call that is part of OAuth 2.0 authorization code flow.
 */
import React, { useCallback, useEffect } from "react";

import { createRestAPIClient } from "masto";
import { useSearchParams } from "react-router-dom";
import { FEDIALGO } from "../core/index";

import { useError } from "../components/helpers/ErrorHandler";
import { config } from "../config";
import { getLogger } from "../helpers/log_helpers";
import { sanitizeServerUrl } from "../helpers/string_helpers";
import { useAuthContext } from "../hooks/useAuth";
import { getApp, useServerStorage } from "../hooks/useLocalStorage";
import type { User } from "../types";

const VERIFY_CREDENTIALS = "api.v1.accounts.verifyCredentials()";

const logger = getLogger("CallbackPage");

export default function CallbackPage() {
	const { logAndSetFormattedError } = useError();
	const { setLoggedInUser, user } = useAuthContext();
	const [searchParams] = useSearchParams();

	const paramsCode = searchParams.get("code");
	logger.trace(`paramsCode: "${paramsCode}", searchParams:`, searchParams);

	// Example of 'app' object
	// {
	//     clientId: "blahblah",
	//     clientSecret: "blahblahblahblahblahblahblahblah",
	//     id: "519245",
	//     name: "Fefme",
	//     redirectUri: "http://localhost:3000/callback",
	//     vapidKey: "blahblahblahblahblahblahblahblahblahblahblahblahblahblahblahblahblahblah",
	//     website: "https://mastodon.social",
	// }
	const [serverDomain] = useServerStorage();
	const server = sanitizeServerUrl(serverDomain, true);
	const app = getApp();

	// Get an OAuth token for our app using the code we received from the server
	const oAuthUserAndRegisterApp = useCallback(
		async (code: string) => {
			const handleAuthError = (msg: string, note: string, errorObj: Error) => {
				logAndSetFormattedError({
					args: { app, code, searchParams, user },
					errorObj,
					msg,
					note,
				});
			};

			if (!app?.clientId || !app.clientSecret || !app.redirectUri) {
				handleAuthError(
					`${FEDIALGO} app credentials missing.`,
					"Try logging out and logging back in.",
					new Error("Missing app credentials"),
				);
				return;
			}

			const body = new FormData();
			body.append("grant_type", "authorization_code");
			body.append("client_id", app.clientId);
			body.append("client_secret", app.clientSecret);
			body.append("redirect_uri", app.redirectUri);
			body.append("code", code);
			body.append("scope", config.app.createAppParams.scopes);

			// TODO: access_token is retrieved manually via fetch() instead of using the masto.js library
			const oauthTokenURI = `${server}/oauth/token`;
			logger.trace(
				`oauthTokenURI: "${oauthTokenURI}"\napp:`,
				app,
				"\nuser:",
				user,
				`\ncode: "${code}`,
			);
			const oAuthResult = await fetch(oauthTokenURI, { method: "POST", body });
			const json = await oAuthResult.json();

			// Handle OAuth token request errors
			if (!oAuthResult.ok) {
				const errorDesc =
					json.error_description || json.error || "Unknown error";
				handleAuthError(
					`OAuth token request failed (${oAuthResult.status})`,
					`Server returned: ${errorDesc}. Try logging out and logging back in.`,
					new Error(`OAuth token error: ${errorDesc}`),
				);
				return;
			}

			const accessToken = json.access_token;
			if (!accessToken) {
				handleAuthError(
					"OAuth response missing access_token",
					"The server did not return an access token. Try logging out and logging back in.",
					new Error("Missing access_token in OAuth response"),
				);
				return;
			}

			const api = createRestAPIClient({
				accessToken: accessToken,
				url: server,
			});

			// Authenticate the user
			api.v1.accounts
				.verifyCredentials()
				.then((verifiedUser) => {
					logger.trace(`${VERIFY_CREDENTIALS} succeeded:`, verifiedUser);

					const userData: User = {
						access_token: accessToken,
						id: verifiedUser.id,
						profilePicture: verifiedUser.avatar,
						server: server,
						username: verifiedUser.username,
					};

					const redirectTo =
						localStorage.getItem("fefme_login_redirect") || "/";
					localStorage.removeItem("fefme_login_redirect");
					setLoggedInUser(userData, redirectTo);
				})
				.catch((errorObj) => {
					handleAuthError(
						`${FEDIALGO} failed to login to Mastodon server!`,
						`${VERIFY_CREDENTIALS} failed. Try logging out and in again?`,
						errorObj,
					);
				});
		},
		[app, logAndSetFormattedError, searchParams, server, setLoggedInUser, user],
	);

	useEffect(() => {
		if (paramsCode !== null && !user) {
			oAuthUserAndRegisterApp(paramsCode);
		}
	}, [oAuthUserAndRegisterApp, paramsCode, user]);

	return (
		<div>
			<h1>Validating ....</h1>
		</div>
	);
}
