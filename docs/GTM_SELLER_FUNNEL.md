# GTM — Seller Funnel Setup

The app pushes named Custom Events to `window.dataLayer`. GTM decides what to
do with them. This doc is the contract between the two.

**Code side:** `src/lib/gtm.ts` (event names + `pushToDataLayer`),
`src/hooks/useAnalytics.ts` (fans every `trackEvent` call out to both the
first-party store and the dataLayer).

## 1. Activate the container

Set `NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX` in the environment (Vercel → Project →
Settings → Environment Variables, plus `.env.local` for local dev). Until
that's set, `<GoogleTagManager />` renders nothing and no events are consumed
— the dataLayer pushes still happen harmlessly.

⚠️ **Don't move GA4 into GTM without removing `<GoogleAnalytics />` from
`src/app/layout.tsx`.** GA4 currently loads directly. Running a GA4 config tag
in GTM *and* the direct script will double-count every pageview and
conversion. Same applies to Meta (`<MetaPixel />`) and TikTok
(`<TikTokPixel />`) if you migrate those into GTM.

## 2. Seller funnel events

In order. All fire client-side.

| # | Event name | When | Key parameters |
|---|---|---|---|
| 1 | `valuation_requested` | Reg entered, DVLA lookup returned data | `listing_type`, `make`, `model`, `year`, `fuel_type` |
| — | `valuation_failed` | Lookup errored | `listing_type`, `reason` |
| 2 | `listing_started` | Seller picked Retail or Auction, entered wizard | `listing_type`, `seller_role` |
| 3 | `listing_step_completed` | A wizard step validated and advanced | `listing_type`, `step`, `step_name`, `total_steps` |
| — | `listing_step_blocked` | Step failed validation | `listing_type`, `step`, `step_name` |
| 4 | `listing_submitted` | **Wizard finished (either path)** | `listing_type`, `outcome`, `listing_id`, `badge_tier`, `make`, `model`, `year`, `seller_role` |
| 4a | `auction_submitted_for_review` | Auction path only | same as above |
| 4b | `listing_checkout_started` | Retail path only, redirecting to Stripe | same as above |
| — | `listing_submit_failed` | Submit threw | `listing_type`, `badge_tier`, `reason` |
| 5 | `listing_fee_paid` | Retail listing fee cleared | `transaction_id`, `value`, `currency`, `listing_type`, `listing_id` |
| — | `purchase` | Any fee cleared (listing, buyer, KYC, deposit) | `transaction_id`, `value`, `currency`, `fee_type`, `listing_id` |

### Watch out for these

- **`auction_submitted_for_review` and `listing_checkout_started` are subsets
  of `listing_submitted`**, fired alongside it. Use `listing_submitted` for the
  funnel; use the path-specific ones only when you want a trigger for just one
  path. Mapping both to the same GA4 conversion double-counts.
- **`step` numbering skips the "Method" card.** The wizard shows Method as
  step 1 cosmetically, but `currentStep` starts at 1 = Details. Retail has 4
  steps, auction has 5 (extra Auction step) — hence `total_steps` on the event.
- **Retail never fires a "published" event in the wizard.** The seller leaves
  for Stripe, so the retail funnel completes at `listing_fee_paid` on the
  success page. Auctions complete in-wizard at `auction_submitted_for_review`
  because they're free and skip payment entirely.
- **`listing_fee_paid` fires on page load of the success page**, guarded
  against double-fire per Stripe session. Pass `transaction_id` through to GA4
  so a refresh can't inflate conversions.

## 3. Building the funnel in GA4

Create a GA4 Event tag in GTM per event above, triggered on a Custom Event
trigger matching the event name, forwarding the parameters as event
parameters. Then register `listing_type`, `step_name`, `outcome`, and
`seller_role` as **custom dimensions** in GA4 (Admin → Custom definitions) —
without that, GA4 records the events but the parameters aren't queryable in
reports.

Then GA4 → Explore → **Funnel exploration**, steps in order:

1. `listing_started`
2. `listing_step_completed` where `step_name = Details`
3. `listing_step_completed` where `step_name = Media`
4. `listing_step_completed` where `step_name = Pricing`
5. `listing_submitted`
6. `listing_fee_paid` *(retail only — auctions end at step 5)*

Breakdown dimension: `listing_type`. That's the whole point — retail and
auction are different products with different economics, and comparing their
drop-off curves side by side is what tells you which flow is losing sellers.

## 4. First-party alternative

Every one of these events also lands in CarMazium's own database via
`POST /analytics/event` (that path predates GTM and is unaffected by it). So
the same funnel can be built in `/dashboard/admin/analytics` without relying
on GA4 at all, and can be joined against business data GA4 can't see — e.g.
drop-off by dealer vs. private seller, or by vehicle make.

## 5. Privacy

`pushToDataLayer` deliberately never sends VRM/registration, email, phone, or
postcode. A registration plate is personal data under UK GDPR (it maps to a
registered keeper), and Google's terms prohibit sending PII to GA4. Vehicle
make/model/year and internal listing IDs are what the funnel needs and are
safe to send.

**Still outstanding:** there's no consent banner on the site. Running GTM plus
four tracking pixels without one is a live UK GDPR/PECR gap. If you add a
consent tool, wire it to GTM's Consent Mode so tags hold until consent is
granted, rather than relying on each pixel's own gating.
