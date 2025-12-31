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

import TheAlgorithm, {
	GET_FEED_BUSY_MSG,
	AgeIn,
	type Toot,
	isAccessTokenRevokedError,
} from "fedialgo";
import { createRestAPIClient, type mastodon } from "masto";
import { useError } from "../components/helpers/ErrorHandler";

import { persistentCheckbox } from "../components/helpers/Checkbox";
import { GuiCheckboxName, config } from "../config";
import { getLogger } from "../helpers/log_helpers";
import {
	type MastodonServer,
	addMimeExtensionsToServer,
} from "../helpers/mastodon_helpers";
import type { ErrorHandler } from "../types";
import { useAuthContext } from "./useAuth";
import { useLocalStorage } from "./useLocalStorage";

const logger = getLogger("AlgorithmProvider");
const loadLogger = logger.tempLogger("setLoadState");
const FILTERS_STORAGE_KEY = "fefme_user_filters_v1";

type SavedFilters = {
	version: 1;
	boolean: Record<
		string,
		{
			invertSelection?: boolean;
			selectedOptions?: string[];
		}
	>;
	numeric: Record<
		string,
		{
			invertSelection?: boolean;
			value?: number;
		}
	>;
};

interface AlgoContext {
	algorithm?: TheAlgorithm;
	alwaysShowFollowed?: boolean;
	alwaysShowFollowedCheckbox?: ReactElement;
	api?: mastodon.rest.Client;
	currentUserWebfinger?: string | null;
	isGoToSocialUser?: boolean; // Whether the user is on a GoToSocial instance
	isLoading?: boolean;
	hideSensitive?: boolean;
	hideSensitiveCheckbox?: ReactElement;
	lastLoadDurationSeconds?: number;
	resetAlgorithm?: () => Promise<void>;
	serverInfo?: MastodonServer;
	selfTypeFilterEnabled?: boolean;
	setSelfTypeFilterEnabled?: (value: boolean) => void;
	showFilterHighlights?: boolean;
	showFilterHighlightsCheckbox?: ReactElement;
	timeline: Toot[];
	triggerFeedUpdate?: () => void;
	triggerHomeTimelineBackFill?: () => void;
	triggerMoarData?: () => void;
	triggerPullAllUserData?: () => void;
}

const AlgorithmContext = createContext<AlgoContext>({ timeline: [] });
export const useAlgorithm = () => useContext(AlgorithmContext);

