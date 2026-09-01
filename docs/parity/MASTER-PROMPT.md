# MASTER PROMPT — CarMazium Mobile Remediation (build machine)

Paste everything below the line into a fresh session on the build machine. It governs the
planning session and every session after it.

---

## Context

The CarMazium mobile app (React Native / Expo) is materially behind the Next.js web app. A
six-pass parity audit is **complete**. Its output is committed to this repo on branch
`parity/audit`:

- `docs/parity/PARITY-MATRIX.md` — 210 rows, one per capability, permanent IDs
  (`AUTH-005`, `BUY-022`, `SELL-006`, `AUC-029`, `DASH-030`, `CROSS-015`…). Every row cites
  `file:line` on web, mobile and the API.
- `docs/parity/OPEN-QUESTIONS.md` — 29 questions, **all answered**. The **Decisions Log** at the
  end is binding.
- `docs/parity/PROGRESS.md` — per-pass findings, explicit "not traced" sections, and a first-cut
  10-flow plan at the end.

The mobile app lives in the directory whose name contains spaces and is nested twice — quote all
paths. Read its `CLAUDE.md` and `CONTEXT.md` before touching code.

**Nothing has been fixed yet.** The audit was docs-only; no mobile source file has been modified.

## Your first task: produce the plan

Read the three parity docs first. Then produce `docs/parity/IMPLEMENTATION-PLAN.md` containing a
phased, prioritised remediation plan. Do not write feature code in this first session.

Sequencing is **correctness and money first**, then session/auth, then store-readiness, then
feature gaps, then polish. The near-term goal is a **shippable APK**, so the plan must name an
explicit **ship-line**: the minimum set of rows that must be `VERIFIED` before a release build is
credible, with everything else deferred behind it.

Use this phase skeleton and refine it against the matrix — add, split or reorder if the rows
justify it, but say why:

