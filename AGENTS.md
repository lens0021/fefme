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
React Context (useAlgorithm hook)
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
│   ├── useAlgorithm.tsx    # Algorithm state management
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
- **AlgorithmProvider** (`useAlgorithm`) - Algorithm instance, timeline, filters, loading
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
4. `src/hooks/useAlgorithm.tsx` - Algorithm state management
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
- `AlgorithmStorageKey` - App state (weights, filters, timeline)
- `FediverseCacheKey` - Fediverse-wide trending data

### Timeline Cache Behavior
- `VisibleTimelinePosts` is the filtered timeline used for fast initial render.
- `NextVisibleTimelinePosts` stores the next filtered timeline after background updates.
- `VisibleTimelineStale` marks the visible timeline as stale when new posts are queued.
- On page load, `loadCachedData()` promotes `NextVisibleTimelinePosts` to `VisibleTimelinePosts` only if `VisibleTimelineStale` is set (or missing) and then clears the stale flag.

## TODO
- Decide whether to rename `AlgorithmProvider`/`useAlgorithm` to match `FeedCoordinator` for naming consistency.
- Further split large algorithm modules (e.g., `src/core/coordinator/feed.ts`, `src/core/coordinator/state.ts`) into smaller role-focused units.
- Align code boundaries with the Component Roles list (enforce module responsibilities and remove cross-role coupling).
