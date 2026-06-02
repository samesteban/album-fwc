# Tasks: Cross-Device Sync with Supabase + Google Auth

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated changed lines | ~730 |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Decision needed before apply | **Yes** |

**Recommended split**: 3 chained PRs

---

## Chain 1: Foundation + Auth (est. ~250 lines)

### 1.1 Install Supabase dependency
- [ ] `npm install @supabase/supabase-js`
- **Files**: `package.json`, `package-lock.json`

### 1.2 Create Supabase client
- [ ] Create `src/lib/supabase.ts` with `createClient()` singleton
- [ ] Export typed `supabase` instance
- **Files**: `src/lib/supabase.ts`
- **Ref**: Design — "supabase.ts client singleton"

### 1.3 Create Supabase SQL schema
- [ ] Create SQL migration file for:
  - `profiles` table (id, display_name, avatar_url, created_at)
  - `collection_items` table (id, user_id, card_id, count, updated_at) with UNIQUE(user_id, card_id)
  - Row-Level Security policies (select, insert, update, delete scoped to auth.uid())
- **Files**: (SQL to run in Supabase dashboard or migration file)
- **Ref**: Spec — Req #7-11

### 1.4 Add auth types
- [ ] Add `AuthState`, `AuthContextValue`, `SyncUser` types to `types.ts`
- **Files**: `src/types.ts`
- **Ref**: Design — AuthProvider interface

### 1.5 Create AuthProvider
- [ ] Create `src/providers/AuthProvider.tsx`
- [ ] Check existing session on mount (`supabase.auth.getSession()`)
- [ ] Subscribe to `onAuthStateChange`
- [ ] Expose `signInWithGoogle()` (popup mode)
- [ ] Expose `signOut()`
- [ ] Auto-create profile row on first login
- **Files**: `src/providers/AuthProvider.tsx`
- **Ref**: Design — AuthProvider, Spec — Req #1-6

### 1.6 Create LoginScreen
- [ ] Create `src/components/LoginScreen.tsx`
- [ ] Google OAuth button with loading state
- [ ] Show user avatar + name when logged in
- [ ] Sign out button
- **Files**: `src/components/LoginScreen.tsx`
- **Ref**: Design — LoginScreen, Spec — D1

### 1.7 Integrate AuthProvider in main.tsx
- [ ] Wrap App in AuthProvider
- [ ] Ensure auth initializes before render
- **Files**: `src/main.tsx`
- **Ref**: Design — State Management Flow

### [Chain 1 Verification]
- [ ] App boots without errors
- [ ] Google OAuth popup opens on login click
- [ ] Session persists across page reload
- [ ] Profile row created in Supabase after login
- [ ] App works without auth (guest mode)

---

## Chain 2: Sync Engine + Data Layer (est. ~280 lines)

### 2.1 Create sync engine
- [ ] Create `src/lib/supabase-sync.ts`
- [ ] `pushCollection(userId, cards[])` — batch upsert to Supabase
- [ ] `pullCollection(userId)` — fetch all rows → `TimestampedCard[]`
- [ ] `mergeCollections(local, remote, isFirstSync)`:
  - First-time: MAX count per card, tag with `now()`
  - Subsequent: latest `updated_at` wins (up OR down)
- [ ] `syncCollection(userId, local, timestamps, isFirstSync)` — full cycle
- [ ] `pushWithRetry(upsertFn, data, maxAttempts=3)` — exponential backoff
- **Files**: `src/lib/supabase-sync.ts`
- **Ref**: Design — Sync Engine, Spec — Req #12-19

### 2.2 Create useSync hook
- [ ] Create `src/hooks/useSync.ts`
- [ ] Sync state: `idle | syncing | synced | error | offline`
- [ ] Debounced auto-sync (500ms) on mutation
- [ ] Manual `triggerSync()` for login
- [ ] Queue failed syncs, retry on reconnect
- **Files**: `src/hooks/useSync.ts`
- **Ref**: Design — useSync hook

### 2.3 Add timestamps to data.ts
- [ ] Update `saveCollectionState()` to v2 format: `{ version: 2, collection, timestamps }`
- [ ] Update `loadCollectionState()` to handle v2 (or migrate v1)
- [ ] Add `updateCardCount()`: returns `{ collection, timestamps }`
- [ ] Update localStorage key or version
- **Files**: `src/data.ts`
- **Ref**: Design — data.ts updates

### 2.4 Add sync-related types
- [ ] Add `TimestampedCard`, `SyncState`, `SyncStats` to `types.ts`
- **Files**: `src/types.ts`
- **Ref**: Design — supabase-sync interface

### [Chain 2 Verification]
- [ ] `pushCollection` correctly upserts to Supabase
- [ ] `pullCollection` returns complete dataset
- [ ] Merge with timestamps: latest `updated_at` wins
- [ ] First-time merge uses MAX heuristic
- [ ] Debounced sync fires after 500ms idle
- [ ] Failed sync retries 3 times with backoff

---

## Chain 3: Integration + Migration + UI (est. ~200 lines)

### 3.1 Create SyncIndicator
- [ ] Create `src/components/SyncIndicator.tsx`
- [ ] Show sync status: synced / syncing... / offline / login to sync
- [ ] Show last synced timestamp
- [ ] Style matches existing emerald theme
- **Files**: `src/components/SyncIndicator.tsx`
- **Ref**: Spec — Req #23

### 3.2 Wire sync into App.tsx
- [ ] Import and use `useSync` hook
- [ ] On login: trigger full sync cycle
- [ ] On mutation: call `onCardUpdate()` from useSync
- [ ] Pass sync status to child components
- [ ] Add SyncIndicator to header
- **Files**: `src/App.tsx`
- **Ref**: Design — State Management Flow

### 3.3 Add login/sync UI to Dashboard
- [ ] Show SyncIndicator in Dashboard header
- [ ] Show login prompt (or user avatar) when not authenticated
- [ ] Show sync stats after successful sync
- **Files**: `src/components/Dashboard.tsx`
- **Ref**: Spec — Req #23-24

### 3.4 Add environment variables
- [ ] Create/update `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Update `.env.example`
- **Files**: `.env`, `.env.example`

### 3.5 Handle Reset after login
- [ ] Update `handleResetCollection` in App.tsx
- [ ] If logged in: delete all `collection_items` for user in Supabase
- [ ] Clear LocalStorage
- **Files**: `src/App.tsx`
- **Ref**: Spec — D2

### 3.6 Migrate existing LocalStorage
- [ ] On first login: detect v1 LocalStorage format
- [ ] Run merge cycle (MAX heuristic)
- [ ] Save as v2 format with timestamps
- [ ] Show feedback: "X láminas sincronizadas"
- **Files**: `src/data.ts`, `src/lib/supabase-sync.ts`
- **Ref**: Spec — A1, A2

### [Chain 3 Verification]
- [ ] Existing LocalStorage data survives migration
- [ ] Sync status shows correctly in all states
- [ ] Reset clears both local and remote
- [ ] Guest mode works without login
- [ ] Cross-device: mutation on device A → appears on device B after sync
