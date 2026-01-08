# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Fefme** (Fediverse timeline for ME) is a client-side algorithmic timeline for Mastodon. It's a fork of fedialgo_demo_app_foryoufeed that implements a multi-factor weighted scoring system to rank and filter Mastodon posts. All computation happens in the browser with zero backend—a privacy-first architecture.

**Demo:** <https://lens0021.github.io/fefme/>

## Commands

### Development

```bash
npm run dev      # Start dev server (opens http://localhost:3000)
npm run build    # TypeScript + Vite production build → docs/
npm run preview  # Preview production build
npm run tsc      # Type check only (no emit)
npm test         # Run component tests with Vitest
```

Pre-commit hooks run the required checks automatically, so you generally don't need to run them manually.

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

```text
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

```text
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

```text
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

```text
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
- `Post` object now has an explicit `score` property (number) that is persisted in storage, ensuring the visible timeline retains fixed scores until refresh. This replaces the previous reliance on a getter calculating from `scoreInfo`.

### Review files

Review the following files, and add TODO items for it.

- biome.json
  - ~~Consider customizing linter rules beyond "recommended": true for project-specific needs~~
  - [ ] Evaluate if additional files should be ignored beyond src/default.css
  - [ ] Consider setting files.ignoreUnknown to true to avoid formatting/linting non-source artifacts
- e2e/seen-refresh.spec.ts
  - [ ] Extract API route mocking logic into shared helper functions to reduce duplication across all 3 tests
  - [ ] Move makeAccount, makeStatus, makeStatuses test helpers to separate fixture file (e.g., e2e/fixtures/mockData.ts)
  - [ ] Extract hardcoded timeout values (20_000, 1500, etc.) to named constants for maintainability
  - [ ] Consider extracting common test setup (user initialization, page.addInitScript) into beforeEach hook
  - [ ] Refactor instanceInfo object to shared fixture
- [x] index.html
- [x] src/App.tsx
- lefthook.yml
  - [ ] Consider adding glob patterns to run hooks only on relevant file changes (e.g., skip tsc for markdown-only changes)
  - [ ] Consider making pre-push build/test:e2e conditional to avoid heavy runs on docs-only changes
- package.json
  - [ ] Consider upgrading React from 18.2 to 18.3 (latest stable)
  - [x] Verify if "private": false is intentional - package doesn't seem meant for npm publishing
  - [ ] Replace lodash with lodash-es or individual imports to reduce bundle size
  - [x] Remove or document browserslist config - Vite doesn't use it without @vitejs/plugin-legacy
  - [ ] Consider removing "predeploy" if deployment is only via GitHub Pages workflow
- playwright.config.ts
  - [x] Fix port mismatch: webServer uses "npm run dev" but specifies port 4173 (preview port) - should use dev port 3000 or use "npm run preview"
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
- [ ] src/components/coordinator/filters/**tests**/FilterCheckboxGrid.test.tsx
  - [ ] Add tests for "Exclude" and "Any" filter states.
  - [ ] Add tests for multiple filter options being selected.
  - [ ] Add tests for other filter types (e.g., user, tag).
  - [ ] Consider refactoring mock setup for simplicity.
- [ ] src/components/coordinator/filters/**tests**/NumericFilters.test.tsx
  - [ ] Add tests for multiple numeric filters.
  - [ ] Use @testing-library/user-event for more realistic slider interaction simulation.
  - [ ] Add assertions for the rendered output, such as the slider's value.
  - [ ] Add tests for edge cases, such as when no numeric filters are available.
- [ ] src/components/coordinator/Slider.tsx
  - [ ] Simplify or add comments to the `decimals` calculation logic.
  - [ ] Consider encapsulating styling to make the component more reusable.
  - [ ] Re-evaluate the initial `value` check to handle it more explicitly.
- [ ] src/components/coordinator/WeightSetter.tsx
  - [ ] Refactor to use the project's `Storage` abstraction instead of direct `localStorage` access.
  - [ ] Simplify `initWeights` or move loading/validation logic to the algorithm or a helper.
  - [ ] Avoid `{} as Weights` for initial state to prevent potential runtime errors before initialization.
