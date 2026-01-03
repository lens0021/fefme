/**
 * @fileoverview Context to hold the TheAlgorithm variable
 */
import React, {
	type PropsWithChildren,
	type ReactElement,
	createContext,
	useContext,
	useEffect,
	useMemo,
	useCallback,
	useState,
} from "react";

import { createRestAPIClient, type mastodon } from "masto";
import { useError } from "../components/helpers/ErrorHandler";
import TheAlgorithm, {
	GET_FEED_BUSY_MSG,
	AgeIn,
	type Toot,
	isAccessTokenRevokedError,
} from "../core/index";

import { persistentCheckbox } from "../components/helpers/Checkbox";
import { GuiCheckboxName, config } from "../config";
import { getLogger } from "../helpers/log_helpers";
import {
	type MastodonServer,
	addMimeExtensionsToServer,
} from "../helpers/mastodon_helpers";
import type { ErrorHandler } from "../types";
import { TagTootsCategory } from "../core/enums";
import { useAuthContext } from "./useAuth";
import { useLocalStorage } from "./useLocalStorage";

const logger = getLogger("AlgorithmProvider");
const loadLogger = logger.tempLogger("setLoadState");

interface AlgoContext {
	algorithm?: TheAlgorithm;
	alwaysShowFollowed?: boolean;
	api?: mastodon.rest.Client;
	currentUserWebfinger?: string | null;
	isGoToSocialUser?: boolean; // Whether the user is on a GoToSocial instance
	isLoading?: boolean;
	hideSensitive?: boolean;
	hideSensitiveCheckbox?: ReactElement;
	lastLoadDurationSeconds?: number;
	resetAlgorithm?: () => Promise<void>;
	resetSeenState?: () => Promise<void>;
	serverInfo?: MastodonServer;
	selfTypeFilterMode?: "include" | "exclude" | "none";
	setSelfTypeFilterMode?: (value: "include" | "exclude" | "none") => void;
	showFilterHighlights?: boolean;
	timeline: Toot[];
	triggerFeedUpdate?: () => void;
	triggerHomeTimelineBackFill?: () => void;
	triggerFederatedTimelineBackFill?: () => void;
	triggerFavouritedTagBackFill?: () => void;
	triggerParticipatedTagBackFill?: () => void;
	triggerMoarData?: () => void;
	triggerPullAllUserData?: () => void;
}

const AlgorithmContext = createContext<AlgoContext>({ timeline: [] });
export const useAlgorithm = () => useContext(AlgorithmContext);

