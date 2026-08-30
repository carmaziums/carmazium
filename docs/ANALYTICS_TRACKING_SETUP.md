# Analytics, Tag Manager & Google Ads — setup, decisions, and known gaps

Last updated: 2026-08-31

This documents the measurement pipeline end to end: what is configured, why it
is configured that way, what was broken and how it was fixed, and what is still
outstanding. Read the "Known gaps" section before changing anything — several
of the choices here are deliberate and undoing them will double-count data.

---

## 1. What is configured

| Product | ID | Where it comes from |
|---|---|---|
| Google Analytics 4 | `G-MR12LCBSXY` | `NEXT_PUBLIC_GA_MEASUREMENT_ID` |
| Google Ads | `AW-18328618718` | `NEXT_PUBLIC_GOOGLE_ADS_ID` |
| Google Tag Manager | `GTM-WJS3K6D2` | `NEXT_PUBLIC_GTM_ID` |
| Meta Pixel | — | `NEXT_PUBLIC_META_PIXEL_ID` |
| TikTok Pixel | — | `NEXT_PUBLIC_TIKTOK_PIXEL_ID` |

GA4 property `549182278`, stream `15402469309`, account `404051742`.
Google Ads account: Carmazium Ltd, `699-823-8086`.

Consent handling differs by vendor, and the distinction matters:

- **Google (GA4 + Ads)** uses **Consent Mode v2**. The tag loads for everyone
  with all storage denied, stores nothing, and is upgraded by
  `consent: update` if the visitor accepts — so Google receives an explicit
  signal either way. See §4.5.
- **GTM, Meta Pixel, TikTok Pixel** are hard-gated: nothing loads until the
  visitor accepts (`context/ConsentContext.tsx`). They have no equivalent
  signalling mechanism.

Everything is additionally gated on environment (`lib/analyticsEnv.ts`) so
Vercel preview builds and local dev cannot report into production.

---

## 2. How an event flows

Everything goes through a single call site:

```
useAnalytics().trackEvent(name, payload)
        │
        ├─► POST /analytics/event      first-party store (admin dashboard)
        ├─► pushToDataLayer(...)       GTM dataLayer  (lib/gtm.ts)
        ├─► trackGa4Event(...)         GA4 via gtag   (components/analytics/GoogleAnalytics.tsx)
        └─► trackAdsConversion(...)    Google Ads     (lib/googleAds.ts)
```

Adding an event anywhere in the app automatically reaches all four. No tag
configuration is required for GA4.

### The events

**Seller funnel** (`lib/gtm.ts` → `SELLER_FUNNEL`)

| Event | Fires when | Key params |
|---|---|---|
| `valuation_requested` | Reg entered, DVLA data returned | `listing_type`, `make`, `model`, `year`, `fuel_type` |
| `listing_started` | Seller picks Retail or Auction | `listing_type`, `seller_role` |
| `listing_step_completed` | A wizard step validates and advances | `listing_type`, `step`, `step_name`, `total_steps` |
| `listing_submitted` | Wizard finished, either path | `listing_type`, `listing_id`, `badge_tier`, `make`, `model`, `year`, `seller_role`, `outcome` |
| `auction_submitted_for_review` | Auction path only — **subset** of the above | same |
| `listing_checkout_started` | Retail path only — **subset** of the above | same |
| `listing_fee_paid` | Listing fee cleared — **subset** of `purchase` | `transaction_id`, `value`, `currency`, `listing_type`, `listing_id` |

**Commerce**

| Event | Fires when | Key params |
|---|---|---|
| `purchase` | Any Stripe checkout completes | `transaction_id`, `value`, `currency`, `fee_type`, `listing_id` |

**Engagement / diagnostics**: `search`, `page_view`, `listing_step_blocked`,
`listing_submit_failed`, `valuation_failed`.

---

## 3. Google Ads conversions

