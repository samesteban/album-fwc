## Exploration: Trade Match (Comparador de Álbumes)

### Current State

The system currently supports **individual album sharing**: authenticated users can generate a public JSON snapshot of their `collectionState` to Supabase Storage (`album-shares/public/{shareId}.json`), and any visitor can view it via `/album/{shareId}`. The share ID (7-char nanoid) is persisted in localStorage under key `album_share_metadata` as `{ shareId, createdAt }`.

The architecture uses manual SPA routing via `window.location.pathname` matching. Currently only `/album/([a-zA-Z0-9_-]+)` is matched as a special route; everything else falls through to the main app (Dashboard / Collection tabs). The bottom navigation has 2 tabs: "Resumen" (Dashboard) and "Mis Láminas" (Collection).

Data functions (`calculateStats`, `getTopRepeatedCards`, `buildInitialSections`) all accept a single `CollectionState`. There is **no existing function** for comparing two `CollectionState` objects.

### Affected Areas

| File | Why |
|------|-----|
| `src/App.tsx` | Add route matching for `/match` (and optionally `/match/{shareId}`) |
| `src/data.ts` | New `computeTradeMatches()` function comparing two `CollectionState` objects |
| `src/components/TradeMatchPage.tsx` | **New file** — the trade match UI component |
| `src/components/Dashboard.tsx` | Add entry point / link to the comparer |
| `src/components/TradeMatchView.tsx` | **New file** (or merged into TradeMatchPage) — result table/list |
| `src/types.ts` | New types: `TradeMatches`, `TradeCategory` |
| `openspec/specs/` | New spec file for the domain |

### Approaches

1. **New SPA route + dedicated page component** — Full page at `/match` with inputs, auto-fill from localStorage, fetch both JSONs, compute and display
   - Pros: Consistent with existing `/album/{id}` pattern; clean separation; shareable?
   - Cons: `/match/{id}` probably not shareable (needs two IDs); minimal new routing
   - Effort: Medium

2. **Dashboard section / modal** — Inline comparer within the Dashboard, opened by a button
   - Pros: No routing changes; keeps everything in one view
   - Cons: Modal/state complexity; harder to link to; breaks existing pattern for page-level features
   - Effort: Low

3. **New route with two share IDs in URL** — `/match/{myId}/{otherId}` allowing shareable match links
   - Pros: Fully shareable result URLs; most flexible
   - Cons: Over-engineered; two IDs in URL is fragile; UX unclear
   - Effort: High

### Recommendation

**Approach 1 (new route + dedicated component)**. It mirrors the existing `/album/{id}` pattern, keeps the codebase consistent, and the bottom nav has room for a third entry.

**Auto-fill strategy**: Read `album_share_metadata` from localStorage (same key as ShareButton). If present, auto-fill "Tu ID". If not, show a message guiding the user to share their album first.

**Computation strategy**: Pure function `computeTradeMatches(sections, userState, otherState)` in `data.ts`. Iterates all cards once (O(n), ~1000 cards). Returns three lists:
- `vosLeDas[]`: user has repeats (>1), other needs (=0)
- `elxTeDa[]`: other has repeats (>1), user needs (=0)
- `match[]`: cards where both conditions are true

**Navigation**: Add a third item to the bottom nav bar (between or after existing items), or add a prominent card in Dashboard.

### Risks

- **No share ID in localStorage**: User hasn't shared their album yet. Must handle gracefully with a prompt to share first.
- **Other ID is invalid**: Must handle fetch errors and invalid JSON just like `AlbumPage` does (404 → "no encontrado", parse error → "no encontrado").
- **Private browsing**: localStorage not available in some private modes. `nanoid` generation would still work, but the auto-fill from `album_share_metadata` would fail silently. Already handled by existing code's try/catch.
- **In-flight fetches**: Both fetches should happen in parallel via `Promise.all()`, with proper cancellation on unmount.
- **Edge cases**: Both collections could be identical (no matches), or both could be empty. Must show friendly empty states.

### Ready for Proposal

Yes. The scope is well-defined, the domain is small and isolated (no cross-cutting concerns), and all the building blocks (Storage fetch pattern, localStorage read pattern, section iteration) are already in place.
