# Design: Cross-Device Sync with Supabase + Google Auth

## Overview

Architecture diagram and module design for adding Supabase-backed cross-device sync to the existing React SPA.

## Module Architecture

```
src/
├── lib/
│   ├── supabase.ts              # Supabase client singleton
│   └── supabase-sync.ts         # Sync engine (push, pull, merge)
├── providers/
│   └── AuthProvider.tsx          # Auth React Context + session management
├── hooks/
│   └── useSync.ts               # Hook for sync state + operations
├── components/
│   ├── LoginScreen.tsx          # Google OAuth login UI
│   └── SyncIndicator.tsx        # Sync status badge
├── App.tsx                      # + auth state, sync orchestration
├── data.ts                      # + timestamped mutations, new localStorage format
└── types.ts                     # + auth types
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ AuthProvider  │  │ useSync      │  │ collectionState  │  │
│  │ (context)     │  │ (hook)       │  │ (useState)       │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│         │    ┌────────────┴────────────┐       │            │
│         │    │ supabase-sync.ts        │       │            │
│         │    │ ┌──────────────────────┐│       │            │
│         │    │ │ pushCollection()     ││       │            │
│         │    │ │ pullCollection()     ││       │            │
│         │    │ │ mergeCollections()   ││       │            │
│         │    │ │ syncCollection()     ││       │            │
│         │    │ └──────────────────────┘│       │            │
│         │    └────────┬───────────────┘       │            │
│         │             │                       │            │
│  ┌──────┴──────┐     │              ┌─────────┴──────────┐ │
│  │ supabase.ts │     │              │ data.ts            │ │
│  │ (client)    │     │              │ localStorage       │ │
│  └──────┬──────┘     │              │ +/- timestamps     │ │
│         │            │              └────────────────────┘ │
└─────────┼────────────┼─────────────────────────────────────┘
          │            │
     ┌────┴────┐  ┌────┴───────────┐
     │ Supabase│  │ localStorage   │
     │ (cloud) │  │ (cache primario)│
     └─────────┘  └────────────────┘
```

## Component Design

### `AuthProvider` (React Context)

```typescript
interface AuthState {
  session: Session | null;        // Supabase session
  user: User | null;              // Profile data
  isLoading: boolean;             // Initial session check
}

interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}
```

**Behavior:**
- On mount: check for existing Supabase session (`supabase.auth.getSession()`)
- Subscribe to `onAuthStateChange` for login/logout/token refresh
- On login: fetch/create profile row in `profiles` table
- Expose `signInWithGoogle()` → calls `supabase.auth.signInWithOAuth({ provider: 'google' })` using popup mode
- Expose `signOut()` → calls `supabase.auth.signOut()`

### `supabase-sync.ts` — Sync Engine

```typescript
interface TimestampedCard {
  cardId: string;
  count: number;
  updatedAt: string;        // ISO 8601
}

// Push local changes to Supabase (batch upsert)
async function pushCollection(
  userId: string,
  cards: TimestampedCard[]
): Promise<void>;

// Pull remote data from Supabase
async function pullCollection(
  userId: string
): Promise<TimestampedCard[]>;

// Merge local + remote during sync
// - First-time: local has no timestamps → MAX count heuristic
// - Subsequent: latest updatedAt wins (up OR down)
function mergeCollections(
  local: Map<string, TimestampedCard>,
  remote: Map<string, TimestampedCard>,
  isFirstSync: boolean   // if true, use MAX; else latest-timestamp-wins
): TimestampedCard[];

// Full sync cycle: pull → merge → push (called on login + manual)
async function syncCollection(
  userId: string,
  localCollection: CollectionState,
  localTimestamps: Record<string, string>,
  isFirstSync: boolean
): Promise<{
  merged: CollectionState;
  timestamps: Record<string, string>;
  stats: { pushed: number; pulled: number; updated: number };
}>;
```

**Sync Algorithm (subsequent syncs):**

```
For each cardId in union(local.keys, remote.keys):
  if !remote.has(cardId) → keep local (push to Supabase)
  if !local.has(cardId) → take remote (save to LocalStorage)
  if both exist:
    if local.updatedAt > remote.updatedAt → keep local (push to Supabase)
    else → take remote (save to LocalStorage)
```

**Debounced auto-sync:**

```typescript
// In useSync hook
const debouncedSync = useRef(
  debounce((userId, collection, timestamps) => {
    syncCollection(userId, collection, timestamps, false)
      .catch(() => queueForRetry(/* ... */));
  }, 500)
);

// Called after every mutation
function onCardUpdate(newCollection, newTimestamps) {
  if (user) debouncedSync.current(user.id, newCollection, newTimestamps);
}
```

### `useSync` Hook

