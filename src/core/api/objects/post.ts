/**
 * @fileoverview {@linkcode Post} class and helper methods for dealing with Mastodon
 * {@linkcode https://docs.joinmastodon.org/entities/Status/ Status} objects.
 * Includes methods for scoring, filtering, deduplication, and property repair.
 */
import { capitalCase } from "change-case";
import { Type } from "class-transformer";
import { isEmpty, isFinite } from "lodash";
import type { mastodon } from "masto";
import type { QuoteApproval } from "masto/dist/esm/mastodon/entities/v1/quote-approval.js";

import { config } from "../../config";
import {
	LoadAction,
	MediaCategory,
	type ScoreName,
	TypeFilterName,
} from "../../enums";
import { FILTERABLE_SCORES } from "../../filters/numeric_filter";
import {
	asOptionalArray,
	batchMap,
	filterWithLog,
	groupBy,
	sortObjsByProps,
	split,
	sumArray,
	uniquify,
	uniquifyByProp,
} from "../../helpers/collection_helpers";
import { isProduction } from "../../helpers/environment_helpers";
import {
	FOREIGN_SCRIPTS,
	LANGUAGE_NAMES,
	detectForeignScriptLanguage,
	detectLanguage,
} from "../../helpers/language_helper";
import { Logger } from "../../helpers/logger";
import {
	DEFAULT_FONT_SIZE,
	MEDIA_TYPES,
	VIDEO_TYPES,
	at,
	collapseWhitespace,
	determineMediaCategory,
	extractDomain,
	htmlToParagraphs,
	htmlToText,
	optionalSuffix,
	removeDiacritics,
	removeEmojis,
	removeLinks,
	removeMentions,
	removeTags,
	replaceEmojiShortcodesWithImgTags,
	replaceHttpsLinks,
	wordRegex,
} from "../../helpers/string_helpers";
import {
	AgeIn,
	ageString,
	timelineCutoffAt,
	toISOFormat,
} from "../../helpers/time_helpers";
import Scorer from "../../scorer/scorer";
import type {
	AccountLike,
	FeedFilterSettings,
	Hashtag,
	KeysOfValueType,
	ScoreType,
	TagWithUsageCounts,
	PostLike,
	PostNumberProp,
	TootScore,
	PostSource,
	TrendingLink,
} from "../../types";
import MastoApi from "../api";
import UserData from "../user_data";
import Account from "./account";
import { isValidForSubstringSearch, repairTag } from "./tag";

enum TootCacheKey {
	CONTENT_STRIPPED = "contentStripped",
	CONTENT_WITH_EMOJIS = "contentWithEmojis",
	CONTENT_WITH_CARD = "contentWithCard",
}

// https://docs.joinmastodon.org/entities/Status/#visibility
enum TootVisibility {
	DIRECT_MSG = "direct",
	PUBLIC = "public",
	PRIVATE = "private",
	UNLISTED = "unlisted",
}

// Cache for methods that build strings from the post content.
type TootCacheStrings = { [key in TootCacheKey]?: string };
type TootCache = TootCacheStrings & { tagNames?: Set<string> };

const UNKNOWN = "unknown";
const BSKY_BRIDGY = "bsky.brid.gy";
const HASHTAG_LINK_REGEX =
	/<a href="https:\/\/[\w.]+\/tags\/[\w]+" class="[-\w_ ]*hashtag[-\w_ ]*" rel="[a-z ]+"( target="_blank")?>#<span>[\w]+<\/span><\/a>/i;
const HASHTAG_PARAGRAPH_REGEX = new RegExp(
	`^<p>(?:${HASHTAG_LINK_REGEX.source} ?)+</p>`,
	"i",
);
const PROPS_THAT_CHANGE = FILTERABLE_SCORES.concat("numTimesShown");

const postLogger = new Logger("Post");
const repairLogger = postLogger.tempLogger("repairPost");

/**
 * Extension of mastodon.v1.Status data object with additional properties used by fefme
 * that should be serialized to storage.
 */
export interface SerializableToot extends mastodon.v1.Status {
	completedAt?: string; // Timestamp a full deep inspection of the post was completed
	followedTags?: Hashtag[]; // Array of tags that the user follows that exist in this post
	numTimesShown?: number; // Managed in client app. # of times the Post has been shown to the user.
	reblog?: SerializableToot | null; // The post that was boosted (if any)
	reblogsBy?: AccountLike[]; // The accounts that boosted this post (if any)
	resolvedID?: string; // This Post with URLs resolved to homeserver versions
	score?: number; // The final calculated score of the post
	scoreInfo?: TootScore; // Scoring info for weighting/sorting this post
	sources?: string[]; // Source of the post (e.g. trending tag posts, home timeline, etc.)
	trendingLinks?: TrendingLink[]; // Links that are trending in this post
	trendingRank?: number; // Most trending on a server gets a 10, next is a 9, etc.
	trendingTags?: TagWithUsageCounts[]; // Tags that are trending in this post
	audioAttachments?: mastodon.v1.MediaAttachment[];
	imageAttachments?: mastodon.v1.MediaAttachment[];
	videoAttachments?: mastodon.v1.MediaAttachment[];
	// New fields from masto package updates
	quotesCount: number;
	quoteApproval: QuoteApproval;
}

/**
 * Interface for mastodon.v1.Status object with additional helper methods.
 * @interface
 */
interface PostObj extends SerializableToot {
	// Getters
	accounts: Account[];
	attachmentType: MediaCategory | undefined;
	author: Account;
	contentTagsParagraph: string | undefined;
	description: string;
	isDM: boolean;
	isFollowed: boolean;
	isPrivate: boolean;
	isTrending: boolean;
	popularity: number;
	realToot: Post;
	realURI: string;
	realURL: string;
	score: number;
	withBoost: Post[];
	// Methods
	containsString: (str: string) => boolean;
	containsTag: (tag: TagWithUsageCounts, fullScan?: boolean) => boolean;
	containsTagsMsg: () => string | undefined;
	contentNonTagsParagraphs: (fontSize?: number) => string;
	contentParagraphs: (fontSize?: number) => string[];
	contentShortened: (maxChars?: number) => string;
	contentWithEmojis: (fontSize?: number) => string;
	localServerUrl: () => Promise<string>;
	isInTimeline: (filters: FeedFilterSettings) => boolean;
	isValidForFeed: (
		mutedKeywordRegex: RegExp,
		blockedDomains: Set<string>,
	) => boolean;
	resolve: () => Promise<Post>;
	resolveID: () => Promise<string>;
	tagNames: () => Set<string>;
}

