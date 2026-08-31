# CarMazium Parity — Progress Log

Append-only session log. Read this first at the start of every session.

## Phase 1 — Audit (branch `parity/audit`, docs-only, no source changes)

| Pass | Session date | Status | Rows written |
|---|---|---|---|
| AUTH | — | Not started | — |
| BUY | — | Not started | — |
| SELL | — | Not started | — |
| AUCTION | — | Not started | — |
| DASH | — | Not started | — |
| CROSS | — | Not started | — |

## Phase 2 — Implementation (branch `parity/<flow-name>`, one flow per session)

| Flow | Matrix rows | Session date | Status |
|---|---|---|---|

## Session log

### 2026-08-31 — Scaffold
Created `docs/parity/` with the three persistent artifacts. Mapped the three apps
and their entry points:

- Web: `src/` — Next.js 16 App Router, entry `src/app/layout.tsx`
- API: `backend/src/` — NestJS + Prisma, entry `backend/src/main.ts`
- Mobile: `carmazium app/carmazium app/` — Expo 54 + React Navigation 7,
  entry `App.tsx` -> `src/navigation/RootNavigator.tsx`

**Next session should pick up:** Pass 1 — AUTH.
