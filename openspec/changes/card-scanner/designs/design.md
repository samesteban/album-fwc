# Card Scanner — Technical Design

## Visual Design Language

### Design System Reference

The scanner UI MUST follow the existing app design system:

| Token | Value | Usage |
|-------|-------|-------|
| `bg-surface` | `bg-emerald-950` | Main background, card surfaces |
| `bg-card` | `bg-emerald-900` | Card/container backgrounds |
| `bg-card-border` | `border-emerald-800` | Default card borders |
| `accent-primary` | `bg-yellow-400` / `text-yellow-400` | Highlights, active states |
| `text-primary` | `text-white` | Primary text |
| `text-secondary` | `text-emerald-300` | Secondary text |
| `text-label` | `text-emerald-400` | Labels, muted text |
| `status-missing` | `bg-red-500/10` / `text-red-400` / `border-red-500/20` | Missing cards |
| `status-pasted` | `bg-emerald-400/10` / `text-emerald-300` | Pasted cards (count=1) |
| `status-repeated` | `bg-yellow-400/10` / `text-yellow-400` | Repeated cards (count>=2) |

Scanner-specific additions (viewport + overlay):

| Token | Value | Usage |
|-------|-------|-------|
| `viewport-match-missing` | `border-emerald-400` + `shadow-emerald-400/40` | Green glow when scanning missing card |
| `viewport-match-existing` | `border-yellow-400` + `shadow-yellow-400/40` | Yellow glow when scanning existing card |
| `overlay-bg` | `bg-emerald-950/90 backdrop-blur-md` | Overlay card background |
| `scanning-bg` | `bg-black` | Full-screen camera background |

### Typography

- **Section codes** (e.g., "ESP 5"): `font-mono font-black text-white text-xs` — exact same badge style as `CardGrid.tsx`
- **Status labels**: `text-[10px] font-bold uppercase tracking-wider font-mono` with color per status
- **Action buttons**: `text-[10px] font-black` with `bg-yellow-400` for primary, `bg-emerald-800` for secondary
- **Headings**: `text-sm font-black uppercase tracking-widest text-emerald-300` for scan results

### Shapes

- **Viewfinder frame**: `rounded-3xl` (24px) to match card corners
- **Overlay card**: `rounded-3xl` with `border border-emerald-800`
- **Action buttons**: `rounded-xl` for primary, `rounded-full` for icon-only
- **Status badge**: `rounded-full` with `px-2.5 py-1`

### Icons

Use `lucide-react` icons consistent with the app:
- `Scan` or `Camera` for the Intercambios tab
- `CheckCircle` for successful scan
- `Plus` for Pegar/Agregar
- `ArrowRight` or `SkipForward` for Siguiente

## Architecture

### Module Structure

```
src/
├── components/
│   ├── ScannerView.tsx      ← Camera + viewfinder + capture loop
│   ├── ScanOverlay.tsx      ← Results overlay with actions
│   └── Viewfinder.tsx        ← Viewfinder frame overlay (CSS only)
├── hooks/
│   ├── useScanner.ts        ← Camera lifecycle, frame loop, worker orchestration
│   └── useOcrWorker.ts      ← Web Worker lifecycle, message passing
├── workers/
│   └── ocr.worker.ts        ← Tesseract.js OCR in Web Worker
├── lib/
│   ├── scanner-regex.ts     ← Regex validation + section/number lookup
│   └── scanner-state.ts     ← Card ID resolver (code → cardId → count)
├── types.ts                 ← + ScannerState, ScanResult types
├── App.tsx                  ← + 3rd tab + conditional scanner render
└── data.ts                  ← + parseScannedCode() helper
```

### Component Tree

