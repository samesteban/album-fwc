# Tasks: Card Scanner

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~730-780 |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Suggested split | PR 1 (foundation: types + libs + worker) → PR 2 (hooks + scanner components) → PR 3 (wiring: App.tsx + nav) |
| Delivery strategy | ask-always |
| Chain strategy | feature-branch-chain |

```
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Types + libs + regex + Web Worker | PR 1 | Foundation — no UI, independently testable |
| 2 | Hooks + ScannerView + Viewfinder + Overlay | PR 2 | Core UI — depends on PR 1 types/libs |
| 3 | App.tsx nav integration + wiring | PR 3 | Glue layer — depends on PR 2 components |

## Phase 1: Foundation

- [x] 1.1 Add `tesseract.js` to `package.json` dependencies
- [x] 1.2 Add `ScannerStatus`, `ScanResult`, `OcrRequest`, `OcrResponse` types to `src/types.ts`
- [x] 1.3 Create `src/lib/scanner-regex.ts` — `CODE_PATTERN` regex, `VALID_SECTIONS` set, `isValidNumber()` per section type
- [x] 1.4 Create `src/lib/scanner-state.ts` — `resolveCardStatus()` to parse code → cardId → localStorage lookup + `parseScannedCode()` helper in `src/data.ts`
- [x] 1.5 Create `src/workers/ocr.worker.ts` — Tesseract.js wrapper: init, recognize, regex filter, terminate lifecycle

## Phase 2: Core Implementation

- [x] 2.1 Create `src/hooks/useOcrWorker.ts` — Worker instantiation, message passing (postMessage → onmessage), ready/result/error handling
- [x] 2.2 Create `src/hooks/useScanner.ts` — Camera init (`getUserMedia`), `requestAnimationFrame` frame loop with 500ms throttle, freeze/resume controls, scanner state machine
- [x] 2.3 Create `src/components/Viewfinder.tsx` — Centered frame overlay with corner cutouts, 5 color states (init/scanning/match-missing/match-existing/error), CSS transitions
- [x] 2.4 Create `src/components/ScanOverlay.tsx` — Slide-up card (motion `y: '100%' → 0`), code badge, status text, "Pegar"/"Agregar Repetida" + "Siguiente" buttons, success flash feedback
- [x] 2.5 Create `src/components/ScannerView.tsx` — Full-screen layout: `<video>` + Viewfinder overlay + bottom controls + ScanOverlay conditional, orchestrates `useScanner` + `useOcrWorker`

## Phase 3: Integration

- [x] 3.1 Add "Intercambios" tab to bottom nav in `src/App.tsx` — `Scan` lucide icon, conditional render of `ScannerView` vs existing tabs
- [x] 3.2 Wire ScannerView data mutations — `onCardUpdate` callback from App.tsx `handleUpdateCount`, triggers sync when logged in
- [x] 3.3 Test camera permission denied and unavailable states — verify error UI renders correctly *(manual)*
- [x] 3.4 Test full scan flow: code detection → freeze → overlay → Pegar → Siguiente → resume *(manual)*
