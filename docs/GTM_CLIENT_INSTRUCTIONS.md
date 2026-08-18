# CarMazium — Analytics Setup

## What we need from you

| # | Item | Format | Where to get it |
|---|---|---|---|
| 1 | GA4 Measurement ID | `G-XXXXXXXXXX` | analytics.google.com → Admin → Create → Property → Web data stream for `carmazium.com` |
| 2 | GTM Container ID | `GTM-XXXXXXX` | tagmanager.google.com → Create Account → Container type **Web** |

Send us both. Tracking does not start until we add them.

**Note:** the "Google tag" you sent (`AW-18328618718`) is your Google **Ads**
conversion tag, not Analytics. It's already installed. You do not currently
have a GA4 property — item 1 above creates it. Your TikTok and Meta pixels are
also already installed; no action needed on those.

**Do not paste any tracking snippets into the site.** All pixels are already
built in. Adding snippets would count everything twice.

---

## Step 1 — GTM: create the tags

For each row: create a **Trigger**, then a **Tag**, then link them.

**Trigger:** Triggers → New → **Custom Event** → event name exactly as below → All Custom Events → Save.

**Tag:** Tags → New → **Google Analytics: GA4 Event** → pick your GA4 config → Event Name same as below → add the parameters → attach the trigger → Save.

| Event name | Parameters |
|---|---|
| `valuation_requested` | `listing_type`, `make`, `model`, `year` |
| `listing_started` | `listing_type`, `seller_role` |
| `listing_step_completed` | `listing_type`, `step`, `step_name` |
| `listing_submitted` | `listing_type`, `outcome`, `badge_tier` |
| `listing_fee_paid` | `value`, `currency`, `transaction_id` |

Click **Submit** to publish. Not live until published.

**Optional extras** (same method): `valuation_failed`, `listing_step_blocked`,
`listing_submit_failed`, `auction_submitted_for_review`,
`listing_checkout_started`, `purchase`.

### Two things not to do

- **No GA4 Configuration tag.** GA4 pageviews are handled by the site. A config tag in GTM double-counts every visit.
- **Don't map `listing_submitted` and `auction_submitted_for_review` to the same conversion.** The second is a subset of the first.

---

## Step 2 — GA4: register the dimensions

Admin → Custom definitions → Create custom dimension. Scope = **Event**.

| Name | Parameter |
|---|---|
| Listing type | `listing_type` |
| Step name | `step_name` |
| Outcome | `outcome` |
| Seller role | `seller_role` |
| Badge tier | `badge_tier` |

Without this the data arrives but stays invisible in reports. Not backfilled — do it before you need the data.

---

## Step 3 — View the funnel

GA4 → Explore → **Funnel exploration**. Steps in order:

1. `listing_started`
2. `listing_step_completed` where Step name = `Details`
3. `listing_step_completed` where Step name = `Media`
4. `listing_step_completed` where Step name = `Pricing`
5. `listing_submitted`
6. `listing_fee_paid`

Set **Breakdown** = *Listing type* to compare retail vs auction.

Auction listings are free and skip payment — they finish at step 5. Only retail reaches step 6.

---

## Testing

GTM → **Preview** → enter `https://carmazium.com` → start listing a car. Events appear in the Preview timeline as you go. GA4 → Reports → **Realtime** confirms within a couple of minutes.

---

## Compliance

The site has no cookie consent banner and loads five tracking tools. Under UK GDPR/PECR, analytics and advertising cookies need consent before being set. We recommend adding a banner wired to GTM Consent Mode — quotable separately.

We do not send registration numbers, emails, phone numbers or postcodes to Google. Registration plates are personal data and Google prohibits sending personal data to Analytics. Make, model and year are sent.
