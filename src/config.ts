/*
 * Configuration variables for the application.
 */
import type { CSSProperties } from "react";

import { capitalCase } from "change-case";
import type { mastodon } from "masto";
import FeedCoordinator, {
	FEDIALGO,
	BooleanFilterName,
	ScoreName,
	TagPostsCategory,
	TrendingType,
	TypeFilterName,
	optionalSuffix,
	type FilterOptionDataSource,
} from "./core/index";

import type { TrendingPanelName } from "./components/TrendingSection";
import { formatSourceLabel } from "./helpers/source_labels";
import { nTimes } from "./helpers/string_helpers";
import { SwitchType, THEME, type ThemeConfig } from "./helpers/styles";
import type {
	CheckboxTooltipConfig,
	GuiCheckboxLabel,
	LinkWithTooltipCfg,
} from "./helpers/ui";

// Mastodon OAuth scopes required for this app to work. Details: https://docs.joinmastodon.org/api/oauth-scopes/
const REQUIRED_OAUTH_SCOPES = [
	"read",
	"write:bookmarks",
	"write:favourites",
	"write:follows",
	"write:media",
	"write:mutes",
	"write:statuses", // Required for reposting and voting in polls
];

const HOMEPAGE =
	import.meta.env.VITE_FEDIALGO_HOMEPAGE || "https://lens0021.github.io/fefme";
const HOMEPAGE_URL = (() => {
	try {
		return new URL(HOMEPAGE);
	} catch {
		return null;
	}
})();
const GITHUB_REPO_URL =
	HOMEPAGE_URL && HOMEPAGE_URL.hostname.endsWith(".github.io")
		? `https://github.com/${HOMEPAGE_URL.hostname.replace(".github.io", "")}${HOMEPAGE_URL.pathname.replace(/\/$/, "")}`
		: HOMEPAGE;
const ISSUES_URL = `${GITHUB_REPO_URL.replace(/\/$/, "")}/issues`;

export enum GuiCheckboxName {
	alwaysShowFollowed = "alwaysShowFollowed",
	hideSensitive = "hideSensitive",
	showFilterHighlights = "showFilterHighlights",
	showLinkPreviews = "showLinkPreviews",
}

// Subconfig section type definitions
type CreateAppParams = Parameters<mastodon.rest.v1.AppRepository["create"]>[0];

type AppConfig = {
	readonly accessTokenRevokedMsg: string;
	readonly createAppParams: Readonly<Omit<CreateAppParams, "redirectUris">>;
	readonly defaultServer: string;
	readonly developerMastodonUrl: string;
	readonly headerIconUrl: string;
	readonly issuesUrl: string;
	readonly repoName: string | null;
	readonly repoUrl: string;
};

type FilterTooltipConfigKey =
	| FilterOptionDataSource
	| BooleanFilterName.LANGUAGE
	| TypeFilterName.FOLLOWED_HASHTAGS;

type FilterOptionFormatCfg = {
	readonly formatLabel?: (name: string) => string; // Fxn to transform the option name to a displayed label
	readonly hidden?: boolean; // If true hide this option from the UI
	readonly position: number; // Position of this filter in the filters section, used for ordering
	readonly tooltips?: {
		// Color highlight config for filter options
		readonly [key in FilterTooltipConfigKey]?: Readonly<CheckboxTooltipConfig>;
	};
};

type FilterConfig = {
	readonly boolean: {
		readonly maxLabelLength: number;
		readonly minPostsSlider: {
			readonly idealNumOptions: number;
			readonly minItems: number;
			readonly tooltipHoverDelay: number;
		};
		readonly optionsFormatting: Readonly<
			Record<BooleanFilterName, Readonly<FilterOptionFormatCfg>>
		>;
	};
	readonly headerSwitches: {
		readonly tooltipHoverDelay: number;
		readonly tooltipText: Readonly<Record<SwitchType, string>>;
	};
	readonly numeric: {
		readonly description: string;
		readonly invertSelectionTooltipTxt: string;
		readonly maxValue: number;
		readonly position: number;
		readonly title: string;
	};
};

type LocaleConfig = {
	readonly defaultLocale: string;
};

type StatsConfig = {
	readonly animationDuration: number;
	readonly numPercentiles: number;
};

type TimelineConfig = {
	readonly autoloadOnFocusAfterMinutes: number;
	readonly backgroundPruneIntervalMinutes: number;
	readonly backgroundRefreshIntervalMinutes: number;
	readonly apiErrorsUserMsgSuffix: string;
	readonly defaultLoadingMsg: string;
	readonly defaultNumDisplayedPosts: number;
	readonly dmBackgroundColor: CSSProperties["backgroundColor"];
	readonly guiCheckboxLabels: Record<
		GuiCheckboxName,
		Readonly<GuiCheckboxLabel>
	>;
	readonly loadingErroMsg: string;
	readonly loadPostsButtonLabels: {
		readonly loadNewPosts: Readonly<LinkWithTooltipCfg>;
		readonly loadOldPosts: Readonly<LinkWithTooltipCfg>;
		readonly loadUserDataForAlgorithm: Readonly<LinkWithTooltipCfg>;
	};
	readonly noPostsMsg: string;
	readonly numPostsToLoadOnScroll: number;
	readonly tooltips: {
		readonly accountTooltipDelayMS: number;
		readonly defaultTooltipDelayMS: number;
	};
};

