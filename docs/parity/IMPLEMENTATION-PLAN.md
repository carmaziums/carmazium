# CarMazium Mobile — Phase 2 Implementation Plan

Derived from `PARITY-MATRIX.md` (210 rows), `OPEN-QUESTIONS.md` (29 answered, Decisions Log
binding) and `PROGRESS.md`. Nothing here has been built. No mobile source file has been modified
at the time of writing.

**Governing rule:** one flow per session, on `parity/<flow-name>`. Rows are set
`NEEDS_VERIFICATION`, never `VERIFIED` — only the repo owner sets that.

## Planning decisions — answered 2026-09-01, binding

| # | Decision |
|---|---|
| P-1 | **Every `parity/<flow-name>` branch cuts from `main`.** The audit commits are already there; `origin/parity/audit` is a pushed copy of the same work and is not the base. |
| P-2 | **Near-term APK is side-loaded for owner device testing; Play Store submission follows.** Flow 5 (account deletion) is still built, but sequenced **last, after Flow 7**, so the testable ship-line is reached sooner. It must land before any store submission. |
| P-3 | **CROSS-015 (offline) is folded into Flow 6's prebuild cycle**, not deferred to Phase E. One `expo prebuild` + rebuild instead of two. Scope stays OQ-28's minimum: NetInfo, offline banner, `OFFLINE` sentinel — no queueing, no cached reads. |
| P-4 | **AUC-016: remove the "Adjust Reserve Price" button; keep the reserve status bar.** The backend only accepts a reserve change on a `SCHEDULED` auction (`auctions.service.ts:434-436`), so the control can never work where it sits. Wiring a SCHEDULED-auction edit path is not scoped. |
| P-5 | **Each flow merges into `main` once the repo owner has verified it on device; the next flow is then cut from `main`.** Decided 2026-09-01 after Flows 1 and 2a were both cut from `main` independently. Every flow appends to `PARITY-MATRIX.md` and `PROGRESS.md`, so parallel branches off a common base conflict in both docs, and the conflict grows with each flow. This supersedes the naive reading of P-1: P-1 still names `main` as the base, but "`main`" now means *`main` including every verified flow*, not the audit commit. Consequence: **an unverified flow blocks the next one from starting cleanly** — that is the intended trade, since a flow built on an unverified one inherits its risk. |

**Verification is always a hand-off.** This machine has no Android SDK (`adb` not found,
`ANDROID_HOME` unset), so no flow can close its own on-device step here. Every flow ends with a
manual test script for the owner to run on the build machine.

---

## The ship-line

**Ship-line = every row in Phases A, B and C, plus the three "the app lies to the user" fixes in
Flow 2b.** A release APK built before those are `VERIFIED` is not credible, because below that
line the app charges people for listings that never publish, tells auction winners the wrong
payment deadline, leaks competing dealers' identities, silently drops sessions, and has no
in-app account deletion (a Play Store submission requirement for account-creating apps).

**Above the line (must be `VERIFIED` before a release build):**

| Flow | Rows |
|---|---|
| 1 | SELL-005, SELL-006 |
| 2a | AUC-029, AUC-012, AUC-022, AUC-017 |
| 2b | AUC-016, AUC-038, OQ-9 (BUY-028 stale default), AUC-025 |
| 3 | BUY-022, BUY-006, BUY-017, BUY-007, BUY-008 |
| 4 | AUTH-005, AUTH-013, AUTH-014, AUTH-034, AUTH-035, AUTH-003 (flag split) |
| 6 | AUTH-020, AUTH-019, AUTH-030 + CROSS-015, CROSS-017 (P-3) |
| 7 | CROSS-023, DASH-047 |
| 5 | AUTH-033 / DASH-030 — **sequenced last** (P-2); required before store submission, not before the side-loaded test APK |

**Below the line (deferred, explicitly):** Phases D and E in full — chat presence, contact
support, profile completion gate, buyer dashboard revival, auction bonuses in earnings, offline
handling, pagination, error-surfacing consistency, and every P3 row. None of them can produce a
wrong number, a wrong charge, or a lost session.

**Both borderline calls are now decided (P-2, P-3):** offline joins Flow 6 rather than waiting for
Phase E, and account deletion moves to the end of the line — built, but after the APK the owner
actually tests on.

