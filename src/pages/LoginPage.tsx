import React, { useState } from "react";

import { FEDIALGO } from "fedialgo";
import { createRestAPIClient } from "masto";
import { stringifyQuery } from "ufo";

import { useError } from "../components/helpers/ErrorHandler";
import { config } from "../config";
import { getLogger } from "../helpers/log_helpers";
import { sanitizeServerUrl } from "../helpers/string_helpers";
import {
	getApp,
	useAppStorage,
	useServerStorage,
	useServerUserStorage,
} from "../hooks/useLocalStorage";
import type { App } from "../types";

const logger = getLogger("LoginPage");

/** Landing / login page. */
export default function LoginPage() {
	const { logAndSetFormattedError } = useError();

	// Global state
	const serverUserState = useServerUserStorage();
	const [_app, setApp] = useAppStorage(serverUserState);
	const [_serverDomain, setServer] = useServerStorage();
	// Local state
	const [serverInputText, setServerInputText] = useState(_serverDomain);
	let serverDomain = _serverDomain;

	const handleError = (
		errorObj: Error,
		msg?: string,
		note?: string,
		...args: unknown[]
	) => {
		logAndSetFormattedError({
			args: (args || []).concat([
				{ serverDomain, serverInputText, serverUserState: serverUserState[0] },
			]),
			errorObj,
			logger,
			msg: msg || "Error occurred while trying to login",
			note,
		});
	};

	const oAuthLogin = async (): Promise<void> => {
		try {
			serverDomain = setServer(serverInputText);
		} catch (err) {
			handleError(err);
			return;
		}

		// OAuth won't allow HashRouter's "#" chars in redirectUris
		const redirectUri =
			`${window.location.origin}${window.location.pathname}`.replace(
				/\/+$/,
				"",
			);
		const serverUrl = sanitizeServerUrl(serverDomain, true);
		const api = createRestAPIClient({ url: serverUrl });
		const app = getApp(serverDomain);
		let registeredApp: App | null = null;

		if (app?.clientId) {
			logger.trace(`Found existing app creds to use for '${serverUrl}':`, app);
			registeredApp = app;
		} else {
			logger.log(
				`No existing app found, registering a new app for '${serverUrl}'`,
			);

			try {
				// Note that the redirectUris, once specified, cannot be changed without clearing cache and registering a new app.
				registeredApp = await api.v1.apps.create({
					...config.app.createAppParams,
					redirectUris: redirectUri,
				});
			} catch (error) {
				const msg = `${FEDIALGO} failed to register itself as an app on your Mastodon server!`;
				handleError(error, msg, "Check your server URL and try again.", {
					api,
					redirectUri,
					serverUrl,
				});
				return;
			}

			logger.trace(
				"Created app with api.v1.apps.create(), response var 'registeredApp':",
				registeredApp,
			);
		}

		const query = stringifyQuery({
			client_id: registeredApp.clientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: config.app.createAppParams.scopes,
		});

		setApp({ ...registeredApp, redirectUri });
		const newUrl = `${serverUrl}/oauth/authorize?${query}`;
		logger.trace(`redirecting to "${newUrl}"...`);
		window.location.href = newUrl;
	};

	return (
		<div className="h-screen flex flex-col items-center justify-center flex-1 p-4">
			<div>
				<p className="leading-tight mb-2.5 mt-3 text-center">
					{FEDIALGO} features a customizable algorithm for sorting your feed.
					<br />
					You can choose which factors influence the sorting of your timeline.
					<br />
					<span className="text-[#ff00ff] text-[17px] block mt-1 mb-5">
						All calculations are done in your browser. None of your data leaves
						your machine.
					</span>
					<br />
					To get started enter your Mastodon server in the form:{" "}
					<code className="bg-gray-100 px-1 rounded">
						{config.app.defaultServer}
					</code>
				</p>
			</div>

			<div className="flex flex-row gap-2 mb-1 mt-1">
				<input
					id="mastodon_server"
					onChange={(e) => setServerInputText(e.target.value)}
					placeholder={serverDomain}
					type="url"
					value={serverInputText}
					className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>

				<button
					type="button"
					onClick={oAuthLogin}
					className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
				>
					Login
				</button>
			</div>
		</div>
	);
}