```typescript
interface SyncState {
  status: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  lastSyncedAt: string | null;
  stats: { pushed: number; pulled: number } | null;
}

function useSync(): {
  syncState: SyncState;
  triggerSync: () => Promise<void>;   // Manual sync
  onCardUpdate: (collection: CollectionState, timestamps: Record<string, string>) => void;
  status: SyncState['status'];
}
```

### `data.ts` — Updates

```typescript
// NEW: localStorage schema v2
interface StorageV2 {
  version: 2;
  collection: CollectionState;
  timestamps: Record<string, string>;  // cardId → ISO timestamp
}

// Updated mutation
function updateCardCount(
  prevCollection: CollectionState,
  prevTimestamps: Record<string, string>,
  cardId: string,
  delta: number
): {
  collection: CollectionState;
  timestamps: Record<string, string>;
} {
  const current = prevCollection[cardId] || 0;
  const next = Math.max(0, current + delta);
  return {
    collection: { ...prevCollection, [cardId]: next },
    timestamps: { ...prevTimestamps, [cardId]: new Date().toISOString() },
  };
}
```

## State Management Flow

```
App.tsx
├── AuthProvider wraps everything
│   ├── useSync() provides sync status
│   └── useState<CollectionState> — exists already
│   └── useState<Record<string, string>> — NEW timestamps
│
├── LoginScreen (shown when !user)
├── SyncIndicator (shown when user)
└── Dashboard / CardGrid (existing components)
    └── onUpdateCount → App handles:
        1. updateCardCount() → new collection + timestamps
        2. saveCollectionState() to localStorage
        3. onCardUpdate() → debounced sync
```

## Sequence Diagram — First Login

```
User          App               Supabase          localStorage
 │             │                   │                  │
 │ Login click │                   │                  │
 │────────────→│                   │                  │
 │             │ signInWithOAuth() │                  │
 │             │──────────────────→│                  │
 │    OAuth    │                   │                  │
 │←───────────────────────────────│                  │
 │             │ session          │                  │
 │             │←──────────────────│                  │
 │             │                   │                  │
 │             │ pullCollection()  │                  │
 │             │──────────────────→│                  │
 │             │ remote (or empty) │                  │
 │             │←──────────────────│                  │
 │             │                   │                  │
 │             │ merge (MAX)       │                  │
 │             │ pushCollection()  │                  │
 │             │──────────────────→│                  │
 │             │                   │ save v2 format  │
 │             │                   │───────────────→  │
 │ "Synced"    │                   │                  │
 │←────────────│                   │                  │
```

## Sequence Diagram — Daily Mutation + Sync

```
User          App               Supabase          localStorage
 │             │                   │                  │
 │ Tap "+"     │                   │                  │
 │────────────→│                   │                  │
 │             │ updateCardCount() │                  │
 │             │ save to localStorage (immediate)     │
 │             │────────────────────────────────────→│
 │   updated   │                   │                  │
 │←────────────│                   │                  │
 │             │ (500ms debounce)  │                  │
 │             │ pushCollection()  │                  │
 │             │──────────────────→│                  │
 │             │         ok        │                  │
 │             │←──────────────────│                  │
```

## Conflict Resolution Detail

**First-time merge** (no timestamps in local):
```
merge(local, remote):
  for each cardId in union(local.keys, remote.keys):
    localCount = local.get(cardId) ?? 0     // default 0 if missing
    remoteCount = remote.get(cardId)?.count ?? 0
    result[cardId] = {
      count: max(localCount, remoteCount),   // safe heuristic
      updatedAt: now()
    }
```

**Subsequent sync** (both sides have timestamps):
```
merge(local, remote):
  for each cardId in union(local.keys, remote.keys):
    if !local.has(cardId):
      result[cardId] = remote.get(cardId)    // take remote
    else if !remote.has(cardId):
      result[cardId] = local.get(cardId)     // keep local
    else:
      l = local.get(cardId)
      r = remote.get(cardId)
      result[cardId] = (l.updatedAt > r.updatedAt) ? l : r
```

## Retry Strategy

```typescript
async function pushWithRetry(upsertFn, data, maxAttempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await upsertFn(data);
      return;  // success
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await delay(attempt * 1000);  // 1s, 2s, 3s
    }
  }
}
```

## Environment Variables

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth transport | Popup (not redirect) | Stays in SPA, no full-page reload, preserves React state |
| Sync trigger | Debounced (500ms) | Avoids Supabase rate limits, batches rapid toggles |
| LocalStorage role | Primary cache | Instant UX, works offline, migration path preserved |
| Timestamp strategy | Per-card ISO string | Simple, no library needed, works with Supabase timestamptz |
| Sync on login | Full pull → merge → push | Ensures consistency after long offline periods |
| Profile table | Synced from Google | No user management burden, auto-created on first login |
