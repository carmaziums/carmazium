# CarMazium Backend Audit & Fix Plan

**Date:** February 2026  
**Scope:** User auth, listings, and related backend features.

---

## Executive Summary

The audit identified **six main issue areas** that prevent auth and listings from working accurately:

1. **CSRF middleware** blocks all state-changing API requests (POST/PATCH/DELETE) because the frontend never sends `X-CSRF-Token`.
2. **User sync payload mismatch**: signup sends `supabaseAuthId` but the backend expects `id`; role is not persisted on sync.
3. **Profile response shape**: frontend stores the full API response `{ success, data }` as `profile`, so `profile.id`, `profile.role`, etc. are undefined.
4. **Session vs Bearer ordering**: when using session path, `req.user` is populated by hydration middleware; guard does not set it, which is correct but fragile if middleware order changes.
5. **Auth callback** does not create a backend session or sync user after email verification (relies on client-side AuthContext).
6. **Listing filter** DTO and Prisma schema are mostly aligned; a few optional filters (e.g. fuel, transmission) could be added for parity with the feature doc.

---

## 1. Authentication

### 1.1 CSRF blocking mutations (Critical)

**Finding:**  
`CsrfMiddleware` requires `X-CSRF-Token` for all non-GET/HEAD/OPTIONS requests. The frontend never sends this header. Result: **every POST, PATCH, DELETE** (create listing, update profile, place bid, add to watchlist, etc.) returns **403 Forbidden**.

**Evidence:**
- `backend/src/core/middleware/csrf.middleware.ts`: only login, register, supabase-session, users/sync are excluded.
- `src/lib/apiClient.ts`: no `X-CSRF-Token` header is set.

**Fix options (choose one):**

- **Option A (recommended for API-only SPA):** Do not require CSRF for API routes that are protected by session or Bearer token. Add a condition: if the request has a valid session cookie or `Authorization: Bearer` (or if the route is under `/listings`, `/bids`, etc. and will be guarded by `SessionAuthGuard`), skip CSRF. Alternatively, exclude all API paths that use `SessionAuthGuard` by excluding paths like `/listings`, `/bids`, `/watchlist`, `/users/me`, `/auctions`, etc. from CSRF.
- **Option B:** Implement a proper CSRF flow: backend exposes `GET /auth/csrf` that returns a token (e.g. in a cookie or JSON); frontend reads it and sends it as `X-CSRF-Token` on every mutation. Then keep the middleware as-is.

**Recommended:** Option A — exclude CSRF for authenticated API routes (session or Bearer). Keep CSRF only for browser-style cookie forms if any (e.g. future server-rendered forms). Apply the fix in `csrf.middleware.ts`.

---

### 1.2 User sync payload and role (High)

**Finding:**  
Signup page sends to `POST /users/sync`:

```json
{ "supabaseAuthId": "...", "email": "...", "firstName": "...", "lastName": "...", "role": "..." }
```

Backend `UsersService.syncUser()` expects:

```ts
{ id: string; email: string; firstName?: string; lastName?: string }
```

- So `data.id` is **undefined** on create. Prisma then uses `@default(uuid())`, so the backend user gets a **different ID** than the Supabase user. Auth still works (lookup by email in `verifySupabaseToken`), but IDs are inconsistent and role is **never stored** (sync does not accept or persist `role`).

**Fix:**

1. In **backend** `users.service.ts`:
   - Accept either `id` or `supabaseAuthId` and use that as the user `id` on create (so backend id can match Supabase id if desired).
   - Accept optional `role` and pass it to `create`/`update` (with validation against `UserRole`).
2. In **frontend** signup:
   - Send `id: authData.user.id` (or keep `supabaseAuthId` and have backend map it to `id`). Ensure the backend uses this as the primary key on create.

---

### 1.3 Profile response shape in AuthContext (High)

**Finding:**  
`GET /users/me` returns `{ success: true, data: userProfile }`. In `AuthContext.tsx`, `fetchProfile` does:

```ts
const data = await apiClient<UserProfile>('/users/me');
setProfile(data);
```