/**
 * Class representing a Mastodon {@linkcode Post} with helper methods for scoring, filtering, and more.
 * Extends the base Mastodon {@linkcode https://docs.joinmastodon.org/entities/Status/ Status} object.
 * Note: the base {@linkcode https://docs.joinmastodon.org/entities/Status/ Status} class's
 * properties are not documented here.
 *
 * @implements {PostObj}
 * @extends {mastodon.v1.Status}
 * @property {Account[]} accounts - Array with the author of the post and (if it exists) the account that boosted it.
 * @property {number} ageInHours - Age of this post in hours.
 * @property {mastodon.v1.CustomEmoji[]} allEmojis - All custom emojis in the post, including the author's.
 * @property {MediaAttachmentType} [attachmentType] - The type of media in the post (image, video, audio, etc.).
 * @property {Account} author - The account that posted this post, not the account that reblogged it.
 * @property {string} [completedAt] - Timestamp when a full deep inspection of the post was last completed.
 * @property {string} [contentTagsParagraph] - If the last paragraph is 100% hashtag this is the HTML for that paragraph.
 * @property {string} description - A string describing the post, including author, content, and createdAt.
 * @property {MastodonTag[]} [followedTags] - Array of tags that the user follows that exist in this post.
 * @property {string} homeserver - The homeserver of the author of the post.
 * @property {boolean} isDM - True if the post is a direct message (DM) to the user.
 * @property {boolean} isFollowed - True if this post is from a followed account or contains a followed tag.
 * @property {boolean} isLocal - True if this post is from the Fefme user's home server.
 * @property {boolean} isPrivate - True if it's for followers only.
 * @property {boolean} isTrending - True if it's a trending post or contains any trending hashtags or links.
 * @property {string} lastEditedAt - The date when the post was last edited, or createdAt if never edited.
 * @property {number} [numTimesShown] - Managed in client app. # of times the Post has been shown to the user.
 * @property {number} popularity - Sum of the trendingRank, numReblogs, replies, and local server favourites. Currently unused.
 * @property {Post} realToot - The post that was reblogged if it's a reblog, otherwise this post.
 * @property {string} realURI - URI for the realToot.
 * @property {string} realURL - Default to this.realURI if url property is empty.
 * @property {SerializableToot | null} [reblog] - The post that was boosted (if any).
 * @property {AccountLike[]} [reblogsBy] - The accounts that boosted this post (if any)
 * @property {string[]} replyMentions - The webfinger URIs of the accounts mentioned in the post + the author prepended with @.
 * @property {string} [resolvedID] - This Post with URLs resolved to homeserver versions
 * @property {number} score - Current overall score for this post.
 * @property {TootScore} [scoreInfo] - Scoring info for weighting/sorting this post
 * @property {string[]} [sources] - Source of the post (e.g. trending tag posts, home timeline, etc.)
 * @property {Date} postedAt - Timestamp of post's createdAt.
 * @property {TrendingLink[]} [trendingLinks] - Links that are trending in this post
 * @property {number} [trendingRank] - Most trending on a server gets a 10, next is a 9, etc.
 * @property {TagWithUsageCounts[]} [trendingTags] - Tags that are trending in this post
 * @property {Post[]} withBoost - Returns the post and the boost, if it exists, as an array.
 * @property {mastodon.v1.MediaAttachment[]} [audioAttachments]
 * @property {mastodon.v1.MediaAttachment[]} [imageAttachments]
 * @property {mastodon.v1.MediaAttachment[]} [videoAttachments]
 */
export default class Post implements PostObj {
	// Props from mastodon.v1.Status
	id!: string;
	uri!: string;
	application!: mastodon.v1.Application;
	@Type(() => Account) account!: Account;
	content!: string;
	createdAt!: string;
	editedAt: string | null = null;
	emojis!: mastodon.v1.CustomEmoji[];
	favouritesCount!: number;
	mediaAttachments!: mastodon.v1.MediaAttachment[];
	mentions!: mastodon.v1.StatusMention[];
	reblogsCount!: number;
	repliesCount!: number;
	sensitive!: boolean;
	spoilerText!: string;
	tags!: TagWithUsageCounts[];
	visibility!: mastodon.v1.StatusVisibility;
	// Optional fields
	bookmarked?: boolean | null;
	card?: mastodon.v1.PreviewCard | null;
	favourited?: boolean | null;
	filtered?: mastodon.v1.FilterResult[];
	language?: string | null;
	inReplyToAccountId?: string | null;
	inReplyToId?: string | null;
	muted?: boolean | null;
	pinned?: boolean | null;
	poll?: mastodon.v1.Poll | null;
	@Type(() => Post) reblog?: Post | null;
	reblogged?: boolean | null;
	text?: string | null;
	url?: string | null;
	quotesCount!: number;
	quoteApproval!: QuoteApproval;

	// extensions to mastodon.v1.Status. Most of these are set in completeProperties()
	completedAt?: string;
	followedTags?: mastodon.v1.Tag[]; // Array of tags that the user follows that exist in this post
	numTimesShown!: number;
	@Type(() => Account) reblogsBy!: Account[]; // The accounts that boosted this post
	resolvedID?: string; // This Post with URLs resolved to homeserver versions
	score = 0; // Current overall score for this post.
	scoreInfo?: TootScore; // Scoring info for weighting/sorting this post
	sources?: string[]; // Source of the post (e.g. trending tag posts, home timeline, etc.)
	trendingLinks?: TrendingLink[]; // Links that are trending in this post
	trendingRank?: number; // Most trending on a server gets a 10, next is a 9, etc.
	trendingTags?: TagWithUsageCounts[]; // Tags that are trending that appear in this post
	audioAttachments!: mastodon.v1.MediaAttachment[];
	imageAttachments!: mastodon.v1.MediaAttachment[];
	videoAttachments!: mastodon.v1.MediaAttachment[];

	// See JSDoc comment for explanations of the various getters
	get accounts(): Account[] {
		return this.withBoost.map((post) => post.account);
	}
	get ageInHours(): number {
		return AgeIn.hours(this.createdAt);
	}
	get allEmojis(): mastodon.v1.CustomEmoji[] {
		return (this.emojis || []).concat(this.account.emojis || []);
	}
	get author(): Account {
		return this.realToot.account;
	}
	get homeserver(): string {
		return this.author.homeserver;
	}
	get isDM(): boolean {
		return this.visibility === TootVisibility.DIRECT_MSG;
	}
	get isFollowed(): boolean {
		return !!(
			this.accounts.some((a) => a.isFollowed) ||
			this.realToot.followedTags?.length
		);
	}
	get isLocal(): boolean {
		return MastoApi.instance.isLocalUrl(this.realURI);
	}
	get isPrivate(): boolean {
		return this.visibility === TootVisibility.PRIVATE;
	}
	get isTrending(): boolean {
		return !!(
			this.trendingRank ||
			this.trendingLinks?.length ||
			this.trendingTags?.length
		);
	}
	get lastEditedAt(): string {
		return this.editedAt || this.createdAt;
	}
	get popularity() {
		return sumArray([
			this.favouritesCount,
			this.reblogsCount,
			this.repliesCount,
			this.trendingRank,
		]);
	}
	get realToot(): Post {
		return this.reblog ?? this;
	}
	get realURI(): string {
		return this.realToot.uri;
	}
	get realURL(): string {
		return this.realToot.url || this.realURI;
	}
	get replyMentions(): string[] {
		return [...this.accounts, ...(this.mentions || [])].map((m) => at(m.acct));
	}
	get postedAt(): Date {
		return new Date(this.createdAt);
	}
	// TODO: should this consider the values in reblogsBy?
	get withBoost(): Post[] {
		return [this, ...asOptionalArray(this.reblog)];
	}

