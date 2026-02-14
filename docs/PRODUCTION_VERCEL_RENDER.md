# Production: Vercel (Frontend) + Render (Backend)

This checklist ensures auth and API work correctly when the frontend is on **Vercel** and the backend on **Render**.

---

## 1. Backend (Render) – Environment variables

Set these in the Render dashboard for your **Web Service**:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` so session cookie is `Secure` and `SameSite=None` (needed for cross-origin from Vercel). |
| `SESSION_SECRET` | **Yes** | Strong random string (e.g. `openssl rand -hex 32`). If missing, a warning is logged and the default is insecure. |
| `DATABASE_URL` | Yes | PostgreSQL connection string (Render Postgres or external). |
| `SUPABASE_URL` | Yes | Your Supabase project URL (e.g. `https://xxxx.supabase.co`). |
| `SUPABASE_SERVICE_KEY` or `SUPABASE_ANON_KEY` | Yes | Used to verify Supabase JWTs. Anon key is enough for `getUser(token)`. |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated list of frontend origins that may call the API. Example: `https://carmazium.vercel.app,https://www.yourdomain.com`. If unset, defaults include `https://carmazium.vercel.app` and `https://carmazium.onrender.com`. Add **every** domain you use (production, preview, custom domain). |

**Why this matters**

- Without `NODE_ENV=production`, the session cookie is `SameSite=Lax` and may not be sent on cross-origin requests from Vercel, so users will appear logged out.
- Without `SESSION_SECRET`, sessions are predictable and insecure.
- If your Vercel URL is not in `ALLOWED_ORIGINS`, the browser will block API responses (CORS), so login and API calls will fail.

---

## 2. Frontend (Vercel) – Environment variables

Set these in the Vercel project (Production and Preview if you use them):

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | **Yes** | Full backend URL with no trailing slash, e.g. `https://carmazium.onrender.com`. Used by the browser and by the auth callback (serverless) to call the API. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key. |

**Why this matters**

- If `NEXT_PUBLIC_API_URL` is wrong or missing, the frontend and the auth callback will call the wrong backend (or the fallback `https://carmazium.onrender.com`), which can break auth and listing flows.

---

## 3. Supabase – Redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL:** your production frontend URL (e.g. `https://carmazium.vercel.app`).
- **Redirect URLs:** add at least:
  - `https://carmazium.vercel.app/auth/callback`
  - `https://yourdomain.com/auth/callback` (if you use a custom domain)
  - `http://localhost:3000/auth/callback` for local dev

Without the production redirect URL, email confirmation and OAuth will redirect to a URL Supabase rejects.

---

## 4. CORS and cookie flow (Vercel → Render)

1. User opens the app on **Vercel** (e.g. `https://carmazium.vercel.app`).
2. Login or signup uses **Supabase**; then the frontend calls **Render** `POST /auth/supabase-session` with the Supabase token and `credentials: 'include'`.
3. **Render** validates the token, creates a session, and responds with `Set-Cookie: sid=...; Secure; SameSite=None; HttpOnly`.
4. The browser stores the cookie for the **Render** domain (e.g. `carmazium.onrender.com`).
5. Later requests from the same page to Render (e.g. `GET /listings/my`) are sent with `credentials: 'include'`, so the browser sends the `sid` cookie. Render’s CORS must allow the **Vercel origin** so the browser allows the response to be read.

So for production to work:

- **Render** must have the **exact** Vercel origin in `ALLOWED_ORIGINS` (or in the default list).
- **Render** must run with `NODE_ENV=production` so the cookie is `Secure` and `SameSite=None`.

---

## 5. Auth callback (email verification)

When the user clicks the email verification link:

1. They are sent to **Vercel** at `/auth/callback?code=...`.
2. The **Vercel serverless** function runs: it exchanges the code for a Supabase session, then calls **Render** `POST /users/sync` (server-to-server, so no CORS).
3. Then it redirects the browser to your app (e.g. `/dashboard`).
4. The **browser** loads the app; AuthContext calls `POST /auth/supabase-session` on Render with the Supabase token; Render sets the session cookie and/or returns the user.

So:

- **Vercel** must have `NEXT_PUBLIC_API_URL` set so the callback can reach **Render**.
- If the callback sync fails (e.g. Render cold start), the redirect still happens; the first client-side `supabase-session` will create the user (auto-sync) and set the session.

---

## 6. Quick production test

1. **Backend health:** Open `https://carmazium.onrender.com/health` (or your health path). Should return 200.
2. **CORS:** From the browser console on your Vercel site, run:
   ```js
   fetch('https://carmazium.onrender.com/auth/supabase-session', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ token: 'invalid' }),
     credentials: 'include'
   }).then(r => console.log(r.status))
   ```
   You should see `401` (unauthorized), not a CORS error. If you see a CORS error, add the exact request origin to `ALLOWED_ORIGINS` on Render.
3. **Login:** Sign in on the Vercel app; then open a protected page (e.g. dashboard, my listings). You should stay logged in and see data.
4. **Email verification:** Sign up with email, then use the verification link. You should land on the app (e.g. dashboard) and be logged in.

---

## 7. Common production issues

| Symptom | Likely cause | Fix |
|--------|----------------|-----|
| Logged in on Render/Same origin but not from Vercel | Cookie not sent cross-origin | Set `NODE_ENV=production` on Render; ensure cookie is `Secure` and `SameSite=None`. |
| CORS error in browser when calling API from Vercel | Origin not allowed | Set `ALLOWED_ORIGINS` on Render to include `https://carmazium.vercel.app` (and any custom/preview domains). |
| 401 on `supabase-session` after signup/login | Backend has no user or wrong Supabase env | Ensure Render has `SUPABASE_URL` and key; backend auto-sync will create user on first valid token. |
| Email verification link fails or wrong redirect | Redirect URL not in Supabase | Add production callback URL in Supabase (e.g. `https://carmazium.vercel.app/auth/callback`). |
| Callback sync fails / user not created after verification | Render URL wrong or cold start | Set `NEXT_PUBLIC_API_URL` on Vercel; callback has 8s timeout and still redirects; client-side supabase-session will auto-sync if needed. |
| Session invalid / constant re-login | `SESSION_SECRET` changed or missing | Set a stable `SESSION_SECRET` on Render and do not change it without expecting all users to log in again. |

---

With the above set correctly, the current auth flow (including sync in callback and backend auto-sync) is designed to work accurately in production with frontend on Vercel and backend on Render.
