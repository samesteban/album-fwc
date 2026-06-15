# Tasks: Trade Match — Album Comparison Feature

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450–520 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (preflight accepted 800-line budget) |
| Delivery strategy | ask-always |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

Single PR — all files tightly coupled (types → logic → component → integration → tests). No meaningful standalone slice below 400 lines.

## Phase 1: Foundation (Types + Logic)

- [x] 1.1 Add `TradeCategory`, `TradeMatchItem`, `TradeResult` types to `src/types.ts`
- [x] 1.2 Add `computeTradeMatches()` pure function in `src/data.ts` — O(n) single pass over sections/cards

## Phase 2: Core Component

- [x] 2.1 Create `src/components/TradeMatchPage.tsx` with two ID inputs and "Comparar" button
- [x] 2.2 Implement localStorage auto-fill for "Tu ID"; show share prompt when missing
- [x] 2.3 Add parallel `Promise.all` fetch with loading spinner
- [x] 2.4 Render three result sections (vosLeDas, elxTeDa, matches 🎯) with flag/section/card/count
- [x] 2.5 Handle 404 → "Álbum no encontrado"; network error → "Error al cargar"
- [x] 2.6 Handle empty states: both empty, other empty, self-comparison, no matches

## Phase 3: Integration

- [x] 3.1 Add `/match` path detection in `src/App.tsx` before `/album/:id`; render TradeMatchPage
- [x] 3.2 Add "Comparar Álbumes" entry card in `src/components/Dashboard.tsx` near ShareButton

## Phase 4: Testing (no test framework installed — scenarios documented)

- [x] 4.1 Documented `computeTradeMatches()` test scenarios (see below)
- [x] 4.2 Documented TradeMatchPage state test scenarios (see below)
- [x] 4.3 Documented integration test scenarios (see below)

### Test Scenarios — `computeTradeMatches()`

#### TC-MATCH-001: Both parties have extras for different cards
- Input: userState = { "ARG_1": 2, "MEX_5": 1 }, otherState = { "MEX_5": 2, "BRA_3": 0 }
- Expected: vosLeDas = [ARG_1], elxTeDa = [MEX_5], matches = []

#### TC-MATCH-002: Both have extras for the same card (match)
- Input: userState = { "ARG_1": 2 }, otherState = { "ARG_1": 3 }
- Expected: vosLeDas = [], elxTeDa = [], matches = [ARG_1]

#### TC-MATCH-003: Empty collections
- Input: userState = {}, otherState = {}
- Expected: all three arrays empty

#### TC-MATCH-004: Self-comparison (identical states)
- Input: userState = { "ARG_1": 2, "MEX_5": 3 }, otherState = { "ARG_1": 2, "MEX_5": 3 }
- Expected: matches = [ARG_1, MEX_5], vosLeDas = [], elxTeDa = []
- Note: Self-comparison is detected at UI level before calling computeTradeMatches

#### TC-MATCH-005: Other collection has no duplicates
- Input: userState = { "ARG_1": 2 }, otherState = { "ARG_1": 1 }
- Expected: vosLeDas = [ARG_1], elxTeDa = [], matches = []
- Note: otherCount > 1 must be true for elxTeDa; count of 1 means pasted but no duplicate

#### TC-MATCH-006: User has no duplicates
- Input: userState = { "FWC_5": 1 }, otherState = { "FWC_5": 3 }
- Expected: vosLeDas = [], elxTeDa = [FWC_5], matches = []

#### TC-MATCH-007: Card count === 0 (missing) on both sides
- Input: userState = { "CC_10": 0 }, otherState = { "CC_10": 0 }
- Expected: card excluded (userCount not > 1, otherCount not > 1)

### Test Scenarios — TradeMatchPage States

#### TC-PAGE-001: Form render with stored ID
- Setup: localStorage has `album_share_metadata` with valid shareId
- Expected: "Tu ID" input is pre-filled, "ID del otro álbum" is empty, "Comparar" button is visible

#### TC-PAGE-002: Form render without stored ID
- Setup: localStorage has NO `album_share_metadata`
- Expected: Prompt "Primero compartí tu álbum" with "Volver al inicio" link

#### TC-PAGE-003: Loading state
- Setup: User clicks "Comparar" with two valid IDs
- Expected: Spinner visible, "Comparando álbumes..." text, no other content

#### TC-PAGE-004: Error state on invalid ID
- Setup: One or both fetch requests return 404 or network error
- Expected: Error message "No se pudo cargar uno de los álbumes", retry button visible

#### TC-PAGE-005: Results with matches
- Setup: Both collections have cards with duplicate counts
- Expected: Three sections rendered, "Matches 🎯" section highlighted with ring

#### TC-PAGE-006: Empty results
- Setup: No trade opportunities between the two collections
- Expected: "Nada para intercambiar" message

#### TC-PAGE-007: Self-comparison
- Setup: Same ID in both inputs
- Expected: "Mismo álbum" message without fetch

### Integration Scenarios

#### TC-INT-001: Parallel fetch calls both URLs
- Both Storage URLs are called via fetch; Promise.all resolves when both complete

#### TC-INT-002: Error propagation
- If either fetch fails (network error), the catch block catches it; page state transitions to 'error'

#### TC-INT-003: Invalid JSON response
- Response is 200 but body is not valid ShareData; isValidShareData check catches it → error state
