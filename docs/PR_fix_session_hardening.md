# fix(auth): session hardening on top of the 24h absolute-session work

## Why
Users report session problems: roles that "don't take" after switching, stale access after a ban, being served as the wrong account, and requests that hang. Most of the stateless-Bearer and bridge-race work already landed in #551/#554/#556; this PR closes what was still open on `main`.

## What changes

**Sessions (backend)**
- A session re-reads its user from the database every 30 s (`AuthService.resolveSessionUser`). Bans, role switches (`/users/elevate`), admin role changes and KYC approvals now reach signed-in users within ~30 s instead of waiting out the cookie. A banned/deleted user gets 401 and the session is destroyed.
- `SessionAuthGuard`: if the cookie and the Bearer token name different users, the Bearer identity wins for that request. Bearer requests still never write a session (keeps #554 intact).
- Hydration middleware (`main.ts`) is wrapped in try/catch: a failing lookup no longer leaves the request hanging until the client's 30 s timeout. The 24 h absolute-expiry logic is untouched.

**Token verification**
- New dependency-free verifier `core/supabase-jwt.ts` (HS256 via `SUPABASE_JWT_SECRET`, RS256/ES256 via the project JWKS). Known, email-verified users are resolved by exact id with no Supabase round trip, plus a 30 s per-token cache. Unknown/unverified users, unconfigured projects and issuer/audience mismatches (custom auth domain) fall back to the existing remote `getUser` path, which still handles first-login creation. Email-match fallback stays remote-only.

**Hardening**
- `ThrottlerGuard` is now actually applied to `/auth/*` (it was configured but never attached): login/register 10/min, send-verification 3/min, supabase-session 30/min per IP.
- Failed-login counter is an atomic `increment` (parallel guesses could previously bypass the lockout).
- `SESSION_SECRET` is mandatory in production (previously only a warning); `helmet()` runs before the session middleware; expired sessions are pruned hourly.
- `passwordHash`, `loginAttempts`, `lockoutUntil` are stripped from session-cached users and `/auth` responses.

**Frontend**
- `apiClient`: plain GET/HEAD requests get the same one-shot refresh-and-retry on 401 that admin mutations already had. `/auth/logout` no longer triggers a login redirect (it aborted the Supabase sign-out). The loop guard now covers `/auth/signup`, `/auth/forgot-password`, `/auth/callback`.

## Deploy notes
- **Set `SESSION_SECRET` on Fly before deploying** or the API exits at boot in production.
- `SUPABASE_JWT_SECRET` is optional (only for HS256 projects). Without it behaviour is unchanged, just without the speedup.
- Trade-off: a locally verified token stays valid until `exp` (≤ 1 h) after sign-out. Bans/deletions are still enforced within 30 s because the user row is checked.
- Check the project's token `iss` matches `SUPABASE_URL`; a mismatch is safe (falls back) but hides the speedup.
- Rate limits are per-IP; shared-NAT users could hit 10 logins/min.

## Tests
- Backend: 91 suites / 1,017 tests pass locally (new: `supabase-jwt.spec.ts`, freshness and Bearer-vs-cookie cases in `session-auth.guard.spec.ts`).
- Frontend typechecks. Not exercised in a browser yet - see checklist.

## Not in this PR
- Callback / reset-password still bridge with their own `fetch` (production's versions differ from what I'd mapped).
- Pre-existing type errors in `payments.controller`, `sellers.service`, `db-backup.service` (not rechecked against this base).
- Making the Bearer JWT the only credential (dropping the cross-site cookie) - a separate decision.

## Manual test checklist (staging, or prod with a test account)

**Session freshness**
- [ ] Sign in as a buyer. Switch to Dealer on the profile page. Open a dealer-only page: no 403, no re-login needed.
- [ ] As admin, change a signed-in test user's role. Within ~30 s their next request reflects it.
- [ ] As admin, ban a signed-in test user. Their next request after ~30 s returns 401 and they are sent to login. Unban: they can sign in again.
- [ ] Approve a dealer's KYC while they are on the Trade Exchange "pending" screen: access opens without signing out.

**Wrong-account / switching**
- [ ] Sign in as A, sign out, sign in as B in the same browser: dashboard and `/users/me` show B.
- [ ] Two tabs: sign in as A in tab 1, then as B in tab 2. Reload tab 1: it shows B (no A data).
- [ ] Block third-party cookies in the browser and sign in: the app still works (Bearer path), and no new rows pile up in the `sessions` table per request.

**Auth flows**
- [ ] Email sign-up -> verification link -> onboarding, no bounce to login.
- [ ] Google sign-in.
- [ ] Forgot password -> reset -> lands in dashboard.
- [ ] Hard refresh on a protected page while signed in: no flash to login.
- [ ] Sign out when the backend session has already expired (clear the `sid` cookie first): still lands signed out, no redirect loop.
- [ ] Leave a tab idle until the access token expires (or edit it in localStorage), then trigger a GET: it succeeds after an automatic refresh instead of redirecting.
- [ ] After 24 h absolute expiry: still redirected with the session-expired message (unchanged).

**Hardening**
- [ ] 11 rapid wrong-password attempts from one IP: the 11th gets 429; after 5 failures on one account it locks for 15 min.
- [ ] `/auth/send-verification` 4 times in a minute: the 4th returns 429.
- [ ] `/auth/me` and `/users/me` responses contain no `passwordHash`, `loginAttempts` or `lockoutUntil`.
- [ ] Start the API with `NODE_ENV=production` and no `SESSION_SECRET`: it refuses to start.
- [ ] Take the database briefly unavailable (or throw in `validateSession`): requests fail fast with 401/5xx rather than hanging 30 s.

**Regression spot checks**
- [ ] Auctions live page and bidding (websocket) still authenticate.
- [ ] Admin mutation (e.g. approve a handover) works after a long idle.
- [ ] PDF/receipt download works.