```
App
├── Header (sync status, login) ← unchanged
├── Main content
│   ├── [Tab: Dashboard] ← unchanged
│   ├── [Tab: Collection] ← unchanged
│   └── [Tab: Intercambios]
│       └── ScannerView ← NEW
│           ├── <video> (full screen, z-0)
│           ├── Viewfinder (centered frame overlay, z-10)
│           │   └── Colored based on scan state:
│           │       ├── default → white/emerald
│           │       ├── match-missing → green (#34d399)
│           │       └── match-existing → yellow (#facc15)
│           ├── Scanner controls (bottom area, z-10)
│           │   ├── Flash toggle (optional)
│           │   └── "Apagar Cámara" button
│           └── ScanOverlay (shown on match, z-20)
│               ├── Code badge (e.g., "ESP 5")
│               ├── Status text ("Faltante" / "Pegada" / "X Repetidas")
│               ├── Button: "Pegar" or "Agregar Repetida" (primary)
│               └── Button: "Siguiente" (secondary)
└── Bottom Nav ← {+ "Intercambios" tab}
```

### Data Flow

```
┌──────────┐    capture frame     ┌──────────────┐   ImageData    ┌──────────────────┐
│ <video>  │ ───────────────────→ │ <canvas>     │ ────────────→ │  ocr.worker.ts   │
│  live    │   ~500ms interval    │  (offscreen)  │   postMessage  │  Tesseract.js    │
└──────────┘                      └──────────────┘                │  + regex filter  │
      ↑ paused on match                                            └────────┬─────────┘
      │                                                                    │ match?
      │                                                                    ↓
      │                                                              ┌──────────────┐
      │                                         ┌────────────────── │ ScanResult    │
      │                                         │  null (no match)   │ { raw, code,  │
      │                                         │                    │  section, num}│
      │                                         └────────────────── └──────────────┘
      │                                                                   │
      │                                                                   ↓
      │                                                            ┌──────────────┐
      │                         ┌──────────────────────────────── │ useScanner   │
      │                         │  handles state:                  │ (hook)       │
      │                         │  - scanning / frozen / overlay   └──────────────┘
      │                         │  - invokes lookupCardStatus()          │
      │                         │  - controls video.pause()/play()       │
      │                         └────────────────────────────────────────┘
```

### State Machine

```
[IDLE] ──→ [LOADING] ──→ [SCANNING] ──→ [FROZEN] ──→ [OVERLAY]
  ↑          (camera       (auto-         (match       (result
  │          + worker      capture        detected)     shown)
  │          init)         loop)
  │                                          │
  └──────────────────────────────────────────┘
            "Siguiente" or error
```

### OCR Worker Contract

```typescript
// Message from main thread → worker
interface OcrRequest {
  type: 'scan';
  imageData: ImageData;
}

// Message from worker → main thread
interface OcrResponse {
  type: 'result';
  raw: string | null;       // Full OCR text (or null if no text found)
  match: string | null;     // Regex match group (e.g., "ESP 5") or null
  sectionCode: string | null;
  number: string | null;
}

interface OcrReady {
  type: 'ready';
}

interface OcrError {
  type: 'error';
  message: string;
}
```

### Scanner State Types

```typescript
// Added to src/types.ts

type ScannerStatus = 'idle' | 'loading' | 'scanning' | 'frozen' | 'error';

interface ScanResult {
  raw: string;              // Full OCR output
  code: string;             // e.g., "ESP 5"
  sectionCode: string;      // e.g., "ESP"
  number: string;           // e.g., "5"
  cardId: string;           // e.g., "ESP_5"
  count: number;            // Current localStorage count
  status: 'missing' | 'pasted' | 'repeated';
}
```

### Regex Validation (`src/lib/scanner-regex.ts`)

```typescript
const CODE_PATTERN = /^([A-Z]{2,3}) (\d{1,2})$/;

// Valid section IDs
const VALID_SECTIONS = new Set([
  'MEX','RSA','KOR','CZE','CAN','BIH','QAT','SUI','BRA','MAR',
  'HAI','SCO','USA','PAR','AUS','TUR','GER','CUW','CIV','ECU',
  'NED','JPN','SWE','TUN','BEL','EGY','IRN','NZL','ESP','CPV',
  'KSA','URU','FRA','SEN','IRQ','NOR','ARG','ALG','AUT','JOR',
  'PORT','COD','UZB','COL','ENG','CRO','GHA','PAN','FWC','CC',
]);

// Number range per section type
function isValidNumber(sectionCode: string, num: string): boolean {
  const n = parseInt(num, 10);
  if (sectionCode === 'FWC') return num === '00' || (n >= 1 && n <= 19);
  if (sectionCode === 'CC') return n >= 1 && n <= 14;
  return n >= 1 && n <= 20; // Team sections
}
```

