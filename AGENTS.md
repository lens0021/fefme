# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Fefme** (Fediverse timeline for ME) is a client-side algorithmic timeline for Mastodon. It's a fork of fedialgo_demo_app_foryoufeed that implements a multi-factor weighted scoring system to rank and filter Mastodon posts. All computation happens in the browser with zero backend—a privacy-first architecture.

**Demo:** https://lens0021.github.io/fefme/

## Commands

### Development
```bash
npm run dev      # Start dev server (opens http://localhost:3000)
npm run build    # TypeScript + Vite production build → docs/
npm run preview  # Preview production build
npm run tsc      # Type check only (no emit)
npm test         # Run component tests with Vitest
```

### Code Quality
```bash
npm run lint      # Check with Biome
npm run lint:fix  # Auto-fix issues
npm run format    # Format code
```

### Deployment
- Auto-deploys to GitHub Pages on push to `main` via `.github/workflows/deploy.yaml`
- Build output goes to `docs/` directory (not `dist/`)

## Architecture

### Technology Stack
- **Frontend:** React 18.2 + TypeScript, built with Vite 6.0
- **Routing:** React Router DOM 7.5 with HashRouter (for GitHub Pages)
- **Styling:** Tailwind CSS 4.1
- **API Client:** masto 7.3.0 (Mastodon API)
- **Storage:** LocalForage (IndexedDB) + localStorage
- **Testing:** Vitest + Testing Library (component tests)
- **Code Quality:** Biome (replaces ESLint/Prettier)

### Data Flow (Client-Side Only)
```
User Login (OAuth)
  ↓
Mastodon API ← MastoApi singleton (src/core/api/api.ts)
  ↓
IndexedDB Cache ← Storage class (src/core/Storage.ts)
  ↓
FeedCoordinator class (src/core/index.ts)
  ├── Scorers (15+ scoring algorithms)
  ├── Filters (Boolean + Numeric)
  └── Feed Sorting
  ↓
React Context (useCoordinator hook)
  ↓
Feed.tsx → StatusComponent → Rendered Posts
```

### Loading Behavior (Blue/Green)
- The visible timeline cache (blue) is intentionally stable for a session; seen markers update per post without reshuffling the list.
- Background refreshes populate a next cache (green). The UI switches to it only on an explicit refresh (bubble click or page reload).
- Cache promotion is handled in `src/core/coordinator/cache.ts` using `VISIBLE_TIMELINE_POSTS`, `NEXT_VISIBLE_TIMELINE_POSTS`, and `VISIBLE_TIMELINE_STALE`.

### Core Directory Structure

```
/src
├── core/                    # THE HEART OF THE APP
│   ├── index.ts            # FeedCoordinator class (orchestrator)
│   ├── coordinator/        # Internal feed coordinator modules (state, cache, scoring, feed, etc.)
│   ├── api/                # Mastodon API wrappers, data fetching
│   ├── scorer/             # 15+ scoring algorithms
│   ├── filters/            # Boolean & numeric filtering logic
│   ├── Storage.ts          # IndexedDB persistence layer
│   ├── config.ts           # Non-user-configurable settings
│   ├── enums.ts            # Centralized enums & constants
│   └── types.ts            # TypeScript type definitions
├── components/
│   ├── algorithm/          # Weight sliders, filters, scoring UI
│   ├── status/             # Post display components
│   └── helpers/            # Reusable UI components
├── pages/
│   ├── Feed.tsx            # Main feed display (core UI)
│   ├── LoginPage.tsx       # OAuth login flow
│   └── CallbackPage.tsx    # OAuth callback handler
├── hooks/                  # React Context + custom hooks
│   ├── useCoordinator.tsx    # Algorithm state management
│   ├── useAuth.tsx         # OAuth authentication
│   └── useLocalStorage.tsx # Browser storage hooks
└── config.ts               # User-facing configuration
```

