# Design: Compartir mi Álbum — Public Album Snapshots via Supabase Storage

## Technical Approach

Upload a JSON snapshot of the user's collection to Supabase Storage (public bucket, auth-required uploads) with a short nanoid key. The public album page fetches directly from Storage's public URL — zero server functions, zero DB queries. Route detection via manual `window.location.pathname` + `popstate` in App.tsx.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|----------|---------|-----------|--------|
| Storage backend | Supabase Storage vs Netlify Blobs | Netlify Blobs requires Pro plan + functions. Supabase already set up, free tier, public URLs work without auth. | **Supabase Storage** |
| Route handling | Manual pathname vs react-router | react-router for 2 routes is overkill. Manual parsing + popstate handles both cases cleanly. | **Manual pathname parsing** |
| Short ID | nanoid vs crypto.randomUUID | nanoid produces clean short IDs. Already standard practice for share links. | **nanoid(7)** |
| ShareButton UX | Modal vs inline confirmation | Modal adds complexity. Inline confirmation keeps the flow minimal. | **Inline below button** |
| Upload auth | Client-side supabase-js vs Netlify Function | Client upload uses existing supabase client with session JWT. No server needed. | **Client-side via supabase-js** |

## Data Flow

**Generation (authenticated user):**

```
Dashboard ShareButton
  │ read collectionState + profile.display_name
  │ generate nanoid(7)
  v
supabase.storage.from('album-shares').upload(`${id}.json`, blob)
  │ auth: user's JWT from supabase client session
  v
Public URL displayed → copy to clipboard
```

**Viewing (public, no auth):**

```
Browser: /album/{id}
  │ App.tsx matches pathname → renders AlbumPage
  v
AlbumPage
  │ fetch → Storage public URL
  │ parse → ShareBlobData { name, collectionState, createdAt }
  │ build sections via buildInitialSections()
  │ compute stats via calculateStats(), getTopRepeatedCards()
  v
Render: header → sections gallery → missing list → repeated list
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/ShareButton.tsx` | Create | Generation button + clipboard, 4 states (idle/generating/done/error) |
| `src/components/AlbumPage.tsx` | Create | Public album viewer, 4 states (loading/loaded/not-found/error) |
| `src/App.tsx` | Modify | Add pathname detection for `/album/:id`, conditional render |
| `src/types.ts` | Modify | Add `ShareBlobData` and state machine types |
| `netlify.toml` | Create | SPA fallback `/* /index.html 200` for direct navigation |
| `package.json` | Modify | Add `nanoid` dependency |

## Interfaces / Contracts

```typescript
// Blob stored in Supabase Storage uploaded as JSON
interface ShareBlobData {
  name: string | null;              // profile.display_name
  collectionState: CollectionState; // cardId → count
  createdAt: string;                // ISO 8601
}

// ShareButton states
type ShareGenerationState = 'idle' | 'generating' | 'done' | 'error';

// AlbumPage states
type AlbumPageState = 'loading' | 'loaded' | 'not-found' | 'error';
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | URL pathname matching | Mock `location.pathname` with valid/invalid patterns |
| Unit | ShareButton state machine | Render each state, verify UI output |
| Unit | AlbumPage state machine | Mock fetch responses (success/404/parse error) |
| E2E | Full share flow | Auth → generate → copy URL → open incognito → view album |
| E2E | Direct nav to `/album/:id` | Valid share ID and invalid/missing ID cases |
| E2E | Empty collection guard | Verify button disabled/hidden with empty collectionState |

## Migration / Rollout

No data migration. Existing collections are unaffected. Supabase Storage bucket `album-shares` needs to be created and configured (public downloads, auth-only uploads) before the feature goes live.

## Open Questions

- [ ] Confirm Supabase Storage bucket `album-shares` is created with correct policies (public SELECT, authenticated INSERT)
- [ ] Implement collision retry: generate new nanoid + check storage exists before upload
