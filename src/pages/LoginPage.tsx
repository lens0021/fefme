import React, { useState } from "react";

import { createRestAPIClient } from "masto";
import { stringifyQuery } from "ufo";
import { FEDIALGO } from "../core/index";

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
		<div className="fixed inset-0 flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 overflow-auto">
			<div className="w-full max-w-lg my-auto">
				<div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] p-8 shadow-xl backdrop-blur-sm">
					{/* Header */}
					<div className="mb-8 text-center">
						<h1 className="mb-3 text-3xl font-bold text-[color:var(--color-fg)]">
							Welcome to {FEDIALGO}
						</h1>
						<p className="text-base text-[color:var(--color-muted-fg)]">
							Your personalized Fediverse timeline
						</p>
					</div>

					{/* Features */}
					<div className="mb-8 space-y-3">
						<div className="flex items-start gap-3">
							<span className="mt-0.5 text-lg">⚙️</span>
							<div>
								<h3 className="font-semibold text-[color:var(--color-fg)]">
									Customizable Algorithm
								</h3>
								<p className="text-sm text-[color:var(--color-muted-fg)]">
									Choose which factors influence the sorting of your timeline
								</p>
							</div>
						</div>
						<div className="flex items-start gap-3">
							<span className="mt-0.5 text-lg">🔒</span>
							<div>
								<h3 className="font-semibold text-[color:var(--color-fg)]">
									Privacy First
								</h3>
								<p className="text-sm text-[color:var(--color-muted-fg)]">
									All calculations are done in your browser. Your data never
									leaves your machine
								</p>
							</div>
						</div>
					</div>

					{/* Login Form */}
					<div className="space-y-4">
						<div>
							<label
								htmlFor="mastodon_server"
								className="mb-2 block text-sm font-medium text-[color:var(--color-fg)]"
							>
								Mastodon Server
							</label>
							<input
								id="mastodon_server"
								onChange={(e) => setServerInputText(e.target.value)}
								placeholder={serverDomain || config.app.defaultServer}
								type="url"
								value={serverInputText}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										oAuthLogin();
									}
								}}
								className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] px-4 py-3 text-[color:var(--color-fg)] placeholder-[color:var(--color-muted-fg)] transition-colors focus:border-[color:var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)] focus:ring-opacity-20"
							/>
							<p className="mt-2 text-xs text-[color:var(--color-muted-fg)]">
								Example: {config.app.defaultServer}
							</p>
						</div>

						<button
							type="button"
							onClick={oAuthLogin}
							className="w-full rounded-lg bg-[color:var(--color-primary)] px-6 py-3 font-semibold text-white transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)] focus:ring-offset-2"
						>
							Connect to Mastodon
						</button>
					</div>

					{/* Footer note */}
					<p className="mt-6 text-center text-xs text-[color:var(--color-muted-fg)]">
						You'll be redirected to your Mastodon server to authorize access
					</p>
				</div>
			</div>
		</div>
	);
}