- [ ] src/components/coordinator/WeightSlider.tsx
  - [ ] Standardize storage access; avoid mixing `useLocalStorage` with direct `localStorage` calls for backup values.
  - [ ] Centralize storage keys (`disabledKey`, `backupKey`) to prevent potential name collisions and improve maintainability.
  - [ ] Simplify `defaultMax` and `stepSize` calculation logic.
  - [ ] Investigate potential layout shifts caused by early returns when weights are not yet loaded.
- [ ] src/components/experimental/ExperimentalFeatures.tsx
  - [ ] Replace hardcoded colors (e.g., `bg-[#d3d3d3]`, `border-gray-300`) with theme-aware Tailwind classes or CSS variables.
  - [ ] Convert manual pixel-based spacing (e.g., `ml-[7px]`, `p-[7px]`, `rounded-[20px]`) to standard Tailwind spacing and rounding classes for consistency.
  - [ ] Review and potentially refine the wording of experimental feature descriptions and confirmation messages for clarity and conciseness.
- [x] src/components/Footer.tsx
- [ ] src/components/Header.tsx
  - [ ] Consolidate duplicate "delete all data" logic between `Header.tsx` and `ExperimentalFeatures.tsx`.
  - [ ] Replace direct `localStorage` manipulation with the project's Storage abstraction.
  - [ ] Refactor manual weight-related storage key cleanup into a centralized method in the algorithm or a storage helper.
  - [ ] Improve positioning logic for the "Account & data reset" dropdown to ensure it doesn't overflow on small screens.
- [ ] src/components/helpers/Accordion.tsx
  - [ ] Re-evaluate the title casing logic; consider moving it out of the component or providing a prop to control it.
  - [ ] Refactor common structure between `top` and `sub` variants to reduce duplication.
  - [ ] Remove unnecessary `key` props from static children.
  - [ ] Replace fragile margin hacks (e.g., `my-[-5px]`) with standard Tailwind alignment/spacing.
- [ ] src/components/helpers/Checkbox.tsx
  - [ ] Simplify tooltip anchor resolution logic.
  - [ ] Consider moving label capitalization and truncation logic out of the component or using CSS for truncation.
  - [ ] Ensure unique `id` attributes for inputs to improve accessibility, especially when labels might be duplicated.
  - [ ] Review `persistentCheckbox` to ensure tooltip components are not unnecessarily duplicated in the DOM.
- [x] src/components/helpers/Confirmation.tsx
- [x] src/components/helpers/ErrorHandler.tsx
- [ ] src/components/helpers/LabeledDropdownButton.tsx
  - [x] Make the component theme-aware, replacing hardcoded `bg-white` and `border-gray-300`.
  - [ ] Add a way to reset the dropdown value from the parent component if needed.
  - [x] Improve focus states for better accessibility.
- [ ] src/components/helpers/NewTabLink.tsx
  - [x] Add `noopener` to `rel` attribute for improved security.
  - [ ] Add an optional visual indicator (e.g., an external link icon) for accessibility.
  - [x] Refactor `onClick` to optionally allow the default behavior (opening the tab).
- [ ] src/components/ProtectedRoute.tsx
  - [ ] Add a loading state while authentication status is being determined to prevent flickering.
  - [x] Implement redirect-back logic to return users to their intended page after logging in.
- [ ] src/components/status/ActionButton.tsx
  - [ ] Avoid direct mutation of the `post` object during optimistic updates.
  - [x] Add loading/disabled states while an action is in flight to prevent duplicate requests.
  - [ ] Refactor `actionColor` to use semantic theme variables or Tailwind's primary/secondary palettes.
- [ ] src/components/status/AttachmentsModal.tsx
  - [x] Make the modal theme-aware, replacing hardcoded `bg-white` and `text-black`.
  - [ ] Add explicit navigation buttons (Previous/Next) for multi-attachment posts.
  - [x] Implement `Escape` key listener to close the modal.
  - [x] Standardize the backdrop overlay and transition animations using Tailwind.