- **Phase A — Ship-blocking correctness & money.** `SELL-005`/`SELL-006` (seller is charged, the
  publish call then 400s on the backend's 10-photo gate, and a missing `return` shows a false
  "Published!" before clearing the draft), `BUY-022` (offer floor is an absolute `price - 15000`
  where the backend enforces a proportional 70%), `BUY-006` (search sends `SEMI_AUTO`, not in the
  enum; `CVT` missing), `BUY-017` (auction search results open the retail detail screen),
  `AUC-029` (re-auction filter excludes the reverted DRAFT — the fix is written down in web's own
  code comment), `AUC-022` (payment deadline shows 24h where the backend grace is 72h),
  `AUC-012` (bid list shows competing bidders' full names; web shows initials only).
- **Phase B — Session, auth & trust.** `AUTH-005` (signup role picker), `AUTH-013` (no global
  `onAuthStateChange`), `AUTH-014` (401 never navigates), `AUTH-034`, `AUTH-035`, `AUTH-003`
  (separate the onboarding flags).
- **Phase C — Store-readiness & structural.** `AUTH-033`/`DASH-030` (account deletion — app-store
  policy), `AUTH-020` (no React Navigation `linking` config — root cause behind `AUTH-019`,
  `AUTH-030`), `CROSS-023` (dashboards `catch { /* show zeros */ }`, so failures look like real
  zero data — one dedicated pass).
- **Phase D — Feature gaps.** `DASH-023` (chat presence), `DASH-024` (contact support),
  `DASH-003`, `DASH-010`, `DASH-004` + wire up `BuyerDashboardScreen`, `AUC-025`.
- **Phase E — Resilience & polish.** `CROSS-015` (offline: NetInfo, offline banner, `OFFLINE`
  sentinel in `apiClient` — no queueing or cached reads), `CROSS-018` (pagination, scoped to
  dealer inventory, dealer leads, seller listings only), `CROSS-009`, `AUC-016`, `AUC-038`.

For each phase give: rows in scope, files to touch, dependencies between flows, effort, risk, and
what "done" looks like on device. Group rows into **flows sized to one session each**.

## Binding decisions — do not re-litigate

These were decided by the repo owner. Full reasoning is in the Decisions Log.

- Port from **`/buy-cars/[slug]`** only. The legacy `/vehicle/[id]` contains a **simulated** bid
  modal with client-seeded fake bid history — it must never reach mobile.
- Port from **`ListingWizard`** only, not `DealerQuickList`.
- **`ListingWizard`'s rule is "listing complete"**: 10 photos + required fields + all 5 legal
  declarations.
- Mobile roles are **buyer / seller / dealer only**. The new signup picker offers **BUYER +
  DEALER only** — FINANCE_PARTNER is deliberately omitted (mobile has no partner dashboard).
- Canonical brand red is **`#FF0037`**. **Mobile is already correct; web is stale.** Never "fix"
  mobile toward web's `#ed1c24`.
- Password minimum is **8** everywhere. Mobile is already correct.
- Mobile's **terms-acceptance checkbox stays** — web is missing it. Do not remove it.
- Vehicle payments are **off-platform**; dormant retail-checkout code is leftover to remove.
- Out of scope entirely: `AUTH-027`, `AUTH-029`, `AUTH-031`, `BUY-029`, `DASH-046`.

## Standing working agreement — every session after the plan

1. **One flow per session.** Restate the row IDs in scope and get confirmation before writing
   code. Never batch flows.
2. **Never mark a row done.** Set `NEEDS_VERIFICATION`. Only the repo owner sets `VERIFIED`.
3. **No inference from code presence.** A component existing or a route being registered is not
   evidence a feature works. Trace UI → navigation → store → API client → backend handler →
   response shape → render, or state explicitly that you could not.
4. **Cite before you assert.** Any claim about current behaviour needs a `file:line` you read in
   that session.
5. **Run `npx tsc --noEmit` and lint after each flow. Paste the actual terminal output.**
6. **Produce a manual test script** — numbered steps, exact taps, expected result per step,
   including error and empty states. That is how the owner verifies.
7. Update `PARITY-MATRIX.md` and `PROGRESS.md`, then commit on `parity/<flow-name>` with a message
   naming the flow. Push. Then stop and wait for device testing.
8. If something is blocked by a missing endpoint or an ambiguity, write it to `OPEN-QUESTIONS.md`
   and stop — do not invent behaviour or stub something that looks finished.

## How to work — efficiency rules

- **Execute, don't narrate.** Minimal prose. No progress commentary, no restating the plan back.
  Lead with the change and the evidence.
- **Batch tool calls.** Independent reads/edits go in one message, never one per turn.
- **Use subagents for bulk file reading** (the audit used Sonnet Explore agents for this) — but
  **verify every cited line yourself** before acting on it. Agent reports have contained
  overstatements that verification caught.
- **Don't re-derive what the matrix already establishes.** It has the `file:line` for both apps
  and the API. Read the row, verify the specific lines, act.
- **Use the relevant skills:** `senior-fullstack-dev` for architecture and code-quality gates,
  `anthropic-skills:react-native` for RN/Expo implementation, `ui-ux-pro-max` for visual and
  interaction work, `qa-fix-workflow` when fixing items sent back from device testing.

## Constraints

- Reuse existing mobile patterns, navigation structure and design tokens. Mobile's token
  discipline is strong (zero hardcoded hex in `src/screens/`) — keep it that way. If an existing
  pattern is the actual blocker, say so rather than quietly replacing it.
- No refactors outside the flow in scope without approval.
- **Backend changes require an explicit callout.** Prefer consuming existing endpoints. Several
  backend items are already logged in the Decisions Log as noted-not-actioned.
- Iterate on `expo-dev-client` with Fast Refresh. Cut a release APK only at phase boundaries, not
  during iteration.
- Visual parity means adapted to native conventions, not a pixel copy of web. Call out any
  deliberate divergence and why.

## Known traps

- The drawer navigates via a **variable** (`navigation.navigate('Main', { screen: item.stackScreen })`),
  so `navigate('X')` greps miss those routes. A naive dead-screen check will produce false
  positives. `UnifiedDashboardScreen`'s stack route is never navigated to, yet the component is
  live because the tab navigator renders it directly.
- Two mobile screens **are** genuinely dead: `WatchlistScreen` (delete) and `BuyerDashboardScreen`
  (wire up — it holds richer buyer tiles and a period toggle the live screen lacks).
- Mobile is **ahead of web** in several places — debounced search, buyer counter-offers, image
  compression, `recordSale` usage, notification preferences that actually save, dealer payouts,
  address verification, a shared `EmptyState`/`Skeleton` web lacks. Do not "align" these downward.