	get attachmentType(): MediaCategory | undefined {
		if (this.imageAttachments.length) {
			return MediaCategory.IMAGE;
		} else if (this.videoAttachments.length) {
			return MediaCategory.VIDEO;
		} else if (this.audioAttachments.length) {
			return MediaCategory.AUDIO;
		}
	}

	// TODO: should this take a fontSize argument like contentParagraphs()?
	get contentTagsParagraph(): string | undefined {
		const finalParagraph = this.contentParagraphs().slice(-1)[0];
		return HASHTAG_PARAGRAPH_REGEX.test(finalParagraph)
			? finalParagraph
			: undefined;
	}

	get description(): string {
		const msg = `${this.account.description} [url="${this.url || this.uri}"`;
		return `${msg}, createdAt="${toISOFormat(this.createdAt)}"]: "${this.contentShortened()}"`;
	}

	// Temporary caches for performance (profiler said contentWithCard() was using a lot of runtime)
	private contentCache: TootCache = {};

	/**
	 * Alternate constructor because {@linkcode https://www.npmjs.com/package/class-transformer class-transformer}
	 * doesn't work with constructor arguments.
	 * @static
	 * @param {SerializableToot} post - The post data to build from.
	 * @returns {Post} The constructed Post instance.
	 */
	static build(post: SerializableToot | Post): Post {
		if (post instanceof Post) {
			// Clear the cache if the post was edited // TODO: Probably not the ideal time to clear the cache
			if (post.editedAt) post.contentCache = {};
			return post;
		}

		const postObj = new Post();
		postObj.id = post.id;
		postObj.uri = post.uri;
		postObj.account = Account.build(post.account);
		postObj.application = post.application;
		postObj.bookmarked = post.bookmarked;
		postObj.card = post.card;
		postObj.content = post.content;
		postObj.createdAt = post.createdAt;
		postObj.editedAt = post.editedAt;
		postObj.emojis = post.emojis;
		postObj.favourited = post.favourited;
		postObj.favouritesCount = post.favouritesCount;
		postObj.filtered = post.filtered;
		postObj.inReplyToAccountId = post.inReplyToAccountId;
		postObj.inReplyToId = post.inReplyToId;
		postObj.language = post.language;
		postObj.mediaAttachments = post.mediaAttachments || [];
		postObj.mentions = post.mentions;
		postObj.muted = post.muted;
		postObj.pinned = post.pinned;
		postObj.poll = post.poll;
		postObj.reblogged = post.reblogged;
		postObj.reblogsCount = post.reblogsCount;
		postObj.repliesCount = post.repliesCount;
		postObj.sensitive = post.sensitive;
		postObj.spoilerText = post.spoilerText;
		postObj.tags = post.tags;
		postObj.text = post.text;
		postObj.url = post.url;
		postObj.visibility = post.visibility;
		postObj.quotesCount = post.quotesCount ?? 0;
		postObj.quoteApproval = post.quoteApproval ?? {
			automatic: [],
			manual: [],
			currentUser: "unknown",
		};

		// Unique to fefme
		postObj.numTimesShown = post.numTimesShown || 0;
		postObj.completedAt = post.completedAt;
		postObj.followedTags = post.followedTags;
		postObj.reblog = post.reblog ? Post.build(post.reblog) : undefined;
		// TODO: the reblogsBy don't necessarily have the isFollowed flag set correctly
		postObj.reblogsBy = (post.reblogsBy ?? []).map((account) =>
			Account.build(account),
		);
		postObj.resolvedID = post.resolvedID;
		postObj.scoreInfo = post.scoreInfo;
		postObj.score = post.score || post.scoreInfo?.score || 0;
		postObj.sources = post.sources;
		postObj.trendingLinks = post.trendingLinks;
		postObj.trendingRank = post.trendingRank;
		postObj.trendingTags = post.trendingTags;

		postObj.repair();
		// These must be set after repair() has a chance to fix any broken media types
		postObj.audioAttachments = postObj.attachmentsOfType(MediaCategory.AUDIO);
		postObj.imageAttachments = postObj.attachmentsOfType(MediaCategory.IMAGE);
		postObj.videoAttachments = VIDEO_TYPES.flatMap((videoType) =>
			postObj.attachmentsOfType(videoType),
		);

		if (postObj.account.suspended) {
			postLogger.warn(`Post from suspended account:`, postObj);
		} else if (postObj.account.limited) {
			postLogger.trace(`Post from limited account:`, postObj);
		}

		return postObj;
	}

	/**
	 * True if post contains {@linkcode pattern} in the tags, the content, or the link preview card description.
	 * @param {string} pattern - The string to search for.
	 * @returns {boolean}
	 */
	containsString(pattern: string): boolean {
		return this.matchesRegex(wordRegex(pattern));
	}

	/**
	 * Return true if the post contains the tag or hashtag. If fullScan is true uses containsString() to search.
	 * @param {TagWithUsageCounts} tag - The tag to search for.
	 * @param {boolean} [fullScan] - Whether to use full scan.
	 * @returns {boolean}
	 */
	containsTag(tag: TagWithUsageCounts, fullScan?: boolean): boolean {
		if (fullScan && isValidForSubstringSearch(tag)) {
			if (!tag.regex) {
				postLogger.warn(`containsTag() called on tag without regex:`, tag);
				tag.regex = wordRegex(tag.name);
			}

			return this.matchesRegex(tag.regex);
		} else {
			try {
				return this.tagNames().has(tag.name);
			} catch (err) {
				postLogger.error(
					`Error in containsTag("${tag.name}"), current cache:`,
					this.contentCache,
					err,
				);
				this.contentCache.tagNames = new Set<string>(
					(this.tags || []).map((tag) => tag.name),
				);
				return this.contentCache.tagNames!.has(tag.name);
			}
		}
	}

	/**
	 * Generate a string describing the followed and trending tags in the post.
	 * TODO: add favourited tags?
	 * @returns {string | undefined}
	 */
	containsTagsMsg(): string | undefined {
		let msgs = [
			this.containsTagsOfTypeMsg(TypeFilterName.FOLLOWED_HASHTAGS),
			this.containsTagsOfTypeMsg(TypeFilterName.TRENDING_TAGS),
		];

		msgs = msgs.filter((msg) => msg);
		return msgs.length ? `Contains ${msgs.join("; ")}` : undefined;
	}

	/**
	 * Returns {@linkcode true} if the fefme user is mentioned in this {@linkcode Post}.
	 * @returns {boolean}
	 */
	containsUserMention(): boolean {
		return this.mentions.some(
			(mention) => mention.acct == MastoApi.instance.user.webfingerURI,
		);
	}