- [ ] src/components/status/MultimediaNode.tsx
  - [x] Remove the unused `HIDDEN_CANVAS` element.
  - [x] Implement a clearer "Show Content" overlay for sensitive media instead of just blur.
  - [x] Refactor multi-image layout to use a proper CSS grid for better responsiveness.
  - [x] Standardize rounded corners and border styling using consistent Tailwind classes.
- [ ] src/components/status/Poll.tsx
  - [x] Add a "Refresh" button to fetch the latest poll results.
  - [x] Improve progress bar visualization with better theme-aware colors and transitions.
  - [x] Add a "Multiple choice" label for polls that allow multiple selections.
  - [ ] Avoid direct mutation of the `poll` object; use a proper state update or callback.
- [ ] src/components/status/PreviewCard.tsx
  - [x] Remove the unused `<canvas>` element.
  - [x] Replace hardcoded color `text-[#4b427a]` with a theme-aware color variable.
  - [x] Implement an image load error handler to show a fallback icon or placeholder.
  - [x] Standardize the card's border and hover states using consistent Tailwind utility classes.
- [ ] src/components/status/Status.tsx
  - [x] Add a Content Warning (CW) overlay to hide sensitive text behind a "Show More" button.
  - [x] Refactor the Score Modal to use theme-aware standard styling and transitions.
  - [x] Improve the top bar layout to reduce clutter, potentially using icons for sources.
  - [x] Replace hardcoded colors (e.g., `text-[#636f7a]`, `text-sky-300`) with theme variables.
  - [x] Standardize the "Open Thread" button with consistent Tailwind styling.
- [ ] src/components/status/**tests**/StatusSeenDuringBackgroundLoad.test.tsx
  - [ ] Replace the inline post stub with a shared test fixture or factory to avoid the heavy cast and duplicated fields
  - [ ] Avoid using global mutable `isOnScreen`; use a per-test mock or helper for clearer isolation
- [ ] src/components/TrendingSection.tsx
  - [x] Handle non-string link labels when computing label lengths (React elements currently stringify to "[object Object]")
  - [ ] Sync `minPostsState` with tagList changes (state is seeded once and can go stale on new data)
  - [ ] Replace hardcoded colors/font stack with theme-aware classes or config
- [ ] src/config.ts
  - [ ] Rename `loadingErroMsg` to `loadingErrorMsg` (and keep a backward-compatible alias if needed)
  - [ ] Allow overriding repo/issues URLs via env to avoid incorrect inference from `HOMEPAGE`
- [ ] src/core/api/api.ts
  - [x] Avoid returning an empty array when apiMutex is locked for a foreground fetch; consider awaiting the mutex or returning cached rows to prevent accidental data loss.
  - [ ] Remove the cacheKey fallback hack in handleApiError() by guaranteeing cacheKey in params or throwing when missing.
- [ ] src/core/api/counted_list.ts
  - [ ] Normalize name input in incrementCount() (currently bypasses lowercasing used by getObj/completeObjProperties)
  - [ ] Avoid mutating the original object in completeObjProperties() or document the mutation side effect
- [ ] src/core/api/errors.ts
  - [ ] Consider accepting unknown error shapes (Axios errors) and extracting status/message more robustly
  - [ ] Ensure throwSanitizedRateLimitError preserves original error as cause for debugging
- [ ] src/core/api/mastodon_server.ts
  - [ ] Add retry/backoff or explicit error classification for axios failures (network vs 4xx/5xx)
  - [ ] Avoid throwing raw axios responses in fetch(); normalize error handling for callers
- [ ] src/core/api/objects/account.ts
  - [ ] Avoid defaulting boolean flags with `|| false` when the API can return `false` vs `undefined` (use nullish coalescing)
  - [ ] Handle missing `url`/`acct` gracefully when building `webfingerURI` and `homeserver`
- [ ] src/core/api/objects/filter.ts
  - [ ] Simplify extractMutedKeywords() by removing redundant flat() calls
  - [ ] Consider de-duplicating keywords to avoid repeated regex terms