So `profile` is the **whole response** (`{ success, data }`), not the user object. Every use of `profile.id`, `profile.email`, `profile.role`, `profile.firstName` etc. is **undefined**. The UI often falls back to `user?.email` or "User", so the app appears to work but with wrong or missing profile data (including role-based routing).

**Fix:**  
In `AuthContext.tsx`, set the **profile payload** only:

```ts
const response = await apiClient<{ success: boolean; data: UserProfile }>('/users/me');
setProfile(response.data);
```

(Or use a shared type for API responses and always use `response.data` for the entity.)

---

### 1.4 Session hydration and guard (Low)

**Finding:**  
When the user is authenticated via **session cookie**, `req.user` is set by the session hydration middleware in `main.ts` (which runs **before** Nest). When the request reaches `SessionAuthGuard`, the guard only checks `request.session?.userId` and returns `true`; it does not set `request.user`. So `req.user` is correct only because the hydration middleware ran first. If someone reorders middleware or mounts the hydration after Nest, `@CurrentUser()` would be undefined for session-based requests.

**Fix:**  
In `SessionAuthGuard`, when the session path is used and `req.user` is not set, call `authService.validateSession(req.session.userId)` and set `(request as any).user = user` so the guard does not depend on middleware order. (Bearer path already does this.)

---

### 1.5 Auth callback and backend session (Medium)

**Finding:**  
After email verification, the user is redirected to `/auth/callback`, which exchanges the code for a Supabase session and redirects to `/dashboard` (or onboarding). It does **not** call the backend `/auth/supabase-session` or `/users/sync`. The backend session is created only when the client (AuthContext) runs and calls `supabase-session`. So:

- If the user has never been synced (e.g. signed up with social and never hit the signup form that calls sync), there is no local user and `supabase-session` will fail.
- For normal email signup, sync was already called at signup, so after verification the only missing piece is the backend session, which is created when the SPA loads and AuthContext runs. So behaviour is OK for the main flow, but the callback could explicitly call the backend to set the session so that the first dashboard request is already authenticated.

**Fix (optional):**  
- Ensure the only way to create an account is through a flow that calls `/users/sync` (e.g. signup page or a post-verification onboarding step that sends Supabase user to sync).
- Optionally, from the auth callback (server-side), call the backend `POST /auth/supabase-session` with the new session token so the first redirect to dashboard already has a session cookie. This requires the callback to have the token (e.g. from `exchangeCodeForSession`) and to call the backend from the server (same origin or server-side only).

---

## 2. Listings

### 2.1 Listing create/update/delete blocked by CSRF (Critical)

**Finding:**  
Same as §1.1. All listing mutations are blocked by CSRF until the middleware is fixed.

**Fix:**  
Resolve CSRF as in §1.1. No listing-specific change needed.

---

### 2.2 Listing filter DTO vs feature doc (Low)

**Finding:**  
Feature doc mentions filtering by "fuel type, transmission, etc." `ListingFilterDto` currently has `minPrice`, `maxPrice`, `make`, `year`, `page`, `limit`. No `fuelType` or `transmission` in the DTO or in `ListingsService.findAll()`.

**Fix:**  
Add optional `fuelType` and `transmission` to `ListingFilterDto` and to the `where` clause in `listings.service.ts` `findAll()` (and ensure Prisma enum values match).

---

### 2.3 Listing response shape (OK)

**Finding:**  
Listings controller returns `StandardResponse` / `PaginatedResponse` with `{ success, data, pagination?, timestamp }`. Frontend `listingApi` and callers use the full response and `.data` where needed. No bug found here.

---

## 3. Other Protected Routes

All of these use `SessionAuthGuard` and are affected by:

- **CSRF:** Any POST/PATCH/DELETE will 403 until CSRF is fixed (bids, watchlist, users/me PATCH, auctions, service-requests, transactions, etc.).
- **Profile shape:** Any logic that uses `profile.id` or `profile.role` from AuthContext will be wrong until §1.3 is fixed.

No additional backend bugs were found in bids, auctions, watchlist, or users controllers beyond auth and CSRF.

