# Go-Live Plan — carmazium.com

Tracks everything needed to cut the production domain over to `carmazium.com` and get the site indexed/tracked properly. Companion to [`CLIENT_SETUP_GUIDE.md`](../CLIENT_SETUP_GUIDE.md) (client-owned steps) and `CarMazium_Domain_Setup_carmazium.com.docx` (polished handover copy of the same).

Stack recap: **Vercel** (Next.js frontend) · **Fly.io** `carmazium-hjoh9w.fly.dev` (NestJS backend) · **Supabase** (Postgres + auth) · **Stripe** (payments). The `render.yaml` / Render docs in this repo are stale — production moved to Fly.io; ignore them for live config.

---

## 1. Code changes — done this session, not yet deployed

The repo had a mix of `carmazium.co.uk`, `carmazium.uk`, and `carmazium.com` hardcoded in different places (metadata, sitemap, JSON-LD, footer, email templates, backend User-Agent header). All normalized to `carmazium.com` (or `NEXT_PUBLIC_APP_URL` where an env-driven value made sense), plus two fixes:

| Change | File(s) |
|---|---|
| Domain refs unified to `carmazium.com` | `src/app/layout.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/components/seo/JsonLd.tsx`, `src/app/buy-cars/[slug]/page.tsx`, `src/components/layout/Footer.tsx`, `backend/src/listings/listings.service.ts`, `supabase-email-templates/change-email.html`, `backend/.env.example` |
| **Bug fix:** Stripe webhook URL | `CLIENT_SETUP_GUIDE.md` documented `https://www.carmazium.co.uk/api/webhooks/stripe` — **that route doesn't exist**, there's no Next.js API route for it. The real handler is `POST /payments/webhook` on the Fly.io backend. If this was ever set up per the old doc, Stripe events have been failing silently (no payment confirmation → listings never auto-publish, payouts/refunds never fire). Corrected in both the guide and the handover doc — verify the client's existing webhook (if any) and fix it. |
| `carmazium.com` / `www.carmazium.com` added to backend CORS allowlist | `backend/src/main.ts` (`CORE_ORIGINS`) |
| Google Analytics 4 scaffolding added (no-op until a Measurement ID is set) | `src/components/analytics/GoogleAnalytics.tsx`, wired into `src/app/layout.tsx` |
| Search Console verification meta tag support added | `src/app/layout.tsx` (`metadata.verification.google`, env-driven) |