- [ ] src/core/api/objects/post.ts
  - [ ] Avoid importing QuoteApproval from a deep `masto` path; prefer a stable public type export
  - [ ] Expand hashtag regex to support non-ASCII tag characters (current `\\w` misses many tags)
- [ ] src/core/api/objects/tag.ts
  - [ ] Replace random tag IDs in buildTag() with deterministic IDs to improve caching and comparisons
  - [ ] Avoid mutating the input tag in repairTag() or clearly document the mutation
- [ ] src/core/api/objects/trending_with_history.ts
  - [ ] Avoid mutating incoming objects in decorateHistoryScores() (lowercases url in-place)
  - [ ] Guard against NaN in history parsing when `uses`/`accounts` are missing or non-numeric
- [ ] src/core/api/tag_list.ts
  - [ ] Cache or reuse followed tags/muted keywords when removing unwanted tags to avoid repeated API calls
  - [ ] Consider passing `includeBoosts` explicitly with a default to avoid accidental falsey bugs
- [ ] src/core/api/tags_for_fetching_posts.ts
  - [ ] Avoid rebuilding tag list on every create() call when cache is fresh (consider Storage-backed list)
  - [ ] Ensure getOlderPosts() does not bypass removeUnwantedTags filtering for newly fetched tags
- [ ] src/core/api/user_data_poller.ts
  - [x] Prevent overlapping getMoarData runs when the interval fires faster than completion
  - [ ] Make `pollers` configurable to skip endpoints that are rate-limited or disabled
- [ ] src/core/api/user_data.ts
  - [ ] Prefer non-mutating postLanguageOption() (avoid writing to `post.language`)
  - [ ] Expose lastUpdatedAt via getter for easier freshness checks/testing
- [ ] src/core/config.ts
  - [ ] Keep config locale defaults in one place (avoid separate DEFAULT_LOCALE string + config.locale)
  - [ ] Consider typing load status messages to prevent missing/extra keys
- [ ] src/core/coordinator/actions.ts
  - [ ] Ensure releaseLoadingMutex() resets loadStartedAt/releaseLoadingMutex to prevent reuse
  - [ ] Consider using finally guards so exceptions in startAction callers always release mutex
- [ ] src/core/coordinator/background.ts
  - [x] Ensure cacheUpdater interval is cleared when saveTimelineToCache throws
  - [ ] Add optional immediate save on stop to avoid losing last-minute changes
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
  - [ ] Avoid constructing TagList in a constants module to keep side effects minimal
- [ ] src/core/coordinator/feed_stats.ts
  - [ ] Avoid recomputing date arrays on every call; consider caching or incremental stats
  - [ ] Clarify when fallbacks to full feed happen (add docs or log level tweak)
- [ ] src/core/coordinator/feed.ts
  - [ ] Remove hardcoded CacheKey.HOME_TIMELINE_POSTS from log message (line 30) - function handles multiple sources
  - [ ] Add comment or extract shouldUpdateFilters() helper to clarify complex filter update condition (line 83-93)
  - [ ] Add comment explaining why loadingStatus update is skipped for TIMELINE_BACKFILL (line 96-99)
  - [ ] Split finishFeedUpdate() into smaller functions: finalizeTimeline(), cleanupLoadingState() - too many responsibilities (line 106-133)
  - [ ] Ensure loadStartedAt is cleared in failure paths (currently only in finishFeedUpdate)
- [ ] src/core/coordinator/filters.ts
  - [ ] filterFeedAndSetInApp() has multiple responsibilities: filtering + defer handling + first-post telemetry
  - [ ] Consider extracting hasProvidedAnyPostsToClient flag management to separate concern
  - [x] updateFilters() calls Storage.setFilters without await - Promise is ignored, may cause race conditions
  - [ ] Avoid setting state.deferredTimeline to a reference that can be mutated later (copy array)
- [ ] src/core/coordinator/loaders.ts
  - [ ] Document that getHomeTimeline delegates merging via callback and why it returns posts too
  - [ ] Handle empty federated timeline bounds (minId/maxId) to avoid fetching with null/undefined