### Component Roles
- **Algorithm Orchestrator:** `src/core/index.ts` (FeedCoordinator public API and coordination)
- **Coordinator State:** `src/core/coordinator/state.ts` (timeline, weights, scorers, loading state)
- **Scoring Engine:** `src/core/coordinator/scoring.ts`, `src/core/coordinator/scorers.ts`, `src/core/scorer/` (score + sort)
- **Filter Engine:** `src/core/coordinator/filters.ts`, `src/core/filters/` (boolean/numeric filters)
- **Timeline IO + Merge:** `src/core/coordinator/feed.ts` (merge, reconcile, finalize timeline)
- **Data Loaders:** `src/core/coordinator/loaders.ts`, `src/core/api/` (API fetch + conversion)
- **Cache Manager:** `src/core/coordinator/cache.ts`, `src/core/Storage.ts` (persist timeline/state)
- **Background Pollers:** `src/core/coordinator/background.ts` (periodic refresh)
- **Stats/Telemetry:** `src/core/coordinator/stats.ts`, `src/core/coordinator/feed_stats.ts`, `src/core/coordinator/source_stats.ts` (data summaries for logging/UI)
- **UI Composition:** `src/pages/Feed.tsx`, `src/components/**` (render + interactions)

### The Scoring System

The app implements a **multi-factor weighted scoring** pipeline:

```
Raw Posts → Individual Scorers → Weighted Scores → Time Decay → Diversity Penalty → Final Sorted Feed
```

**15+ Scoring Factors** (all in `/src/core/scorer/post/`):
- **Social Graph:** FollowedAccountsScorer, FollowersScorer, InteractionsScorer
- **Engagement:** NumFavourites, NumReplies, NumBoosts, MentionsFollowedScorer
- **Trending:** TrendingPostsScorer, TrendingTagsScorer
- **User Preferences:** FavouritedAccountsScorer, FollowedTagsScorer, ParticipatedTags
- **Content Type:** ImageAttachmentScorer, VideoAttachmentScorer
- **Novelty:** AlreadyShownScorer (penalizes seen posts)
- **Randomness:** ChaosScorer (controlled randomness)
- **Diversity:** DiversityFeedScorer (prevents topic clustering)

Each scorer extends the `Scorer` base class:
```typescript
class XyzScorer extends Scorer {
  async _score(post: Post): Promise<number>  // Return 0-1 normalized score
}
```

### State Management

Uses **React Context + Custom Hooks** (no Redux):
- **AuthProvider** (`useAuth`) - OAuth state, credentials, logout
- **CoordinatorProvider** (`useCoordinator`) - Algorithm instance, timeline, filters, loading
- **ErrorHandler** (`useError`) - Centralized error boundary
- **LocalStorage hooks** - Persistent settings

### Storage Strategy (Dual-Layer)

**IndexedDB (via localForage):**
- Cached posts (home timeline, trending, tags)
- User data (followers, followed accounts, favorites)
- Algorithm weights and filters
- Instance info, trending data

**localStorage:**
- OAuth tokens and server URLs
- User identity
- UI preferences (show previews, hide sensitive)

**Privacy:** All data stored client-side only. Zero backend.

### OAuth Flow (GitHub Pages Workaround)

GitHub Pages only supports GET params. OAuth uses query strings without hashes, so App.tsx includes:
```typescript
// Redirects: /?code=xyz → /#/callback?code=xyz
if (window.location.href.includes("?code=")) {
  const newUrl = window.location.href.replace(/\/(\?code=.*)/, "/#/callback$1");
  window.location.href = newUrl;
}
```

### API Integration

**MastoApi singleton** (`src/core/api/api.ts`):
- Wraps masto.js client
- Implements caching, pagination, rate limiting
- Uses async-mutex for concurrency control
- Supports "backfill" mode (load older posts by maxId)
- Converts mastodon.v1.Status → Toot objects (class-transformer)

### Key Design Decisions

**Privacy-First:** All computation in browser, no server-side tracking, OAuth tokens never sent to third parties.

**Build Output to `docs/`:** GitHub Pages serves from `docs/` instead of typical `dist/` (configured in vite.config.ts).

**HashRouter:** Uses `/#/page` URLs for client-side routing without server config.

**Class-Transformer for Data Models:** Mastodon API responses transformed into class instances (Toot, Account) using decorators. Requires `experimentalDecorators: true` in tsconfig.json.

**AI-Generated Code:** Much of the codebase written by AI agents (acknowledged in README). Focus on rapid iteration.

**Strict Mode OFF:** TypeScript strict mode disabled (loose type checking).

## Working with the Algorithm

### FeedCoordinator Class (`/src/core/index.ts`)

Main entry points:
- `triggerFeedUpdate()` - Fetch new posts since last update
- `triggerMoarData()` - Pull extra user data for scoring
- `triggerTimelineBackfill()` - Fetch older posts
- `scoreAndSortFeed()` - Re-score and sort timeline

### Adding a New Scorer