/** Manage FediAlgo algorithm state. */
export default function AlgorithmProvider(props: PropsWithChildren) {
	const { logout, user } = useAuthContext();
	const { logAndSetFormattedError, resetErrors } = useError();

	// State variables
	const [algorithm, setAlgorithm] = useState<TheAlgorithm>(null);
	const [isGoToSocialUser, setIsGoToSocialUser] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(true); // TODO: this shouldn't start as true...
	const [lastLoadDurationSeconds, setLastLoadDurationSeconds] = useState<
		number | undefined
	>();
	const [lastLoadStartedAt, setLastLoadStartedAt] = useState<Date>(new Date());
	const [serverInfo, setServerInfo] = useState<MastodonServer>(null); // Instance info for the user's server
	const [timeline, setTimeline] = useState<Toot[]>([]);

	// TODO: this doesn't make any API calls yet, right?
	const api = useMemo(() => {
		if (!user) return null;
		return createRestAPIClient({
			accessToken: user.access_token,
			url: user.server,
		});
	}, [user]);

	// Checkboxes with persistent storage that require somewhat global state
	const [alwaysShowFollowed, alwaysShowFollowedCheckbox] = persistentCheckbox(
		GuiCheckboxName.alwaysShowFollowed,
	);
	const [hideSensitive, hideSensitiveCheckbox] = persistentCheckbox(
		GuiCheckboxName.hideSensitive,
	);
	const [showFilterHighlights, showFilterHighlightsCheckbox] =
		persistentCheckbox(GuiCheckboxName.showFilterHighlights);
	const [selfTypeFilterEnabled, setSelfTypeFilterEnabled] =
		useLocalStorage<boolean>("type-filter-self", false);

	const currentUserWebfinger = useMemo(() => {
		if (!user?.username || !user?.server) return null;
		try {
			const domain = new URL(user.server).hostname;
			return `${user.username}@${domain}`.toLowerCase();
		} catch {
			return null;
		}
	}, [user?.server, user?.username]);

	const loadSavedFilters = useCallback((): SavedFilters | null => {
		try {
			const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as SavedFilters;
			if (parsed?.version !== 1) return null;
			return parsed;
		} catch (error) {
			logger.warn("Failed to load saved filters:", error);
			return null;
		}
	}, []);

	const saveFilters = useCallback((filters: TheAlgorithm["filters"]) => {
		const saved: SavedFilters = {
			version: 1,
			boolean: Object.values(filters.booleanFilters || {}).reduce(
				(acc, filter) => {
					acc[filter.propertyName] = {
						invertSelection: filter.invertSelection,
						selectedOptions: filter.selectedOptions,
					};
					return acc;
				},
				{} as SavedFilters["boolean"],
			),
			numeric: Object.values(filters.numericFilters || {}).reduce(
				(acc, filter) => {
					acc[filter.propertyName] = {
						invertSelection: filter.invertSelection,
						value: filter.value,
					};
					return acc;
				},
				{} as SavedFilters["numeric"],
			),
		};

		localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(saved));
	}, []);

	const applySavedFilters = useCallback(
		(algo: TheAlgorithm, saved: SavedFilters | null) => {
			if (!saved) return;

			for (const [name, state] of Object.entries(saved.boolean)) {
				const filter = algo.filters.booleanFilters[name];
				if (!filter) continue;
				filter.invertSelection = state.invertSelection ?? false;
				filter.selectedOptions = state.selectedOptions ?? [];
			}

			for (const [name, state] of Object.entries(saved.numeric)) {
				const filter = algo.filters.numericFilters[name];
				if (!filter) continue;
				filter.invertSelection = state.invertSelection ?? false;
				filter.value = state.value ?? 0;
			}
		},
		[],
	);

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

	// Wrapper for calls to FediAlgo TheAlgorithm class that can throw a "busy" error
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
		() =>
			algorithm &&
			trigger(async () => {
				await algorithm.triggerFeedUpdate();
				await algorithm.triggerFederatedTimelineMerge();
			}),
		[algorithm, trigger],
	);
	const triggerHomeTimelineBackFill = useCallback(
		() =>
			algorithm &&
			trigger(async () => {
				await algorithm.triggerHomeTimelineBackFill();
				await algorithm.triggerFederatedTimelineMerge();
			}),
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
		applySavedFilters(algorithm, loadSavedFilters());
		algorithm.updateFilters(algorithm.filters);
		triggerFeedUpdate();
	}, [
		algorithm,
		applySavedFilters,
		loadSavedFilters,
		resetErrors,
		triggerFeedUpdate,
	]);

	// Initial load of the feed
	useEffect(() => {
		if (algorithm || !user || !api) return;

		// Check that we have valid user credentials and load timeline posts, otherwise force a logout.
		const constructFeed = async (): Promise<void> => {
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

				logout(true);
				return;
			}

			const algo = await TheAlgorithm.create({
				api: api,
				user: currentUser,
				setTimelineInApp: setTimeline,
				locale: navigator?.language,
			});

			const originalUpdateFilters = algo.updateFilters.bind(algo);
			algo.updateFilters = (filters) => {
				const result = originalUpdateFilters(filters);
				saveFilters(filters);
				return result;
			};

			const savedFilters = loadSavedFilters();
			applySavedFilters(algo, savedFilters);
			algo.updateFilters(algo.filters);

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
			triggerLoadFxn(
				() => algo.triggerFeedUpdate(),
				logAndShowError,
				setLoadState,
			);

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
		applySavedFilters,
		loadSavedFilters,
		logAndShowError,
		logout,
		saveFilters,
		setLoadState,
		timeline.length,
		triggerLoadFxn,
		user,
	]);

	const algoContext: AlgoContext = {
		algorithm,
		alwaysShowFollowed,
		alwaysShowFollowedCheckbox,
		api,
		currentUserWebfinger,
		hideSensitive,
		hideSensitiveCheckbox,
		isGoToSocialUser,
		isLoading,
		lastLoadDurationSeconds,
		resetAlgorithm,
		serverInfo,
		selfTypeFilterEnabled,
		setSelfTypeFilterEnabled,
		showFilterHighlights,
		showFilterHighlightsCheckbox,
		timeline,
		triggerFeedUpdate,
		triggerHomeTimelineBackFill,
		triggerMoarData,
		triggerPullAllUserData,
	};

	return (
		<AlgorithmContext.Provider value={algoContext}>
			{props.children}
		</AlgorithmContext.Provider>
	);
}