	/**
	 * Return all but the last paragraph if that last paragraph is just hashtag links.
	 * @param {number} [fontSize=DEFAULT_FONT_SIZE] - Size in pixels of any emoji &lt;img&gt; tags. Should match surrounding txt.
	 * @returns {string}
	 */
	contentNonTagsParagraphs(fontSize: number = DEFAULT_FONT_SIZE): string {
		const paragraphs = this.contentParagraphs(fontSize);
		if (this.contentTagsParagraph) paragraphs.pop(); // Remove the last paragraph if it's just hashtags
		return paragraphs.join("\n");
	}

	/**
	 * Break up the content into paragraphs and add &lt;img&gt; tags for custom emojis.
	 * @param {number} [fontSize=DEFAULT_FONT_SIZE] - Size in pixels of any emoji &lt;img&gt; tags. Should match surrounding txt.
	 * @returns {string[]}
	 */
	contentParagraphs(fontSize: number = DEFAULT_FONT_SIZE): string[] {
		return htmlToParagraphs(this.contentWithEmojis(fontSize));
	}

	/**
	 * Shortened string of content property stripped of HTML tags.
	 * @param {number} [maxChars]
	 * @returns {string}
	 */
	contentShortened(maxChars?: number): string {
		maxChars ||= config.posts.maxContentPreviewChars;
		let content = replaceHttpsLinks(this.contentString());

		// Fill in placeholders if content string is empty, truncate it if it's too long
		if (content.length == 0) {
			content = `<${capitalCase(this.attachmentType || "empty")} post by ${this.author.description}>`;
		} else if (content.length > maxChars) {
			content = `${content.slice(0, maxChars)}...`;
		}

		return content;
	}

	/**
	 * Replace custom emoji shortcodes (e.g. ":myemoji:") with image tags.
	 * @param {number} [fontSize=DEFAULT_FONT_SIZE] - Size in pixels of any emoji imgs. Should match surrounding text.
	 * @returns {string}
	 */
	contentWithEmojis(fontSize: number = DEFAULT_FONT_SIZE): string {
		if (!this.contentCache[TootCacheKey.CONTENT_WITH_EMOJIS]) {
			this.contentCache[TootCacheKey.CONTENT_WITH_EMOJIS] =
				this.addEmojiHtmlTags(this.content, fontSize);
		}

		return this.contentCache[TootCacheKey.CONTENT_WITH_EMOJIS];
	}

	/**
	 * Fetch the conversation for this post (Mastodon API calls this a
	 * {@linkcode https://docs.joinmastodon.org/entities/Context/ Context}).
	 * @returns {Promise<Post[]>}
	 */
	async getConversation(): Promise<Post[]> {
		const action = LoadAction.GET_CONVERSATION;
		const logger = postLogger.tempLogger(action);
		logger.debug(`Fetching conversation for post:`, this.description);
		const startTime = new Date();
		const context = await MastoApi.instance.api.v1.statuses
			.$select(await this.resolveID())
			.context.fetch();
		const posts = await Post.buildPosts(
			[...context.ancestors, this, ...context.descendants],
			action,
		);
		logger.trace(
			`Fetched ${posts.length} posts ${ageString(startTime)}`,
			posts.map((t) => t.description),
		);
		return posts;
	}

	/**
	 * Get an individual score for this {@linkcode Post}.
	 * @param {ScoreType} scoreType - The score type.
	 * @param {ScoreName} name - The score name.
	 * @returns {number}
	 */
	getIndividualScore(scoreType: ScoreType, name: ScoreName): number {
		if (isFinite(this.scoreInfo?.scores?.[name]?.[scoreType])) {
			return this.scoreInfo!.scores[name][scoreType];
		} else {
			postLogger.trace(`no score available for ${scoreType}/${name}:`, this);
			return 0;
		}
	}

	/**
	 * Return true if the {@linkcode Post} should not be filtered out of the feed by the current filters.
	 * @param {FeedFilterSettings} filters - The feed filter settings.
	 * @returns {boolean}
	 */
	isInTimeline(filters: FeedFilterSettings): boolean {
		const isOK = Object.values(filters.booleanFilters).every((section) =>
			section.isAllowed(this),
		);
		return (
			isOK &&
			Object.values(filters.numericFilters).every((filter) =>
				filter.isAllowed(this),
			)
		);
	}

	/**
	 * Return false if {@linkcode Post} should be discarded from feed altogether and permanently.
	 * @param {mastodon.v2.Filter[]} serverSideFilters - Server-side filters.
	 * @returns {boolean}
	 */
	isValidForFeed(
		mutedKeywordRegex: RegExp,
		blockedDomains: Set<string>,
	): boolean {
		if (this.reblog?.muted || this.muted) {
			postLogger.trace(
				`Removing post from muted account (${this.author.description}):`,
				this,
			);
			return false;
		} else if (Date.now() < this.postedAt.getTime()) {
			// Sometimes there are wonky statuses that are like years in the future so we filter them out.
			postLogger.warn(`Removing post with future timestamp:`, this);
			return false;
		} else if (this.filtered?.length || this.reblog?.filtered?.length) {
			// The user can configure suppression filters through a Mastodon GUI (webapp or whatever)
			const filterMatches = (this.filtered || []).concat(
				this.reblog?.filtered || [],
			);
			const filterMatchStr = filterMatches[0].keywordMatches?.join(" ");
			postLogger.trace(
				`Removing post matching server filter (${filterMatchStr}): ${this.description}`,
			);
			return false;
		} else if (this.postedAt < timelineCutoffAt()) {
			postLogger.trace(
				`Removing post older than ${timelineCutoffAt()}:`,
				this.postedAt,
			);
			return false;
		} else if (blockedDomains.has(this.author.homeserver)) {
			postLogger.trace(`Removing post from blocked domain:`, this);
			return false;
		} else if (this.matchesRegex(mutedKeywordRegex)) {
			postLogger.trace(`Removing post matching muted keyword regex:`, this);
			return false;
		}

		return true;
	}

	/**
	 * Make an API call to get this {@linkcode Post}'s URL on the Fefme user's home server instead of on
	 * the {@linkcode Post}'s home server.
	 * @example "https://fosstodon.org/@kate/114360290341300577" => "https://mastodon.social/@kate@fosstodon.org/114360290578867339"
	 * @returns {Promise<string>} The home server URL.
	 */
	async localServerUrl(): Promise<string> {
		const homeURL = `${this.account.localServerUrl}/${await this.resolveID()}`;
		postLogger.debug(
			`<homeserverURL()> converted '${this.realURL}' to '${homeURL}'`,
		);
		return homeURL;
	}

	/**
	 * True if {@linkcode Post} matches {@linkcode regex} in the tags, the content, or the link preview card description.
	 * @param {RegExp} regex - The string to search for.
	 * @returns {boolean}
	 */
	matchesRegex(regex: RegExp): boolean {
		return regex.test(this.contentWithCard());
	}

	/**
	 * Get {@linkcode https://docs.joinmastodon.org/entities/Status/ Status} obj for this {@linkcode Post}
	 * from user's home server so the property URLs point to the home server.
	 * @returns {Promise<Post>}
	 */
	async resolve(): Promise<Post> {
		try {
			postLogger.trace(`Resolving local post ID for`, this);
			const resolvedToot = await MastoApi.instance.resolveToot(this);
			this.resolvedID = resolvedToot.id; // Cache the resolved ID for future calls
			return resolvedToot;
		} catch (error) {
			postLogger.error(
				`Error resolving a post:`,
				error,
				`\nThis was the post:`,
				this,
			);
			throw error;
		}
	}

