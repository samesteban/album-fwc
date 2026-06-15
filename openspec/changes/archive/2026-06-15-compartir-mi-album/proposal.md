# Proposal: Compartir mi Álbum

## Intent

Let users generate a public shareable link to their sticker collection snapshot, viewable by anyone without auth — zero DB queries, data from a JSON file in Supabase Storage.

## Scope

### In Scope
- Share generation button in Dashboard
- Supabase Storage bucket for JSON snapshots
- Public landing page `/album/:id`
- Manual SPA route detection (no router lib)
- Copy share URL to clipboard
- Loading state and error handling on public page

### Out of Scope
- Editing/deleting shares after creation
- Password-protected or private shares
- QR code generation
- Social sharing (native share API only)
- Analytics or tracking

## Capabilities

### New Capabilities
- `album-sharing`: Create public share snapshots of a user's collection state and view them via a short link without authentication.

### Modified Capabilities
- None — album sharing is a new independent capability with no overlap with existing `auth-sync` requirements.

## Approach

1. **Generation** (authenticated): Dashboard button → read `collectionState` + `profile.display_name` → generate short ID (nanoid, 5-7 chars) → upload `{ name, collectionState }` JSON to `album-shares/public/` → return `/album/<id>` → copy to clipboard.
2. **Viewing** (public): `App.tsx` parses `window.location.pathname` for `/album/:id` → `AlbumPage` fetches JSON from Supabase Storage public URL → reuse `SECTIONS_METADATA`, `buildInitialSections()`, `calculateStats()` → render pasted/missing/repeated.
3. **Bucket**: public downloads, auth-required uploads via Supabase client. No DB queries on viewing flow.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/Dashboard.tsx` | Modified | Add share button |
| `src/components/ShareButton.tsx` | New | Generation + clipboard |
| `src/components/AlbumPage.tsx` | New | Public landing page |
| `src/App.tsx` | Modified | URL route detection for `/album/:id` |
| `src/types.ts` | Modified | `ShareBlobData` type |
| `netlify.toml` | New | SPA fallback `/* /index.html 200` |
| Supabase Storage | New | `album-shares` bucket |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SPA fallback 404 on direct `/album/:id` | Med | Add `/* /index.html 200` in `netlify.toml` |
| Short ID collision | Low | Retry on upload collision |
| Bucket public access misconfig | Low | Test policy before deploy |

## Rollback Plan

Remove share button from Dashboard, revert App.tsx route detection, delete AlbumPage/ShareButton components, delete or privatize bucket.

## Dependencies

- `nanoid` for short IDs
- Supabase Storage (free tier: 1GB, 2M requests/month)

## Success Criteria

- [ ] Auth user generates share link, copies to clipboard
- [ ] Any visitor opens `/album/:id` and sees pasted/missing/repeated cards
- [ ] Invalid/deleted share ID shows graceful error (no crash)
- [ ] Zero DB queries on the viewing flow
