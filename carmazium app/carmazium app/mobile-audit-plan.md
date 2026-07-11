# Carmazium Mobile — Production-Readiness Plan

Staged execution plan derived from `mobile-audit.md` (2026-07-10). Each stage is a self-contained prompt — paste it verbatim into a fresh session if this one runs out of context. Do each stage in a separate session so context stays focused. Do not re-order stages: 1 and 2 unblock trust and live-bug reports, 3 hardens the damage-taxonomy work already in the working tree before it ships, 4 is the big perf sweep, 5 is cleanup.

Every stage's acceptance criteria include `npx tsc --noEmit` clean (per `CLAUDE.md` — the only automated gate) and on-device verification of the specific flow touched.

> **STATUS AS OF 2026-07-12** (verified by direct code inspection, not assumption — see `mobile-production-readiness-plan.md` for the session that did this check):
> - **Stage 1 (W1, W2) — DONE.** `CarListing`/`ApiListing`/`mapApiListingToCarListing` carry real `motStatus`/`owners`/`writeOffCategory`/`stolenRecovered`/`hasOutstandingFinance`/etc.; `VehicleDetailScreen.tsx` renders them with honest "Not disclosed" fallbacks; hardcoded `rating: 4.5` removed entirely (not faked, not replaced — the field and its UI are gone where no real rating exists).
> - **Stage 2 (P1, stale socket auth) — DONE.** `ChatContext.tsx`, `GlobalToastProvider.tsx`, `AuctionDetailScreen.tsx` all use the function-form `auth: (cb) => getAccessToken().then(...)`.
> - **Stage 3 (W3, W4, W7) — PARTIALLY DONE.** The defensive null-guard in `DamageMapViewer.tsx` (a `validRecords` filter checking `coords`/`x`/`y`/`view` before render) is in place — W4's crash risk is mitigated. **Still open:** `damageZones.ts` still contains the "UNVERIFIED best-effort guesses" comment — the actual zone-id diff against the web app's taxonomy has not been done. W3 (interior zone coordinate spread) not independently re-verified this pass.
> - **Stage 4 (P2, P3, P4, P6) — DONE (spot-checked).** Every screen listed in P3 now has a `FlatList`; remaining `.map()` calls in those files are over small bounded arrays (tabs, chips), not the main record list.
> - **Stage 5 (W6, W8, W9, P7) — DONE**, with one correction: W8 ("verify server trust of client-supplied listing-fee amount") turned out to be a **confirmed broken request**, not just an unverified trust question — see `mobile-production-readiness-plan.md` finding F1 (fixed) and F2 (the trust-hardening part, deliberately deferred as its own follow-up). W6 (lead source picker), W9 (SecureStore split), P7 (`pushNotifications` via `apiClient`) are all done.

---

## Stage 1 — Wire real vehicle data into the buyer-facing detail screen (W1, W2)

**Why first:** buyers currently see hardcoded "HPI: Clear / Owners: 1 (Full FSH) / MOT until: Mar 2026 / Finance: None owed / rating: 4.5" on **every listing** regardless of the truth. Legal/trust risk on a marketplace where money changes hands based on these claims. Nothing else on this list matters if the app is materially lying to buyers.

**Prompt to paste:**

> Read `carmazium app/carmazium app/mobile-audit.md` finding W1 (and W2) for full context. The buyer-facing `VehicleDetailScreen.tsx` renders hardcoded fake vehicle-history/spec data on every listing — real DVLA and seller-declaration fields already collected by `SellCarFlowScreen.tsx` and sent to `/listings` never reach buyers because the `CarListing` type and `mapApiListingToCarListing` don't carry them.
>
> Do this end-to-end in one PR:
> 1. Add these fields to `CarListing` (`src/data/listings.ts`) and to `ApiListing` (`src/lib/listingsApi.ts`): `motStatus`, `motExpiry`, `taxStatus`, `taxDueDate`, `owners` (number), `writeOffCategory`, `stolenRecovered` (boolean), `hasOutstandingFinance` (boolean), `wheelplan`, `typeApproval`, `monthOfFirstRegistration`. Also add a real `rating` (seller/dealer aggregate) — check what the web app uses; if there's no true rating yet, remove the hardcoded 4.5 from `mapApiListingToCarListing` and hide the badge entirely rather than fake it (W2). Before you add these to `ApiListing`, confirm the backend actually returns them from `GET /listings/{id}` — the payload the mobile app sends (`SellCarFlowScreen.tsx:835-878`) has these fields, but the read-side may not surface them yet; check the web repo at `D:\carmazium\src\` for the response shape, and stop and ask me if the backend doesn't return them. CLAUDE.md is explicit: "The backend rejects unknown DTO properties" — this rule applies to *sent* payloads, not received ones, but still confirm before assuming presence.
> 3. Update `mapApiListingToCarListing` to pass those fields through (typed, not string-coerced).
> 4. Replace **every** hardcoded value in `VehicleDetailScreen.tsx:736-800` with the real listing field, and add a shared "Not disclosed" fallback for null/undefined — do NOT invent a fallback that reads like a positive claim (e.g. don't fall back to "Clear" when we don't know).
> 5. Do NOT touch the paid HPI report flow (`:314-360, 1399-1406`) — audit finding W5 says it's correct. Just make sure the fake "always Clear" copy is gone from the free spec section that sits above it, since that copy currently makes users wonder why they'd pay for the HPI report at all.
>
> Acceptance criteria:
> - `npx tsc --noEmit` clean.
> - `VehicleDetailScreen` renders "Not disclosed" (or equivalent) for every history field on a listing you just created without filling those fields, and renders the real values you selected on a listing where you did fill them.
> - No literal strings "Clear", "None owed", "No marker", "Mar 2026", "1 (Full FSH)", or "4.5" remain in `VehicleDetailScreen.tsx` or `HomeScreen.tsx`/card components as display values.

