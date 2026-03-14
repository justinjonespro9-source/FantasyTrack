# Workspace problems triage (pre–shareable live)

**Last run:** Pre-launch re-check. Build and tsc pass; blockers and pre-launch issues addressed.

---

## Current state (after fixes)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ Passes |
| `npm run build` | ✅ Passes (no errors, no ESLint warnings) |
| `npx prisma validate` | ✅ Schema valid |
| `npx prisma generate` | ✅ Client generated |

---

## Problem count before this pass

- **Blockers:** 1 (tsconfig: `tsc` failed when `.next` was missing).
- **Should fix before sharing:** 3 (ESLint react-hooks/exhaustive-deps in contest-board and contest-live-tape).
- **Safe to defer:** npm "devdir" warning; Next telemetry notice (not code).

---

## Grouping (pre-fix)

### Blocker for deployment/testing

- **tsconfig:** `include` had `.next/types/**/*.ts` and `exclude` did not include `.next`. Running `npx tsc --noEmit` without a prior `next build` (or with a clean `.next`) caused 16 “file not found” errors. **Fixed:** added `.next` to `exclude` so standalone tsc does not depend on generated files.

### Should fix before sharing publicly

- **contest-board.tsx (line 502):** `useEffect` missing dependency `refreshOdds`. **Fixed:** added eslint-disable-next-line with comment (intentional: poll only depends on contestId/bettingClosed).
- **contest-live-tape.tsx (lines 127, 133):** `useEffect` missing `load`, `useMemo` missing `latest`. **Fixed:** wrapped `load` in `useCallback([contestId])`, used `[load]` in effect deps; headline useMemo deps set to `[latest]`.

### Safe to defer

- npm warning: `Unknown env config "devdir"` (npm config, not app code).
- Next.js telemetry message during build (informational).

---

## Confirmation

- **npm run build:** Passes.
- **Prisma schema:** No issues; `prisma validate` and `prisma generate` succeed.
- **Runtime:** No changes to login, admin, contest pages, or live stats pulling; only tsconfig and dependency-array / lint fixes. No refactors that would affect auth, admin, contest, or `/api/internal/basketball-live-stats`.

---

## Files changed (this pass)

| File | Change |
|------|--------|
| `tsconfig.json` | Added `.next` to `exclude` so `tsc --noEmit` works without generated types. |
| `components/contest/contest-board.tsx` | eslint-disable-next-line for the odds-polling useEffect. |
| `components/contest-live-tape.tsx` | `useCallback` for `load`, effect deps `[load]`, headline useMemo deps `[latest]`. |