	/**
	 * Get {@linkcode https://docs.joinmastodon.org/entities/Status/ Status} ID for {@linkcode Post} from
	 * user's home server so the property URLs point to the home server.
	 * @returns {Promise<string>}
	 */
	async resolveID(): Promise<string> {
		this.resolvedID ||= (await this.resolve()).id;
		return this.resolvedID;
	}

	/**
	 * Get the {@linkcode Post}'s tags as a {@linkcode Set} of strings. Caches results for future calls.
	 * @returns {Set<string>} Set of the names of the tags in this post.
	 */
	tagNames(): Set<string> {
		// TODO: class-transformer doesn't serialize Sets correctly so we have to check if it's an array
		//       See https://github.com/typestack/class-transformer/issues/54
		if (
			!this.contentCache.tagNames ||
			Array.isArray(this.contentCache.tagNames)
		) {
			this.contentCache.tagNames = new Set(
				(this.tags || []).map((tag) => tag.name),
			);
		}

		return this.contentCache.tagNames;
	}

	//////////////////////////////
	//     Private methods      //
	//////////////////////////////

	/**
	 * Replace custome emoji shortcodes (e.g. ":myemoji:") with image tags in a string.
	 * @private
	 */
	private addEmojiHtmlTags(
		str: string,
		fontSize: number = DEFAULT_FONT_SIZE,
	): string {
		return replaceEmojiShortcodesWithImgTags(str, this.allEmojis, fontSize);
	}

	/**
	 * Return {@linkcode MediaAttachmentType} objects with type == {@linkcode attachmentType}
	 * @private
	 * @param {MediaAttachmentType} attachmentType - The attachment type to filter for.
	 * @returns {mastodon.v1.MediaAttachment[]}
	 */
	private attachmentsOfType(
		attachmentType: mastodon.v1.MediaAttachmentType,
	): mastodon.v1.MediaAttachment[] {
		return this.realToot.mediaAttachments.filter(
			(attachment) => attachment.type == attachmentType,
		);
	}

	/**
	 * Some properties cannot be repaired and/or set until info about the user is available.
	 * Also some properties are very slow - in particular all the tag and trendingLink calcs.
	 * {@linkcode isDeepInspect} argument is used to determine if we should do the slow
	 * calculations or quick ones.
	 * @private
	 * @param {UserData} userData - The user data.
	 * @param {TrendingLink[]} trendingLinks - The trending links.
	 * @param {TagWithUsageCounts[]} trendingTags - The trending tags.
	 * @param {PostSource} [source] - The source of the post (e.g. REFRESH_HOME_TIMELINE).
	 */
	private completeProperties(
		userData: UserData,
		trendingLinks: TrendingLink[],
		trendingTags: TagWithUsageCounts[],
		source?: PostSource,
	): void {
		if (source) {
			this.sources ??= [];

			// REFRESH_MUTED_ACCOUNTS isn't a sources for posts even if it's a reason for invoking this method.
			if (
				source != LoadAction.REFRESH_MUTED_ACCOUNTS &&
				!this.sources.includes(source)
			) {
				this.sources?.push(source);
			}
		}

		const isDeepInspect = !source;
		this.muted ||= this.author.webfingerURI in userData.mutedAccounts;
		this.account.isFollowed ||=
			this.account.webfingerURI in userData.followedAccounts;

		if (this.reblog) {
			this.reblog.account.isFollowed ||=
				this.reblog.account.webfingerURI in userData.followedAccounts;
		}

		// TODO: We handled muted/followed before checking if complete so we can refresh mutes & follows which sucks
		if (this.isComplete()) return;
		const post = this.realToot; // Boosts never have their own tags, etc.

		// With all the containsString() calls it takes ~1.1 seconds to build 40 posts
		// Without them it's ~0.1 seconds. In particular the trendingLinks are slow! maybe 90% of that time.
		post.followedTags = userData.followedTags.filter((tag) =>
			post.containsTag(tag, isDeepInspect),
		).objs;
		post.trendingTags = trendingTags.filter((tag) =>
			post.containsTag(tag, isDeepInspect),
		);

		// Only set the completedAt field if isDeepInspect is true  // TODO: might be fast enough to try this again?
		if (isDeepInspect) {
			post.trendingLinks = trendingLinks.filter((link) =>
				post.matchesRegex(link.regex!),
			);
			this.completedAt = post.completedAt = new Date().toISOString(); // Note the multiple assignmnet!
		} else {
			post.trendingLinks ??= []; // Very slow to calculate so skip it unless isDeepInspect is true
		}
	}

	// Generate a string describing the followed and trending tags in the post
	private containsTagsOfTypeMsg(tagType: TypeFilterName): string | undefined {
		let tags: Hashtag[] = [];

		if (tagType == TypeFilterName.FOLLOWED_HASHTAGS) {
			tags = this.followedTags || [];
		} else if (tagType == TypeFilterName.TRENDING_TAGS) {
			tags = this.trendingTags || [];
		} else {
			postLogger.warn(
				`containsTagsOfTypeMsg() called with invalid tagType: ${tagType}`,
			);
			return;
		}

		if (!tags.length) return;
		const tagTypeStr = capitalCase(tagType).replace(/ Tag/, " Hashtag");
		return `${tagTypeStr}: ${tags.map((t) => `#${t.name}`).join(", ")}`;
	}

	/**
	 * Return the post's 'content' field stripped of HTML tags and emojis.
	 * @private
	 * @returns {string}
	 */
	private contentString(): string {
		return htmlToText(this.realToot.contentWithEmojis());
	}

	/**
	 * Return the post's content + link description stripped of everything (links, mentions, tags, etc.)
	 * Used for inferring the Post's language.
	 * @private
	 * @returns {string}
	 */
	private contentStripped(): string {
		if (!this.contentCache[TootCacheKey.CONTENT_STRIPPED]) {
			const str = removeEmojis(removeTags(removeLinks(this.contentWithCard())));
			this.contentCache[TootCacheKey.CONTENT_STRIPPED] = collapseWhitespace(
				removeMentions(str),
			);
		}

		return this.contentCache[TootCacheKey.CONTENT_STRIPPED];
	}

	/**
	 * Return the content with the card title and description added in parentheses, stripped of diacritics for
	 * matching tags. Returned string is cached for future calls to {@linkcode containsString()} and
	 * {@linkcode containsTag()} etc.
	 * @private
	 * @returns {string}
	 */
	private contentWithCard(): string {
		if (!this.contentCache[TootCacheKey.CONTENT_WITH_CARD]) {
			const cardContent = [this.card?.title || "", this.card?.description || ""]
				.join(" ")
				.trim();
			const suffix = optionalSuffix(cardContent, htmlToText);
			const txt =
				`${this.contentString()} ${this.imageAltText()} ${suffix}`.trim();
			this.contentCache[TootCacheKey.CONTENT_WITH_CARD] = removeDiacritics(txt);
		}

		return this.contentCache[TootCacheKey.CONTENT_WITH_CARD];
	}