- [ ] src/core/coordinator/loggers.ts
  - [ ] Prefer a single logger factory to avoid building two separate logger maps
- [ ] src/core/coordinator/scorers.ts
  - [ ] Keep scorer registration in sorted order or documented grouping for easier diff review
  - [ ] Consider lazy-loading heavy scorers in quick mode to reduce startup time
- [ ] src/core/coordinator/scoring.ts
  - [ ] scoreAndFilterFeed() does 4 things: scoring + truncate + storage + filtering - consider splitting responsibilities
  - [x] Duplicate truncate logic with cache.ts - consolidate into single location
  - [ ] Function name "scoreAndFilter" doesn't indicate it also saves to storage - rename or split
- [ ] src/core/coordinator/source_stats.ts
  - [ ] Avoid double-iterating over posts for date bounds; reuse min/max from getSourceBounds or compute once
  - [ ] Include trending tag sources in sourcesToTrack if they should be surfaced in stats
- [ ] src/core/coordinator/state.ts
  - [ ] Review completed - minimal improvements needed, class structure is clean
- [ ] src/core/coordinator/stats.ts
  - [ ] Consider re-exporting SourceStats from a single module to avoid circular usage patterns
- [ ] src/core/coordinator/**tests**/cache.test.ts
  - [ ] Add assertions for loadCachedData when visible cache is missing or stale flag is unset
  - [ ] Verify behavior when filters are missing or Storage.getFilters returns null
- [ ] src/core/enums.ts
  - [ ] Add unit tests to ensure STORAGE_KEYS_WITH_POSTS stays in sync with CacheKey values
  - [ ] Consider freezing ALL_CACHE_KEYS/ALL_ACTIONS as readonly tuples to prevent mutation
- [ ] src/core/filters/boolean_filter.ts
  - [ ] Avoid mutating options arrays in addMissingActiveOptions; return a new list instead
  - [ ] Normalize option names (case/trim) when updating or checking option states
- [ ] src/core/filters/feed_filters.ts
  - [ ] Guard against posts missing application/language fields when incrementing counts
  - [ ] Avoid mutating post.sources when adding UNKNOWN_SOURCE (copy or handle in filter matching)
- [ ] src/core/filters/numeric_filter.ts
  - [ ] Handle NaN/undefined `value` gracefully in updateValue and serialization
  - [ ] Consider memoizing warning for missing property values to avoid noisy logs
- [ ] src/core/filters/post_filter.ts
  - [ ] Consider making logger optional or lazy to reduce construction overhead
  - [ ] Include description in toArgs for clarity when serializing filters
- [ ] src/core/filters/**tests**/SeenFilter.test.ts
  - [ ] Add tests for numTimesShown > 0 without favourites/reblogs to cover seen tracking
  - [ ] Add tests for realToot.numTimesShown to confirm nested handling
- [ ] src/core/helpers/collection_helpers.ts
  - [x] Fix computeMinMax to include zero values (current truthy check skips 0)
  - [ ] Ensure batchMap preserves result order when filtering nulls
- [ ] src/core/helpers/environment_helpers.ts
  - [ ] Gate console debug logging behind isDebugMode to avoid noisy production logs
  - [ ] Switch to import.meta.env for Vite instead of process.env to avoid bundler assumptions
- [ ] src/core/helpers/language_helper.ts
  - [ ] Consider narrowing LANGUAGE_NAMES to ISO 639-1 codes or document mixed sources (custom names like pidgin)
  - [ ] Validate tinyld/languagedetect outputs against LANGUAGE_CODES to avoid unknown mappings
- [ ] src/core/helpers/logger.ts
  - [ ] Avoid logging full args twice in error() (currently passes allArgs to console.error along with msg)
  - [ ] Ensure warn() preserves additional args instead of dropping them (currently only logs string)
- [ ] src/core/helpers/math_helper.ts
  - [ ] Replace Buffer usage in sizeFromBufferByteLength with TextEncoder for browser compatibility
  - [ ] Fix strBytes to account for UTF-8 byte length instead of string length