---

## What I changed against the skeleton, and why

- **Added Phase 0.** The working agreement requires pasting `npx tsc --noEmit` and lint output
  after every flow. That is worthless without a known baseline — if the repo already has 40
  pre-existing errors, no later flow can tell its own damage from the background. Phase 0 is one
  short session that establishes the baseline and confirms the build toolchain actually exists on
  this machine (`ANDROID_HOME` was unset in my shell; `CLAUDE.md:146-148` says the dev machine has
  no SDK and only `C:\ca\carmazium\` does — that needs confirming before any flow promises an
  on-device verification step).
- **Split Phase A's auction work into 2a and 2b.** The skeleton puts AUC-029/022/012 together with
  nothing else, but AUC-016 (a stub that alerts "Reserve Updated" and makes no API call),
  AUC-038 (a header that contradicts the list under it) and the £95 `buyerFee` default all live in
  the same three files and are all the same class of defect — *the app states something untrue*.
  Grouping them makes 2b a single coherent pass over `AuctionDetailScreen` /
  `AuctionCompleteScreen` / `PurchaseFlowScreen` rather than five orphan fixes scattered across
  later flows. AUC-025 joins 2b for the same file-locality reason.
- **Pulled AUC-025 forward from Phase D into Phase A.** The skeleton has it in the feature-gap
  phase. It is a seller doing physical handover work with no payout destination configured and no
  warning — that is a money row, not a feature gap, and it touches `SellerAuctionsScreen`, which
  Flow 2a already opens.
- **Batched the two native-touching flows.** AUTH-020 (`linking` config, `app.json` intent
  filters, iOS `associatedDomains`) and CROSS-015 (NetInfo) are the only flows that require
  `npx expo prebuild --clean` before they can be verified on device (`CLAUDE.md:137-141`).
  Everything else iterates under Fast Refresh on `expo-dev-client`. Flow 6 is therefore positioned
  as the last ship-line flow, at a phase boundary, so exactly one prebuild + release cycle is
  needed to clear the line.
- **Moved CROSS-023 above the line.** The skeleton has it in Phase C as structural. I agree with
  the placement but want the reason on record for the ship decision: a dealer whose analytics call
  fails currently sees a dashboard reporting zero sales and zero revenue with no error. That is
  indistinguishable from real data, so it is a *wrong number shown confidently*, which is the same
  category as the Phase A defects — not polish.
- **Ordered Flow 4 before Flow 6, not after.** The skeleton's Phase B/C order already does this;
  recording why it matters: AUTH-014's `forceLogout()` and AUTH-034's destination preservation are
  what a deep link lands *into*. Building linking first means testing it against a session layer
  that still drops the user at the stack root.

Everything else follows the skeleton and the `PROGRESS.md` 10-flow plan.

---

## Phase 0 — Baseline (ship-line prerequisite, ~half a session)

**Rows in scope:** none. No source changes.

**Do:**
1. `cd "carmazium app/carmazium app" && npx tsc --noEmit` and `npm run lint`. Record the exact
   output in `PROGRESS.md` as the Phase 2 baseline.
Branch base and build-machine questions are settled — see P-1 and the verification note above.

**Done:** baseline output pasted into `PROGRESS.md`.

**Risk:** none. **Effort:** S.

---

## Phase A — Ship-blocking correctness and money

### Flow 1 — `parity/listing-publish-payment` (SELL-005, SELL-006)

The seller is charged, publish then 400s on the backend's 10-photo gate, and a missing `return`
shows a false "Published!" before wiping the draft.

**Files:** `src/screens/sell/SellCarFlowScreen.tsx` (Media step gate ~`:1344-1347`; publish/pay
sequence `:1528-1557`), `src/lib/paymentsApi.ts` (read only), `src/lib/sellWizardStore.ts`
(`clearDraft` call site only).

**Work, in the order the Decisions Log requires (OQ-14 — both fixes):**
1. Fix the missing `return` in the failure `catch` first — it is one line and it stops the app
   asserting a lie today.
2. Raise the Media-step gate from ≥1 to ≥10 photos, matching `ListingWizard.tsx:611` and the
   backend (`listings.service.ts:941-945`). Canonical "complete" is 10 photos + required fields
   + all 5 declarations (OQ-16).
3. Restructure create to **publish first, pay only if the response says `requiresPayment`** —
   the working local precedent is `SellerListingsScreen.tsx:331-380` (SELL-028). Reuse it; do not
   invent a second sequence.

**Dependencies:** none. This is first because it is the only row where a user loses money.

**Risk: high** — payment path. Mitigations: the correct ordering already exists in-repo, so this
is transplanting a proven sequence rather than designing one; do not touch `paymentsApi`; test the
cancel-the-PaymentSheet branch explicitly, not just the happy path.

**Effort:** M (one session).

**Done on device:** a draft with 9 photos cannot leave the Media step and is never charged; a
draft with 10 publishes and only then charges; cancelling the PaymentSheet leaves the listing in a
recoverable state with one honest message and the draft intact; a forced publish failure shows
exactly one alert, and it is not "Published!".

### Flow 2a — `parity/auction-correctness` (AUC-029, AUC-012, AUC-022, AUC-017)

**Files:** `src/screens/seller/SellerAuctionsScreen.tsx` (eligibility filter `:631`),
`src/screens/vehicle/AuctionDetailScreen.tsx` (bidder name build `:296-306`, render `:1369`,
socket handlers `:370-462`, win payload `:434`), `src/screens/main/AuctionCompleteScreen.tsx`
(deadline fallback `:98-115`), `src/screens/buyer/BuyerBidsScreen.tsx` (`:115-117`).

**Work:**
- **AUC-029** — admit the reverted `DRAFT` when an `ENDED` auction exists for that listing. Web's
  filter and its own explanatory comment are at `dashboard/seller/auctions/page.tsx:212-218`. Port
  the condition, not the prose. While in that filter, consider AUC-030's two extra exclusions
  (already-auctioned, `linkedListingId`) — same three lines, same test.
- **AUC-012** — initials only, matching web and matching what the socket already sends (OQ-18).
  Kills the current inconsistency where initially-loaded bids show full names and live ones show
  initials.
- **AUC-022** — 72 hours from auction end (OQ-20). Pass a real `paymentDeadline` from **both**
  entry points; delete the 24h mount-time fallback rather than re-pointing it.
- **AUC-017** — call `loadAuction()` in the socket `reconnect` handler (OQ-17). Mobile-only fix.

**Dependencies:** none on Flow 1, but **AUC-029 and AUC-025 both edit `SellerAuctionsScreen`** —
run 2a before 2b to avoid two branches fighting over the same file.

**Risk: medium.** AUC-022 is the one to be careful with: three call sites compute the deadline
today and all three must end up sourcing the same value, or the app disagrees with itself again in
a new place.

**Effort:** M.

**Done on device:** an auction ended below reserve appears in the re-auction picker and re-auctions
successfully; the bid list shows initials for every row including ones loaded on mount; a fresh win
shows a deadline ~72h from auction end from both the socket path and the bids-screen path;
backgrounding the app past the socket timeout and returning re-syncs bid state rather than freezing.

### Flow 2b — `parity/auction-truthfulness` (AUC-016, AUC-038, AUC-025, OQ-9 on BUY-028)

Four places where the app states something that is not true, or defaults to a wrong number.

**Files:** `src/screens/vehicle/AuctionDetailScreen.tsx` (reserve stub `:1628-1644`),
`src/screens/main/AuctionCompleteScreen.tsx` (header `:325` vs journey `:303-464`),
`src/screens/seller/SellerAuctionsScreen.tsx` (payout warning),
`src/screens/main/PurchaseFlowScreen.tsx` (`buyerFee` default `:74,80`).

**Work:**
- **AUC-016 (decided, P-4)** — **remove** the "Adjust Reserve Price" button; keep the
  reserve-met/not-met bar, which web lacks and is genuinely useful. `PATCH /auctions/:id` rejects
  anything not `SCHEDULED` (`auctions.service.ts:434-436`), so the control cannot work on a live
  auction. A SCHEDULED-auction reserve edit is not scoped.
- **AUC-038** — make the paid-state header agree with the journey list beneath it. No buyer action
  can complete those steps (`submitHandoverProof` is seller-only), so the header must not claim
  handover is confirmed.
- **AUC-025** — fetch `GET /users/stripe-connect/status` and warn a seller with no payout
  destination *before* handover work, mirroring web `dashboard/seller/auctions/page.tsx:1001-1013`.
  The status call already exists in `SettingsScreen.tsx:269-274` — reuse it.
- **OQ-9** — remove the £95 `buyerFee` default and make the prop required, so no future caller can
  silently undercharge. All five live callers already pass 125.

**Dependencies:** after 2a (shared file).

**Risk: low**, except that making `buyerFee` required is a type change that will surface at every
call site — that is the point, and `tsc --noEmit` will enumerate them.

**Effort:** M.

**Done on device:** no control claims an effect it does not have; the completion screen's header
and journey list agree; a seller with no Stripe Connect account sees the warning before uploading
handover proof; `tsc` proves there is no `buyerFee`-less call site left.

### Flow 3 — `parity/search-and-offer-contract` (BUY-022, BUY-006, BUY-017, BUY-007, BUY-008)

**Files:** `src/screens/vehicle/VehicleDetailScreen.tsx` (offer floor `:317`, submit `:348-362`),
`src/screens/main/SearchScreen.tsx` (transmission values `:915`, makes `:60`, conditions
`:112-119`, `handleCardPress` `:223-226`).

**Work:**
- **BUY-022** — replace the absolute `price - 15000` floor with `Math.floor(price * 0.7)`,
  matching the backend (`offers.service.ts:53-64`) and web
  (`VehicleDetailsPageClient.tsx:115-124`), including web's 90% prefill. Today the mobile floor is
  negative on a £10k car and blocks legitimate offers on a £100k one.
- **BUY-006** — `SEMI_AUTO` → `SEMI_AUTOMATIC`, add `CVT` (OQ-12: fix without waiting on a device
  test). The DTO has no per-item `@IsEnum`, so the bad value currently reaches Prisma unchecked.
- **BUY-017** — branch `handleCardPress` on listing type so an `AUCTION` result opens
  `LiveAuctionDetailed`, as `HomeScreen.tsx:418-419,434-438` already does. Reuse that branch.
- **BUY-007 / BUY-008** — source makes from the full list rather than 10 hardcoded ones; add
  `CAT_C` and `CAT_D` to conditions.

**Dependencies:** none.

**Risk: low.** BUY-023 (offer payload missing `amountMax`, which the backend uses for the 70%
check) is adjacent and tempting — **leave it out of scope**; changing the payload shape is a
separate decision and the backend rejects unknown properties.

**Effort:** M.

**Done on device:** on a £10k listing the minimum offer is £7,000 and an offer below it is blocked
client-side with a real number; a Semi-Automatic filter returns results and CVT is selectable;
tapping an auction card in search opens the live auction screen; a make outside the old ten is
filterable; CAT_C/CAT_D are selectable.

---

## Phase B — Session, auth and trust

### Flow 4 — `parity/session-and-auth` (AUTH-005, AUTH-013, AUTH-014, AUTH-034, AUTH-035, AUTH-003)

The largest single flow. If it proves too big in-session, the natural split is
**4a = signup role picker + onboarding flag split (AUTH-005, AUTH-003)** and
**4b = session lifecycle (AUTH-013, AUTH-014, AUTH-034, AUTH-035)**. Take that split rather than
half-landing either half.

**Files:** `src/store/authStore.ts` (role hardcode `:265`, onboarding flag `:6,89-92`, derived
`hasCompletedOnboarding` `:123-127`, `isLoading` `:59`), `src/screens/auth/SignupScreen.tsx`,
`src/screens/onboarding/OnboardingScreen.tsx` (`:156,162`), `src/lib/apiClient.ts` (`:93-95`),
`src/lib/navigationRef.ts`, `App.tsx` (`:184-190,242-244`),
`src/navigation/RootNavigator.tsx` (`:20-44`).

**Work:**
- **AUTH-005** — signup role picker offering **BUYER + DEALER only**. FINANCE_PARTNER is
  deliberately omitted (OQ-1/OQ-5): mobile has no partner dashboard, so offering it would create a
  dead-end account. Note `CLAUDE.md:127-133` defends the current `role: 'BUYER'` hardcode as
  deliberate — it is, historically, but the Decisions Log supersedes it. **Update `CLAUDE.md` in
  the same commit** so the next session does not read the old rationale and revert this.
- **AUTH-003 flag split (OQ-3)** — give the pre-auth marketing carousel its own flag; the
  post-signup wizard gate reads only its own. The new flag must default so existing installs are
  not re-prompted.
- **AUTH-013** — a single global `onAuthStateChange` subscription handling `SIGNED_IN` /
  `TOKEN_REFRESHED` / `SIGNED_OUT` / `PASSWORD_RECOVERY`, mirroring `AuthContext.tsx:116-141`.
  The only existing subscriber (`VerifyEmailScreen.tsx:38-48`) is screen-scoped and should be
  reconciled with, not duplicated by, the global one.
- **AUTH-014 (OQ-6)** — store-level `forceLogout()` called by `apiClient` on `AUTH_REDIRECT`, so
  an expired session returns to the Auth stack instead of throwing into a screen that ignores it.
  `navigationRef.ts` already exists for this. `ChatContext` was never traced as an `AUTH_REDIRECT`
  consumer (Pass 1) — grep it in-session before assuming this is the only handler.
- **AUTH-034** — preserve the intended destination through re-login, web's `?redirect=` equivalent.
  Depends on AUTH-014 existing first.
- **AUTH-035** — gate the cold start on `authStore.isLoading`, which exists but
  `RootNavigator.tsx:20-44` never reads, so a signed-in user can see a Login flash.

**Dependencies:** AUTH-034 depends on AUTH-014. Nothing here depends on Phase A. Flow 6 (deep
links) should land *after* this, so a deep link arrives into a session layer that can hold it.

**Risk: high** — this is the layer every screen sits on, and a mistake logs everyone out. Verify
against a real expired token, not a simulated one, and check the sign-out path still leaves clean
state (`authStore.ts:367-393`).

**Effort:** L (one session, or two if split).

**Done on device:** a new account can be created as DEALER and lands in the dealer path; an
existing install is not re-shown the carousel or the wizard; a signed-in cold start shows no Login
flash; forcing a 401 returns the user to Login and, after re-login, back to the screen they were
on; signing out on another device is observed by this one.

---

## Phase C — Store-readiness and structural

### Flow 5 — `parity/account-deletion` (AUTH-033, DASH-030) — **runs last, after Flow 7 (P-2)**

**Files:** `src/screens/main/SettingsScreen.tsx`, a users API wrapper for `DELETE /users/me`
(`users.controller.ts:231-262`).

**Work:** mirror web's `DeleteAccountSection.tsx:73-97` — typed `DELETE` confirmation, then the
call, then a full local teardown reusing the existing sign-out path rather than a second one.

**Dependencies:** needs Flow 4's `forceLogout()` teardown to exist. Per P-2 it runs after Flow 7 —
the side-loaded test APK does not need it, Play Store submission does.

**Risk: medium** — irreversible for the user. The typed confirmation is not optional, and the
copy must state what is deleted. Test it on a throwaway account only.

**Effort:** S–M.

**Done on device:** deletion requires typing `DELETE`; after it, the app is at the Auth stack with
no restorable session and the account cannot sign back in.

### Flow 6 — `parity/deep-linking-and-offline` (AUTH-020, AUTH-019, AUTH-030, CROSS-015, CROSS-017) — **prebuild boundary**

**Files:** `App.tsx` (`NavigationContainer` `:254-262`; the ad-hoc handler `:193-234`),
`app.json` (`:10` scheme, `:46-60` Android intent filters; no iOS `associatedDomains` today),
`src/navigation/MainStackNavigator.tsx` (`AcceptInvite: undefined` at `:143` needs a `token`
param), `src/screens/main/AcceptInviteScreen.tsx` (`:31-37,55` paste workaround).

**Work:**
1. A real React Navigation `linking` config covering the stacks, so any inbound URL is routable —
   this is the root cause behind AUTH-019 and AUTH-030.
2. Bring the callback handler up to web's ordered branches (`callback/page.tsx:44-199`): error
   param, hash recovery, PKCE with AbortError rescue, implicit tokens, `getSession` fallback,
   and a safety timeout. Mobile currently handles two of seven.
3. Give `AcceptInvite` a `token` param and route the invite link into it; keep the paste field as
   a fallback, do not delete it until the link path is verified on device.
4. **CROSS-015 / CROSS-017 (P-3), same prebuild:** add `@react-native-community/netinfo`, an
   offline banner, and an `OFFLINE` sentinel in `apiClient` alongside `NO_SESSION` /
   `REQUEST_TIMEOUT` / `AUTH_REDIRECT`, so screens can distinguish offline from a real failure
   instead of rendering a raw `TypeError: Network request failed`. **No request queueing and no
   cached reads** (OQ-28). Do this as a second, separately-reviewable commit on the branch so a
   linking problem and an offline problem never have to be bisected together.

**Dependencies:** after Flow 4. **Requires `npx expo prebuild --clean --platform android`** —
`app.json` changes do not reach a binary without it (`CLAUDE.md:137-141`), and `android/` is
gitignored so a `git pull` never updates it.

**Risk: high**, and different in kind from the others: a wrong `linking` config can make cold-start
navigation unreachable, and it cannot be verified under Fast Refresh. Budget the session for the
native rebuild.

**Effort:** L, now ~1.5 sessions with offline folded in.

**Done on device:** a Supabase recovery link, an OAuth return and a dealer-staff invite link each
open the app on the correct screen from cold start and from background; the invite no longer needs
pasting; an unknown URL fails gracefully rather than hanging on a splash; with airplane mode on,
the app shows an offline banner and screens report "you're offline" rather than a raw network
`TypeError`, and recover on reconnect.

### Flow 7 — `parity/dashboard-error-states` (CROSS-023, DASH-047)

One dedicated pass, per OQ-26 — deliberately not folded into feature flows.

**Files:** `UnifiedDashboardScreen`, `SellerDashboardScreen`, `SellerPerformanceScreen`,
`EarningsScreen`, `DealerProfileScreen`, `DealerAnalyticsScreen`, `DealerEarningsScreen`, and any
other screen whose fetch `catch` renders zeros. `src/components/ui/ErrorBanner.tsx` already exists
and is used in 18 screens — this is adoption, not new components.

**Work:** replace `catch { /* show zeros */ }` with an error state plus retry. Distinguish three
states explicitly: loading, loaded-and-genuinely-zero, and failed. The middle one must still look
like real zero data, so do not turn every empty dashboard into an error.

**Dependencies:** none, but run it after the Phase A/B flows so it sweeps their final shapes rather
than being re-swept.

**Risk: low**, breadth-heavy. The trap is scope creep into CROSS-009 (`Alert.alert` vs
`ErrorBanner` consistency, 173 call sites) — that is Phase E and stays there.

**Effort:** M, wide but mechanical.

**Done on device:** with the API unreachable, every dashboard shows an error with a working retry
and no fabricated zeros; with the API up and genuinely empty data, it shows zeros with no error.

---

## Phase D — Feature gaps (below the ship-line)

| Flow | Rows | Files | Effort | Notes |
|---|---|---|---|---|
| 8 — `parity/chat-presence-support` | DASH-023, DASH-024 | `src/context/ChatContext.tsx:93-113`, `MessagesScreen`, a support entry point | M | Backend already emits `presence:snapshot` / `presence:update`; `POST /chat/support` already exists. Pure consumption, no backend work. |
| 9 — `parity/buyer-dashboard-merge` | DASH-004, DASH-005, OQ-29 | `BuyerDashboardScreen.tsx` (dead, 624 lines), `MainStackNavigator`, `GlobalDrawer`, delete `WatchlistScreen.tsx` | M | OQ-29: wire up `BuyerDashboardScreen`, delete `WatchlistScreen`. **Trap:** `WatchlistScreen` is dead from every entry point *except* the dealer drawer's Wishlist item (DASH-034) — repoint that to `SavedScreen` in the same commit or you break a live route. |
| 10 — `parity/profile-completion-gate` | DASH-003 | `UnifiedDashboardScreen`, onboarding | M | Web blocks all dashboard content until name + phone. Decide whether mobile blocks or nags before building — web's is a hard modal. |
| 11 — `parity/earnings-auction-bonuses` | DASH-010 | `EarningsScreen`, `DealerEarningsScreen` | M | Per OQ-21 the merged web target includes auction bonuses; mobile has zero `sellerBonus` references today. |

Also in this phase, unscheduled: DASH-019/OQ-22 (live notification list — small, folds into any
flow touching `NotificationsScreen`), DASH-028 (the second, statusless Stripe Connect entry point
in `EarningsScreen`), AUC-020/AUC-023/AUC-024 (handover status detail).

---

## Phase E — Resilience and polish (below the ship-line)

| Flow | Rows | Scope note | Effort |
|---|---|---|---|
| ~~12 — `parity/offline`~~ | CROSS-015, CROSS-017 | **Moved into Flow 6 (P-3)** — same prebuild cycle. | — |
| 13 — `parity/pagination` | CROSS-018 | OQ-27: **dealer inventory, dealer leads, seller listings only.** Compare and dashboard previews stay deliberately capped. `SearchScreen`'s `onEndReached` is the in-repo pattern to copy. | M |
| 14 — `parity/error-surfacing` | CROSS-009, CROSS-020 | Establish and apply one rule for `Alert.alert` vs `ErrorBanner` vs toast. 173 `Alert.alert` call sites — do not attempt in one session; scope to a named screen set. | L |
| 15 — `parity/token-migration` | CROSS-006, CROSS-007 | Deprecated `sizeNN` / `deepBlue_*` aliases and the type-scale divergence from the design system. `CLAUDE.md` already says migrate call sites when you touch a file — much of this lands for free during Phases A–D. | M |

Remaining P3 rows (AUC-028 live countdowns in lists, CROSS-019 pull-to-refresh gaps, SELL-009
photo reordering, SELL-020 draft partialize gaps, BUY-009 ULEZ tri-state, DASH-036 dealer analytics
breakdowns) are not scheduled. SELL-020 is the one most likely to deserve promotion — a seller who
resumes a draft loses every legal declaration and must re-enter all five.

---

## Cross-cutting rules for every flow

1. **Do not "align" mobile downward.** Mobile is ahead of web on debounced search (BUY-003), buyer
   counter-offers (BUY-024), image compression (SELL-008), `recordSale` (SELL-024/DASH-015),
   notification preferences (DASH-021), dealer payouts (DASH-042), address verification
   (DASH-031), Withdraw (SELL-023), min-increment and 70% pre-validation (AUC-010, AUC-032), KYC
   bid gating (AUC-011), and the shared `EmptyState` / `Skeleton` / `ErrorBanner` primitives web
   lacks. Brand red stays `#FF0037`; password minimum stays 8; the terms checkbox stays.
2. **Port from `/buy-cars/[slug]` and `ListingWizard` only.** The legacy `/vehicle/[id]` contains a
   simulated bid modal with client-seeded fake bid history. It must never reach mobile.
3. **Out of scope entirely:** AUTH-027, AUTH-029, AUTH-031, BUY-029, DASH-046.
4. **Backend changes require an explicit callout.** Consume existing endpoints. Already logged as
   noted-not-actioned: the damage-endpoint ownership check (OQ-15), `reservePrice` on the wire
   (OQ-19), declaration validation (OQ-16), the missing per-item `@IsEnum` on `transmissions`.
5. **The drawer navigates via a variable** (`GlobalDrawer.tsx:349`), so `navigate('X')` greps miss
   drawer routes. Any dead-screen claim must account for that, and for `UnifiedDashboardScreen`,
   whose stack route is dead while the component is live via `TabNavigator.tsx:29`.
6. **Every flow ends with:** `npx tsc --noEmit` + `npm run lint` output pasted; a numbered manual
   test script including error and empty states; matrix rows set `NEEDS_VERIFICATION` (never
   `VERIFIED`); `PROGRESS.md` updated; committed and pushed on `parity/<flow-name>`; then stop.

## Session budget to the ship-line

Order: **0 → 1 → 2a → 2b → 3 → 4 → 6 → 7 → 5.**

Phase 0 (0.5) + Flows 1, 2a, 2b, 3 (4) + Flow 4 (1–2) + Flow 6 (1.5, incl. the native rebuild) +
Flow 7 (1) = **8–9 sessions to the side-loadable ship-line**, plus Flow 5 (1) before store
submission. Each is followed by device verification by the repo owner before the next begins. Cut
an APK only at the Phase A→B boundary, after Flow 6's prebuild, and after Flow 7 — not during
iteration.
