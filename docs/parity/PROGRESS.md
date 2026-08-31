# CarMazium Parity — Progress Log

Append-only session log. Read this first at the start of every session.

## Phase 1 — Audit (branch `parity/audit`, docs-only, no source changes)

| Pass | Session date | Status | Rows written |
|---|---|---|---|
| AUTH | 2026-08-31 | Audited | 36 (AUTH-001..036) |
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

**Next session should pick up:** Pass 1 — AUTH.  _(done — see below)_

### 2026-08-31 — Pass 1: AUTH

**Method.** Read the web + backend implementation first to establish the contract, then read
mobile and diffed against it. Every citation written into the matrix was re-read directly
before being recorded.

**Scope covered.**
- Web: `src/app/auth/{login,signup,callback,forgot-password,reset-password,onboarding,accept-invite,partners}/page.tsx`, `src/context/AuthContext.tsx`, `src/lib/{supabase,apiClient}.ts`, `src/app/dashboard/page.tsx`, `src/app/dashboard/admin/page.tsx`, `src/components/dashboard/DeleteAccountSection.tsx`
- Backend: `backend/src/auth/{auth.controller,auth.service}.ts`, `backend/src/auth/guards/*`, `backend/src/users/{users.controller,users.service}.ts`, `backend/prisma/schema.prisma` (UserRole), `backend/src/main.ts` (session + pipe config)
- Mobile: `App.tsx`, `src/navigation/*`, `src/store/authStore.ts`, `src/lib/{supabase,apiClient}.ts`, `src/screens/auth/*`, `src/screens/onboarding/OnboardingScreen.tsx`, `src/screens/main/AcceptInviteScreen.tsx`, `app.json`

**Result: 36 rows, AUTH-001 through AUTH-036.**

| Status | Count |
|---|---|
| MISSING | 9 |
| PARTIAL | 8 |
| DIVERGENT | 8 |
| PRESENT | 11 |

P0 rows: AUTH-005 (no role selection at signup), AUTH-013 (no global `onAuthStateChange`),
AUTH-014 (401 never navigates), AUTH-019 (callback handles 2 of 7 branches),
AUTH-020 (no React Navigation linking config), AUTH-026 (7 backend roles collapsed to 3).

**The structural finding.** AUTH-020 is the root of several other rows. Mobile has no
`linking` config on `NavigationContainer` (`App.tsx:254-262`) — all deep-link handling is
an ad-hoc `expo-linking` listener that only matches Supabase auth tokens
(`App.tsx:193-234`). This is why the invite flow needs a paste-the-link workaround
(AUTH-030) and why the OAuth return leg could not be traced end to end (AUTH-003).
Any later pass needing an inbound URL to reach a screen will hit the same wall.

**Not traced — stated explicitly rather than assumed.**
- `ChatContext` was not read; it is referenced in `apiClient.ts` comments as an
  `AUTH_REDIRECT` / `NO_SESSION` caller, so the claim in AUTH-014 is scoped to
  "no handler in `App.tsx`, `RootNavigator.tsx`, or `authStore.ts`" — not "none anywhere".
- The OAuth return leg (AUTH-003) is not traced past `Linking.openURL`.
- Web role gating: the central gates were read, not all files matching the role grep.
- Per-screen contents of the 9 dealer-gated screens (AUTH-028) — gating shape only.
- `screens/main/{Finance,Services}Screen.tsx` (AUTH-029) — named but not read.
- AUTH-023, AUTH-035 and OQ-3 describe interactions I reasoned about from code but did
  **not** run. They are marked as needing device verification and are not asserted as bugs.

**Open questions raised: OQ-1 through OQ-8.** OQ-1 (canonical signup role behaviour) and
OQ-5 (are ADMIN/partner roles in scope for mobile at all) gate the largest chunk of Phase 2
scope — answering those two first will settle roughly a third of these rows.

**Docs-only commit. No source files were modified.**

**Next session should pick up:** Pass 2 — BUY.
