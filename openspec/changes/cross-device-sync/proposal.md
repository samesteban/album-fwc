# Proposal: Cross-Device Sync with Supabase + Google Auth

## Intent

Enable the user to access and update their sticker collection from any device (PC, mobile) using Supabase for cloud storage and Google OAuth for authentication, while preserving all existing LocalStorage data.

## Scope

### In Scope
- Google OAuth login via Supabase Auth
- Supabase database backend (profiles + collection_items tables)
- Local-first sync engine (LocalStorage as cache, Supabase as source of truth)
- Migration of existing LocalStorage data → Supabase on first login (merge, no data loss)
- Sync status indicator in the UI
- Graceful offline behavior (app works without auth, syncs when possible)
- Environment variables for Supabase credentials

### Out of Scope
- GitHub / email / magic-link auth (Google only for v1)
- Real-time subscriptions (Supabase Realtime — defer to v2)
- PWA service worker / offline-first architecture (defer)
- Multi-user sharing / trading (defer)
- Push notifications (defer)

## Approach

**Local-first architecture with async Supabase sync.**

### Data Flow
```
User Action → update LocalStorage (immediate) → queue Supabase upsert (async)
Login       → pull remote data → merge with local → save merged to both
```

### Auth Flow
```
App boots → check Supabase session exists?
  ├── No → show LoginScreen or optional guest mode
  └── Yes → load user profile → trigger sync
Login with Google → Supabase redirect → session callback → store session
```

### Sync Flow (on login or manual trigger)
1. Read `collection_state` from LocalStorage (with optional `updated_at` per card)
2. Fetch `collection_items` from Supabase for this user (each row has `updated_at`)
3. For each card in union(local_keys, remote_keys):
   - **Migration first sync** (local has no timestamps): use MAX count per card, then tag with `now()`
   - **Subsequent syncs** (both sides have timestamps): the card with the **latest `updated_at`** wins — whether count went up OR down
4. Upsert merged collection to Supabase
5. Save merged state back to LocalStorage

### Mutation Flow (on +/- button press)
1. Update LocalStorage immediately (current behavior)
2. Debounce 500ms, then upsert `collection_items` row to Supabase
3. On failure: retry 3x with backoff, then queue for next sync

### Conflict Resolution
**Latest `updated_at` wins per card.** Every mutation timestamps the card. During sync, the card with the most recent `updated_at` is the source of truth — regardless of whether the count went up or down. This correctly handles reductions (e.g., trading away a duplicate).

**First migration** (no timestamps exist in LocalStorage): use MAX count per card as a one-time heuristic, then `updated_at` takes over for all subsequent syncs.

Since the user is the sole writer to their own collection, conflicts are unlikely — the primary risk is two browser tabs open simultaneously, which resolves cleanly by `updated_at`.

## Rollback Plan

1. **Disable sync**: Remove Supabase env vars, app falls back to LocalStorage-only mode with zero code changes needed (sync layer is additive, not invasive).
2. **Data recovery**: All data always exists in LocalStorage even after sync. User can export/download if needed.
3. **Auth recovery**: Supabase session timeout → re-login with Google. No data loss.

## Required Resources

- Supabase project (free tier sufficient)
- Google OAuth credentials (Web Client ID) configured in Supabase dashboard
- Two environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Delivery Plan

### Phase 1 — Foundation
- [ ] Install `@supabase/supabase-js`
- [ ] Create `src/lib/supabase.ts` — client singleton
- [ ] Create Supabase tables (profiles, collection_items) with SQL
- [ ] Configure Google OAuth in Supabase dashboard
- [ ] Add `.env` with Supabase credentials

### Phase 2 — Auth
- [ ] Create `AuthProvider` (React Context for session)
- [ ] Create `LoginScreen` component (Google OAuth button)
- [ ] Wrap `App` in `AuthProvider`
- [ ] Handle auth state: loading, logged-in, logged-out
- [ ] Persist session across page reloads

### Phase 3 — Sync Engine
- [ ] Create `src/lib/supabase-sync.ts`:
  - `pushCollection(userId, collectionState)` → upsert rows
  - `pullCollection(userId)` → fetch rows → `CollectionState`
  - `mergeCollections(local, remote)` → max count per card
  - `syncCollection(userId, localState)` → full sync cycle
- [ ] Create `useSync` hook (sync state, trigger sync, status)
- [ ] Debounced auto-sync on mutation (500ms)

### Phase 4 — Integration
- [ ] Integrate `AuthProvider` in `App.tsx`
- [ ] Add login/sync UI to `Dashboard` (login button, sync status)
- [ ] Update `main.tsx` to init Supabase before render
- [ ] Wire mutations to trigger auto-sync
- [ ] Handle offline: queue failed syncs, retry on reconnect

### Phase 5 — Migration
- [ ] On first login: detect existing LocalStorage data
- [ ] Run merge cycle (local + remote → merged)
- [ ] Show "X láminas sincronizadas" feedback
- [ ] Preserve LocalStorage as primary cache forever

## Risks

| Risk | Mitigation |
|------|-----------|
| **Data loss on merge** | Never delete local data — only add/enrich. MAX merge is additive. |
| **Offline login** | App works fully without auth. Login only needed for sync. |
| **Rate limiting** | Debounce mutations 500ms. Batch upserts. Free tier is generous. |
| **OAuth config errors** | Clear error messages. Fallback to local-only mode. |
| **Browser tab conflicts** | Resolved by last-write-wins. Real-time subscriptions deferred to v2. |

## Ready for Next Phase

Yes. Proceed to spec.
