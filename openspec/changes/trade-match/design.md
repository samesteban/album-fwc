# Design: Trade Match (Comparador de Álbumes)

## Technical Approach

New SPA route `/match` with a dedicated `TradeMatchPage` component that reads `album_share_metadata` from localStorage to auto-fill "Tu ID", fetches both album JSONs in parallel from Supabase Storage, and computes trade opportunities via a pure `computeTradeMatches()` function in data.ts. Follows existing `/album/:id` manual routing pattern — no router library needed.

## Architecture Decisions

### Decision: Route Strategy
| Option | Tradeoff | Decision |
|--------|----------|----------|
| Manual path matching in App.tsx | Consistent with existing `/album/:id`; no deps | ✅ **Chosen** — same pattern, renders TradeMatchPage standalone |
| React Router | Framework dependency for single route | ❌ Rejected — overkill, breaks consistency |
| Modal in Dashboard | Avoids routing | ❌ Rejected — spec requires dedicated route |

### Decision: Storage Fetch Pattern
| Option | Tradeoff | Decision |
|--------|----------|----------|
| Parallel `Promise.all` with raw `fetch` | Same as AlbumPage; simple; works | ✅ **Chosen** — pattern already proven |
| Supabase JS client on public bucket | Extra import; no auth benefit | ❌ Rejected — raw fetch is simpler for public reads |

### Decision: Trade Computation
| Option | Tradeoff | Decision |
|--------|----------|----------|
| Pure function in data.ts | Testable; O(n); no side effects | ✅ **Chosen** — clean, follows `calculateStats` pattern |
| Inline in component | Coupled to UI | ❌ Rejected — not testable |

### Decision: Dashboard Entry
| Option | Tradeoff | Decision |
|--------|----------|----------|
| Button/card in dashboard | Visible; no nav crowding | ✅ **Chosen** — placed near ShareButton section |
| Third bottom nav tab | Always visible | ❌ Rejected — spec says "entry point", not persistent nav |

## Data Flow

```
TradeMatchPage mounted at /match
  │
  ├─ Read localStorage('album_share_metadata')
  │   ├─ Found → pre-fill "Tu ID" input
  │   └─ Not found → show prompt "Compartí tu álbum primero"
  │
  ├─ User enters other ID → clicks "Comparar"
  │
  ├─ fetch both JSONs in parallel (Promise.all)
  │   ├─ URL: ${SUPABASE_URL}/storage/v1/object/public/album-shares/public/{id}.json
  │   ├─ Both return 200 + valid JSON → computeTradeMatches()
  │   ├─ Either 404 → "Álbum no encontrado"
  │   ├─ Either network error → "Error al cargar"
  │   └─ Both empty → "Nada para intercambiar"
  │
  └─ Render three result sections:
      ┌───────────┐  ┌───────────┐  ┌──────────────┐
      │ vosLeDas  │  │ elxTeDa   │  │ matches 🎯   │
      │ vos→elx   │  │ elx→vos   │  │ ambos extras │
      └───────────┘  └───────────┘  └──────────────┘
```

**`computeTradeMatches` algorithm** (iterates all sections/cards once):

```
for each card in all sections:
  userCount = userState[card.id] || 0
  otherCount = otherState[card.id] || 0

  if userCount > 1 AND otherCount === 0 → vosLeDas
  if otherCount > 1 AND userCount === 0 → elxTeDa
  if userCount > 1 AND otherCount > 1   → match
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/TradeMatchPage.tsx` | Create | Full-page form + results component with loading/error/empty states |
| `src/App.tsx` | Modify | Add `/match` path detection before `/album/:id` check; render TradeMatchPage |
| `src/data.ts` | Modify | Add `computeTradeMatches()` pure function |
| `src/types.ts` | Modify | Add `TradeCategory`, `TradeMatchItem`, `TradeResult` types |
| `src/components/Dashboard.tsx` | Modify | Add "Comparar Álbumes" entry card |

## Interfaces / Contracts

```typescript
// types.ts additions
type TradeCategory = 'vosLeDas' | 'elxTeDa' | 'match';

interface TradeMatchItem {
  cardId: string;
  sectionId: string;
  sectionFlag?: string;
  num: string;
  playerName?: string;
  userCount: number;
  otherCount: number;
  category: TradeCategory;
}

interface TradeResult {
  vosLeDas: TradeMatchItem[];
  elxTeDa: TradeMatchItem[];
  matches: TradeMatchItem[];
}
```

```typescript
// data.ts addition
function computeTradeMatches(
  sections: Section[],
  userState: CollectionState,
  otherState: CollectionState
): TradeResult;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `computeTradeMatches()` | Pure function tests: both have extras, one has extras, empty states, self-comparison, identical collections |
| Unit | `TradeMatchPage` states | Form renders, auto-fill from localStorage, loading/error/empty display |
| Integration | Parallel fetch | Mock fetch, verify both URLs called, verify error handling |
| E2E | Full flow | Manual — enter two valid share IDs, verify three sections render |

## Migration / Rollout

No migration required. New feature, no existing data schema changes.

## Open Questions

- [ ] Should the "Comparar" card in Dashboard show the user's share ID snippet when available?
- [ ] Is the match result highlighting enough (background color + 🎯 icon) or need more prominent treatment?
