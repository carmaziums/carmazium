# CarMazium: Account Creation, Onboarding & Deployment Issues

This document explains **what’s likely causing** user issues (account creation, verification, listing, dashboards) and **what to change** (including alternatives to Render).

---

## 1. What’s Causing the Issues?

Several things can combine to make the app feel broken. They’re not all “Render’s fault,” but **Render’s free tier makes them much more visible**.

### A. Backend cold starts (very likely)

- **What:** On Render **free** tier the service is spun down after ~15 minutes of no traffic. The **first request** after that can take **30–60+ seconds** while the instance starts.
- **Effect:**
  - **Signup:** Frontend calls `POST /users/sync` and `POST /auth/supabase-session`. If the backend is cold, these requests **time out** (browser default is often 30–60s) → “Backend sync failed,” no backend session.
  - **Email verification:** Callback page calls the same endpoints. Same timeouts → user lands on onboarding but backend doesn’t know them → 401 on dashboard/listing.
  - **Dashboards / listing:** First load after idle hits a cold backend → long wait or timeout → blank page or errors.
- **Why it looks like “account/onboarding/listing/dashboard” are broken:** Every flow depends on the same backend. When it’s cold, **all** of them fail or hang.

### B. No retries or long timeout on critical requests

- **What:** Signup and auth callback use plain `fetch()` with **no custom timeout** and **no retry**.
- **Effect:** One slow or failed request (e.g. during cold start) = permanent failure. User has to try again manually; no automatic retry.

### C. Cross-origin setup (frontend Vercel ↔ backend Render)

- **What:** Frontend is on `carmazium.vercel.app`, backend on `carmazium.onrender.com`. Cookies are set by Render and sent only to Render; API calls use `credentials: 'include'` and (when available) `Authorization: Bearer <token>`.
- **Effect:** If **ALLOWED_ORIGINS** on Render doesn’t include your exact frontend URL (e.g. `https://carmazium.vercel.app`), CORS blocks requests and everything that touches the API can fail. Same if **SESSION_SECRET** is missing in production (session cookie may not be set correctly).

### D. Env / config on Render

If any of these are wrong or missing on Render, auth and APIs break:

- **ALLOWED_ORIGINS** – must include `https://carmazium.vercel.app` (and any other frontend origins).
- **SESSION_SECRET** – must be set in production (long random string).
- **DATABASE_URL** – backend can’t start or persist sessions without it.
- **NODE_ENV=production** – so cookies use `Secure` and `SameSite=None` for cross-origin.

### E. Verification link / callback

- **What:** Verification email sends the user to a link with tokens in the **hash** (`#access_token=...`). Only a **client-side** callback page can read the hash and complete sign-in + backend sync.
- **Effect:** If the callback page doesn’t run (e.g. wrong redirect URL, or build error), users never get a backend session after verifying and will see 401 on dashboards/listing.

---

## 2. Is It “the Render-Deployed Backend”?

**Partly.**

- **Render free tier** is the main amplifier: **cold starts** cause timeouts and failed sync/session, which then break account creation, onboarding, listing, and dashboards.
- The **same** backend logic on a **always-on** or **faster-wake** host would behave much better.
- So: the **code and flow** are fine for “warm” backends; the **hosting plan and timeouts/retries** are what make it fragile.

---

## 3. What to Do Short-Term (Keep Render)

1. **Set env on Render**
   - `ALLOWED_ORIGINS` = `https://carmazium.vercel.app` (and any other frontend URLs).
   - `SESSION_SECRET` = long random string.
   - `DATABASE_URL`, `NODE_ENV=production`.

2. **Add retries and longer timeout for auth**
   - For **signup** and **auth callback**, call `/users/sync` and `/auth/supabase-session` with:
     - Timeout **≥ 60 seconds** (to survive one cold start).
     - **1–2 retries** with a short delay (e.g. 2–3s) so a single timeout doesn’t permanently fail.

3. **Optional: reduce cold starts**
   - **Render paid** (“Starter” or above): service can stay always-on → no cold starts.
   - Or use an **external cron** (e.g. cron-job.org) to hit your backend health endpoint every 10–15 minutes so it stays warm (only helps if the free instance is allowed to stay up with traffic).

---

## 4. Alternatives to Render for the Backend

All of these can run your existing NestJS backend; the main differences are **pricing**, **cold starts**, and **regions**.

| Option | Pros | Cons | Cold start |
|--------|------|------|------------|
| **Railway** | Simple, good DX, easy env and DB add-ons | Free tier is limited; paid is usage-based | Free tier can sleep; paid stays up |
| **Fly.io** | Good free tier, global regions, no cold start if you keep a machine running | Slightly more ops (Docker / flyctl) | Only if you scale to zero (optional) |
| **Vercel (Serverless)** | Same place as frontend; no CORS if same domain | NestJS is not ideal on serverless (cold per request, no long WebSockets); would need refactor | Per-request cold unless you use something like Vercel Edge or a separate long-running service |
| **DigitalOcean App Platform** | Predictable pricing, always-on possible | Paid for always-on | No cold start if always-on |
| **Hetzner / DigitalOcean Droplet (VPS)** | Full control, cheap, no cold start | You manage OS, Node, process manager (PM2), SSL, deployments | None if you run the app as a service |
| **Cyclic** | Node-friendly, free tier | Less known; check current limits | Can have cold starts on free |
| **Koyeb** | Free tier, global | Newer; check limits | Free tier may sleep |

**Practical suggestions:**

- **Minimal change, fewer cold starts:** **Railway** or **Fly.io** (run the same Node app; keep it always-on on a small paid plan if you need reliability).
- **Maximum control, no cold start, low cost:** **VPS** (e.g. Hetzner CPX or DigitalOcean basic Droplet) + **PM2** + **Nginx** (or Caddy) for SSL. You deploy with git + `npm run build` and `node dist/main` (or similar).
- **Stay on Render:** Move to a **paid plan** so the backend doesn’t spin down, and add the **retry + 60s timeout** for sync and supabase-session (see above).

---

## 5. Checklist for “Everything Works” (Any Host)

- [ ] Backend env: `ALLOWED_ORIGINS`, `SESSION_SECRET`, `DATABASE_URL`, `NODE_ENV=production`.
- [ ] Frontend env: `NEXT_PUBLIC_API_URL` = your backend URL (e.g. `https://carmazium.onrender.com`).
- [ ] Auth callback page builds and runs (Suspense boundary for `useSearchParams`); verification link goes to that page and completes sync + supabase-session.
- [ ] Critical auth requests (signup sync, callback sync/session) use **long timeout (e.g. 60s)** and **retries (e.g. 2)**.
- [ ] Backend is either **always-on** (paid plan / VPS) or kept **warm** (cron hitting health), so the first request after signup/verification doesn’t hit a 60s cold start.

Once these are in place, account creation, onboarding, verification, listing, and dashboards should behave consistently. The main variable is **backend availability (cold start)** and **robustness of the first few requests (timeout + retry)**.
