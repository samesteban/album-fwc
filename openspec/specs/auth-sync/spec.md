# Spec: Auth & Sync — Cross-Device Sync with Supabase

> **Source**: Archived from change `2026-06-02-cross-device-sync`
> **Status**: Active spec — governs auth and sync behavior

## Requirements

> Keywords: MUST (requirement), SHOULD (recommendation), MAY (optional)

### Auth
1. Users MUST be able to log in via Google OAuth using Supabase Auth.
2. The session MUST persist across page reloads.
3. A logged-in user's session MUST be accessible globally via a React Context (`AuthProvider`).
4. The app MUST work without authentication (guest/local-only mode).
5. A login button SHOULD be visible when not authenticated.
6. A user avatar and display name SHOULD be visible when authenticated.

### Database
7. A `profiles` table MUST store user metadata (id, display_name, avatar_url, created_at).
8. A `collection_items` table MUST store per-card counts (id, user_id, card_id, count, updated_at) with a UNIQUE(user_id, card_id) constraint.
9. Row-Level Security MUST be enabled on both tables, scoped to `auth.uid()`.

### Sync Engine
10. On login, the app MUST run a full sync cycle: pull remote → merge with local → persist merged state.
11. First-time sync (local data without timestamps): count per card MUST use MAX of local and remote values. All cards MUST be tagged with `updated_at = now()`.
12. Subsequent syncs: the record with the latest `updated_at` MUST win (wins regardless of direction — increment OR decrement).
13. Every mutation MUST update `updated_at` to the current timestamp.
14. Mutations MUST update LocalStorage synchronously.
15. Mutations SHOULD sync to Supabase after a 500ms debounce.
16. Failed syncs MUST retry with exponential backoff (3 attempts).
17. Failed syncs after all retries MUST be silently queued — the app does NOT block the user.

### Data Preservation
18. Existing LocalStorage data MUST NOT be deleted or overwritten during auth or sync.
19. The merge operation MUST be additive-only.

### UI
20. A sync status indicator MUST show: `synced`, `syncing...`, `offline`, or `login to sync`.
21. The login flow MUST use a popup (not full-page redirect).

## Scenarios

### First Login with Existing Data
```
Given local data exists (ARG_15=3)
And Supabase has no data for this user
When the user logs in with Google
Then local data is uploaded to Supabase
And all cards are tagged with updated_at = now()
```

### Decrement Sync (Cross-Device)
```
Given Device A has ARG_15=3 (updated_at=10:00) and Device B has ARG_15=3 (updated_at=10:00)
When user decrements to 2 on Device A at 11:00
And sync runs
Then Device B shows ARG_15=2
— Latest updated_at (11:00) wins, correctly reflecting the reduction
```

### Guest Mode
```
Given the user is NOT logged in
When they open the app
Then the app works fully with LocalStorage
And a login prompt is shown
```

## Data Contracts

### LocalStorage v2 Format
```typescript
interface StorageV2 {
  version: 2;
  collection: Record<string, number>;       // cardId → count
  timestamps: Record<string, string>;       // cardId → ISO timestamp
}
```

### Supabase `collection_items` Row
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | FK → profiles.id, FK → auth.users.id |
| card_id | text | e.g. "ARG_15" |
| count | integer | >= 0 |
| updated_at | timestamptz | default now() |
| UNIQUE | (user_id, card_id) | |

### Supabase `profiles` Row
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK, matches auth.users.id |
| display_name | text | From Google profile |
| avatar_url | text | From Google profile |
| created_at | timestamptz | default now() |
