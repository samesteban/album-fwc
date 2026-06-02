# Exploration: Cross-Device Sync with Supabase + Google Auth

## Current State

The app is a mobile-first React 19 SPA (Vite 6 + TypeScript + Tailwind CSS v4) for tracking World Cup 2026 sticker collection progress.

### State Management
- **State lives in `App.tsx`** via `useState<CollectionState>` — a flat `{[cardId: string]: number}` map.
- Passed down as props to `Dashboard`, `CardGrid`, `SectionModal` — no React Context, no external store.
- **No Auth**, no backend, no API calls.

### Persistence
- `saveCollectionState()` writes the full `CollectionState` map to `localStorage` on every change via `useEffect`.
- `loadCollectionState()` hydrates from `localStorage` on boot.
- Single key: `album_mundial_48_collection_state_v1`.
- **No offline service worker**, no cache strategy.

### Component Tree
```
App (state owner)
├── Header (sticky nav)
├── Dashboard (stats, search, top-10 repeated)
├── CardGrid (sticker grid per section, +/- controls)
├── SectionModal (country selector)
└── Bottom Nav (tab bar)
```

### Data Shape
```typescript
type CollectionState = Record<string, number>; // cardId → count
// e.g. { "ARG_1": 1, "ARG_15": 3, "FWC_00": 0, "CC_5": 2 }
```

## Affected Areas

| File | Why affected |
|------|-------------|
| `src/App.tsx` | Auth state, sync orchestration, loading states |
| `src/data.ts` | New sync functions, Supabase CRUD, merge logic |
| `src/types.ts` | New types: User, SyncStatus, AuthState |
| `src/main.tsx` | Supabase client init, Auth provider wrapper |
| `src/components/Dashboard.tsx` | Login UI, sync status indicator |
| `package.json` | New deps: `@supabase/supabase-js`, `@supabase/ssr` |
| `.env` | Supabase URL + anon key |
| (new) `src/lib/supabase.ts` | Supabase client singleton |
| (new) `src/lib/supabase-sync.ts` | Sync engine (push/pull/merge) |
| (new) `src/providers/AuthProvider.tsx` | Auth context + session management |
| (new) `src/hooks/useSync.ts` | Hook for sync operations |
| (new) `src/components/LoginScreen.tsx` | Google OAuth login UI |

## Approaches

### 1. Full Supabase Sync (Recommended)
**LocalStorage as local cache, Supabase as source of truth.**
- On auth: push local data ↔ pull remote → merge by `updated_at`
- Every mutation: update LocalStorage immediately + enqueue Supabase sync
- Works offline with stale LocalStorage, syncs on reconnect
- **Pros**: Real cross-device sync, Google Auth, full data safety, conflict resolution
- **Cons**: More upfront work, need to handle offline edge cases
- **Effort**: High (but complete)

### 2. Local-First with Manual Sync
**LocalStorage is primary, Supabase sync on demand.**
- User clicks "Sync" button to push/pull
- Merge strategy: last-write-wins
- **Pros**: Simpler, less code, works fully offline
- **Cons**: Not automatic, user must remember to sync, risk of data loss between syncs
- **Effort**: Medium

### 3. Hybrid Progressive
**Start with manual sync, evolve to automatic.**
- Phase 1: Auth + manual sync button
- Phase 2: Background auto-sync on mutation
- Phase 3: Real-time subscriptions
- **Pros**: Ship faster, iterate
- **Cons**: Two rewrites of sync logic
- **Effort**: Low initial but more total

## Recommendation

**Approach 1 — Full Supabase Sync with local-first caching.**

Why:
1. The user explicitly wants seamless cross-device sync — manual sync defeats the purpose.
2. Google Auth via Supabase is well-documented and straightforward.
3. Local-first architecture (update LocalStorage immediately, sync async) preserves the snappy UX.
4. The data model is simple enough (flat map of card IDs → counts) that conflict resolution is straightforward: `last-write-wins` per card.
5. No existing backend means we start clean — no legacy migration complexity.

### Proposed Schema

**Table `profiles`:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key, matches auth.users.id |
| `display_name` | text | From Google profile |
| `avatar_url` | text | From Google profile |
| `created_at` | timestamptz | |

**Table `collection_items`:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → profiles.id |
| `card_id` | text | e.g. "ARG_15" |
| `count` | integer | |
| `updated_at` | timestamptz | For conflict resolution |
| | | UNIQUE(user_id, card_id) |

### Migration Path
1. App boots → load from LocalStorage (current behavior)
2. User logs in with Google → Supabase Auth session created
3. Check if `collection_items` has data for this user
4. **First-time merge** (local has no timestamps):
   - For each card: take the MAX count between local and remote (safe heuristic, one-time only)
   - Tag all cards with `updated_at = now()`
   - Save merged results to both Supabase and LocalStorage
5. **Subsequent syncs**: latest `updated_at` wins regardless of direction (up or down)
6. Each mutation timestamps the card so reductions are tracked correctly

### Risks
- **Offline during auth**: Google OAuth requires network. Mitigation: graceful fallback — app works without auth.
- **Race conditions**: Two devices editing same card simultaneously. Mitigation: `updated_at` comparison, last-write-wins per card.
- **Supabase free tier limits**: 500 MB database, 2 GB bandwidth, 50,000 monthly active users — more than enough for this app.

## Ready for Proposal

Yes. Proceed to proposal with the Full Sync approach.