### Card Status Resolution (`src/lib/scanner-state.ts`)

Resolves scanned code → cardId → localStorage lookup:

```typescript
function resolveCardStatus(code: string): ScanResult | null {
  const match = code.match(/^([A-Z]{2,3}) (\d{1,2})$/);
  if (!match) return null;

  const sectionCode = match[1];
  const number = match[2];

  if (!VALID_SECTIONS.has(sectionCode)) return null;
  if (!isValidNumber(sectionCode, number)) return null;

  const cardId = `${sectionCode}_${number}`;

  // Read directly from localStorage
  const collection = loadCollectionState();
  const count = collection[cardId] || 0;

  return {
    raw: code,
    code,
    sectionCode,
    number,
    cardId,
    count,
    status: count === 0 ? 'missing' : count === 1 ? 'pasted' : 'repeated',
  };
}
```

## Sequence Diagrams

### Happy Path — Scan Missing Card

```
User           ScannerView         useScanner          ocr.worker       localStorage
 │                  │                  │                  │                  │
 │  tap Intercambios│                  │                  │                  │
 │─────────────────→│                  │                  │                  │
 │                  │  init camera     │                  │                  │
 │                  │─────────────────→│                  │                  │
 │                  │                  │  load Tesseract  │                  │
 │                  │                  │─────────────────→│                  │
 │                  │                  │                  │─── ready ───────→│
 │                  │                  │←──── ready ──────│                  │
 │                  │←──── ready ──────│                  │                  │
 │                  │  show viewfinder │                  │                  │
 │  [camera live]   │                  │                  │                  │
 │◄─────────────────│                  │                  │                  │
 │                  │  auto-capture    │                  │                  │
 │                  │  every 500ms     │                  │                  │
 │                  │─────────────────→│  ImageData       │                  │
 │                  │                  │─────────────────→│  OCR + regex     │
 │                  │                  │                  │──────────────────│
 │                  │                  │←── "ESP 5" ─────│                  │
 │                  │←── ScanResult ───│                  │                  │
 │                  │                  │                  │                  │
 │                  │  look up status  │                  │                  │
 │                  │───────────────────────────────────────────────────────→│
 │                  │←────────────────────────────────── count=0 ───────────│
 │                  │                                                       │
 │                  │  freeze video                                          │
 │                  │  viewfinder → green (#34d399)                          │
 │                  │  show overlay: "ESP 5 - Faltante"                      │
 │                  │  [Pegar] [Siguiente]                                   │
 │◄─────────────────│                                                       │
 │                                                                          │
 │  tap "Pegar"                                                             │
 │─────────────────→│  update count 0→1                                     │
 │                  │───────────────────────────────────────────────────────→│
 │                  │  show success flash                                    │
 │                  │  status updates to "Pegada"                            │
 │                                                                          │
 │  tap "Siguiente"                                                         │
 │─────────────────→│  resume video                                         │
 │                  │  clear overlay                                         │
 │                  │  viewfinder → default                                  │
 │                  │  restart capture loop                                  │
```

### Error Path — Invalid OCR

```
Camera            useScanner          ocr.worker
 │                    │                  │
 │  frame captured    │                  │
 │───────────────────→│  ImageData       │
 │                    │─────────────────→│
 │                    │                  │  OCR → "garbage text"
 │                    │                  │  regex → no match
 │                    │←── null ─────────│
 │                    │                  │
 │                    │  continue loop   │
 │                    │  (no state change)│
 │                    │  wait 500ms       │
```

## Performance Design

### Lazy Loading Strategy

1. **Tesseract.js** is NOT imported at app bootstrap
2. On "Intercambios" tab mount → dynamic `import('tesseract.js')` + spawn Web Worker
3. Show a loading skeleton matching app style while initializing
4. Worker is terminated on tab unmount (to release WASM memory)