	// Figure out an appropriate language for the post based on the content.
	private determineLanguage(): void {
		const text = this.contentStripped();

		// if (this.isUsersOwnToot() || text.length < config.posts.minCharsForLanguageDetect) {
		if (text.length < config.posts.minCharsForLanguageDetect) {
			this.language ??= config.locale.defaultLanguage;
			return;
		}

		const langDetectInfo = detectLanguage(text);
		const { chosenLanguage, langDetector, tinyLD } = langDetectInfo;
		const langLogObj = {
			...langDetectInfo,
			text,
			post: this,
			postLanguage: this.language,
		};
		const logTrace = (msg: string) =>
			repairLogger.trace(`${msg} for "${text}"`, langLogObj);

		// If there's nothing detected log a warning (if text is long enough) and set language to default
		if (
			tinyLD.languageAccuracies.length +
				langDetector.languageAccuracies.length ==
			0
		) {
			// Last ditch effort with detectHashtagLanguage() for foreign scripts
			const foreignScript = detectForeignScriptLanguage(text);

			if (foreignScript) {
				logTrace(
					`Falling back to foreign script "${foreignScript}" as language`,
				);
				this.language = foreignScript;
			} else if (text.length > config.posts.minCharsForLanguageDetect * 2) {
				repairLogger.warn(`no language detected`, langLogObj);
			}

			this.language ??= config.locale.defaultLanguage;
			return;
		}

		// If either language detection matches this.language return
		if (
			this.language &&
			(tinyLD.chosenLang == this.language ||
				langDetector.chosenLang == this.language)
		) {
			return;
		}

		// Or if we have successfully detected a language assign it to this.language and return
		if (chosenLanguage) {
			// Don't overwrite "zh-TW" with "zh"
			if (this.language?.startsWith(chosenLanguage)) {
				return;
			} else if (this.language && this.language != UNKNOWN) {
				logTrace(
					`Using chosenLanguage "${chosenLanguage}" to replace "${this.language}"`,
				);
			}

			this.language = chosenLanguage;
			return;
		}

		if (
			FOREIGN_SCRIPTS.has(tinyLD.chosenLang) &&
			this.language?.startsWith(tinyLD.chosenLang!)
		) {
			logTrace(
				`Using existing foreign lang "${this.language}" even with low accuracy`,
			);
			return;
		}

		// Prioritize English in edge cases with low tinyLD accuracy but "en" either in post or in LangDetector result
		if (
			!tinyLD.isAccurate &&
			langDetector.isAccurate &&
			langDetector.chosenLang == LANGUAGE_NAMES.english
		) {
			logTrace(`Accepting "en" from langDetector.detectedLang`);
			this.language = LANGUAGE_NAMES.english;
			return;
		}

		if (this.language) {
			if (text.length > 2 * config.posts.minCharsForLanguageDetect) {
				logTrace(
					`No guess good enough to override language "${this.language}" for "${text}"`,
				);
			}
		} else {
			logTrace(`Defaulting language prop to "en"`);
			this.language ??= config.locale.defaultLanguage;
		}

		// If this is the user's own post and we have a language set, log it
		// TODO: remove this eventually
		if (
			this.isUsersOwnToot() &&
			this.language != config.locale.defaultLanguage
		) {
			repairLogger.warn(
				`User's own post language set to "${this.language}"`,
				langLogObj,
			);
		}
	}

	/**
	 * @private
	 * @returns {string} Alt text from any included multimedia objects.
	 */
	private imageAltText(): string {
		return this.mediaAttachments
			.map((media) => media.description || "")
			.join(" ");
	}

	/**
	 * Returns true if the {@linkcode Post} needs to be (re-)evaluated for trending tags, links, etc.
	 * @private
	 */
	private isComplete(): boolean {
		if (
			!this.completedAt ||
			this.completedAt < this.lastEditedAt ||
			!this.trendingLinks
		) {
			return false;
		}

		// If we have completed it, check if we need to re-evaluate for newer trending tags, links, etc.
		return (
			// Check if post was completed long enough ago that we might want to re-evaluate it
			AgeIn.minutes(this.completedAt) < config.minTrendingMinutesUntilStale() ||
			// But not posted so long ago that there's little chance of new data
			AgeIn.minutes(this.createdAt) > config.posts.completeAfterMinutes
		);
	}

	/**
	 * Returns true if this post is by the fefme user.
	 * @private
	 */
	private isUsersOwnToot(): boolean {
		return this.accounts.some(
			(account) => account.webfingerURI == MastoApi.instance.user.webfingerURI,
		);
	}

	/**
	 * Repair post properties:
	 *   1. Set {@linkcode Post.application.name} to UNKNOWN if missing
	 *   2. Call {@linkcode Post.determineLanguage} to set the language
	 *   3. Lowercase all tags
	 *   4. Repair {@linkcode mediaAttachment} types if reparable based on URL file extension
	 *   5. Repair {@linkcode https://docs.joinmastodon.org/entities/StatusMention/ StatusMention} objects for users on home server
	 * @private
	 */
	private repair(): void {
		this.application ??= { name: UNKNOWN };
		this.application.name ??= UNKNOWN;
		this.tags.forEach(repairTag); // Repair Tags
		this.determineLanguage(); // Determine language

		if (this.reblog) {
			this.trendingRank ||= this.reblog.trendingRank;
			const reblogsByAccts = this.reblogsBy.map(
				(account) => account.webfingerURI,
			);

			if (!reblogsByAccts.includes(this.account.webfingerURI)) {
				this.reblog.reblogsBy.push(this.account);
				this.reblog.reblogsBy = sortObjsByProps(
					this.reblog.reblogsBy,
					["displayName"],
					true,
					true,
				);
			}
		}

		// Check for weird media types
		this.mediaAttachments.forEach((media) => {
			if (media.type == UNKNOWN) {
				const category = determineMediaCategory(media.remoteUrl);

				if (category) {
					repairLogger.trace(
						`Repaired broken ${category} attachment in post:`,
						this,
					);
					media.type = category;
				} else if (
					this.uri?.includes(BSKY_BRIDGY) &&
					media.previewUrl?.endsWith("/small") &&
					!media.previewRemoteUrl
				) {
					// Special handling for Bluesky bridge images
					repairLogger.debug(
						`Repairing broken bluesky bridge image attachment in post:`,
						this,
					);
					media.type = MediaCategory.IMAGE;
				} else {
					repairLogger.warn(
						`Unknown media type for URL: '${media.remoteUrl}' for post:`,
						this,
					);
				}
			} else if (!MEDIA_TYPES.includes(media.type)) {
				repairLogger.warn(
					`Unknown media of type: '${media.type}' for post:`,
					this,
				);
			}

			if (isEmpty(media?.url)) {
				repairLogger.warn(`Media attachment URL is empty for post:`, this);
			}
		});

		// Repair StatusMention.acct field for users on the home server by appending @serverDomain
		this.mentions.forEach((mention) => {
			if (mention.acct && !mention.acct.includes("@")) {
				mention.acct += at(extractDomain(mention.url));
			}
		});
	}