**None of this is deployed yet.** Frontend changes need `git push` (assuming Vercel's GitHub integration auto-deploys `main` — confirm this is still connected). Backend changes need an explicit `fly deploy -a carmazium-hjoh9w` from `backend/`. Flagging before doing either since both touch the live site — say the word and I'll ship them.

One thing to know about the backend deploy: `backend/fly.toml`'s `release_command` runs `npx prisma db push --accept-data-loss` on every deploy. That's pre-existing (not something introduced here) but worth being aware of — it means every backend deploy touches the production schema directly rather than through tracked migrations. Not blocking, just flagging.

---

## 2. Domain cutover (client + you)

1. **Client**: adds the two DNS records at IONOS — see `CLIENT_SETUP_GUIDE.md` / the handover doc. (A `@` → `216.198.79.1`, CNAME `www` → `a67967c4543e4579.vercel-dns-017.com`.)
2. **You**: once DNS resolves, confirm both `carmazium.com` and `www.carmazium.com` show "Valid Configuration" in the Vercel domain dashboard, and set the canonical redirect (apex → www, or vice versa — whichever Vercel is set to serve as primary).
3. **You**: deploy the code changes above (§1) so the backend actually accepts requests from the new domain and metadata/sitemap point at it.
4. **You — Vercel env vars**: add/confirm for Production:
   - `NEXT_PUBLIC_APP_URL=https://carmazium.com`
   - `NEXT_PUBLIC_API_URL=https://carmazium-hjoh9w.fly.dev` (confirm it's not still pointing at an old Render URL)
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (confirm these match the *live* Supabase project — see the discrepancy flagged in §5)
5. **You — Supabase**: Dashboard → Authentication → URL Configuration:
   - Site URL → `https://carmazium.com`
   - Add redirect URLs: `https://carmazium.com/auth/callback`, `https://www.carmazium.com/auth/callback` (keep the existing `vercel.app` and `localhost` ones during transition)
6. **Client**: adds the Stripe webhook pointing at the Fly.io backend (§2 of the handover doc), shares the signing secret with you.
7. **You**: set `STRIPE_WEBHOOK_SECRET` on Fly.io if the client generates a new one (`fly secrets set STRIPE_WEBHOOK_SECRET=whsec_... -a carmazium-hjoh9w`) — only if it changed from the currently-configured one.

---

## 3. SEO & indexing

- `sitemap.ts` / `robots.ts` already exist and now point at `carmazium.com`. **Known gap**: the sitemap only lists static routes — the `TODO` in `sitemap.ts` for pulling live listing slugs (`/buy-cars/[slug]`) was never implemented, so individual vehicle listings aren't in the sitemap. Worth doing before go-live if organic listing traffic matters; it's a real gap, not urgent-urgent.
- JSON-LD structured data (AutoDealer + per-vehicle Vehicle schema) is already implemented and now uses the corrected domain.
- OpenGraph/Twitter card metadata already implemented in `layout.tsx`.
- **Google Search Console**:
  1. Add `carmazium.com` as a property (domain property recommended — verify via the DNS TXT record IONOS lets you add alongside the A/CNAME records, so no separate code deploy needed).
  2. Once deployed, submit `https://carmazium.com/sitemap.xml`.
  3. Alternative if you'd rather verify via HTML meta tag instead of DNS TXT: set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` in Vercel to the code Search Console gives you — already wired into `layout.tsx`, no code change needed.
- **Bing Webmaster Tools**: optional but low-effort — same sitemap URL, can import directly from Search Console.

---

## 4. Google Analytics 4

Nothing existed before this session — the app only had a custom first-party analytics pipe (`useAnalytics` → `POST /analytics/event` on the backend), no GA.

1. Create a GA4 property for `carmazium.com` in the Google Analytics account you want this under, grab the Measurement ID (`G-XXXXXXXXXX`).
2. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in Vercel (Production, and Preview if you want GA on preview deploys too — usually you don't).
3. That's it — `GoogleAnalytics.tsx` loads `gtag.js` and fires a `page_view` on every App Router client-side navigation only when the env var is present; it's a complete no-op otherwise, so nothing breaks if this step is skipped or delayed.
4. Recommended: link the GA4 property to Search Console once both exist, for the combined organic-performance view.

### Google Ads conversion tag

Separate product from GA4 (`AW-...` id, not `G-...`) but shares the same `gtag.js` script — `GoogleAnalytics.tsx` loads the library and configures whichever of GA4/Ads is present, independently of the other.

1. Grab the Conversion ID (`AW-XXXXXXXXXX`) from the Google Ads account's conversion tracking setup.
2. Set `NEXT_PUBLIC_GOOGLE_ADS_ID` in Vercel (same scoping as `NEXT_PUBLIC_GA_MEASUREMENT_ID` above).
3. No-op if unset, same as GA4.

---

## 5. Things worth a decision before/around go-live (found while auditing, not caused by the domain work)

- **Two different Supabase projects show up in the repo**: `qcqnllehtuczgammazwi.supabase.co` (referenced in `docs/FLY_IO_DEPLOYMENT.md` and `next.config.ts` image remote patterns) vs. `bwtnzmevjlowwronylxm.supabase.co` (in `backend/.env.example` and also in `next.config.ts`). Confirm which one is actually live in the Fly.io/Vercel production env — if the wrong one is referenced anywhere, image loading or auth will break. I can't tell which from the code alone since both are allow-listed as image hosts.
- **Previously-leaked secrets still need rotating** (already flagged in `FEATURE_AUDIT.md` Issue 18): `backend/env.txt` was committed with a live Stripe key, Supabase service-role key, DB credentials, OpenAI key, and session secret, then removed in commit `7bfd43b8`. Removing the file doesn't invalidate the keys — anyone with repo access before that commit had them. If they haven't been rotated yet, do it before this domain goes live to real customer traffic and money.
- **`PAYMENT_BYPASS` Fly.io secret is set but unused** — no code references it (checked). Harmless as-is, but worth deleting (`fly secrets unset PAYMENT_BYPASS -a carmazium-hjoh9w`) so it's not a landmine for someone who later adds a bypass code path and doesn't realize the flag is already sitting there with an unknown value.
- **Auction bid restriction (regular buyers can't bid) is a known, frozen product decision** per `FEATURE_AUDIT.md` Issue 1 — not a go-live blocker, just noting it's a live UX rough edge (buyers see a bid form that 403s) if support tickets start coming in post-launch.

---

## Summary — who owns what

| Owner | Action |
|---|---|
| **Client** | Add 2 DNS records at IONOS; add Stripe webhook; share signing secret |
| **You (dev)** | Deploy the code changes in §1 (needs your go-ahead — touches production) |
| **You (dev)** | Vercel env vars (§2.4) |
| **You (dev)** | Supabase redirect URLs (§2.5) |
| **You (dev)** | Search Console property + sitemap submission (§3) |
| **You (dev)** | Create GA4 property + set env var (§4) |
| **You (dev)** | Decide on the two Supabase-project discrepancy and secret rotation (§5) |