---

## 4. Implementation Priority

| Priority | Item | Area | Effort |
|----------|------|------|--------|
| P0 | Fix CSRF so mutations are allowed (Option A: skip for authenticated API) | Backend | Small |
| P0 | Fix profile shape in AuthContext (`setProfile(response.data)`) | Frontend | Small |
| P1 | Sync: accept `id`/`supabaseAuthId` and `role`; persist role | Backend + Frontend | Small |
| P1 | SessionAuthGuard: set `req.user` when session path is used and user missing | Backend | Small |
| P2 | Add optional fuel/transmission to listing filter DTO and service | Backend | Small |
| P3 | Auth callback: optional backend session creation after verification | Backend + Frontend | Medium |

---

## 5. Suggested Implementation Order

1. **CSRF (P0)**  
   - In `backend/src/core/middleware/csrf.middleware.ts`, for requests that have `req.session?.userId` or `Authorization: Bearer ...`, call `next()` without requiring CSRF. Alternatively, add a list of path prefixes for authenticated API routes and skip CSRF for those.  
   - Retest: create listing, update profile, place bid, add to watchlist.

2. **Profile shape (P0)**  
   - In `src/context/AuthContext.tsx`, after `apiClient('/users/me')`, set `setProfile(response.data)` (with correct typing).  
   - Retest: dashboard role redirect, settings form prefill, sidebar name/role.

3. **Sync payload and role (P1)**  
   - Backend: extend `syncUser` to accept `id` or `supabaseAuthId` (map to `id`), and optional `role`; validate role and set on create/update.  
   - Frontend: send `id: authData.user.id` (and keep sending `role`).  
   - Retest: sign up as SELLER/DEALER, verify profile.role and dashboard route.

4. **SessionAuthGuard (P1)**  
   - In the guard, when `request.session?.userId` is set and `request.user` is not, call `authService.validateSession(request.session.userId)` and set `(request as any).user = user`.  
   - Retest: login with cookie-only (no Bearer), hit /users/me and /listings/my.

5. **Listing filters (P2)**  
   - Add `fuelType` and `transmission` to `ListingFilterDto` and to `findAll()` where clause.

6. **Auth callback (P3)**  
   - Optionally call backend session endpoint from callback or ensure sync is always run after first Supabase signup/verification.

---

## 6. Files to Touch (Summary)

| File | Change |
|------|--------|
| `backend/src/core/middleware/csrf.middleware.ts` | Skip CSRF when session or Bearer token present (or for authenticated API path prefixes). |
| `src/context/AuthContext.tsx` | Set `profile` from `response.data` for `/users/me`. |
| `backend/src/users/users.service.ts` | Sync: accept `id` or `supabaseAuthId`, optional `role`; persist role. |
| `src/app/auth/signup/page.tsx` | Send `id: authData.user.id` in sync body (and keep `role`). |
| `backend/src/auth/guards/session-auth.guard.ts` | When session path and no `req.user`, hydrate `req.user` via `validateSession`. |
| `backend/src/listings/dto/listing-filter.dto.ts` | Add optional `fuelType`, `transmission`. |
| `backend/src/listings/listings.service.ts` | In `findAll()`, add filters for `fuelType`, `transmission` when provided. |

---

## 7. Testing Checklist After Fixes

- [ ] Sign up (email) → sync → verify email → log in → dashboard shows correct role and name.
- [ ] Log in with email/password → create listing (POST) → 201, listing appears under "My listings".
- [ ] Log in → PATCH /users/me (e.g. firstName) → 200, GET /users/me returns updated profile; UI shows new name.
- [ ] Log in → place bid (POST /bids) → 201.
- [ ] Log in → add to watchlist (POST /watchlist/:id) → 200/201.
- [ ] GET /listings?make=Audi&fuelType=PETROL (after P2) returns filtered results.
- [ ] Session-only (no Bearer): cookie sent, /listings/my and /users/me return 200 with correct data.

This completes the audit and fix plan. Implementing P0 and P1 will resolve the main user auth and listing inaccuracies.
