# Work log — August 2026

A record of what changed, why, and what remains. Commits are on `main` and
pushed to both `pizn-01/carmazium` (`origin`) and `carmaziums/carmazium`
(`client-origin`).

---

## 1. HPI reports — publish first, attach the report later

**Commits:** `274afcb8`, `28e4b760`

### The change

A listing whose seller paid for an HPI report used to be held back from going
live until staff produced the report, which stalled sellers behind our own
turnaround. It now publishes, runs, and can even sell with the report
outstanding; an admin attaches it afterwards.

### Backend

- `approveListing` no longer refuses on a `PENDING` report.
- New `POST` / `DELETE /hpi/admin/:listingId/pdf` so an admin can upload the
  supplied third-party PDF instead of re-keying it into the form.
- PDFs are stored **in-row as `Bytes`**, not in a bucket. Reports are paid
  content, so there must be no URL that reaches one without passing our auth.
  Magic-number checked (`%PDF-`), 15 MB cap.
- `renderPdf` serves an uploaded PDF in preference to the generated one, so the
  buyer email attachment and in-app download both follow automatically.
- `isClear` is an explicit admin choice on the upload path. Nothing is
  derivable from a PDF, and a silent default would put an unverified
  "all checks passed" badge on a listing.
- Both completion paths share `announceCompletion`: fan out queued buyer
  emails, and notify the seller (guarded so re-saving a typo doesn't re-notify).
- Daily cron chases admins about reports outstanding 3+ days, deduped via
  `reminderSentAt`.

### Web

- New `/dashboard/admin/hpi` queue. This was **required, not cosmetic**:
  `GET /hpi/admin/pending` had no UI at all, and once approval stopped gating,
  an approved-but-pending listing fell out of the review queue and became
  unreachable.
- Completed reports route to the editor that owns them — "Replace PDF" for
  uploads, "Edit report" for form entries.
- Pending reports render amber on buyer-facing pages. A green shield beside
  "being prepared" read as a check that had already passed.
- `apiClient` lets `FormData` set its own `Content-Type` (it carries the
  multipart boundary; forcing JSON left the server unable to parse the body).

### Mobile

- The report sheet was written entirely against the legacy OneAutoAPI shape, so
  admin-prepared reports rendered an **empty sheet**. It now branches on
  `format` and handles the PDF-only case.
- Loads any existing report on mount. Without this, a buyer arriving at a
  listing whose report was pending or already seller-paid was pushed to a
  £9.99 checkout **for a report that already existed**.
- Opens the PDF via `downloadAsync` + share sheet, carrying the bearer token.

### Not verified

The upload round trip was never exercised against production — at the time,
production had **zero** HPI reports (checked all 78 live listings), so the queue
would have rendered its empty state. Routes, guards, schema and bundles were
verified; the business flow was not.

---

## 2. Vercel outage — 301 GB bandwidth overage

**Commit:** `7db096a6`

### Cause

The whole site returned `402 Payment Required` /
`X-Vercel-Error: DEPLOYMENT_DISABLED`. Dashboard showed **Fast Data Transfer
301.04 GB / 100 GB** — 3× over. Every other metric was comfortably inside
limits, and Fast Origin Transfer was only 264 MB, so the bytes were static
assets served from the edge.

`public/` was **342 MB**, dominated by:

| File | Size | Status |
|---|---|---|
| `about-cinematic.mov` | 85.66 MB | 4K, 68 Mbps, autoplaying, CSS-blurred |
| `hero-cinematic2.mp4` | 61.46 MB | unreferenced |
| `vecteezy_woman-drives-car….mp4` | 61.46 MB | unreferenced |
| 3 × `.glb` 3D models | 91 MB | loaded on **every** vehicle page view |
| `discover-hero*.png` | 10.6 MB | `priority`, homepage, served raw |

`next.config.ts` has `images: { unoptimized: true }` (set during an earlier
image-quota incident), so those PNGs were served at full size on every visit.
The 3D viewer rendered unconditionally in "Condition & Damage", and
`dynamic({ssr:false})` only defers the JS chunk — `useGLTF` fetches on mount.

### Fixes

- `discover-hero.png` 5.27 MB → **46 KB** WebP (99% reduction)
- `about-cinematic.mov` 85.66 MB → **1.10 MB** MP4 + 65 KB poster
- 3D viewer gated so the model isn't fetched until it's actually wanted
- `preload="none"` + posters on hero videos
- ~125 MB of unreferenced media deleted

`public/` went 342 MB → ~113 MB.

### Outcome

Project was transferred to the client's Vercel Pro account. Verified afterwards
that the optimized build survived the transfer and auto-deploy reconnected.

> **Note:** Vercel's Hobby plan prohibits commercial use. CarMazium takes
> payments. If the account is ever moved back to Hobby, this recurs.

---

## 3. Google sign-in broken

**No code change — configuration fix.**

### Cause

`signInWithOAuth` sends `redirectTo: ${window.location.origin}/auth/callback`.
Probing Supabase's auth endpoint directly showed:

| Redirect URL | Result |
|---|---|
| `https://www.carmazium.com/auth/callback` | ❌ discarded → `https://carmazium.com` |
| `https://carmazium-two.vercel.app/auth/callback` | ❌ discarded → `https://carmazium.com` |
| `https://carmazium.com/auth/callback` | ✅ allowed |
| `https://carmazium.vercel.app/auth/callback` | ✅ allowed |
| `http://localhost:3000/auth/callback` | ✅ allowed |

`www.carmazium.com` was **not allowlisted** — and the apex 301-redirects to
`www`, so that's the host every real user is on. Supabase discarded the
redirect and fell back to Site URL `https://carmazium.com`: the bare homepage,
no `/auth/callback`, no `?code=`. Users landed logged out. Old and new accounts
alike.

### Fix

Allowlisted `www.carmazium.com` and `carmazium-two.vercel.app`; Site URL moved
to `https://www.carmazium.com`. Re-probed and confirmed both now resolve to
themselves.

I deliberately did **not** "fix" this in code by forcing a canonical
`redirectTo` — that would complete the callback on the apex, write the Supabase
session into that origin's localStorage, then redirect to `www` where the
session doesn't exist. Strictly worse.

---

## 4. Re-auctioning was structurally impossible

**Commit:** `3418edff`

### Cause

When an auction ends with reserve not met, `AuctionsService.closeAuction`
deliberately reverts the listing to `status: DRAFT, type: CLASSIFIED` —
specifically so the seller can re-auction it (per its own comments).

But the only UI entry point, the "Re-auction" button in `AuctionResultsModal`,
feeds that listing's ID into the seller auctions form, whose eligibility filter
required `status === "ACTIVE"`. A `DRAFT` listing can never satisfy that.

So the dropdown showed **"No eligible listings"** for the exact listing the
seller was trying to select, while `<select value={formListingId}>` held a value
with no matching `<option>` and rendered the placeholder — which is why it
looked like nothing was selected, right before submitting surfaced
**"Listing not found"**.

This was broken for **every seller, 100% of the time**.

### Fix

Frontend filter widened: a listing also counts as eligible when it is `DRAFT`
**and** has an `ENDED` auction against its own ID — that combination proves it's
a reverted auction rather than an ordinary unfinished draft (which stays
excluded). The dropdown labels it "(previous auction ended — reserve not met)".

The backend needed no change; `create()` already accepted a DRAFT listing,
reused the existing `ENDED` auction row and flipped `type` back to `AUCTION`.
The frontend gate was simply stricter than the backend it was meant to match.

---

## 5. Analytics & Google Ads

**Commits:** `d35bfee0`, `e3c5fd33`

Full detail in [`ANALYTICS_TRACKING_SETUP.md`](./ANALYTICS_TRACKING_SETUP.md).
Summary:

- **No app event ever reached GA4.** Events went to the GTM dataLayer, but
  container `GTM-WJS3K6D2` has 0 tags / 0 triggers / 0 variables. Fixed by
  sending straight to GA4 via gtag.
- **Google Ads had zero conversion tracking.** Added `lib/googleAds.ts` and
  created two Primary conversion actions (Purchase, Submit lead form).
- **Purchase goal had 0 primary actions**, so a £50/day Performance Max
  campaign was optimising against Google's auto-detected form submits rather
  than any real business outcome. Now 1 primary.
- **Auto-apply recommendations was fully on** (21/21 types). Turned off.

Verified in production: GA4 receives `en=search`; Ads receives
`pagead/conversion/18328618718/`.

---

## Outstanding

| Item | Where |
|---|---|
| Google Consent Mode v2 not implemented — largest measurement gap | Analytics doc §6.1 |
| Contact / Page view Ads goals still Misconfigured | Analytics doc §6.4 |
| Second GA4 property `G-ZTE65WTK16` collecting via the Ads tag | Analytics doc §6.6 |
| Empty GTM container loading on every pageview | Analytics doc §6.7 |
| Enhanced Conversions — needs legal/consent decision | Analytics doc §6.8 |
| HPI upload round trip untested against production | §1 above |
| Live Postgres password committed in `docs/FLY_IO_DEPLOYMENT.md` | see below |
| Pre-existing backend type errors (payments.controller, sellers.service, db-backup) | unrelated to this work |

### Credential in git history

`docs/FLY_IO_DEPLOYMENT.md` contains a live Postgres password in plaintext. It
is for the now-dead `qcqnllehtuczgammazwi` Supabase project, so likely inert —
but it is in the history of two public repos. Deleting the line will not remove
it from history. Confirm the credential is not reused anywhere, then decide
whether history needs rewriting.
