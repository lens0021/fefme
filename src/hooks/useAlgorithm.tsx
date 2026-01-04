/**
 * @fileoverview Context to hold the FeedCoordinator variable
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
import FeedCoordinator, {
	GET_FEED_BUSY_MSG,
	AgeIn,
	type Post,
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
import { AlgorithmStorageKey, TagPostsCategory } from "../core/enums";
import type { FeedFilterSettings, Weights } from "../core/types";
import type { WeightPresetLabel } from "../core/scorer/weight_presets";
import { useAuthContext } from "./useAuth";
import { useLocalStorage } from "./useLocalStorage";
import Storage from "../core/Storage";

const logger = getLogger("AlgorithmProvider");
const loadLogger = logger.tempLogger("setLoadState");

interface AlgoContext {
	algorithm?: FeedCoordinator;
	alwaysShowFollowed?: boolean;
	api?: mastodon.rest.Client;
	currentUserWebfinger?: string | null;
	isGoToSocialUser?: boolean; // Whether the user is on a GoToSocial instance
	hasInitialCache?: boolean;
	hasPendingTimeline?: boolean;
	isRebuildLoading?: boolean;
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
	pendingTimelineReasons?: PendingTimelineReason[];
	timeline: Post[];
	triggerFilterUpdate?: (filters: FeedFilterSettings) => Promise<void>;
	triggerFeedUpdate?: () => void;
	triggerHomeTimelineBackFill?: () => void;
	triggerFederatedTimelineBackFill?: () => void;
	triggerFavouritedTagBackFill?: () => void;
	triggerParticipatedTagBackFill?: () => void;
	triggerMoarData?: () => void;
	triggerPullAllUserData?: () => void;
	triggerWeightUpdate?: (weights: Weights) => Promise<void>;
	triggerWeightPresetUpdate?: (
		preset: WeightPresetLabel | string,
	) => Promise<void>;
}

const AlgorithmContext = createContext<AlgoContext>({ timeline: [] });
export const useAlgorithm = () => useContext(AlgorithmContext);

type PendingTimelineReason = "new-posts" | "filters" | "weights";

/** Manage Fefme algorithm state. */
export default function AlgorithmProvider(props: PropsWithChildren) {
	const { logout, user } = useAuthContext();
	const { logAndSetFormattedError, resetErrors } = useError();

	// State variables
	const [algorithm, setAlgorithm] = useState<FeedCoordinator>(null);
	const [isGoToSocialUser, setIsGoToSocialUser] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [hasInitialCache, setHasInitialCache] = useState<boolean>(false);
	const [hasPendingTimeline, setHasPendingTimeline] = useState<boolean>(false);
	const [isRebuildLoading, setIsRebuildLoading] = useState<boolean>(false);
	const [lastLoadDurationSeconds, setLastLoadDurationSeconds] = useState<
		number | undefined
	>();
	const [lastLoadStartedAt, setLastLoadStartedAt] = useState<Date>(new Date());
	const [serverInfo, setServerInfo] = useState<MastodonServer>(null); // Instance info for the user's server
	const [timeline, setTimeline] = useState<Post[]>([]);
	const hasInitializedRef = React.useRef(false);
	const lastUserIdRef = React.useRef<string | null>(null);
	const pendingTimelineRef = React.useRef<Post[] | null>(null);
	const visibleTimelineRef = React.useRef<Post[]>([]);
	const pendingTimelineReasonsRef = React.useRef<Set<PendingTimelineReason>>(
		new Set(),
	);
	const queuedRebuildRef = React.useRef<{
		reason: PendingTimelineReason;
		run: () => Promise<void>;
	} | null>(null);
	const rebuildInFlightRef = React.useRef(false);
	const [pendingTimelineReasons, setPendingTimelineReasons] = useState<
		PendingTimelineReason[]
	>([]);

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

	// Wrapper for calls to Fefme FeedCoordinator class that can throw a "busy" error
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

	useEffect(() => {
		visibleTimelineRef.current = timeline;
	}, [timeline]);

	const queuePendingTimeline = useCallback((reason?: PendingTimelineReason) => {
		if (!pendingTimelineRef.current) return;
		if (reason === "new-posts") {
			const currentTimeline = visibleTimelineRef.current;
			const currentUris = new Set(currentTimeline.map((post) => post.uri));
			const hasNewPosts = pendingTimelineRef.current.some(
				(post) => !currentUris.has(post.uri),
			);
			if (!hasNewPosts) return;
		}
		if (reason) {
			pendingTimelineReasonsRef.current.add(reason);
		}
		if (pendingTimelineReasonsRef.current.size === 0) {
			pendingTimelineReasonsRef.current.add("new-posts");
		}
		setHasPendingTimeline(true);
		setPendingTimelineReasons(Array.from(pendingTimelineReasonsRef.current));
		Storage.set(AlgorithmStorageKey.VISIBLE_TIMELINE_STALE, 1).catch((err) =>
			logger.error("Failed to persist visible timeline stale flag:", err),
		);
	}, []);

	const triggerWithPending = useCallback(
		(loadFxn: () => Promise<void>, reason?: PendingTimelineReason) => {
			if (!algorithm) return;
			triggerLoadFxn(
				async () => {
					try {
						await loadFxn();
					} finally {
						queuePendingTimeline(reason);
					}
				},
				logAndShowError,
				setLoadState,
			);
		},
		[
			algorithm,
			logAndShowError,
			queuePendingTimeline,
			setLoadState,
			triggerLoadFxn,
		],
	);

	const triggerFeedUpdate = useCallback(
		() => triggerWithPending(() => algorithm.triggerFeedUpdate(), "new-posts"),
		[algorithm, triggerWithPending],
	);
	const triggerHomeTimelineBackFill = useCallback(
		() =>
			triggerWithPending(
				() => algorithm.triggerHomeTimelineBackFill(),
				"new-posts",
			),
		[algorithm, triggerWithPending],
	);
	const triggerFederatedTimelineBackFill = useCallback(
		() =>
			triggerWithPending(
				() => algorithm.triggerFederatedTimelineBackFill(),
				"new-posts",
			),
		[algorithm, triggerWithPending],
	);
	const triggerFavouritedTagBackFill = useCallback(
		() =>
			triggerWithPending(
				() => algorithm.triggerTagTimelineBackFill(TagPostsCategory.FAVOURITED),
				"new-posts",
			),
		[algorithm, triggerWithPending],
	);
	const triggerParticipatedTagBackFill = useCallback(
		() =>
			triggerWithPending(
				() =>
					algorithm.triggerTagTimelineBackFill(TagPostsCategory.PARTICIPATED),
				"new-posts",
			),
		[algorithm, triggerWithPending],
	);
	const triggerMoarData = useCallback(
		() => algorithm && trigger(() => algorithm.triggerMoarData()),
		[algorithm, trigger],
	);
	const triggerPullAllUserData = useCallback(
		() => algorithm && trigger(() => algorithm.triggerPullAllUserData()),
		[algorithm, trigger],
	);

	const setTimelineInApp = useCallback((feed: Post[]) => {
		pendingTimelineRef.current = feed;
		Storage.set(AlgorithmStorageKey.NEXT_VISIBLE_TIMELINE_POSTS, feed).catch(
			(err) =>
				logger.error("Failed to persist next visible timeline cache:", err),
		);
	}, []);

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
			pendingTimelineRef.current = null;
			pendingTimelineReasonsRef.current = new Set();
			setHasInitialCache(false);
			setHasPendingTimeline(false);
			setPendingTimelineReasons([]);
			return;
		}

		if (lastUserIdRef.current !== user.id) {
			lastUserIdRef.current = user.id;
			hasInitializedRef.current = false;
			pendingTimelineRef.current = null;
			pendingTimelineReasonsRef.current = new Set();
			setHasInitialCache(false);
			setHasPendingTimeline(false);
			setPendingTimelineReasons([]);
		}
	}, [user?.id]);

	const runRebuild = useCallback(
		async (reason: PendingTimelineReason, run: () => Promise<void>) => {
			if (!algorithm) return;
			if (rebuildInFlightRef.current) {
				pendingTimelineReasonsRef.current.add(reason);
				queuedRebuildRef.current = { reason, run };
				return;
			}

			rebuildInFlightRef.current = true;
			pendingTimelineReasonsRef.current = new Set([reason]);
			setHasPendingTimeline(false);
			setPendingTimelineReasons([]);
			setIsRebuildLoading(true);

			try {
				await run();
			} catch (err) {
				logAndShowError("Failure while rebuilding the feed!", err as Error);
			} finally {
				setIsRebuildLoading(false);
				rebuildInFlightRef.current = false;
				queuePendingTimeline(reason);

				pendingTimelineReasonsRef.current = new Set();
				const queued = queuedRebuildRef.current;
				queuedRebuildRef.current = null;
				if (queued) {
					runRebuild(queued.reason, queued.run);
				}
			}
		},
		[algorithm, logAndShowError, queuePendingTimeline],
	);

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

			const algo = await FeedCoordinator.create({
				api: api,
				user: currentUser,
				setTimelineInApp,
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

			const cachedTimeline = algo.timeline;
			const hasCachedPosts = cachedTimeline.length > 0;
			setHasInitialCache(hasCachedPosts);

			// Manually display the initial cache if it exists.
			if (hasCachedPosts) {
				logger.log(
					`Displaying ${cachedTimeline.length} cached posts while loading fresh data`,
				);
				setTimeline(cachedTimeline);
				Storage.set(
					AlgorithmStorageKey.VISIBLE_TIMELINE_POSTS,
					cachedTimeline,
				).catch((err) =>
					logger.error("Failed to persist visible timeline cache:", err),
				);
			} else {
				logger.log(
					"No cached posts found, showing loading screen until first load completes",
				);
			}
			const shouldApplyInitialLoadResults = !hasCachedPosts;
			const finalizeInitialLoad = () => {
				if (shouldApplyInitialLoadResults) {
					const pendingTimeline = pendingTimelineRef.current ?? algo.timeline;
					pendingTimelineRef.current = null;
					setTimeline(pendingTimeline);
					setHasPendingTimeline(false);
					pendingTimelineReasonsRef.current = new Set();
					setPendingTimelineReasons([]);
					Storage.set(
						AlgorithmStorageKey.VISIBLE_TIMELINE_POSTS,
						pendingTimeline,
					)
						.then(() =>
							Storage.remove(AlgorithmStorageKey.NEXT_VISIBLE_TIMELINE_POSTS),
						)
						.catch((err) =>
							logger.error("Failed to promote pending timeline cache:", err),
						);
				} else {
					queuePendingTimeline("new-posts");
				}
			};

			triggerLoadFxn(
				async () => {
					try {
						await algo.triggerFeedUpdate();
					} finally {
						finalizeInitialLoad();
					}
				},
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
		logAndShowError,
		logout,
		queuePendingTimeline,
		setLoadState,
		setTimelineInApp,
		timeline.length,
		triggerLoadFxn,
		user,
	]);

	const algoContext: AlgoContext = {
		algorithm,
		alwaysShowFollowed,
		api,
		currentUserWebfinger,
		hasInitialCache,
		hasPendingTimeline,
		hideSensitive,
		hideSensitiveCheckbox,
		isRebuildLoading,
		isGoToSocialUser,
		isLoading,
		lastLoadDurationSeconds,
		pendingTimelineReasons,
		resetAlgorithm,
		resetSeenState,
		serverInfo,
		selfTypeFilterMode,
		setSelfTypeFilterMode,
		showFilterHighlights,
		timeline,
		triggerFilterUpdate: async (filters: FeedFilterSettings) => {
			if (!algorithm) return;
			await runRebuild("filters", async () => {
				algorithm.updateFilters(filters);
			});
		},
		triggerFeedUpdate,
		triggerHomeTimelineBackFill,
		triggerFederatedTimelineBackFill,
		triggerFavouritedTagBackFill,
		triggerParticipatedTagBackFill,
		triggerMoarData,
		triggerPullAllUserData,
		triggerWeightUpdate: async (weights: Weights) => {
			if (!algorithm) return;
			await runRebuild("weights", async () => {
				await algorithm.updateUserWeights(weights);
			});
		},
		triggerWeightPresetUpdate: async (preset: WeightPresetLabel | string) => {
			if (!algorithm) return;
			await runRebuild("weights", async () => {
				await algorithm.updateUserWeightsToPreset(preset);
			});
		},
	};

	return (
		<AlgorithmContext.Provider value={algoContext}>
			{props.children}
		</AlgorithmContext.Provider>
	);
}
