import type React from "react";
import { useEffect } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";

import "./theme.css";
import Footer from "./components/Footer";
import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorHandler from "./components/helpers/ErrorHandler";
import { getLogger, logLocaleInfo } from "./helpers/log_helpers";
import CoordinatorProvider from "./hooks/useCoordinator";
import AuthProvider from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import CallbackPage from "./pages/CallbackPage";
import Feed from "./pages/Feed";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";

const logger = getLogger("App.tsx");

export default function App(): React.ReactElement {
	logLocaleInfo();

	// Initialize theme detection
	useTheme();

	// OAuth redirect handler for GitHub Pages compatibility
	// This is a workaround for Github pages (which only allows GET query params), the HashRouter,
	// and OAuth redirects. OAuth redirects cannot include a hash and Github Pages doesn't accept
	// any route URLs without a hash.
	//       otherwise this: http://localhost:3000/?code=abcdafwgwdgw
	//    is routed to this: http://localhost:3000/?code=abcdafwgwdgw#/login
	// From: https://github.com/auth0/auth0-spa-js/issues/407
	useEffect(() => {
		if (window.location.href.includes("?code=")) {
			const newUrl = window.location.href.replace(
				/\/(\?code=.*)/,
				"/#/callback$1",
			);
			logger.trace(
				`<App.tsx> OAuth callback to "${window.location.href}", redirecting to "${newUrl}"`,
			);
			window.location.href = newUrl;
		}
	}, []);

	// Service Worker registration for offline support
	// Service worker for github pages: https://gist.github.com/kosamari/7c5d1e8449b2fbc97d372675f16b566e
	useEffect(() => {
		if ("serviceWorker" in navigator) {
			logger.log("Service Worker is supported, registering...");

			const registerServiceWorker = async () => {
				try {
					await navigator.serviceWorker.register("./service-worker.js");
					logger.log("Service Worker registered successfully");
				} catch (error) {
					logger.error("Error registering service worker:", error);
				}
			};

			window.addEventListener("load", registerServiceWorker);

			return () => {
				window.removeEventListener("load", registerServiceWorker);
			};
		}
	}, []);

	// Mobile back button handler - scroll to top instead of closing app
	useEffect(() => {
		// Add initial history entry to enable back button interception
		window.history.pushState(null, "", window.location.href);

		const handlePopState = (event: PopStateEvent) => {
			event.preventDefault();

			// Scroll to top
			window.scrollTo({ top: 0, behavior: "smooth" });

			// Push a new state to keep the app from closing on next back press
			window.history.pushState(null, "", window.location.href);

			logger.trace("Mobile back button pressed, scrolled to top");
		};

		window.addEventListener("popstate", handlePopState);

		return () => {
			window.removeEventListener("popstate", handlePopState);
		};
	}, []);

	return (
		<HashRouter>
			<div
				className="w-full min-h-screen px-3 flex flex-col items-center"
				style={{ backgroundColor: "var(--color-bg)", color: "var(--color-fg)" }}
			>
				<div className="w-full max-w-2xl flex flex-col gap-4">
					<ErrorHandler>
						<AuthProvider>
							<CoordinatorProvider>
								<Header />

								<Routes>
									<Route
										path="/"
										element={
											<ProtectedRoute>
												<Feed />
											</ProtectedRoute>
										}
									/>

									<Route path="/callback" element={<CallbackPage />} />
									<Route path="/login" element={<LoginPage />} />
									<Route path="*" element={<NotFoundPage />} />
								</Routes>
							</CoordinatorProvider>

							<Footer />
						</AuthProvider>
					</ErrorHandler>
				</div>
			</div>
		</HashRouter>
	);
}
