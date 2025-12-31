import { Buffer } from "buffer"; // Required for class-transformer to work (maybe???)
import type React from "react";
import { useEffect } from "react";
const windowWithBuffer = window as Window & { Buffer?: typeof Buffer };
windowWithBuffer.Buffer = Buffer;
// NOTE: Using CDN to get boostrap instead of importing bootstrap.min.css (see index.html)

import { HashRouter, Route, Routes } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";

import "./birdUI.css";
import "./default.css";
import Footer from "./components/Footer";
import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorHandler from "./components/helpers/ErrorHandler";
import { getLogger, logLocaleInfo } from "./helpers/log_helpers";
import AlgorithmProvider from "./hooks/useAlgorithm";
import AuthProvider from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import CallbackPage from "./pages/CallbackPage";
import Feed from "./pages/Feed";
import LoginPage from "./pages/LoginPage";

const logger = getLogger("App.tsx");

export default function App(): React.ReactElement {
	logLocaleInfo();

	// Initialize theme detection
	useTheme();

	// This is a workaround for Github pages (which only allows GET query params), the HashRouter,
	// and OAuth redirects. OAuth redirects cannot include a hash and Github Pages doesn't accept
	// any route URLs without a hash.
	//       otherwise this: http://localhost:3000/?code=abcdafwgwdgw
	//    is routed to this: http://localhost:3000/?code=abcdafwgwdgw#/login
	// From: https://github.com/auth0/auth0-spa-js/issues/407
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

	if ("serviceWorker" in navigator) {
		logger.log("Service Worker is supported, registering...");

		// Service worker for github pages: https://gist.github.com/kosamari/7c5d1e8449b2fbc97d372675f16b566e
		try {
			window.addEventListener("load", () => {
				navigator.serviceWorker.register("./service-worker.js");
			});
		} catch (error) {
			logger.error("Error registering service worker:", error);
		}
	}

	return (
		<HashRouter>
			<div
				className="w-full min-h-screen px-4 flex flex-col items-center"
				style={{ backgroundColor: "var(--color-bg)", color: "var(--color-fg)" }}
			>
				<ErrorHandler>
					<AuthProvider>
						<Header />

						<Routes>
							<Route
								path="/"
								element={
									<ProtectedRoute>
										<AlgorithmProvider>
											<Feed />
										</AlgorithmProvider>
									</ProtectedRoute>
								}
							/>

							<Route path="/callback" element={<CallbackPage />} />
							<Route path="/login" element={<LoginPage />} />
							<Route path="*" element={<NotFoundPage />} />
						</Routes>

						<Footer />
					</AuthProvider>
				</ErrorHandler>
			</div>
		</HashRouter>
	);
}

function NotFoundPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const currentPath = location.pathname;

	logger.log(
		`<NotFoundPage> You shouldn't be here! currentPath: "${currentPath}", location:`,
		location,
	);
	useEffect(() => {
		navigate("/");
	}, [navigate]);
	return <div>Redirecting...</div>;
}