1. Create file in `/src/core/scorer/post/`
2. Extend `Scorer` base class
3. Implement `_score(post: Post): Promise<number>`
4. Add scorer name to `ScoreName` enum in `/src/core/enums.ts`
5. Register in `FeedCoordinator` constructor
6. Add weight slider config in `/src/config.ts`

### Adding a New Filter

1. Add to `BooleanFilterName` enum or `PostNumberProp` in `/src/core/enums.ts`
2. Update filter creation in `/src/core/filters/feed_filters.ts`
3. Add UI in `/src/components/coordinator/filters/`
4. Configure display in `/src/config.ts`

## Environment Variables

Create `.env.development.local` or `.env.production.local`:
```
FEDIALGO_DEBUG=true          # Verbose console logging
FEDIALGO_DEEP_DEBUG=false    # Extra verbose logging
QUICK_MODE=true              # Skip some data for faster dev
LOAD_TEST=false              # Load testing mode
```

## Development Notes

### Biome Configuration
- Tabs for indentation
- Double quotes for strings
- Ignores `src/default.css`

### TypeScript Configuration
- **Decorators enabled** (required for class-transformer)
- **Strict mode OFF**
- **No emit** (Vite handles compilation)

### Key Files to Understand First
1. `src/App.tsx` - Entry point, routing, providers
2. `src/pages/Feed.tsx` - Main feed UI
3. `src/core/index.ts` - FeedCoordinator class
4. `src/hooks/useCoordinator.tsx` - Algorithm state management
5. `src/core/api/api.ts` - API wrapper
6. `src/core/Storage.ts` - Persistence layer

### Common Gotchas
- **Buffer polyfill required:** App.tsx imports buffer for class-transformer
- **HashRouter quirk:** All routes prefixed with `/#/`
- **OAuth redirect:** Custom handling in App.tsx for GitHub Pages
- **Service Worker:** Registered in App.tsx for offline support
- **Mutex/Concurrency:** Uses async-mutex to prevent race conditions in API calls and scoring

### Performance Considerations
- IndexedDB can store thousands of posts (grows large)
- Scoring is CPU-intensive (batched, uses mutex)
- Initial load can take 30+ seconds (fetches lots of data)
- No virtual scrolling (all visible posts rendered)
- Feed.tsx manages displayed post count (incremental loading on scroll)

### Storage Keys

Defined in `/src/core/enums.ts`:
- `CacheKey` - API data (home timeline, favorites, followers)
- `CoordinatorStorageKey` - App state (weights, filters, timeline)
- `FediverseCacheKey` - Fediverse-wide trending data

### Timeline Cache Behavior
- `VisibleTimelinePosts` is the filtered timeline used for fast initial render.
- `NextVisibleTimelinePosts` stores the next filtered timeline after background updates.
- `VisibleTimelineStale` marks the visible timeline as stale when new posts are queued.
- On page load, `loadCachedData()` promotes `NextVisibleTimelinePosts` to `VisibleTimelinePosts` only if `VisibleTimelineStale` is set (or missing) and then clears the stale flag.

## TODO
- Decide whether to rename `CoordinatorProvider`/`useCoordinator` to match `FeedCoordinator` for naming consistency.
- Further split large algorithm modules (e.g., `src/core/coordinator/feed.ts`, `src/core/coordinator/state.ts`) into smaller role-focused units.
- Align code boundaries with the Component Roles list (enforce module responsibilities and remove cross-role coupling).

### Review files

Review the following files, and add TODO items for it.

- biome.json
  - ~~Consider customizing linter rules beyond "recommended": true for project-specific needs~~
  - [ ] Evaluate if additional files should be ignored beyond src/default.css
- e2e/seen-refresh.spec.ts
  - [ ] Extract API route mocking logic into shared helper functions to reduce duplication across all 3 tests
  - [ ] Move makeAccount, makeStatus, makeStatuses test helpers to separate fixture file (e.g., e2e/fixtures/mockData.ts)
  - [ ] Extract hardcoded timeout values (20_000, 1500, etc.) to named constants for maintainability
  - [ ] Consider extracting common test setup (user initialization, page.addInitScript) into beforeEach hook
  - [ ] Refactor instanceInfo object to shared fixture
- index.html
  - [ ] Add meta description tag for SEO
  - [ ] Consider adding Open Graph meta tags for social sharing
  - [ ] Add theme-color meta tag for better PWA integration
  - [ ] Consider adding noscript tag with message for users without JavaScript