type TootConfig = {
	readonly imageHeight: number;
	readonly maxPreviewCardLength: number;
	readonly scoreDigits: number;
};

type TrendingConfig = {
	readonly maxLengthForMulticolumn: number;
	readonly panels: Readonly<
		Record<TrendingPanelName, Readonly<TrendingPanelCfg>>
	>;
};

type TrendingPanelCfg = {
	readonly description?: string;
	readonly hasCustomStyle?: boolean;
	readonly initialNumShown: number;
	readonly objTypeLabel?: string;
	readonly prependTrending?: boolean;
	readonly title?: string;
};

type WeightsConfig = {
	readonly defaultStepSize: number;
	readonly scalingMultiplier: number;
};

interface ConfigType {
	readonly app: AppConfig;
	readonly filters: FilterConfig;
	readonly locale: LocaleConfig;
	readonly stats: StatsConfig;
	readonly theme: ThemeConfig;
	readonly timeline: TimelineConfig;
	readonly posts: TootConfig;
	readonly trending: TrendingConfig;
	readonly weights: WeightsConfig;
}

// App level config that is not user configurable
const config: Readonly<ConfigType> = {
	app: {
		accessTokenRevokedMsg:
			"Your access token expired. Please log in again to continue using the app.",
		createAppParams: {
			clientName: "Fefme",
			scopes: REQUIRED_OAUTH_SCOPES.join(" "),
			website: HOMEPAGE,
		},
		defaultServer: "mastodon.social",
		developerMastodonUrl: "https://mastodon.social/@cryptadamist",
		headerIconUrl: "/assets/logo.svg",
		issuesUrl: ISSUES_URL,
		repoName: HOMEPAGE_URL ? HOMEPAGE_URL.pathname.split("/").pop() : null,
		repoUrl: GITHUB_REPO_URL,
	},

	filters: {
		boolean: {
			maxLabelLength: 19, // Maximum length of a filter option label
			minPostsSlider: {
				idealNumOptions: 60, // Ideal number of options to show in the minPostsSlider
				minItems: 10, // Minimum number of items to show (used for max value calculation)
				tooltipHoverDelay: 50, // Delay for the minimum posts slider tooltip in milliseconds
			},
			optionsFormatting: {
				// How filter options should be displayed w/what header switches
				[BooleanFilterName.APP]: {
					// App filter is kinda useless (98% of posts don't have the application property)
					hidden: true,
					position: 99,
				},
				[BooleanFilterName.HASHTAG]: {
					position: 2,
					tooltips: {
						[TagPostsCategory.FAVOURITED]: {
							highlight: {
								gradient: {
									endpoints: THEME.favouritedTagGradient,
									textWithSuffix: (s: string, n: number) =>
										`${s} ${nTimes(n)} recently`,
								},
							},
							text: "You favourited this hashtag",
						},
						[TagPostsCategory.TRENDING]: {
							highlight: {
								gradient: {
									endpoints: THEME.trendingTagGradient,
									textWithSuffix: (s: string, n: number) =>
										`${s} (${n} recent post${n > 1 ? "s" : ""})`,
								},
							},
							text: "This hashtag is trending",
						},
						[TypeFilterName.FOLLOWED_HASHTAGS]: {
							highlight: {
								color: THEME.followedTagColor,
							},
							text: "You follow this hashtag",
						},
					},
				},
				[BooleanFilterName.LANGUAGE]: {
					position: 5,
					tooltips: {
						[BooleanFilterName.LANGUAGE]: {
							highlight: {
								gradient: {
									endpoints: THEME.followedUserGradient,
									textWithSuffix: (s: string, n: number) => {
										return s + optionalSuffix(n, `${nTimes(n)} recently`);
									},
								},
							},
							text: "You used this language",
						},
					},
				},
				[BooleanFilterName.SOURCE]: {
					position: 3,
					formatLabel: formatSourceLabel,
				},
				[BooleanFilterName.SERVER]: {
					position: 6,
				},
				[BooleanFilterName.TYPE]: {
					position: 1,
					formatLabel: (name: string) => {
						if (name === "me") return "Me";
						const normalized = name
							.replace("boosts", "reposts")
							.replace("posts", "posts");
						return capitalCase(normalized);
					},
				},
				[BooleanFilterName.USER]: {
					position: 4,
					tooltips: {
						[ScoreName.FAVOURITED_ACCOUNTS]: {
							highlight: {
								gradient: {
									adjustment: {
										adjustPctiles: [0.8, 0.98], // Percentiles for gradient adjustment of participated tags
										minTagsToAdjust: 40, // Minimum number of participated tags to adjust the gradient
									},
									endpoints: THEME.followedUserGradient,
									// TODO: the code currently requires this string start with "and i" which sucks
									textWithSuffix: (_s: string, n: number) =>
										n ? `Interacted ${nTimes(n)} recently` : "",
								},
							},
							text: "You follow this account",
						},
					},
				},
			},
		},
		numeric: {
			description:
				"Filter based on minimum/maximum number of replies, reposts, etc",
			invertSelectionTooltipTxt:
				"Show posts with less than the selected number of interactions instead of more",
			position: 3,
			maxValue: 50, // Maximum value for numeric filters
			title: "Interactions", // Title for numeric filters section
		},
		headerSwitches: {
			tooltipText: {
				[SwitchType.HIGHLIGHTS_ONLY]:
					"Only show the color highlighted options in this panel",
				[SwitchType.INVERT_SELECTION]:
					"Exclude posts matching your selected options instead of including them",
				[SwitchType.SORT_BY_COUNT]:
					"Sort the options in this panel by number of posts instead of alphabetically",
			},
			tooltipHoverDelay: 500, // Delay for header tooltips in milliseconds
		},
	},

	locale: {
		defaultLocale: "en-CA", // Default locale for the application
	},

	stats: {
		animationDuration: 500, // Duration of stats animations in milliseconds
		numPercentiles: 10, // Number of quartiles/quintiles/deciles/etc. to display in stats
	},

	theme: THEME,

	timeline: {
		autoloadOnFocusAfterMinutes: 5, // Autoload new posts if timeline is this old (and feature is enabled)
		backgroundPruneIntervalMinutes: 30, // How often to prune old posts from the cached timeline
		backgroundRefreshIntervalMinutes: 5, // How often to auto-load new posts in the background
		apiErrorsUserMsgSuffix: "warnings while retrieving Mastodon data",
		defaultLoadingMsg: "Loading (first time can take up to a minute or so)", // Message when first loading posts
		defaultNumDisplayedPosts: 20, // Default number of posts displayed in the timeline
		dmBackgroundColor: "var(--color-dm-bg)", // Background color for DMs (theme-aware)

		guiCheckboxLabels: {
			alwaysShowFollowed: {
				defaultValue: true,
				label: "Always Show Followed",
				tooltipText:
					"Always show filter options for followed users and hashtags even if they have below the minimum posts threshold.",
			},
			hideSensitive: {
				defaultValue: true,
				label: "Hide Sensitive Images",
				tooltipText:
					"Hide images marked as sensitive (NSFW etc.) behind a click through.",
			},
			showFilterHighlights: {
				defaultValue: true,
				label: "Color Highlights",
				tooltipText: "Show colored highlighting for notable filter options.",
			},
			showLinkPreviews: {
				defaultValue: true,
				label: "Show Link Previews",
				tooltipText: "Show the full preview card for embedded links.",
			},
		},

		loadPostsButtonLabels: {
			loadNewPosts: {
				label: "(load new posts)",
				tooltipText: "Load posts created since the last time you loaded posts.",
			},
			loadOldPosts: {
				label: "(load old posts)",
				tooltipText:
					"Load more posts but starting from the oldest post in your feed and working backwards",
			},
			loadUserDataForAlgorithm: {
				label: "(load more algorithm data)",
				tooltipText:
					"Use more of your Mastodon activity to refine the algorithm",
			},
		},

		loadingErroMsg: "Currently loading, please wait a moment and try again.", // Error message when busy
		noPostsMsg: "No posts in feed! Maybe check your filter settings?", // Message when no posts are available
		numPostsToLoadOnScroll: 10, // Number of posts to load on scroll to bottom of page
		tooltips: {
			accountTooltipDelayMS: 100, // Delay for account tooltips in milliseconds
			defaultTooltipDelayMS: 800, // Default delay for tooltips in milliseconds;
		},
	},

	posts: {
		imageHeight: 314, // Default height for images in posts
		maxPreviewCardLength: 350, // Maximum length of preview card description
		scoreDigits: 3, // Number of digits to display in the score
	},

	trending: {
		maxLengthForMulticolumn: 55, // Maximum length of a trending object label to use multicolumn layout
		panels: {
			[TagPostsCategory.FAVOURITED]: {
				initialNumShown: 40,
				objTypeLabel: "of your favourite hashtags",
				title: "Hashtags You Often Favourite",
			},
			[TrendingType.SERVERS]: {
				description:
					"The Mastodon servers these trending posts and hashtags came from, sorted by the percentage of that server's monthly active users you follow:",
				initialNumShown: 40, // TODO: unused
				title: "Servers Telling Us What's Trending In The Fediverse",
			},
			[TagPostsCategory.TRENDING]: {
				initialNumShown: 30,
				objTypeLabel: "trending hashtags",
			},
			posts: {
				initialNumShown: 10,
				objTypeLabel: "trending posts",
			},
		},
	},

	weights: {
		defaultStepSize: 0.02, // Default step size for weight sliders
		scalingMultiplier: 1.2, // Multiplier for scaling weight sliders responsively
	},
};

export { config };
