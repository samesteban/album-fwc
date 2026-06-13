# Proposal: Card Scanner

## Intent

Add a camera-based OCR scanner for sticker cards using Tesseract.js in a Web Worker. Users point their phone camera at a sticker's back (where the code like "ESP 5" or "FWC 00" is printed) and the app auto-detects it, checks localStorage status, and lets them mark it as pasted or duplicate — all without manual search.

## Scope

### In Scope
- New "Intercambios" tab in the bottom navigation bar
- Full-screen camera viewfinder with auto-capture (no trigger button)
- Tesseract.js OCR running in a Web Worker (non-blocking)
- Regex validation: `^[A-Z]{2,3} \d{1,2}$` with "00" exception
- Freeze frame on valid scan with color feedback (green=missing, yellow=exists)
- Overlay card: code detected, current status, action buttons ("Pegar" / "Agregar Repetida" / "Siguiente")
- Integration with existing localStorage data format (`CollectionState` via `data.ts`)
- Lazy loading of Tesseract.js to minimize initial bundle

### Out of Scope
- No backend/cloud OCR — everything runs client-side
- No barcode/QR scanning
- No image gallery import (camera-only)
- No multi-language OCR training (English only)
- No sync with Supabase during scanner flow (uses localStorage directly)

## Capabilities

### New Capabilities
- `card-scanner`: Camera-based OCR scanning of sticker codes with auto-detection, regex validation, and one-tap status updates

### Modified Capabilities
- None (auth-sync capability is unaffected)

## Approach

```
┌─────────────────────────────────────────────┐
│  ScannerView (new tab)                       │
│  ├── <video> live feed (full screen)         │
│  ├── Viewfinder overlay (CSS mask/border)    │
│  ├── Hidden <canvas> for frame capture       │
│  └── ScanOverlay (on valid match)            │
│       ├── Code detected + card info          │
│       ├── "Pegar" / "Agregar Repetida" btn   │
│       └── "Siguiente" btn                    │
├─────────────────────────────────────────────┤
│  Web Worker (OCR Worker)                     │
│  ├── Receives ImageData via postMessage      │
│  ├── Runs Tesseract.recognize()              │
│  ├── Post-processes with regex               │
│  └── Returns result or null                  │
└─────────────────────────────────────────────┘
```

The camera stream runs continuously. Every ~500ms a frame is captured to an offscreen canvas and sent to the Web Worker. On match, the video is paused (not stopped), the viewfinder color updates, and an overlay shows scan results.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/App.tsx` | Modified | Add 3rd tab + conditional ScannerView render |
| `src/components/ScannerView.tsx` | New | Camera + viewfinder + frame capture loop |
| `src/components/ScanOverlay.tsx` | New | Results overlay with action buttons |
| `src/components/Viewfinder.tsx` | New | CSS viewfinder overlay element |
| `src/hooks/useScanner.ts` | New | Camera lifecycle, frame loop, worker comms |
| `src/workers/ocr.worker.ts` | New | Tesseract.js Web Worker wrapper |
| `src/data.ts` | Modified | Helper to parse scanned code → cardId + sectionId |
| `src/types.ts` | Modified | Scanner state types (scanning, frozen, result) |
| `package.json` | Modified | Add `tesseract.js` dependency |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tesseract.js bundle size (~1MB+) | High | Lazy import + Web Worker (loaded only when user taps Intercambios) |
| Low OCR accuracy on glossy stickers | Medium | Regex post-processing filters noise; viewfinder guides user to align code |
| Camera permission denial | Low | Fallback message with instructions to enable camera |
| Mobile performance with OCR every 500ms | Medium | Web Worker keeps main thread free; can dynamically throttle if lag |

## Rollback Plan

Remove the Intercambios tab from `App.tsx`, delete `ScannerView.tsx`, `ScanOverlay.tsx`, `useScanner.ts`, `ocr.worker.ts`, revert `data.ts` and `types.ts` changes, remove `tesseract.js` from `package.json`.

## Dependencies

- `tesseract.js` (npm) — OCR engine with Web Worker support

## Success Criteria

- [ ] Scanner correctly detects and parses valid sticker codes (test with at least 5 section codes)
- [ ] Viewfinder color changes correctly based on localStorage status (green for 0, yellow for >=1)
- [ ] Overlay shows all required info and action buttons work
- [ ] No main thread blocking during OCR processing (verified with DevTools Performance tab)
- [ ] "Siguiente" correctly resets camera and clears state
- [ ] Works on mobile Safari and Chrome (PWA context)
