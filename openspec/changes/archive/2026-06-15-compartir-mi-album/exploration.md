## Exploration: Compartir mi Álbum (Share Album Feature)

### Current State

**Netlify: zero configuration.** There is no `netlify.toml`, no `_redirects`, no `functions/` directory. The app is deployed to Netlify as a plain Vite SPA — Netlify's auto-detect (Vite preset) handles the build and deploy. The `dist/` folder is gitignored, so builds happen on Netlify CI.

**Netlify Blobs: not present.** `@netlify/blobs` is not in `package.json`. No blob infrastructure exists.

**Supabase Auth: fully set up.** Google OAuth via Supabase. `AuthProvider` provides `session`, `user`, `profile` (from `profiles` table). Profile has `display_name` (from Google's `user_metadata.name ?? user_metadata.full_name`), `avatar_url`, `created_at`. RLS is enabled on both `profiles` and `collection_items` tables (1,129 rows currently — real user data).

**Collection data structure:**
- **994 total cards**: 48 team sections × 20 cards + FWC (20 cards: 00 + 1-19) + Coca-Cola (14 cards: 1-14)
- `CollectionState` = `Record<string, number>` — cardId → count (e.g., `"ARG_15": 3`)
- Stored in localStorage under key `album_mundial_48_album_data_v2` (also synced to Supabase)
- Raw JSON estimate: ~40KB uncompressed, ~8-12KB gzipped (well within Netlify Blobs 25MB limit)

**Routing: none.** The app uses React state (`activeTab: 'dashboard' | 'collection'`) with conditional rendering in `App.tsx`. Bottom nav bar switches views. No React Router, no hash routing, no URL parsing.

**Build:** Vite builds to `dist/`. Output is `index.html` + hashed JS/CSS assets in `dist/assets/`.

**Existing components that can be reused for the landing page:**
- `Dashboard.tsx` — stats calculation (`calculateStats`), progress circle, KPIs, Top 10 repeated
- `CardGrid.tsx` — per-section card grid with status labels (missing/pasted/repeated)
- `SectionModal.tsx` — section picker with progress
- `data.ts` — `calculateStats()`, `getTopRepeatedCards()`, `SECTIONS_METADATA`, `buildInitialSections()`

### Affected Areas

| File | Why affected |
|------|-------------|
| `netlify.toml` | **NEW** — required to define functions directory, redirect rules for SPA fallback, and blob store configuration |
| `netlify/functions/create-share.ts` | **NEW** — Netlify Function: receives `{ name, collectionState }`, stores as JSON blob with short ID, returns URL |
| `netlify/functions/get-share.ts` | **NEW** — Netlify Function: reads blob by ID, returns JSON `{ name, collectionState }` |
| `package.json` | **NEW dependency** — add `@netlify/blobs` |
| `src/App.tsx` | **MODIFY** — add URL path detection for `/album/:id`, conditionally render `AlbumPage` instead of main app |
| `src/components/AlbumPage.tsx` | **NEW** — public landing page component, receives blob data, renders pasted/missing/repeated views |
| `src/components/ShareButton.tsx` | **NEW** — "Compartir" button on Dashboard, calls Netlify Function to generate share link |
| `.env` | **MODIFY** — may need Netlify deployment context env vars |
| `src/types.ts` | **MODIFY** — add `ShareBlobData` type |

### Approaches

1. **Manual URL parsing in App.tsx (no router library)** — Low effort, zero dependencies
   - Parse `window.location.pathname` in App.tsx, check for `/album/:id` pattern
   - Use `window.history.pushState` + `popstate` listener for navigation
   - Requires `netlify.toml` redirect: `/* /index.html 200` for SPA fallback
   - **Pros**: Zero dependencies, full control, minimal overhead, works for 2 routes
   - **Cons**: Manual popstate handling, not extensible for more routes
   - **Effort**: Low

2. **React Router** — Add `react-router-dom` for proper client-side routing
   - Wrap app in `BrowserRouter`, define routes for `/` and `/album/:id`
   - **Pros**: Standard approach, well-known API, handles edge cases (back/forward, deep links)
   - **Cons**: Adds ~14KB gzipped dependency, overkill for 2 routes
   - **Effort**: Medium

3. **Netlify Function generates complete HTML page (SSR-like)** — Function reads blob, renders full landing page HTML server-side
   - **Pros**: No JS required to view, fastest initial load, SEO-friendly
   - **Cons**: Duplicate rendering logic (can't reuse React components), no client interactivity, against the SPA architecture
   - **Effort**: High

4. **Edge Function serves JSON** — Edge Function at `/api/album/:id.json` reads blob, returns JSON; SPA fetches it
   - **Pros**: Edge-fast response (<50ms), cached at CDN
   - **Cons**: Requires Edge Functions config, more complex than standard Functions for this payload size
   - **Effort**: Medium-High

### Recommendation

**Adopt approach 1 + standard Netlify Functions (not Edge):**

- **Routing**: Manual URL parsing in `App.tsx` — the simplest approach for 2 routes. Pair with `netlify.toml` redirect for SPA fallback.
- **Generate share**: Standard Netlify Function `create-share` at `/api/share` — receives POST `{ name, collectionState }`, generates short random ID (e.g., `nanoid(5)`), stores JSON in Netlify Blobs store, returns `{ id, url: /album/x7k2f }`.
- **Read share**: Standard Netlify Function `get-share` at `/api/share/:id` — reads blob from store by ID, returns `{ name, collectionState }`.
- **Landing page**: New `AlbumPage` component that fetches from `/api/share/:id` on mount and renders three sections: pasted stickers (per section with status like CardGrid), missing stickers (summary list), repeated counts (table per card).
- **Reuse**: `AlbumPage` calls `calculateStats()` and `getTopRepeatedCards()` from `data.ts` for stats. Reuses `SECTIONS_METADATA` and `buildInitialSections()` for the card catalog.
- **Blob store**: Use `@netlify/blobs` with a dedicated store name (e.g., `album-shares`). The blob key is the short ID, value is JSON `{ name, collectionState }`.

**Why standard Functions over Edge Functions**: The payload is tiny (~40KB), latency difference is negligible for a single blob read. Standard Functions are simpler to configure, debug, and deploy. No Edge Function-specific config needed.

**Why no React Router**: Two routes don't justify a routing library. Manual URL parsing with `window.location.pathname` and `popstate` handles both cases cleanly. If more routes emerge later, the router can be added then.

### Risks

1. **Netlify deployment context**: Need to verify the project is actually deployed on Netlify and that Netlify Blobs add-on is provisioned or available on the plan. Blobs require Netlify Pro plan or higher, or the Starter plan with usage-based billing. **This needs verification before implementation.**

2. **Function cold starts**: First request after a period of inactivity may take 1-3 seconds. The share creation is user-initiated so acceptable. The public view fetch could be slow on first load — consider prefetching or adding a loading skeleton.

3. **Blob data integrity**: If a blob is deleted or expires, the share link breaks. Netlify Blobs are persistent but need to understand retention/expiry defaults (default: indefinite, but plan limits may apply).

4. **Short ID collision risk**: With 5-char alphanumeric (a-z, 0-9, ~36^5 = 60M combinations), collision risk is minimal for a personal album app. But worth implementing collision retry logic in `create-share`.

5. **SPA fallback misconfiguration**: If `netlify.toml` redirect rules are wrong, direct navigation to `/album/x7k2f` will return 404 instead of `index.html`. Must test thoroughly.

6. **Auth on the main app vs no auth on sharing**: The share Feature **must never** hit the DB or Supabase. The `get-share` Function should only read from Netlify Blobs, never from Supabase. This is enforced by the Function simply not having the Supabase client.

7. **User's display name**: Available from `profile.display_name` in the Auth context. Falls back gracefully to display_name being `null`.

### Ready for Proposal

**Yes** — the investigation is complete. All major unknowns have been resolved. The recommendation is clear and the risks are documented.

One clarification for the orchestrator to tell the user before proposal:
> "Need to confirm: Does your Netlify plan support Netlify Blobs? Blobs require at least the Pro plan (Starter plan with usage-based billing may also work). If not, we'll need an alternative storage approach."