- [ ] src/core/helpers/mutex_helpers.ts
  - [ ] Log when a mutex is released to improve debugging of lock contention
  - [ ] Add timeout or cancellation handling for stuck locks
- [ ] src/core/helpers/string_helpers.ts
  - [ ] Fix extractDomain to use normalized `url` consistently (currently uses original inUrl for http check)
  - [ ] Expand hashtag regex to cover non-ASCII word characters
- [ ] src/core/helpers/suppressed_hashtags.ts
  - [ ] Avoid rebuilding Sets in allTootURIs(); accumulate into a single Set via mutation
  - [ ] Consider exposing a reset() to clear state between sessions/tests
- [ ] src/core/helpers/time_helpers.ts
  - [ ] Clarify AgeIn.ms behavior for invalid inputs (currently returns -1 but other helpers assume non-negative)
  - [ ] Normalize timeString() to use locale-safe date comparisons (today check can fail across timezones)
- [ ] src/core/index.ts
  - [ ] Remove the unused Buffer import (or document why it is still required for class-transformer).
  - [x] Await startAction() in triggerPullAllUserData() so the loading mutex is reliably acquired before work starts.
  - [ ] Consider removing default setTimelineInApp console.debug or guard it behind isDebugMode
- [ ] src/core/scorer/feed/diversity_feed_scorer.ts
  - [ ] Guard against division by zero in penaltyIncrement when numPosts is undefined
  - [ ] Consider clamping penalties to avoid large negative scores when numPosts is high
- [ ] src/core/scorer/feed_scorer.ts
  - [ ] Consider making extractScoreDataFromFeed async to support scorers that need async preprocessing
  - [ ] Ensure extractScoringData handles empty feeds consistently (return empty dict)
- [ ] src/core/scorer/post/acccount_scorer.ts
  - [ ] Fix filename typo (acccount_scorer.ts) to avoid import confusion
  - [ ] Guard against missing scoreData entries (sumArray of undefined)
- [ ] src/core/scorer/post/already_shown_scorer.ts
  - [ ] Default missing numTimesShown to 0 to avoid NaN in sumArray
  - [ ] Consider capping the score to avoid overweighting heavy re-viewed posts
- [ ] src/core/scorer/post/author_followers_scorer.ts
  - [ ] Handle undefined followersCount (fallback to 0) to avoid NaN
  - [ ] Consider log-scaling with +1 to avoid log10(0) branches
- [ ] src/core/scorer/post/boosts_in_feed_scorer.ts
  - [ ] Guard against missing reblog.reblogsBy to avoid runtime errors
  - [ ] Consider weighting boosts by follower status rather than raw count
- [ ] src/core/scorer/post/chaos_scorer.ts
  - [ ] Clamp decimalHash to [0,1] range; current hash can be negative
  - [ ] Prefer a stable hash util for deterministic scores across environments
- [ ] src/core/scorer/post/followed_accounts_scorer.ts
  - [ ] Normalize webfingerURI casing before lookup to avoid misses
  - [ ] Avoid re-fetching followed accounts on every rebuild; reuse cached data
- [ ] src/core/scorer/post/followed_tags_scorer.ts
  - [ ] Ensure followedTags is populated when missing (post.realToot.followedTags can be undefined)
  - [ ] Consider de-duping followed tags before counting length
- [ ] src/core/scorer/post/followers_scorer.ts
  - [ ] Avoid hitting followers endpoint in quick mode if not needed
  - [ ] Add error handling when API returns partial follower lists
- [ ] src/core/scorer/post/interactions_scorer.ts
  - [ ] Add dedupe for notification accounts to avoid inflating counts
  - [ ] Consider filtering out self-notifications to avoid skew
- [ ] src/core/scorer/post/mentions_followed_scorer.ts
  - [ ] Normalize mention acct casing before lookup to avoid missing followed accounts
- [ ] src/core/scorer/post/most_boosted_accounts_scorer.ts
  - [ ] Consider reusing cached recent posts instead of fetching every time
- [ ] src/core/scorer/post/most_favourited_accounts_scorer.ts
  - [ ] Decide whether to count favourites for boosted posts by booster or original author