| Ads conversion action | Fires on | Label | Type |
|---|---|---|---|
| Purchase | `purchase` event | `KyfHCLLQ1eocEN6N4qNE` | Primary, value-based, count Every |
| Submit lead form (1) | `listing_submitted` event | `uD94CLXQ1eocEN6N4qNE` | Primary |
| **Completed Seller Registration** | **confirmed new account** | `LTNTCIuK4-ocEN6N4qNE` | Primary, count One |

### Completed Seller Registration — why it is wired differently

This one does NOT go through the analytics event map. It fires from a single
point in `src/app/auth/callback/page.tsx`: the response to `/users/sync`,
gated on the backend's `isNewUser`.

`users.service.syncUser` already computed `userExists` to decide whether to
send a welcome email; it now returns it. The flag can only be true on the
request that actually inserted the user row, so it is structurally incapable
of being true for a login, a dashboard refresh, a return visit, or an
abandoned or invalid signup — none of which reach a successful sync at all.

That mattered because the obvious implementation — firing on arrival at
`/dashboard` — would have counted every one of those, and the Search
campaign's Maximise Conversions bidding would have learned from the inflated
number. Deriving newness client-side from how recent `user.created_at` looks
(as the onboarding page does, for a different purpose) would have been a
guess rather than a fact.

Both signup routes converge on `syncBackendAndRedirect`, so email/password
(arriving via the Supabase verification link) and Google OAuth (arriving with
`?code=`) are both covered without special cases. Note the older
`trackMetaEvent("CompleteRegistration")` beside it only ever covered the
first of the two.

`trackSignupConversion` dedupes per account id in **localStorage, not
sessionStorage** — the guarantee required is "never again", which has to
survive a refresh, a logout/login and a visit next week, all of which start a
new session. Keyed by account so a shared browser can still report a genuine
second person's registration.

Verified in production: an existing user hitting `/dashboard`, refreshing, and
revisiting produced zero conversion pings, and a genuine new registration
produced exactly one.

All three are Website / "manually with code" actions on `www.carmazium.com`,
data-driven attribution. Purchase and Submit lead form use a 90-day click
window and count Every; Completed Seller Registration counts One.

Labels live in `lib/googleAds.ts` as committed defaults, with env-var override
(`NEXT_PUBLIC_GADS_LABEL_*`). They are **not secrets** — they ship in the client
bundle and are visible in view-source, exactly like the `AW-`/`G-` IDs. Keeping
them in code means a deploy doesn't depend on env vars being set in whichever
Vercel account owns the project.

### Deliberately NOT mapped to Ads conversions

Mapping these would double-count, because each is a *subset* of an event that
is already mapped:

- `listing_fee_paid` — subset of `purchase`
- `auction_submitted_for_review` — subset of `listing_submitted`
- `listing_checkout_started` — subset of `listing_submitted`

`valuation_requested` is unmapped for a different reason: no Ads category fits
a DVLA-lookup micro-conversion without mislabelling it. If one is created later
it must be **Secondary** — a cheap top-funnel action set as Primary pushes smart
bidding towards low-intent traffic.

---

## 4. What was broken, and what fixed it

### 4.1 No app event ever reached GA4

**Symptom:** GA4 showed only `page_view`, `scroll`, `click`, `form_start`,
`form_submit`, `session_start`, `first_visit`, `user_engagement`,
`view_search_results`, plus two `ads_conversion_*` actions. None of the funnel
events appeared. The manually-created `purchase` key event read
"No stream data detected".

**Cause:** every one of those visible events is auto-generated — GA4 Enhanced
Measurement, plus conversions Google Ads creates by itself. The app's own
events were pushed to the **GTM dataLayer**, but a dataLayer push only reaches
GA4 if a GA4 Event tag + Custom Event trigger exists in the GTM console.
Container `GTM-WJS3K6D2` has **0 tags, 0 triggers, 0 variables** (verified in
the console — Version 2 live, Version 1 literally named "Empty Container").
The dataLayer was talking to nobody.

**Fix:** `trackGa4Event()` sends events straight to GA4 via gtag, so the funnel
works with zero GTM configuration.