---

## Stage 2 — Fix stale-token socket reconnection (P1)

**Why second:** this is the root cause of the `Mobile chat socket error: {"code":"AUTH_REQUIRED",...}` toast I kept seeing during on-device testing. It's a real bug that will get worse in production (longer sessions → more reconnects → more failures). Small, contained fix.

**Prompt to paste:**

> Read `carmazium app/carmazium app/mobile-audit.md` finding P1. Three Socket.IO clients — `src/context/ChatContext.tsx:67-73`, `src/components/GlobalToastProvider.tsx:56-62`, `src/screens/vehicle/AuctionDetailScreen.tsx:271-278` — pass `auth: { token }` as a plain object captured once at connect time. `socket.io-client` never re-evaluates a plain-object `auth` on reconnect, so after Supabase's background token refresh (~hourly, silent) any reconnect (network blip, backgrounding, long auction viewing) authenticates with the expired token and fails on `AUTH_REQUIRED`.
>
> Do this:
> 1. Change each `auth: { token }` to a function form: `auth: (cb) => getAccessToken().then(t => cb(t ? { token: t } : {}))`. Verify `socket.io-client`'s installed version supports the callback form (check `package.json`) — if not, use the equivalent `'reconnect_attempt'` listener pattern that assigns `socket.auth = { token }` before each attempt.
> 2. Confirm none of the three call sites need any other change (the `useEffect` deps stay as-is; we intentionally want the socket instance stable, we're only changing how the token is supplied per attempt).
> 3. Do NOT wrap this in a broader refactor of how tokens are fetched — the goal is a minimal fix, not a chat/socket abstraction.
>
> Acceptance criteria:
> - `npx tsc --noEmit` clean.
> - On device: leave the app foregrounded for at least 1 hour on any screen that opens a socket, then interact with chat/notifications — no `AUTH_REQUIRED` toast should appear.
> - Faster verification path: temporarily lower the Supabase JWT expiry via the dashboard (or briefly stub `getAccessToken` to return an expired token then a valid one) and confirm the socket recovers on the next reconnect attempt.

---

## Stage 3 — Harden the damage taxonomy already in the working tree (W3, W4, W7)

**Why third:** I just expanded `damageZones.ts` from 10 to 33 zones and added a button-list UI in `Damage3DMapper`. Per finding W4, 23 of those 33 IDs are unverified against the web app's real taxonomy, so a listing with any of the new zones could crash the buyer-side `DamageMapViewer` or silently save an unrecognized `part` value. Also W3 (interior zones all render at the same 2D pixel) and W7 (damage save failure silently swallowed during publish). Fix these together — they're all in the damage subsystem.

**Prompt to paste:**

> Read `carmazium app/carmazium app/mobile-audit.md` findings W3, W4, W7 for context. Three related tasks in the damage subsystem:
>
> 1. **Verify zone-ID parity (W4).** Open `D:\carmazium\src\components\listing\VehicleDamageMapper.tsx` (and `ThreeDVehicleViewer.tsx` there) and diff the exact `id` string of every zone against `carmazium app/carmazium app/src/components/damage/damageZones.ts`. For every mismatch, correct the mobile ID to match web verbatim. If the web app defines a zone we don't have, that's fine (mobile can be a subset); if we define one that doesn't exist in web, either match the web equivalent or remove it — do not ship a zone id the backend doesn't recognize. Update the "unverified guesses" comment at the top of `damageZones.ts` to reflect the verified state.
>
> 2. **Harden `DamageMapViewer.tsx` against unknown zones (W4 defensive-code fallback).** Even after verification, add a null/undefined guard: skip rendering any damage record whose `coords` cannot be resolved (currently `record.coords.view`/`.x`/`.y` at lines 37, 108-109 have no null check, so a bad response from `/damage/{listingId}` crashes the whole `VehicleDetailScreen`). Log a `console.warn` with the unrecognized `part` value so future backend/mobile drift is diagnosable in dev, not user-visible.
>
> 3. **Give interior zones distinct 2D coords (W3).** The 8 interior zones in `damageZones.ts:81-88` all share `{ x: 50, y: 50, view: 'FRONT' }`, so multiple interior damage pins stack on the same pixel on the buyer-side flat 2D viewer. Add a dedicated `view: 'INTERIOR'` variant and lay them out on distinct coords (see how web's `VehicleDamageMapper.tsx` does it), OR keep FRONT but spread the 8 zones vertically along one column with realistic `y` values. If adding a new view, extend `DamageMapViewer.tsx`'s tab selector to include it. Do not overload FRONT with interior pins mixed among exterior ones — buyers should be able to see "3 interior damages, all visible on one screen" cleanly.
>
> 4. **Surface damage-save failures during publish (W7).** In `SellCarFlowScreen.tsx:882-904`, `saveDamageRecords` ends in `.catch(() => {})` — remove the silent swallow. On failure, either:
>    - block publish and show a real error alert, or
>    - allow publish to succeed but show a distinct warning ("Listing published, but damage details couldn't be saved — edit the listing to retry") and log the failure to whatever crash-reporter is wired (or `console.error` if none).
>    Choose whichever matches the web app's behavior when its `/damage/{id}/save` fails. Do not leave it silent.
>
> Acceptance criteria:
> - `npx tsc --noEmit` clean.
> - Every id in `DAMAGE_ZONES_3D` matches an id defined in `D:\carmazium\src\components\listing\VehicleDamageMapper.tsx` (or is deliberately mobile-only with an inline comment saying so).
> - Damage viewer no longer crashes when handed a synthetic bad `part` response (test by editing a listing's damage response in Chrome devtools/proxy, or by mocking).
> - Marking 3 interior zones on a listing then viewing it as a buyer shows 3 distinct, readable pins — not one stacked pin.
> - Killing your network mid-publish shows a real warning, not a silent success.

---

## Stage 4 — Virtualization + memoization sweep (P2, P3, P4, P6)

**Why fourth:** this is the big performance work — 9 screens using `ScrollView`+`.map()`, no `React.memo` anywhere, `ChatScreen` doing O(n²) work per render. It's high-value but also the largest diff, and it should land *after* the trust and correctness fixes so bisecting bugs stays clean.

**Prompt to paste:**

> Read `carmazium app/carmazium app/mobile-audit.md` findings P2, P3, P4, P6. Systemic performance work — do it in this order to keep the diff reviewable:
>
> 1. **Memoize the two card components everyone uses first.** Wrap `src/components/VehicleCard.tsx` and `src/components/HorizontalVehicleCard.tsx` in `React.memo`. Adjust the prop shape so callers don't have to pass inline arrow closures per row: change `onPress={() => goToListing(l)}` / `onToggle={() => toggle(l)}` etc. to `onPress={handleCardPress}` where the handler receives the listing id and looks it up in a stable ref. Do NOT change the visual output. Verify by React Profiler that a parent re-render (e.g. flipping a filter chip in `HomeScreen.tsx`) no longer re-renders every card.
>
> 2. **Convert the nine `ScrollView`+`.map()` screens to `FlatList`.** Listed in P3 with exact file:line refs. Reuse the memoized card from step 1 where the row is a `VehicleCard`. For row types unique to one screen (leads, offers, bids, delivery requests, notifications), extract a memoized `RowComponent` at module scope and hoist its `renderItem`. For each screen, `keyExtractor` should use the backend id (never array index). Do not change the visual output, filter behavior, or empty-state copy.
>
> 3. **Fix `ChatScreen`'s O(n²) work per render (P2).** Move `isLastOwnMessage` out of the per-message map: compute a single derived `Map<messageId, boolean>` via `useMemo` on `messages`, then look up. Convert message rendering to `FlatList inverted` with `keyExtractor` and a memoized row. Do not paginate history yet — that's P6, handle in a separate PR to keep this one focused. Just stop the current thread from getting slower to type in as it grows.
>
> 4. **Consistency pass on the already-`FlatList` screens** (SearchScreen, MessagesScreen, SellerListingsScreen, DealerOffersScreen, DealerMyOffersScreen, DealerPurchasesScreen, DealerTeamScreen, ProfileScreen, PaymentHistoryScreen, OnboardingScreen). Each currently passes an inline `renderItem={({item}) => <Card .../>}`. Hoist those to module-scope memoized components. Small win, but worth doing here so the whole app follows one pattern.
>
> Explicitly out of scope for this PR: paginating chat history (P6), and any watchlist-eviction logic. Do those in follow-ups. Also do not change any list's data-fetching (still use `apiClient`, no React Query per CLAUDE.md).
>
> Acceptance criteria:
> - `npx tsc --noEmit` clean.
> - React Profiler on `HomeScreen` after a filter toggle shows only the newly-visible cards rendering, not the entire list.
> - `ChatScreen` in a 500+ message thread stays typing-smooth (measured with the JS/UI thread FPS overlay or manual observation — no ramp-up in typing lag as more messages arrive).
> - `DealerInventoryScreen` with 100+ listings scrolls without dropped frames (visible via `PerfMonitor`).
> - No visual regression on any converted screen.

---

## Stage 5 — Cleanup pass (W6, W8, W9, P7)

**Why last:** these are individually small, correctness-adjacent items that don't block anything but each removes a real risk or long-term footgun. Bundle them into one PR — none are complex.

**Prompt to paste:**

> Read `carmazium app/carmazium app/mobile-audit.md` findings W6, W8, W9, P7. Four small independent fixes, one PR:
>
> 1. **Dealer Add-Lead source picker (W6).** `src/screens/main/DealerLeadsScreen.tsx:442-451` hardcodes `source: 'walk_in'` for every manually-created lead. Add a source picker to the create-lead sheet using `SOURCE_LABELS` already defined at `:70-76` (values `listing_enquiry | chat | offer | walk_in | phone`). Default to `walk_in` since that's likely the common case for manual entry, but let the dealer pick.
>
> 2. **Verify server trust of client-supplied listing-fee amount (W8).** `src/screens/sell/SellCarFlowScreen.tsx:787-790` computes `amount = { BASIC: 1, STANDARD: 10, PREMIUM: 25 }` on the client and POSTs it to `/payments/intent`. Check the backend endpoint (in the web repo at `D:\carmazium\` or via the API): does the server re-derive the amount from the listing's `badgeTier`, or trust the client? If it trusts the client, either (a) change the endpoint to accept `{ listingId, tier }` and derive server-side, or (b) at minimum, log this as a known issue in `CONTEXT.md` for a backend follow-up. Do NOT paper over it by pretending the client is authoritative.
>
> 3. **Slim down what's stored in SecureStore (W9).** `src/lib/supabase.ts:11-36` stores the full Supabase session (including the whole `user` object with metadata) in SecureStore under one key, which routinely exceeds SecureStore's 2048-byte soft limit — this is the observed "Value being stored in SecureStore is larger than 2048 bytes" warning and a real reliability risk on older Android. Split the storage: put only the access + refresh tokens in SecureStore, and store the rest of the session (expiry, user object) in `AsyncStorage` under a separate key. Use Supabase's official split-storage adapter pattern if the installed SDK version supports one — check the changelog. Keep the interface surface (`getItem`/`setItem`/`removeItem`) so Supabase itself doesn't see the split.
>
> 4. **Route `pushNotifications.ts` through `apiClient` (P7).** `src/lib/pushNotifications.ts:90-99` uses raw `fetch()` with manually-attached bearer, violating CLAUDE.md's convention. Replace with a single `apiClient('/users/push-token', { method: 'POST', body: JSON.stringify(...) })` call. Delete any now-unused helpers.
>
> Acceptance criteria:
> - `npx tsc --noEmit` clean.
> - New lead created via mobile with source "Phone" shows source=phone in the leads list AND in the web dashboard (parity check).
> - Answer written in the PR description or `CONTEXT.md` for #2 — either fixed, or acknowledged as a backend TODO with a linked issue.
> - No SecureStore >2048-byte warning after login (observe with `adb logcat | grep SecureStore` for at least one full session).
> - `pushNotifications.ts` has zero direct `fetch` calls.

---

## After Stage 5

Once all five stages land, the audit's remaining items are documented and either handled or explicitly deferred. Before calling the app "production ready" also:

1. Run through the manual test matrix in `CONTEXT.md` on a fresh build (not just dev-client).
2. Do a release-build test on Android (`npx expo prebuild --clean --platform android` then `expo run:android --variant release`) — dev-client can mask timing issues that only show up in release JS mode.
3. Enable a real crash reporter (Sentry / Bugsnag) before shipping — several audit findings reference "log to whatever crash-reporter is wired," and there isn't one in the tree yet.
