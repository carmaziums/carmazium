# Mobile TradeXchange parity — starting brief

**Created:** 1 October 2026
**Baseline commit:** `cfac4e2d` (client-origin/main, pulled clean)
**Target:** React Native app at `carmazium app/carmazium app/`
**Source of truth:** the web app (`src/`). Flutter is parked — RN is the active track.

---

## The reported symptom

> "They worked on it, but when we build the release we can't see the new pages."

## Diagnosis: the screens are orphaned, not missing

The code is there. It is registered. **Nothing navigates to it.**

- `MainStackNavigator.tsx` registers **62 routes**, including the whole TradeXchange
  services surface: `Services`, `PartnerDashboard`, `ProviderJobs`, `ProviderLeads`,
  `ProviderCapabilities`, `ProviderVerification`, `ProviderMatching`, `ProviderMessages`,
  `CustomerServiceJobs`, `CustomerServiceJobDetail`.
- The tab bar exposes only: `Home`, `Search`, `Live`, `Saved`, `Profile`.
- `linking.ts` defines no deep links for them.

**14 registered routes have zero `navigate()` / `push()` entry points:**

```
About              BuyerDashboard      DealerAnalytics    Earnings
Finance            HowItWorks          MyListingDashboard NotificationSettings
Pricing            Reviews             Services           UnifiedDashboard
AuctionDeepLink*   VehicleDeepLink*
```

`*` these two are legitimate — they are reached through deep-link config, not `navigate()`.

`Services` was verified exhaustively: the only files in the repo that mention `ServicesScreen`
are `MainStackNavigator.tsx` and the screen itself. It is unreachable by any route.

The remaining orphans were detected by grepping `navigate('X')` / `push('X')`, which would miss
navigation through a variable or a menu-config array. **Confirm each individually before
declaring it orphaned** — the detection method is sound for `Services` but not proof for all 14.

Two further gaps found:

- `DealerProfileScreen.tsx` exists on disk but is **not registered** in the navigator at all.
- `DealerProfile` likewise has zero entry points.

## Why this matters more than it looks

This is not "a few missing links". It means a body of TradeXchange work was built and merged
without ever being reachable, so **none of it can have been exercised end to end** — not by the
client, not by a reviewer, not in a release build. Treat every orphaned screen as unverified
until it is opened and walked through against the web flow, regardless of how finished the code
looks.

---

## Scope agreed with the user

Mobile parity for TradeXchange **end to end**, covering:

1. The auction room / bidding flow (the feature fully proven on web)
2. **The other TradeXchange services too** — not just auctions. The provider and customer
   service journeys listed above.

Explicitly out of scope: Flutter. To be discussed with the client separately; RN is the near-term
track.

## Surface comparison at baseline

| | Web | Mobile |
|---|---|---|
| Dealer routes | 18 | 14 screens |
| Absent on mobile | — | `bids`, `crm`, `messages`, `settings`, `wishlist`, `add-listing`, `put-on-auction` |
| Auction routes | `browse`, `live`, `won`, `how-it-works` | detail + deep-link screen |

---

## Suggested order of work

1. **Make the existing work reachable first.** Wire the orphaned screens into navigation and
   walk each one against its web counterpart. This converts invisible code into something
   testable, and will surface the real defects — which cannot be seen while the screens cannot
   be opened.
2. **Then fix what that exposes**, web as the reference for every business rule.
3. **Then close the surface gaps** in the table above.

Doing (3) before (1) risks building more screens nobody can reach.

## Rules to carry in

- **Web is the source of truth** for business rules. Never port a rule from an older RN
  implementation — RN has superseded decisions in it.
- The app shares the production backend. Do not duplicate business logic client-side; call the
  endpoint.
- Trade Exchange is **verified-dealers-only** — the backend enforces this with
  `VerifiedDealerGuard`, and the mobile UI must match, not re-implement, that rule.
- Handover proof now uploads through `POST /auctions/:id/handover-proof/document` (multipart,
  private storage). The mobile app was moved onto it on 23 September; do not reintroduce direct
  uploads to the public `listings` bucket.
- Invoke the `/mobile` skill at session start — it is purpose-built for implementing web
  features in this RN app against the same backend.

---

## Existing reference: `MOBILE_PARITY_PROMPTS.md` (repo root, untracked)

A 465-line parity document dated **5 July 2026**. Use it carefully — half is durable, half is
stale.

**Still valid — carry these constraints:**

- Expo SDK 54, React Navigation 7, StyleSheet, Zustand, `@stripe/stripe-react-native`,
  `socket.io-client`, `react-native-webview`
- Auth: Supabase JWT → `Authorization: Bearer` via `src/lib/apiClient.ts`
- Design tokens in `src/constants/{colors,typography,spacing}.ts`
- **Do not** introduce NativeWind, TanStack Query, or another state library
- Web (`src/`) is the reference for feature behaviour

**Stale — do not trust:**

Its gap analysis, priority table and "deploy-blocking" flags predate roughly 500 commits,
including 84 touching the mobile app. Several gaps it lists have since been built (that is
precisely the work that turned out to be unreachable). Re-derive any gap list from the current
tree rather than reading it off that document.