> ⚠️ **Do NOT create GA4 Event tags in GTM for these event names.** The
> dataLayer push is retained (it's what lets Meta/TikTok tags be attached
> per-event from the GTM console), so a GA4 tag on the same custom event would
> double-count every single one.

### 4.2 Google Ads had zero conversion tracking

**Symptom:** `AW-18328618718` was loaded and configured, but nothing ever fired
a conversion against it. Smart bidding had nothing real to optimise towards.

**Cause:** no code path ever called `gtag('event','conversion', …)`.

**Fix:** `lib/googleAds.ts`, plus the two conversion actions above.

### 4.3 The Purchase goal could not feed bidding

**Symptom:** Ads warned *"3 goals cannot be used for optimisation because they
do not have any primary conversion actions."* The **Purchase** goal — the only
one representing real revenue — had **0** primary actions. The only Active
goals were `ads_conversion_Submit_lead_form_1` and `ads_conversion_Contact_1`,
both auto-created by Google from generic detected form submits.

Meanwhile a **Performance Max campaign was live at £50/day**. PMax is almost
entirely conversion-driven, so it had been optimising against "someone
submitted some form somewhere" rather than any CarMazium business outcome.

**Fix:** Purchase goal now has 1 primary conversion action.

### 4.4 Auto-apply recommendations was fully enabled

**Symptom:** all 21 auto-apply types were on (7/7 "Maintain your ads",
14/14 "Grow your business"). Google could change bidding, budgets, keywords and
ad copy unattended; one had already been applied 17–23 Aug 2026.

**Fix:** turned off — now 0/7 and 0/14.

---

### 4.5 Google received no consent signal at all

**Symptom:** Ads diagnostics reported *"Verify consent mode set up as 0%
consent rate detected"*, with conversion reporting flagged as impacted because
consent is required for website conversions in the EEA/UK. This — not "the
actions are new" — was what kept the Purchase and Page view goals on
"Misconfigured".

**Cause:** the site refused to load gtag until the visitor accepted cookies,
so Google received nothing. Not "denied" — silence, which reads as 0% and
leaves Google unable to model the conversions it cannot observe.

**Fix:** `components/analytics/GoogleConsentMode.tsx` declares every storage
type denied *before* any Google tag loads, so the tag loads for everyone while
storing nothing, and `ConsentContext` sends `consent: update` on the visitor's
choice — for **both** outcomes, since an explicit "denied" is itself a signal.
Also sets `ads_data_redaction` and `url_passthrough`.

Ordering is load-bearing: the defaults use `beforeInteractive` so they are
inline in the initial HTML, and the component is mounted **first** in
`app/layout.tsx`. Moving it below `GoogleAnalytics` would make them arrive too
late to apply, silently.

Verified on the wire: `gcs=G100` before consent, `gcs=G111` after accepting,
and an explicit denied update on reject.

Tradeoff: Google's tag now loads for every visitor. With storage denied it
sets no cookies and no advertising identifiers, but a cookieless ping does
reach Google — that is how modelled conversions work and is the mechanism
Google prescribes for GDPR. If a stricter "no requests before consent" posture
is ever needed, `GoogleConsentMode.tsx` is the single place to change it, and
the 0% diagnostic will return.

## 5. Verified working

Confirmed against production, not assumed:

- **GA4** — drove a real search on `www.carmazium.com` and captured
  `analytics.google.com/g/collect?…&tid=G-MR12LCBSXY&en=search&ep.query=audi%20a4`
- **Google Ads** — fired one test conversion and captured
  `pagead2.googlesyndication.com/pagead/conversion/18328618718/`
- **Deployed bundle** — conversion labels confirmed present in the live JS

> One test conversion (value £1, `transaction_id: pipeline-verify-…`) exists in
> the Ads account from that verification. Ignore it in reporting.

---

## 6. Known gaps

### 1. Three Primary actions now share the "Submit lead form" goal

