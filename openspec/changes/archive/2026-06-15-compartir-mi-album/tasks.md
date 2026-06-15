# Tasks: Compartir mi Álbum

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~400–520 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-always |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

## Phase 1: Foundation / Infrastructure

- [x] 1.1 Create Supabase `album-shares` Storage bucket with public SELECT + authenticated INSERT policies
- [x] 1.2 Add `nanoid` dependency to `package.json`
- [x] 1.3 Add `ShareBlobData`, `ShareGenerationState`, `AlbumPageState` types to `src/types.ts`
- [x] 1.4 Create `netlify.toml` with `/* /index.html 200` SPA fallback

## Phase 2: Core Implementation

- [x] 2.1 Create `src/components/ShareButton.tsx` with 4 states (idle/generating/done/error), nanoid generation, supabase upload, and clipboard copy
- [x] 2.2 Create `src/components/AlbumPage.tsx` with 4 states (loading/loaded/not-found/error), fetch from Storage public URL, render sections via `buildInitialSections()`, missing stickers, repeated stickers via `getTopRepeatedCards()`
- [x] 2.3 Wire ShareButton into Dashboard — read `collectionState` + `profile.display_name`, disable on empty collection, hide when unauthenticated

## Phase 3: Integration / Wiring

- [x] 3.1 Add pathname detection in `src/App.tsx` for `/album/:id`, conditional render of AlbumPage vs existing Dashboard

## Phase 4: Testing

> ⚠️ No testing framework is installed in the project (strict_tdd: false, no test runner configured).  
> The following test scenarios are documented for manual or future automated verification.

### Test Scenarios

**4.1 — URL pathname matching (manual verification):**
- Valid: `/album/xk7f2a` → should match and extract "xk7f2a"
- Valid: `/album/a1B2C3D` → should match alphanumeric + underscore + hyphen
- Invalid: `/album/` → no match (no ID)
- Invalid: `/albums/xk7f2a` → no match (wrong base path)
- Invalid: `/album/xk7f2a/extra` → no match (extra path segments)

**4.2 — ShareButton state machine (manual verification):**
- `idle`: Shows "Compartir mi Álbum" button with Share2 icon
- `generating`: Shows spinner and "Generando enlace..."
- `done`: Shows URL card with "Copiar" button and "Nuevo" reset link
- `error`: Shows error message with "Reintentar" and "Cancelar" buttons

**4.3 — AlbumPage state machine (manual verification):**
- `loading`: Centered spinner with "Cargando álbum..."
- `loaded`: Full album view with header, stats, sections grid, missing stickers, repeated stickers
- `not-found`: "Álbum no encontrado" message with "Volver al inicio" link
- `error`: Error message with "Volver al inicio" link

**4.4 — Full share flow (E2E manual):**
1. Log in with Google OAuth
2. Ensure collection has at least one sticker
3. Navigate to Dashboard
4. Click "Compartir mi Álbum"
5. Wait for "generating" state
6. Verify "done" state with URL displayed
7. Click "Copiar" button → verify "Copiado!" feedback
8. Open incognito/private browser window
9. Navigate to the copied URL
10. Verify album renders with correct stickers

**4.5 — Direct navigation (E2E manual):**
- Valid ID: Navigate directly to `/album/{valid-share-id}` → verify album renders
- Invalid ID: Navigate to `/album/doesnotexist` → verify "Álbum no encontrado"

**4.6 — Empty collection guard (E2E manual):**
- Log in with empty collection
- Verify no "Compartir mi Álbum" button appears

**4.7 — Unauthenticated guard (E2E manual):**
- Log out
- Verify no "Compartir mi Álbum" button appears in Dashboard