- src/App.tsx
  - [x] Verify if Buffer polyfill is actually required for class-transformer (line 1 comment says "maybe???") - Not required, removed
  - [x] Remove or update misleading Bootstrap CDN comment (line 6) - index.html doesn't have Bootstrap CDN
  - [x] Move OAuth redirect logic (lines 38-47) into useEffect to avoid side effects during render
  - [x] Move Service Worker registration (lines 49-58) into useEffect hook
  - [x] Add success logging for Service Worker registration
  - [ ] Consider showing 404 message briefly before redirecting in NotFoundPage instead of immediate redirect
  - [x] Review Footer placement outside CoordinatorProvider - verify if intentional (line 88) - Intentional: Footer should be visible even when not authenticated
  - [x] Consider extracting NotFoundPage to separate file in src/pages/ - Extracted to src/pages/NotFoundPage.tsx
  - [x] Document or simplify useEffect dependency array in NotFoundPage (navigate is stable but could add comment)
  - [x] Review mixing of inline styles (CSS variables) with Tailwind classes for consistency - Intentional: CSS variables needed for theming
- lefthook.yml
  - [ ] Consider adding glob patterns to run hooks only on relevant file changes (e.g., skip tsc for markdown-only changes)
- package.json
  - [ ] Consider upgrading React from 18.2 to 18.3 (latest stable)
  - [x] Verify if "private": false is intentional - package doesn't seem meant for npm publishing
  - [ ] Replace lodash with lodash-es or individual imports to reduce bundle size
  - [x] Remove or document browserslist config - Vite doesn't use it without @vitejs/plugin-legacy
- playwright.config.ts
  - [ ] Fix port mismatch: webServer uses "npm run dev" but specifies port 4173 (preview port) - should use dev port 3000 or use "npm run preview"
  - [ ] Add workers configuration for parallel test execution control
  - [ ] Add retries configuration for handling flaky tests
  - ~~Consider adding reporter configuration for better test output~~
- public/manifest.json
  - ~~Add multiple icon sizes (192x192, 512x512 PNG) in addition to SVG for better PWA support~~
  - ~~Add "description" field for app stores and browsers~~
  - ~~Consider adding "screenshots" field for Progressive Web App installation~~
  - [ ] Verify theme_color matches actual app theme
- [x] src/components/ApiErrorsPanel.tsx
- [x] src/components/coordinator/BooleanFilterAccordionSection.tsx
- [x] src/components/coordinator/FeedFiltersAccordionSection.tsx - Optimized to use Object.entries() for better performance
- src/components/coordinator/filters/FilterCheckboxGrid.tsx
  - [ ] Address existing TODO: "maybe rename this BooleanFilterCheckboxGrid?" (line 122)
  - [ ] Consider splitting this 403-line component into smaller, focused components
  - [ ] Extract getGradientTooltip and findTooltip functions to separate utility file
  - [ ] Convert optionGrid from IIFE to useMemo for better React optimization
  - [ ] Consider extracting gradient calculation logic to separate module
- [x] src/components/coordinator/filters/HeaderSwitch.tsx
- [x] src/components/coordinator/filters/NumericFilters.tsx
- [ ] src/components/coordinator/filters/__tests__/FilterCheckboxGrid.test.tsx
- [ ] src/components/coordinator/filters/__tests__/NumericFilters.test.tsx
- [ ] src/components/coordinator/Slider.tsx
- [ ] src/components/coordinator/WeightSetter.tsx
- [ ] src/components/coordinator/WeightSlider.tsx
- [ ] src/components/experimental/ExperimentalFeatures.tsx
- [ ] src/components/Footer.tsx
- [ ] src/components/Header.tsx
- [ ] src/components/helpers/Accordion.tsx
- [ ] src/components/helpers/Checkbox.tsx
- [ ] src/components/helpers/Confirmation.tsx
- [ ] src/components/helpers/ErrorHandler.tsx
- [ ] src/components/helpers/LabeledDropdownButton.tsx
- [ ] src/components/helpers/NewTabLink.tsx
- [ ] src/components/ProtectedRoute.tsx
- [ ] src/components/status/ActionButton.tsx
- [ ] src/components/status/AttachmentsModal.tsx
- [ ] src/components/status/MultimediaNode.tsx
- [ ] src/components/status/Poll.tsx
- [ ] src/components/status/PreviewCard.tsx
- [ ] src/components/status/Status.tsx
- [ ] src/components/status/__tests__/StatusSeenDuringBackgroundLoad.test.tsx
- [ ] src/components/TrendingSection.tsx
- [ ] src/config.ts
- [ ] src/core/api/api.ts
- [ ] src/core/api/counted_list.ts
- [ ] src/core/api/errors.ts
- [ ] src/core/api/mastodon_server.ts
- [ ] src/core/api/objects/account.ts
- [ ] src/core/api/objects/filter.ts
- [ ] src/core/api/objects/post.ts
- [ ] src/core/api/objects/tag.ts
- [ ] src/core/api/objects/trending_with_history.ts
- [ ] src/core/api/tag_list.ts
- [ ] src/core/api/tags_for_fetching_posts.ts
- [ ] src/core/api/user_data_poller.ts
- [ ] src/core/api/user_data.ts
- [ ] src/core/config.ts
- [ ] src/core/coordinator/actions.ts
- [ ] src/core/coordinator/background.ts
  - [x] Consider adding stopBackgroundPollers() function to properly cleanup intervals
  - [ ] When cacheUpdater already exists, consider whether to restart it or keep the existing one (currently just logs and ignores)
  - [ ] File only contains one 12-line function - consider merging into another module or expanding with related background task management