RESOLVED SEPARATELY: Consent Mode v2 is implemented (§4.5) — this gap used to
read "no Consent Mode", which Ads diagnostics had flagged as
"0% consent rate detected".

What remains is a bidding question, not a tracking one. The "Submit lead form"
goal currently holds three Primary actions:

- `ads_conversion_Submit_lead_form_1` — auto-created by Google, fires on a
  **page load of /auctions**. Not a business outcome; should be removed or
  demoted.
- `Submit lead form (1)` — ours, fires on `listing_submitted`.
- `Completed Seller Registration` — ours, fires on a confirmed new account.

Maximise Conversions optimises the **sum** of the Primary actions in a goal, so
the campaign is currently learning from page loads, listing submissions and
registrations mixed together. Pick one signal per campaign and demote the rest
to Secondary — they are still measured, they just stop driving bidding.

Worth knowing when choosing: registration is high-volume and low-intent
(anyone can make an account to browse), whereas `listing_submitted` is the
point someone actually becomes a seller. Optimising for the cheaper of two
Primary actions is what smart bidding will do by default.

### 2. GCLID attribution — verified working, with one caveat

Checked rather than assumed: `carmazium.com/?gclid=…` 301-redirects to
`www.carmazium.com/?gclid=…` with the query preserved, and the `_gcl_aw`
first-party cookie is written on landing. Because attribution rides in that
cookie, no internal redirect can strip it — including `auth/callback`'s
`router.replace`, which does drop query params.

Caveat: under denied consent `ad_storage` is denied, so `_gcl_aw` is not
written. `url_passthrough` (set with the Consent Mode defaults) partially
covers this, but those conversions are modelled rather than click-attributed.

### 3. `purchase` covers every fee type

HPI report (£9.99), buyer fee (£125) and listing fee all fire `purchase` with
their real value. Value-based bidding therefore optimises on total revenue, not
listing revenue specifically. Split by `fee_type` in reporting, or create a
separate conversion action if listing fees should be bid on alone.

### 4. `listing_submitted` fires before payment

It carries `outcome: awaiting_payment | pending_review`, so a seller who
reaches the end of the wizard and never pays still counts as a lead. Correct
for a *lead* conversion, but it will read higher than paid listings.

### 5. Two Ads goals remain Misconfigured

**Contact** (0 primary) and **Page view** (1 primary) are Google auto-created
goals with no corresponding real event. The fix is removing them from campaign
goal selection, not inventing conversions to satisfy them — that changes
campaign targeting, so it needs a deliberate decision.

### 6. New conversion actions show "Misconfigured" / "Needs attention"

Expected. Ads flags a new action as unhealthy until it receives its first real
conversion. Clears on the first genuine purchase or listing submission.

### 7. A second GA4 property is collecting

`G-ZTE65WTK16` also receives pageviews. It is **not** in this codebase and
**not** in GTM (the container is empty). Evidence points to it being a linked
destination on the Google Ads tag — both fire from the same loader
(`gtm=45be68…`), unlike ours (`gtm=45je68…`). Configured in Google Ads →
Admin → Data manager → Google tag → Destinations. Harmless but noisy; worth
unlinking if nobody reads that property.

### 8. GTM container is empty

`GTM-WJS3K6D2` loads on every pageview and does nothing. Keep it only if
Meta/TikTok tags will be managed there; otherwise remove the script for a small
performance win.

### 9. Enhanced Conversions not implemented

Would improve attribution, but requires sending a hashed email to Google. That
cuts against the codebase's explicit no-PII rule (`lib/gtm.ts` deliberately
excludes VRM, email, phone and postcode — a registration plate is personal data
under UK GDPR). Needs a legal/consent decision before implementing.

---

## 9. Privacy rules (do not break these)

- No VRM/registration, email, phone or postcode is ever sent to any tag.
  A plate maps to a keeper and is personal data under UK GDPR; Google's own
  terms forbid PII in GA4.
- Vehicle make/model/year and internal IDs are safe and are what the funnel
  actually needs.
- Use `listing_id` rather than anything vehicle-identifying when enriching.