/** Manage Fefme algorithm state. */
export default function AlgorithmProvider(props: PropsWithChildren) {
	const { logout, user } = useAuthContext();
	const { logAndSetFormattedError, resetErrors } = useError();

	// State variables
	const [algorithm, setAlgorithm] = useState<TheAlgorithm>(null);
	const [isGoToSocialUser, setIsGoToSocialUser] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [lastLoadDurationSeconds, setLastLoadDurationSeconds] = useState<
		number | undefined
	>();
	const [lastLoadStartedAt, setLastLoadStartedAt] = useState<Date>(new Date());
	const [serverInfo, setServerInfo] = useState<MastodonServer>(null); // Instance info for the user's server
	const [timeline, setTimeline] = useState<Toot[]>([]);
	const hasInitializedRef = React.useRef(false);
	const lastUserIdRef = React.useRef<string | null>(null);

	// TODO: this doesn't make any API calls yet, right?
	const api = useMemo(() => {
		if (!user) return null;
		return createRestAPIClient({
			accessToken: user.access_token,
			url: user.server,
		});
	}, [user]);

	// Checkboxes with persistent storage that require somewhat global state
	const alwaysShowFollowed = true;
	const [hideSensitive, hideSensitiveCheckbox] = persistentCheckbox(
		GuiCheckboxName.hideSensitive,
	);
	const showFilterHighlights = true;
	const [selfTypeFilterMode, setSelfTypeFilterMode] = useLocalStorage<
		"include" | "exclude" | "none"
	>("type-filter-self", "none");

	const currentUserWebfinger = useMemo(() => {
		if (!user?.username || !user?.server) return null;
		try {
			const domain = new URL(user.server).hostname;
			return `${user.username}@${domain}`.toLowerCase();
		} catch {
			return null;
		}
	}, [user?.server, user?.username]);

	// Pass startedLoadAt as an arg every time because managing the react state of the last load is tricky
	const setLoadState = useCallback(
		(newIsLoading: boolean, startedLoadAt: Date) => {
			const loadStartedAtStr = startedLoadAt.toISOString();
			const msg = `called (isLoading: "${isLoading}", newIsLoading: "${newIsLoading}", loadStartedAt: "${loadStartedAtStr}")`;
			isLoading === newIsLoading ? loadLogger.warn(msg) : loadLogger.trace(msg);
			setIsLoading(newIsLoading);

			if (newIsLoading) {
				setLastLoadStartedAt(startedLoadAt);
			} else {
				const lastLoadDuration = AgeIn.seconds(startedLoadAt).toFixed(1);
				loadLogger.log(
					`Load finished in ${lastLoadDuration} seconds (loadStartedAtStr: "${loadStartedAtStr}")`,
				);
				setLastLoadDurationSeconds(Number(lastLoadDuration));
			}
		},
		[isLoading],
	);

	// Log a bunch of info about the current state along with the msg
	const logAndShowError: ErrorHandler = useCallback(
		(msg: string, errorObj?: Error) => {
			const args = {
				api,
				lastLoadStartedAt,
				lastLoadDurationSeconds,
				serverInfo,
				user,
			};
			logAndSetFormattedError({ args, errorObj, logger, msg });
		},
		[
			api,
			lastLoadDurationSeconds,
			lastLoadStartedAt,
			logAndSetFormattedError,
			serverInfo,
			user,
		],
	);

	// Wrapper for calls to Fefme TheAlgorithm class that can throw a "busy" error
	const triggerLoadFxn = useCallback(
		(
			loadFxn: () => Promise<void>,
			handleError: ErrorHandler,
			loadStateHandler: (isLoading: boolean, startedLoadAt: Date) => void,
		) => {
			const startedAt = new Date();
			loadStateHandler(true, startedAt);

			loadFxn()
				.then(() => loadStateHandler(false, startedAt))
				.catch((err) => {
					// Don't flip the isLoading state if the feed is just busy loading
					if (err.message.includes(GET_FEED_BUSY_MSG)) {
						handleError(config.timeline.loadingErroMsg);
					} else {
						handleError("Failure while retrieving timeline data!", err);
						loadStateHandler(false, startedAt);
					}
				});
		},
		[],
	);

	const trigger = useCallback(
		(loadFxn: () => Promise<void>) =>
			triggerLoadFxn(loadFxn, logAndShowError, setLoadState),
		[logAndShowError, setLoadState, triggerLoadFxn],
	);

	const triggerFeedUpdate = useCallback(
		() => algorithm && trigger(() => algorithm.triggerFeedUpdate()),
		[algorithm, trigger],
	);
	const triggerHomeTimelineBackFill = useCallback(
		() => algorithm && trigger(() => algorithm.triggerHomeTimelineBackFill()),
		[algorithm, trigger],
	);
	const triggerFederatedTimelineBackFill = useCallback(
		() =>
			algorithm && trigger(() => algorithm.triggerFederatedTimelineBackFill()),
		[algorithm, trigger],
	);
	const triggerFavouritedTagBackFill = useCallback(
		() =>
			algorithm &&
			trigger(() =>
				algorithm.triggerTagTimelineBackFill(TagTootsCategory.FAVOURITED),
			),
		[algorithm, trigger],
	);
	const triggerParticipatedTagBackFill = useCallback(
		() =>
			algorithm &&
			trigger(() =>
				algorithm.triggerTagTimelineBackFill(TagTootsCategory.PARTICIPATED),
			),
		[algorithm, trigger],
	);
	const triggerMoarData = useCallback(
		() => algorithm && trigger(() => algorithm.triggerMoarData()),
		[algorithm, trigger],
	);
	const triggerPullAllUserData = useCallback(
		() => algorithm && trigger(() => algorithm.triggerPullAllUserData()),
		[algorithm, trigger],
	);

	// Reset all state except for the user and server
	const resetAlgorithm = useCallback(async () => {
		resetErrors();
		if (!algorithm) return;
		setIsLoading(true);
		await algorithm.reset();
		triggerFeedUpdate();
	}, [algorithm, resetErrors, triggerFeedUpdate]);

	const resetSeenState = useCallback(async () => {
		resetErrors();
		if (!algorithm) return;
		await algorithm.resetSeenState();
	}, [algorithm, resetErrors]);

	// Save timeline on page unload to preserve read status
	useEffect(() => {
		if (!algorithm) return;

		const handleBeforeUnload = () => {
			algorithm.saveTimelineToCache().catch((err) => {
				logger.error("Failed to save timeline on unload:", err);
			});
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [algorithm]);

	useEffect(() => {
		if (!user?.id) {
			lastUserIdRef.current = null;
			hasInitializedRef.current = false;
			return;
		}

		if (lastUserIdRef.current !== user.id) {
			lastUserIdRef.current = user.id;
			hasInitializedRef.current = false;
		}
	}, [user?.id]);

	// Initial load of the feed
	useEffect(() => {
		if (algorithm || !user || !api || hasInitializedRef.current) return;
		hasInitializedRef.current = true;

		// Check that we have valid user credentials and load timeline posts, otherwise force a logout.
		const constructFeed = async (): Promise<void> => {
			// Show loading state during initialization
			setIsLoading(true);

			logger.log(
				`constructFeed() called with user ID ${user?.id} (feed has ${timeline.length} posts)`,
			);
			let currentUser: mastodon.v1.Account;

			try {
				currentUser = await api.v1.accounts.verifyCredentials();
			} catch (err) {
				// TODO: are these kind of errors actually recoverable?
				if (
					err.message.includes("NetworkError when attempting to fetch resource")
				) {
					logger.error(
						"NetworkError during verifyCredentials(), going to log out",
						err,
					);
				} else if (isAccessTokenRevokedError(err)) {
					logAndShowError(config.app.accessTokenRevokedMsg, err);
				} else {
					logAndShowError("Failed to verifyCredentials(), logging out...", err);
				}

				setIsLoading(false);
				logout(true);
				return;
			}

			const algo = await TheAlgorithm.create({
				api: api,
				user: currentUser,
				setTimelineInApp: setTimeline,
				locale: navigator?.language,
			});

			if (await algo.isGoToSocialUser()) {
				logger.warn(
					"User is on a GoToSocial instance, skipping call to api.v1.apps.verifyCredentials()...",
				);
			} else {
				// Verify the app crednentials
				api.v1.apps
					.verifyCredentials()
					.then((verifyResponse) => {
						logger.trace(
							"oAuth() api.v1.apps.verifyCredentials() succeeded:",
							verifyResponse,
						);
					})
					.catch((err) => {
						logAndShowError(
							"api.v1.apps.verifyCredentials() failed. It might be OK, if not try logging out & back in.",
							err,
						);
					});
			}

			setAlgorithm(algo);

			// Only trigger initial feed update if we have no cached posts
			// Otherwise, user can manually refresh when ready
			const hasCachedPosts = algo.timeline.length > 0;
			if (!hasCachedPosts) {
				logger.log("No cached posts found, triggering initial feed update...");
				triggerLoadFxn(
					() => algo.triggerFeedUpdate(),
					logAndShowError,
					setLoadState,
				);
			} else {
				logger.log(`Showing ${algo.timeline.length} cached posts`);
				// Initialization complete, stop showing loading indicator
				setIsLoading(false);
			}

			algo
				.serverInfo()
				.then((serverInfo) => {
					logger.trace(
						`User's server info retrieved for "${serverInfo.domain}":`,
						serverInfo,
					);
					setServerInfo(addMimeExtensionsToServer(serverInfo));

					if (serverInfo.sourceUrl?.toLowerCase()?.endsWith("gotosocial")) {
						setIsGoToSocialUser(true);
					}
				})
				.catch((err) => {
					// Not serious enough error to alert the user as we can fallback to our configured defaults
					logger.error("Failed to get server info:", err);
				});
		};

		constructFeed();
	}, [
		algorithm,
		api,
		logAndShowError,
		logout,
		setLoadState,
		timeline.length,
		triggerLoadFxn,
		user,
	]);

	const algoContext: AlgoContext = {
		algorithm,
		alwaysShowFollowed,
		api,
		currentUserWebfinger,
		hideSensitive,
		hideSensitiveCheckbox,
		isGoToSocialUser,
		isLoading,
		lastLoadDurationSeconds,
		resetAlgorithm,
		resetSeenState,
		serverInfo,
		selfTypeFilterMode,
		setSelfTypeFilterMode,
		showFilterHighlights,
		timeline,
		triggerFeedUpdate,
		triggerHomeTimelineBackFill,
		triggerFederatedTimelineBackFill,
		triggerFavouritedTagBackFill,
		triggerParticipatedTagBackFill,
		triggerMoarData,
		triggerPullAllUserData,
	};

	return (
		<AlgorithmContext.Provider value={algoContext}>
			{props.children}
		</AlgorithmContext.Provider>
	);
}