- [ ] src/core/coordinator/cache.ts
  - [ ] loadCachedData() has too many responsibilities - split into promotePendingTimeline(), shouldUseVisibleCache()
  - [x] Add comment explaining visibleTimelineStaleValue === null condition (line 34-36) or use clearer variable like isFirstLoad
  - [x] Add comment explaining edge case: STALE flag exists but NEXT is empty (line 45-47)
  - [x] Extract hasSeenExclude logic to helper function isSeenFilterExcluded(filters) - 4-level optional chaining is fragile (line 71-74)
  - [x] Consider moving truncate logic (line 55-68) to separate function or different location
  - [ ] Move resetSeenState() to separate module (seen_state.ts) - doesn't belong in cache.ts
  - [ ] Extract resetPost inline function to Post class method (post.resetSeenState())
  - [x] Simplify verbose log message (line 124-126) using template literals
  - [ ] Unify error handling strategy across cache functions (saveTimelineToCache catches but doesn't throw, resetSeenState has no try-catch)
- [ ] src/core/coordinator/constants.ts
- [ ] src/core/coordinator/feed_stats.ts
- [ ] src/core/coordinator/feed.ts
  - [ ] Remove hardcoded CacheKey.HOME_TIMELINE_POSTS from log message (line 30) - function handles multiple sources
  - [ ] Add comment or extract shouldUpdateFilters() helper to clarify complex filter update condition (line 83-93)
  - [ ] Add comment explaining why loadingStatus update is skipped for TIMELINE_BACKFILL (line 96-99)
  - [ ] Split finishFeedUpdate() into smaller functions: finalizeTimeline(), cleanupLoadingState() - too many responsibilities (line 106-133)
- [ ] src/core/coordinator/filters.ts
  - [ ] filterFeedAndSetInApp() has multiple responsibilities: filtering + defer handling + first-post telemetry
  - [ ] Consider extracting hasProvidedAnyPostsToClient flag management to separate concern
  - [x] updateFilters() calls Storage.setFilters without await - Promise is ignored, may cause race conditions
- [ ] src/core/coordinator/loaders.ts
- [ ] src/core/coordinator/loggers.ts
- [ ] src/core/coordinator/scorers.ts
- [ ] src/core/coordinator/scoring.ts
  - [ ] scoreAndFilterFeed() does 4 things: scoring + truncate + storage + filtering - consider splitting responsibilities
  - [x] Duplicate truncate logic with cache.ts - consolidate into single location
  - [ ] Function name "scoreAndFilter" doesn't indicate it also saves to storage - rename or split
- [ ] src/core/coordinator/source_stats.ts
- [ ] src/core/coordinator/state.ts
  - [ ] Review completed - minimal improvements needed, class structure is clean
- [ ] src/core/coordinator/stats.ts
- [ ] src/core/coordinator/__tests__/cache.test.ts
- [ ] src/core/enums.ts
- [ ] src/core/filters/boolean_filter.ts
- [ ] src/core/filters/feed_filters.ts
- [ ] src/core/filters/numeric_filter.ts
- [ ] src/core/filters/post_filter.ts
- [ ] src/core/filters/__tests__/SeenFilter.test.ts
- [ ] src/core/helpers/collection_helpers.ts
- [ ] src/core/helpers/environment_helpers.ts
- [ ] src/core/helpers/language_helper.ts
- [ ] src/core/helpers/logger.ts
- [ ] src/core/helpers/math_helper.ts
- [ ] src/core/helpers/mutex_helpers.ts
- [ ] src/core/helpers/string_helpers.ts
- [ ] src/core/helpers/suppressed_hashtags.ts
- [ ] src/core/helpers/time_helpers.ts
- [ ] src/core/index.ts
- [ ] src/core/scorer/feed/diversity_feed_scorer.ts
- [ ] src/core/scorer/feed_scorer.ts
- [ ] src/core/scorer/post/acccount_scorer.ts
- [ ] src/core/scorer/post/already_shown_scorer.ts
- [ ] src/core/scorer/post/author_followers_scorer.ts
- [ ] src/core/scorer/post/boosts_in_feed_scorer.ts
- [ ] src/core/scorer/post/chaos_scorer.ts
- [ ] src/core/scorer/post/followed_accounts_scorer.ts
- [ ] src/core/scorer/post/followed_tags_scorer.ts
- [ ] src/core/scorer/post/followers_scorer.ts
- [ ] src/core/scorer/post/interactions_scorer.ts
- [ ] src/core/scorer/post/mentions_followed_scorer.ts
- [ ] src/core/scorer/post/most_boosted_accounts_scorer.ts
- [ ] src/core/scorer/post/most_favourited_accounts_scorer.ts
- [ ] src/core/scorer/post/most_replied_accounts_scorer.ts
- [ ] src/core/scorer/post/property_scorer_factory.ts
- [ ] src/core/scorer/post_scorer.ts
- [ ] src/core/scorer/post/tag_scorer_factory.ts
- [ ] src/core/scorer/post/trending_tags_scorer.ts
- [ ] src/core/scorer/scorer_cache.ts
- [ ] src/core/scorer/scorer.ts
- [ ] src/core/scorer/weight_presets.ts
- [ ] src/core/Storage.ts
- [ ] src/core/types.ts
- [ ] src/helpers/async_helpers.ts
- [ ] src/helpers/log_helpers.ts
- [ ] src/helpers/mastodon_helpers.ts
- [ ] src/helpers/min_posts.ts
- [ ] src/helpers/navigation.ts
- [ ] src/helpers/number_helpers.ts
- [ ] src/helpers/source_labels.ts
- [ ] src/helpers/string_helpers.ts
- [ ] src/helpers/styles/index.ts
- [ ] src/helpers/styles/theme.ts
- [ ] src/helpers/ui.tsx
- [ ] src/hooks/useAuth.tsx
- [ ] src/hooks/useCoordinator.tsx
  - [ ] File is too large (724 lines) - consider splitting into multiple hooks (useTimeline, useBackgroundSync, usePendingTimeline)
  - [ ] Initial load useEffect (512-667) is 156 lines - extract constructFeed and finalizeInitialLoad as separate functions outside useEffect
  - [x] scheduleSeenRefresh: unclear why setSeenRefreshTick is needed when refreshFilteredTimeline already updates state
  - [x] queuePendingTimeline: complex logic with new-post detection - add comments explaining the flow
  - [x] runRebuild: complex queuing logic - add comments explaining rebuildInFlightRef and queuedRebuildRef
  - [ ] Background refresh useEffect (460-484): extract runBackgroundRefresh as separate function
  - [ ] Too many refs (7) - evaluate if some can be converted to state or removed
  - [ ] Consider extracting pending timeline promotion logic to a custom hook
- [ ] src/hooks/useLocalStorage.tsx
- [ ] src/hooks/useOnScreen.tsx
- [ ] src/hooks/useTheme.ts
- [ ] src/index.css
- [ ] src/index.tsx
- [ ] src/pages/CallbackPage.tsx
- [ ] src/pages/Feed.tsx ⭐
- [ ] src/pages/LoginPage.tsx
- [ ] src/pages/__tests__/FeedInitialLoadingFilters.test.tsx
- [ ] src/pages/__tests__/FeedLoadingOnce.test.tsx
- [ ] src/react-app-env.d.ts
- [ ] src/test/mastoMock.ts
- [ ] src/test/setup.ts
- [ ] src/theme.css
- [ ] src/types.ts
- [ ] src/version.ts
- [ ] tsconfig.json
- [ ] vite.config.ts

