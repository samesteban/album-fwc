# Spec: Cross-Device Sync with Supabase + Google Auth

## Requirements

> Keywords: MUST (requirement), SHOULD (recommendation), MAY (optional)

### Auth

1. Users MUST be able to log in using their Google account via Supabase Auth.
2. The session MUST persist across page reloads using Supabase's built-in session recovery.
3. A logged-in user's session MUST be accessible globally via a React Context (`AuthProvider`).
4. The app MUST work without authentication. Auth is optional — the user MAY skip login and use LocalStorage-only mode.
5. A login button SHOULD be visible in the UI when the user is not authenticated.
6. A user avatar/display name SHOULD be visible when authenticated.

### Database

7. A `profiles` table MUST store user metadata: `id` (uuid, PK = auth.users.id), `display_name` (text), `avatar_url` (text), `created_at` (timestamptz).
8. A `collection_items` table MUST store per-card counts: `id` (uuid, PK), `user_id` (uuid, FK → profiles.id), `card_id` (text), `count` (integer, >= 0), `updated_at` (timestamptz).
9. A UNIQUE constraint MUST exist on `(user_id, card_id)` to prevent duplicate rows.
10. Row-Level Security (RLS) MUST be enabled on both tables.
11. Users MUST only be able to read/write their own rows (RLS policy scoped to `auth.uid()`).

### Sync Engine

12. On login, the app MUST perform a full sync cycle: pull remote data → merge with local → persist merged state.
13. **First-time sync** (local data has no timestamps): the count per card MUST be the MAX of local and remote values. All cards MUST be tagged with `updated_at = now()` after the merge.
14. **Subsequent syncs**: for each card, the record with the latest `updated_at` MUST win — regardless of whether the count increased or decreased.
15. Every card mutation (increment or decrement) MUST update `updated_at` to the current timestamp.
16. Mutations MUST update LocalStorage synchronously (immediate feedback).
17. Mutations SHOULD sync to Supabase after a 500ms debounce.
18. Failed syncs MUST be retried with exponential backoff (3 attempts).
19. Failed syncs after all retries MUST be silently queued — the app does NOT block the user.

### Data Preservation

20. Existing LocalStorage data MUST NOT be deleted or overwritten during auth or sync.
21. The merge operation MUST be additive-only: no local data is ever removed.
22. A reset/clear operation MUST still work locally (it clears LocalStorage AND sends a clear to Supabase).

### UI

23. A sync status indicator MUST show one of: `synced`, `syncing...`, `offline`, or `login to sync`.
24. The login flow MUST NOT redirect away from the app (popup or embedded redirect, not full-page navigation).

## Scenarios

### A1: First Login with Existing LocalStorage Data

```
Given the app has existing LocalStorage data (e.g., ARG_15=3, MEX_01=1)
And the user has NO data in Supabase yet
When the user logs in with Google for the first time
Then the local data is uploaded to Supabase
And each card is tagged with updated_at = now()
And the UI shows "synced" status
And LocalStorage data is preserved and enriched with timestamps
```

### A2: First Login — Remote Has More Data

```
Given the app has LocalStorage data (ARG_15=3)
And Supabase already has different data for this user (ARG_15=1, MEX_01=2)
When the user logs in
Then the merged result is (ARG_15=3, MEX_01=2) — MAX wins
And both devices now have the same data
```

### B1: Increment on Device A → Sync → Device B Sees It

```
Given the user is logged in on both Device A and Device B
And both show ARG_15=2 (updated_at=10:00)
When the user increments ARG_15 to 3 on Device A at 11:00
And sync runs
Then Device B shows ARG_15=3 after sync
```

### B2: Decrement on Device A → Sync → Device B Sees It

```
Given the user is logged in on both Device A and Device B
And both show ARG_15=3 (updated_at=10:00)
When the user decrements ARG_15 to 2 on Device A at 11:00 (they traded one away)
And sync runs
Then Device B shows ARG_15=2 after sync
— The latest updated_at (11:00) wins, correctly reflecting the reduction
```

### C1: Offline Mutation → Sync on Reconnect

```
Given the user is logged in and makes mutations while offline
When the connection is restored
Then the queued mutations sync to Supabase
And the UI updates from "offline" to "synced"
```

### C2: Login Without Existing Data

```
Given the app has NO LocalStorage data (fresh install)
When the user logs in with Google
Then a new profile row is created in Supabase
And a empty collection_items is initialized
And the app is ready to use
```

### D1: Guest Mode (No Auth)

```
Given the user has NOT logged in
When they open the app
Then the app works fully with LocalStorage
And a "Login to sync" indicator is shown
And no Supabase calls are made
```

### D2: Reset After Login

```
Given the user is logged in and has collection data in both LocalStorage and Supabase
When they tap "Reset collection"
Then LocalStorage is cleared
And all collection_items for this user are deleted in Supabase
And the UI shows a fresh collection
```

## Data Contracts

### LocalStorage Schema (after migration)

```typescript
interface LocalStorageData {
  version: 2;
  collection: Record<string, number>;       // cardId → count (existing)
  timestamps: Record<string, string>;       // cardId → ISO timestamp (NEW)
}
```

### Supabase `collection_items` Row

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | FK → `profiles.id`, FK → `auth.users.id` |
| `card_id` | `text` | e.g. "ARG_15" |
| `count` | `integer` | >= 0 |
| `updated_at` | `timestamptz` | default `now()` |

### Supabase `profiles` Row

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | PK, matches `auth.users.id` |
| `display_name` | `text` | From Google profile |
| `avatar_url` | `text` | From Google profile |
| `created_at` | `timestamptz` | default `now()` |

### RLS Policies

```sql
-- profiles: users can read/update their own row
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- collection_items: users can CRUD their own rows
CREATE POLICY "Users can read own items"
  ON collection_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own items"
  ON collection_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items"
  ON collection_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own items"
  ON collection_items FOR DELETE
  USING (auth.uid() = user_id);
```
