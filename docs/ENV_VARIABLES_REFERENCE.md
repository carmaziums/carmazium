# Environment Variables Reference

Use this as the single source of truth for **Render** (backend) and **Vercel** (frontend).

---

## Render (Backend – NestJS)

Set these in **Render → Your Web Service → Environment**.

| Variable | Required | You have? | Notes |
|----------|----------|-----------|--------|
| `DATABASE_URL` | Yes | ✓ | PostgreSQL connection (Supabase pooler or direct). |
| `DIRECT_URL` | Yes | ✓ | Used by Prisma for migrations (e.g. non-pooled port). |
| `PORT` | Yes | ✓ | Render often sets this; your `10000` is fine. |
| `SUPABASE_URL` | Yes | ✓ | e.g. `https://qcqnllehtuczgammazwi.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | ✓ | Used to verify Supabase JWTs in `auth.service.ts`. |
| **`NODE_ENV`** | **Yes** | ⚠️ Add if missing | Set to **`production`** so session cookie is `Secure` and `SameSite=None` (required for Vercel → Render). |
| **`SESSION_SECRET`** | **Yes** | ❌ Add | Strong random string for express-session (e.g. `openssl rand -hex 32`). **Not** the same as `JWT_SECRET`. |
| `ALLOWED_ORIGINS` | Recommended | ❌ Add | Comma-separated origins that may call the API. Example: `https://carmazium.vercel.app` (add custom/preview domains if needed). |

**Optional / not used by current auth:**

- `JWT_SECRET` / `JWT_EXPIRES_IN` – Backend uses **express-session** with **`SESSION_SECRET`**, not JWT for the session cookie. You can leave these if another part of your stack uses them; auth does not.
- `SUPABASE_JWT_SECRET` – Used by Supabase; backend uses `SUPABASE_ANON_KEY` for `getUser(token)`.

**Summary – add on Render:**

1. **`NODE_ENV`** = `production`
2. **`SESSION_SECRET`** = (generate a new secret, e.g. `openssl rand -hex 32`)
3. **`ALLOWED_ORIGINS`** = `https://carmazium.vercel.app` (or your real Vercel/production URL; add more origins separated by commas if needed)

---

## Vercel (Frontend – Next.js)

Set these in **Vercel → Project → Settings → Environment Variables**.

| Variable | Required | You have? | Scope | Notes |
|----------|----------|-----------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | ✓ | Production (and Preview if you use it) | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | ✓ | Production (and Preview) | Supabase anon key. |
| **`NEXT_PUBLIC_API_URL`** | **Yes** | ❌ Add | Production (and Preview) | Backend URL **with no trailing slash**, e.g. `https://carmazium.onrender.com`. Used by browser and auth callback. |
| `NEXT_PUBLIC_WS_URL` | If using WS | ✓ | Production | WebSocket URL for real-time features. |

**Backend-only (not needed on Vercel for a pure frontend):**

- `DATABASE_URL`, `DIRECT_URL` – Used by the Nest backend on Render; no need on Vercel unless you run Prisma or DB access in Next.js.
- `PORT` – Backend only.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` – Backend uses these; frontend uses `NEXT_PUBLIC_*` versions. You can remove the non-`NEXT_PUBLIC_` ones from Vercel if they’re only for the API.

**Summary – add on Vercel:**

1. **`NEXT_PUBLIC_API_URL`** = `https://carmazium.onrender.com` (or your actual Render backend URL, no trailing slash)  
   - Add for **Production** (and **Preview** if you test preview deployments).

---

## Quick copy-paste

**Render – add these:**

```env
NODE_ENV=production
SESSION_SECRET=<generate with: openssl rand -hex 32>
ALLOWED_ORIGINS=https://carmazium.vercel.app
```

**Vercel – add this:**

```env
NEXT_PUBLIC_API_URL=https://carmazium.fly.dev
```

(Replace with your real Render URL and Vercel production URL if different.)