	////////////////////////////////
	//       Static methods       //
	////////////////////////////////

	/**
	 * Build array of new {@linkcode Post} objects from an array of
	 * {@linkcode https://docs.joinmastodon.org/entities/Status/ Status} objects (or {@linkcode Post}s).
	 * {@linkcode Post}s returned are sorted by score and should have most of their properties set correctly.
	 * @param {PostLike[]} statuses - Array of status objects or Posts.
	 * @param {PostSource} source - The source label for logging.
	 * @returns {Promise<Post[]>}
	 */
	static async buildPosts(
		statuses: PostLike[],
		source: PostSource,
	): Promise<Post[]> {
		if (!statuses.length) return []; // Avoid the data fetching if we don't to build anything
		const logger = postLogger.tempLogger(source, `buildPosts`);
		const startedAt = new Date();

		let posts = await this.completePosts(statuses, logger, source);
		posts = await this.removeInvalidPosts(posts, logger);
		posts = Post.dedupePosts(posts, logger);
		// "Best effort" scoring. Note scorePosts() does not sort 'posts' in place but the return value is sorted.
		const postsSortedByScore = await Scorer.scorePosts(posts, false);

		if (source != LoadAction.GET_CONVERSATION) {
			posts = this.removeUsersOwnPosts(postsSortedByScore, logger);
		}

		logger.trace(`${posts.length} posts built in ${ageString(startedAt)}`);
		return posts;
	}

	/**
	 * Fetch all the data we need to set dependent properties and set them on the posts.
	 * If {@linkcode source} arg is provided we set it as the {@linkcode Post.source} prop and avoid doing an
	 * {@linkcode Post.isDeepInspect} completion.
	 * @param {PostLike[]} posts - Array of posts to complete.
	 * @param {Logger} logger - Logger for logging.
	 * @param {string} [source] - Optional source label.
	 * @returns {Promise<Post[]>}
	 */
	static async completePosts(
		posts: PostLike[],
		logger: Logger,
		source?: PostSource,
	): Promise<Post[]> {
		logger = logger.tempLogger(`completePosts(${source || ""})`);
		const isDeepInspect = !source;
		const startedAt = new Date();

		const userData = await MastoApi.instance.getUserData();
		const trendingTags: TagWithUsageCounts[] = [];
		const trendingLinks: TrendingLink[] = [];
		let completedPosts: PostLike[] = [];
		let incompletePosts = posts;

		// If isDeepInspect separate posts that need completing bc it's slow to rely on isComplete() + batching
		if (isDeepInspect) {
			[completedPosts, incompletePosts] = split(
				posts,
				(t) => t instanceof Post && t.isComplete(),
			);
		}

		const newCompletePosts: Post[] = await batchMap(
			incompletePosts,
			async (postLike: PostLike) => {
				const post = postLike instanceof Post ? postLike : Post.build(postLike);
				post.completeProperties(userData, trendingLinks, trendingTags, source);
				return post as Post;
			},
			{
				batchSize: config.posts.batchCompleteSize,
				logger,
				sleepBetweenMS: isDeepInspect
					? config.posts.batchCompleteSleepBetweenMS
					: 0,
			},
		);

		const msg = `${posts.length} posts ${ageString(startedAt)}`;
		logger.debug(
			`${msg} (${newCompletePosts.length} completed, ${completedPosts.length} skipped)`,
		);
		return newCompletePosts.concat(completedPosts as Post[]);
	}

	/**
	 * Remove dupes by uniquifying on the {@linkcode Post}'s URI.
	 * @param {Post[]} posts - Array of posts.
	 * @param {Logger} [inLogger] - Logger for logging.
	 * @returns {Post[]} Deduped array of posts.
	 */
	static dedupePosts(posts: Post[], inLogger?: Logger): Post[] {
		inLogger ||= postLogger;
		const logger = inLogger.tempLogger("dedupePosts()");
		const postsByURI = groupBy<Post>(posts, (post) => post.realURI);

		// Collect the properties of a single Post from all the instances of the same URI (we can
		// encounter the same Post both in the user's feed as well as in a Trending post list).
		Object.values(postsByURI).forEach((uriPosts) => {
			if (uriPosts.length == 1) return; // If there's only one post, nothing to do

			uriPosts.sort((a, b) => (b.lastEditedAt < a.lastEditedAt ? -1 : 1));
			const lastCompleted = uriPosts.find(
				(post) => !!post.realToot.completedAt,
			);
			const lastScored = uriPosts.find((post) => !!post.scoreInfo); // TODO: this is probably not 100% correct
			const lastTrendingRank = uriPosts.find(
				(post) => !!post.realToot.trendingRank,
			);
			// Deal with array properties that we want to collate
			const uniqFiltered = this.uniqFlatMap<mastodon.v1.FilterResult>(
				uriPosts,
				"filtered",
				(f) => f.filter.id,
			);
			const uniqFollowedTags = this.uniqFlatMap<mastodon.v1.Tag>(
				uriPosts,
				"followedTags",
				(t) => t.name,
			);
			const uniqTrendingLinks = this.uniqFlatMap<TrendingLink>(
				uriPosts,
				"trendingLinks",
				(t) => t.url,
			);
			const uniqTrendingTags = this.uniqFlatMap<TagWithUsageCounts>(
				uriPosts,
				"trendingTags",
				(t) => t.name,
			);
			const uniqSources = this.uniqFlatMap<string>(
				uriPosts,
				"sources",
				(source) => source,
			);
			// Collate multiple boosters if they exist
			let reblogsBy = this.uniqFlatMap<Account>(
				uriPosts,
				"reblogsBy",
				(account) => account.webfingerURI,
			);
			reblogsBy = sortObjsByProps(reblogsBy, ["displayName"], true, true);
			// Collate accounts - reblogs and realToot accounts
			const allAccounts = uriPosts.flatMap((post) => post.accounts);
			// Helper method to collate the isFollowed property for the accounts
			const isFollowed = (uri: string) =>
				allAccounts.some((a) => a.isFollowed && a.webfingerURI == uri);
			const isSuspended = (uri: string) =>
				allAccounts.some((a) => a.suspended && a.webfingerURI == uri);

			// Counts may increase over time w/repeated fetches so we collate the max
			const propsThatChange = PROPS_THAT_CHANGE.reduce(
				(propValues, propName) => {
					propValues[propName] = Math.max(
						...uriPosts.map((t) => t.realToot[propName] || 0),
					);
					return propValues;
				},
				{} as Record<PostNumberProp, number>,
			);

			uriPosts.forEach((post) => {
				// propsThatChange are only set on the realToot
				post.realToot.favouritesCount = propsThatChange.favouritesCount;
				post.realToot.numTimesShown = propsThatChange.numTimesShown;
				post.realToot.reblogsCount = propsThatChange.reblogsCount;
				post.realToot.repliesCount = propsThatChange.repliesCount;
				// Props set on first found
				post.realToot.completedAt ??= lastCompleted?.realToot.completedAt;
				post.realToot.trendingRank ??= lastTrendingRank?.realToot.trendingRank;
				post.scoreInfo ??= lastScored?.scoreInfo; // TODO: this is probably wrong... boost scores could differ but should be corrected
				// Tags + sources + server side filter matches
				post.realToot.followedTags = uniqFollowedTags;
				post.realToot.trendingLinks = uniqTrendingLinks;
				post.realToot.trendingTags = uniqTrendingTags;
				post.filtered = uniqFiltered;
				post.sources = uniqSources;
				// Booleans usually only set on the realToot
				post.realToot.bookmarked = uriPosts.some(
					(post) => post.realToot.bookmarked,
				);
				post.realToot.favourited = uriPosts.some(
					(post) => post.realToot.favourited,
				);
				post.realToot.reblogged = uriPosts.some(
					(post) => post.realToot.reblogged,
				);
				post.muted = uriPosts.some((post) => post.muted || post.realToot.muted); // Liberally set muted on boosts and real posts

				post.accounts.forEach((account) => {
					account.isFollowed ||= isFollowed(account.webfingerURI);
					account.suspended ||= isSuspended(account.webfingerURI);
				});

				// Reblog props
				if (post.reblog) {
					post.reblog.completedAt ??= lastCompleted?.realToot.completedAt;
					post.reblog.filtered = uniqFiltered;
					post.reblog.reblogsBy = reblogsBy;
					post.reblog.sources = uniqSources;
				}
			});
		});

		// Choose the most recent boost from the group of posts with the same realURI value
		const deduped = Object.values(postsByURI).map((posts) => {
			const mostRecent = mostRecentToot(posts)! as Post;

			// Skip logging this in production
			if (!isProduction && uniquify(posts.map((t) => t.uri))!.length > 1) {
				logger.deep(
					`deduped ${posts.length} posts to ${mostRecent.description}:`,
					posts,
				);
			}

			return mostRecent;
		});

		logger.logArrayReduction(posts, deduped, "Post", "duplicate");
		return deduped;
	}