- [ ] src/core/scorer/post/most_replied_accounts_scorer.ts
  - [ ] Account IDs are not globally unique; consider using webfinger when available
- [x] src/core/scorer/post/property_scorer_factory.ts
- [x] src/core/scorer/post_scorer.ts
- [ ] src/core/scorer/post/tag_scorer_factory.ts
  - [ ] Normalize tag names before lookup to avoid case/diacritic mismatches
- [x] src/core/scorer/post/trending_tags_scorer.ts
- [x] src/core/scorer/scorer_cache.ts
- [ ] src/core/scorer/scorer.ts
  - [ ] Cache weights once per scoring batch to avoid repeated Storage.getWeights calls
- [ ] src/core/scorer/weight_presets.ts
  - [ ] Consider documenting preset intent (short description) for UI display
- [ ] src/core/Storage.ts
  - [ ] Centralize storage key serialization/deserialization to avoid scattered logic
  - [ ] Consider handling localForage config errors or fallback drivers
- [ ] src/core/types.ts
  - [ ] Tighten ApiObj union to avoid string-only entries if possible
  - [ ] Consider removing TODOs or converting them into tracked issues
- [ ] src/helpers/async_helpers.ts
  - [ ] Consider exposing a hook-friendly variant for React to avoid repeated state closures
- [ ] src/helpers/log_helpers.ts
  - [ ] Avoid importing Logger from core/index to reduce circular deps; import directly from core/helpers/logger
- [ ] src/helpers/mastodon_helpers.ts
  - [ ] Guard against missing server configuration/mediaAttachments when building MIME extensions
- [ ] src/helpers/min_posts.ts
  - [ ] Use a single source of truth for the list length (objList.length vs objList.objs.length) to avoid drift
- [x] src/helpers/navigation.ts
- [ ] src/helpers/number_helpers.ts
  - [ ] Avoid assuming non-null objects in formatScores; guard null before accessing raw
- [x] src/helpers/source_labels.ts
- [ ] src/helpers/string_helpers.ts
  - [ ] isToday should compare full date (year/month/day) to avoid false positives across months
- [x] src/helpers/styles/index.ts
- [ ] src/helpers/styles/theme.ts
  - [ ] Fix feedBackgrounGradient typo to feedBackgroundGradient and align references
- [ ] src/helpers/ui.tsx
  - [ ] booleanIcon should handle null/undefined without calling toString()
  - [ ] followUri should open with noopener/noreferrer for security
- [ ] src/hooks/useAuth.tsx
  - [ ] Type AuthContext explicitly and throw when useAuthContext is used outside provider
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
  - [ ] Avoid mutating serverUsers in place; clone state before setServerUsers to prevent stale renders
  - [ ] Parse stored server value in getServer() to stay consistent with JSON.stringify usage
- [ ] src/hooks/useOnScreen.tsx
  - [ ] Disconnect IntersectionObserver on cleanup to avoid leaks when ref changes
- [ ] src/hooks/useTheme.ts
  - [ ] Add fallback for browsers without matchMedia addEventListener (use addListener/removeListener)
- [x] src/index.css
- [x] src/index.tsx
- [ ] src/pages/CallbackPage.tsx
  - [ ] Handle non-OK token responses or missing access_token before continuing
- [x] src/pages/Feed.tsx
- [ ] src/pages/LoginPage.tsx
  - [ ] Type location.state instead of using any for redirect persistence
- [x] src/pages/**tests**/FeedInitialLoadingFilters.test.tsx
- [ ] src/pages/**tests**/FeedLoadingOnce.test.tsx
  - [ ] Prefer user-event for refresh bubble click to simulate real interaction
- [x] src/react-app-env.d.ts
- [x] src/test/mastoMock.ts
- [ ] src/test/setup.ts
  - [ ] Consider clearing localStorage in afterEach to avoid cross-test leakage
- [ ] src/theme.css
  - [ ] Keep CSS theme variables in sync with src/helpers/styles/theme.ts palettes
- [x] src/types.ts
- [x] src/version.ts
- [x] tsconfig.json
- [x] vite.config.ts