### Frame Throttling

- Use `requestAnimationFrame` loop with time accumulator (not `setInterval`)
- Process at most 1 frame per 500ms
- Skip processing if worker is busy (backpressure)
- Drop accumulated frames if worker queue exceeds 1

### Memory Considerations

- Camera stream released on tab unmount (`stream.getTracks().forEach(t => t.stop())`)
- Worker terminated on unmount
- Canvas reused (no new allocations per frame — redraw into same canvas)
- Tesseract worker terminates after last message + timeout

## Interaction Design

### Viewfinder States

| State | Border color | Glow | Description |
|-------|-------------|------|-------------|
| Initializing | `border-emerald-800/50` | None | Camera + worker loading |
| Scanning | `border-emerald-400/50` | Subtle pulse | Auto-capture active |
| Match: missing | `border-emerald-400` | `shadow-emerald-400/40` | Green glow |
| Match: existing | `border-yellow-400` | `shadow-yellow-400/40` | Yellow glow |
| Error | `border-red-400` | `shadow-red-400/30` | Camera error |

### Viewfinder Sizing

- Viewport frame: 75% of screen width, aspect ratio 4:3
- Positioned center-screen using `absolute inset-0 flex items-center justify-center`
- Corner cutouts using CSS pseudo-elements or box-shadow technique
- Rounded corners: `rounded-3xl` to match card design

### Overlay Card

- Slides up from bottom (matching SectionModal pattern): `motion.div initial={{ y: '100%' }} animate={{ y: 0 }}`
- Background: `bg-emerald-950/90 backdrop-blur-md`
- Border: `border border-emerald-800` rounded-3xl
- Internal padding: `p-4.5`
- Close affordance: "Siguiente" button

### Action Buttons

**"Pegar" / "Agregar Repetida" (primary):**
- `bg-yellow-400 hover:bg-yellow-300 text-emerald-950 font-black`
- `rounded-xl px-6 py-3 text-xs`
- `shadow-[0_4px_15px_rgba(234,179,8,0.3)]`

**"Siguiente" (secondary):**
- `bg-emerald-800 hover:bg-emerald-700 text-emerald-100`
- `rounded-xl px-6 py-3 text-xs font-bold`

## Web Worker Implementation

### Worker Script

The worker file (`src/workers/ocr.worker.ts`) will:

1. Import Tesseract.js inside the worker context (Vite handles worker bundling)
2. Create a single Tesseract worker on init with English language data
3. Listen for `message` events with ImageData
4. Run `worker.recognize(imageData)` on a canvas-backed image
5. Extract text, apply regex, return result
6. Terminate Tesseract worker on `close` message

### Worker Lifecycle

```
┌──────────┐   new Worker()   ┌──────────────┐
│ App      │ ───────────────→ │ ocr.worker    │
│ (main)   │                  │              │
│          │                  │ init Tesseract│
│          │                  │ load language │
│          │  ← postMessage   │              │
│          │    {type:'ready'}│              │
│          │                  │              │
│          │  → postMessage   │              │
│          │    {imageData}   │  recognize()  │
│          │                  │  regex filter │
│          │  ← postMessage   │              │
│          │    {result|null} │              │
│          │                  │              │
│          │  → postMessage   │              │
│          │    {type:'close'}│  terminate()  │
└──────────┘                  └──────────────┘
```

### Vite Worker Config

No special Vite config needed — `new Worker(new URL('./ocr.worker.ts', import.meta.url), { type: 'module' })` is supported out of the box by `@vitejs/plugin-react`.

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Tesseract.js ~1MB download | Lazy import + show loading skeleton; cache in browser on first load |
| OCR slow on low-end devices | Dynamic throttling — increase capture interval if processing takes >1s |
| Camera not available | Graceful fallback with error UI matching app style |
| Worker memory leak | Terminate worker on unmount; single worker instance per session |
| Glossy stickers reflect light | Viewfinder guides user; regex is lenient enough to catch partial reads |