	/**
	 * Get rid of {@linkcode Post}s we never want to see again.
	 * @param {Post[]} posts - Array of posts.
	 * @param {Logger} logger - Logger for logging.
	 * @returns {Promise<Post[]>}
	 */
	static async removeInvalidPosts(
		posts: Post[],
		logger: Logger,
	): Promise<Post[]> {
		let blockedDomains: Set<string> = new Set();
		let mutedKeywordsRegex: RegExp;

		if (MastoApi.instance.userData) {
			blockedDomains = new Set(MastoApi.instance.userData.blockedDomains);
			mutedKeywordsRegex = MastoApi.instance.userData.mutedKeywordsRegex;
		} else {
			blockedDomains = new Set(await MastoApi.instance.getBlockedDomains());
			mutedKeywordsRegex = await UserData.getMutedKeywordsRegex();
		}

		return filterWithLog(
			posts,
			(post) => post.isValidForFeed(mutedKeywordsRegex, blockedDomains),
			logger,
			"invalid",
			"Post",
		);
	}

	/**
	 * Get rid of the user's own {@linkcode Post}s.
	 * @param {Post[]} posts - Array of posts.
	 * @param {Logger} logger - Logger for logging.
	 * @returns {Post[]} Array without user's own posts.
	 */
	static removeUsersOwnPosts(posts: Post[], logger: Logger): Post[] {
		const newPosts = posts.filter((post) => !post.isUsersOwnToot());
		logger.logArrayReduction(posts, newPosts, "Post", "user's own posts");
		return newPosts;
	}

	/**
	 * Filter an array of {@linkcode Post}s down to just the boosts.
	 * @param {Post[]} posts - Array of posts.
	 * @returns {Post[]} Array of boosts.
	 */
	static onlyBoosts(posts: Post[]): Post[] {
		return posts.filter((post) => post.reblog);
	}

	/**
	 * Filter an array of {@linkcode Post}s down to just the replies.
	 * @param {Post[]} posts - Array of posts.
	 * @returns {Post[]} Array of replies.
	 */
	static onlyReplies(posts: Post[]): Post[] {
		return posts.filter((post) => post.inReplyToAccountId);
	}

	/**
	 * Return a new array of a {@linkcode Post} property collected and uniquified from an array of {@linkcode Post}s.
	 * @private
	 * @template T
	 * @param {Post[]} posts - Array of posts.
	 * @param {KeysOfValueType<Post, any[] | undefined>} property - The property to collect.
	 * @param {(elem: T) => string} uniqFxn - Function to get unique key for each element.
	 * @returns {T[]} Array of unique property values.
	 */
	private static uniqFlatMap<T>(
		posts: Post[],
		property: KeysOfValueType<Post, unknown[] | undefined>,
		uniqFxn: (elem: T) => string,
	): T[] {
		const mappedReblogs = posts.flatMap(
			(post) => (post.reblog?.[property] as T[] | undefined) ?? [],
		);
		const mapped = posts
			.flatMap((post) => (post[property] as T[] | undefined) ?? [])
			.concat(mappedReblogs);
		return uniquifyByProp(mapped, uniqFxn);
	}
}

/**
 * Get the Date the {@linkcode Post} was created.
 * @private
 * @param {PostLike} post - The post object.
 * @returns {Date}
 */
export const postedAt = (post: PostLike): Date => new Date(post.createdAt);

/**
 * Get the earliest {@linkcode Post} from a list.
 * @private
 * @param {PostLike[]} posts - List of posts.
 * @returns {PostLike | null}
 */
export const earliestToot = (posts: PostLike[]): PostLike | null =>
	sortByCreatedAt(posts)[0];

/**
 * Get the most recent {@linkcode Post} from a list.
 * @private
 * @param {PostLike[]} posts - List of posts.
 * @returns {PostLike | null}
 */
export const mostRecentToot = (posts: PostLike[]): PostLike | null =>
	sortByCreatedAt(posts).slice(-1)[0];

/**
 * Returns array with oldest {@linkcode Post} first.
 * @private
 * @template T extends PostLike
 * @param {T} posts - List of posts.
 * @returns {T}
 */
export function sortByCreatedAt<T extends PostLike[]>(posts: T): T {
	return posts.toSorted((a, b) => (a.createdAt < b.createdAt ? -1 : 1)) as T;
}

/**
 * Get the Date of the earliest {@linkcode Post} in a list.
 * @private
 * @param {PostLike[]} posts - List of posts.
 * @returns {Date | null}
 */
export const earliestTootedAt = (posts: PostLike[]): Date | null => {
	const earliest = earliestToot(posts);
	return earliest ? postedAt(earliest) : null;
};

/**
 * Get the Date of the most recent {@linkcode Post} in a list.
 * @private
 * @param {PostLike[]} posts - List of posts.
 * @returns {Date | null}
 */
export const mostRecentTootedAt = (posts: PostLike[]): Date | null => {
	const newest = mostRecentToot(posts);
	return newest ? postedAt(newest) : null;
};
