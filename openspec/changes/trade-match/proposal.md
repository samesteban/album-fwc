# Proposal: Trade Match (Comparador de Álbumes)

## Intent

Let two collectors compare their shared album snapshots to find trade opportunities. Currently each collector can only view their own collection or another's individually — no comparison exists.

## Scope

### In Scope
- New SPA route `/match` in App.tsx
- TradeMatchPage component with two inputs, parallel fetch, and results
- `computeTradeMatches()` pure function in data.ts
- New types (`TradeMatches`, `TradeCategory`) in types.ts
- Dashboard entry point linking to `/match`
- Loading, error, and empty states

### Out of Scope
- Shareable comparison URLs (`/match/id1/id2`)
- Comparison history or saved results
- Multiple simultaneous comparisons
- Chat/messaging between collectors
- In-app trade confirmation

## Capabilities

### New Capabilities
- `trade-match`: compare two album share snapshots to find which cards each party can give and which cards match as mutual trades

### Modified Capabilities
None — pure new capability. No spec-level changes to album-sharing or auth-sync.

## Approach

New SPA route `/match` mirrors existing `/album/{id}` pattern. TradeMatchPage reads `album_share_metadata` from localStorage to auto-fill "Tu ID". Both share JSONs fetched in parallel via `Promise.all()`. Pure `computeTradeMatches(sections, userState, otherState)` iterates all cards once (O(n)), returning three lists: `vosLeDas[]`, `elxTeDa[]`, `match[]`. Results grouped by category. Entry point added to Dashboard.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/App.tsx` | Modified | New route match for `/match` |
| `src/data.ts` | Modified | New `computeTradeMatches()` |
| `src/types.ts` | Modified | New `TradeMatches`, `TradeCategory` |
| `src/components/TradeMatchPage.tsx` | New | Main comparison UI |
| `src/components/Dashboard.tsx` | Modified | Entry point to `/match` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| No localStorage ID (never shared) | Medium | Prompt to share first with ShareButton link |
| Invalid/expired other ID | Low | Error state matching "Álbum no encontrado" |
| Empty results (identical collections) | Low | Friendly "Sin coincidencias" message |
| Private browsing localStorage | Low | Already handled by existing try/catch |

## Rollback Plan

Revert route addition in App.tsx, Dashboard entry point, and delete `TradeMatchPage.tsx`. No data migration needed.

## Dependencies

None. All building blocks exist: Storage fetch, localStorage reads, section iteration.

## Success Criteria

- [ ] `/match` route renders TradeMatchPage component
- [ ] Auto-fill from `album_share_metadata` works when present
- [ ] Parallel fetch of both share JSONs completes; parse errors handled
- [ ] `computeTradeMatches()` correctly produces three result lists
- [ ] Dashboard has visible entry point to the comparer
- [ ] Loading, error, and empty states render correctly
