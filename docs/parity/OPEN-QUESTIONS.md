# CarMazium Parity — Open Questions

Ambiguities found during the audit that need a decision from the repo owner.
Claude writes questions here and stops rather than inventing behaviour.

Format: one section per question. Status is `OPEN` or `ANSWERED`.
Answered questions stay in the file with the answer recorded inline.

---
## OQ-1 — Should mobile support role selection at signup? — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-005, AUTH-026, AUTH-029.

Web lets a user pick BUYER / DEALER / FINANCE_PARTNER at signup (`src/app/auth/signup/page.tsx:153-157`) and validates against six roles (`signup/page.tsx:13`). Mobile hardcodes `const role = 'BUYER'` (`carmazium app/carmazium app/src/store/authStore.ts:265`).

The mobile comment (`authStore.ts:258-264`) says this was a deliberate fix — reading the local preview-role toggle was writing `role: DEALER` into the database for fresh signups. So the hardcode fixed a real bug, but it also removed the capability.

**Question:** which is canonical?
- (a) Mobile is right — all signups are BUYER, dealers elevate later via `DealerOnboardingScreen` / `POST /users/elevate`. Then the **web** role picker is the divergence and AUTH-005 becomes a web bug, not a mobile gap.
- (b) Web is right — mobile needs a role picker, wired so it reads the picker rather than `get().role`.

Not guessing. This determines whether AUTH-005 is scoped at all, and whether AUTH-029 (partner dashboards) is ever in scope for mobile.

---

## OQ-2 — Which password minimum length is canonical? — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-008, AUTH-016.

Four different rules in one codebase:

| Surface | Minimum | Citation |
|---|---|---|
| Web signup | none client-side (HTML5 `required` only) | `src/app/auth/signup/page.tsx:60-151` |
| Web reset password | **6** | `src/app/auth/reset-password/page.tsx:30-33` |
| Mobile signup | **8** | `src/screens/auth/SignupScreen.tsx:50` |
| Mobile reset password | **8** | `src/screens/auth/ResetPasswordScreen.tsx:41-45` |
| Backend `RegisterDto` / `ResetPasswordDto` | **8** | MinLength(8) |

**Question:** confirm 8 everywhere, and confirm the web reset page's 6 is a bug to be filed separately (web change — out of scope for mobile parity, but it should not be copied onto mobile).

---

## OQ-3 — `hasCompletedOnboarding` is set pre-auth by the marketing carousel — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-001, AUTH-023, AUTH-025.

`OnboardingScreen.tsx:156,162` calls `completeOnboarding()` — which writes the `czm_onboarding_complete` SecureStore flag (`store/authStore.ts:6,89-92`) — when a user skips or finishes the pre-auth marketing carousel, before they have an account.

That is the same flag the post-signup wizard gate reads: `hasCompletedOnboarding = storedFlag === '1' || !!profile.location` (`authStore.ts:123-127`), consumed at `RootNavigator.tsx:40-41`.

**Concern (not verified on device):** a user who skips the carousel, then signs up, may have the post-signup wizard skipped entirely — never setting name, postcode, or preferences — because the OR short-circuits on the local flag.

**Question:** are these meant to be the same flag? I have not run this on device and will not assume the outcome. If they should be separate, that is a mobile fix; the flag split is the change, and it needs your go-ahead since it touches stored state on existing installs.

---

## OQ-4 — Terms and Privacy acceptance: mobile enforces it, web does not — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-007.

Mobile requires an agree-to-terms checkbox before signup is enabled (`SignupScreen.tsx:50,292-305`). A grep for `terms` / `agree` in `src/app/auth/signup/page.tsx` returned no matches.

**Question:** is the web app missing a required legal gate (a web bug), or is the mobile checkbox extra? Parity work will otherwise "fix" mobile by removing a consent gate, which is the wrong direction if the gate is legally required.

---

## OQ-5 — Are ADMIN and partner roles ever in scope for mobile? — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-027, AUTH-029, AUTH-026.

Backend has 7 roles (`backend/prisma/schema.prisma:18-27`). Web routes 6 of them to distinct dashboards plus an admin panel (`src/app/dashboard/page.tsx:25-44`). Mobile's store types `role` as only `'buyer' | 'seller' | 'dealer'` (`store/authStore.ts:60,68`) and maps everything else to `buyer` (`authStore.ts:117`).

**Question:** confirm mobile is intentionally buyer/seller/dealer only. If so I will mark AUTH-027 and AUTH-029 as out-of-scope rather than gaps, and AUTH-026 reduces to "ensure non-supported roles get a clear message instead of silently landing in the buyer UI."

---

## OQ-6 — Who handles the mobile `AUTH_REDIRECT` sentinel? — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-014, AUTH-012.

Mobile `src/lib/apiClient.ts:93-95` throws `Error('AUTH_REDIRECT')` on 401, mirroring the web sentinel. But web's `apiClient` *also* navigates first (`src/lib/apiClient.ts:9-20,119`); mobile does not.

I searched `App.tsx`, `RootNavigator.tsx`, and `store/authStore.ts` and found no global catch. `ChatContext` is referenced in an `apiClient.ts` comment as a caller that motivated the `NO_SESSION` early-bail, but I did not read `ChatContext` in this pass — so **I cannot claim there is no handler anywhere**, only that there is none in the three files I checked.

**Question:** is there an intended global handler? If not, the fix is a store-level `forceLogout()` that `apiClient` calls on `AUTH_REDIRECT`. That touches every screen's error path, so I want your approval before scoping it.

---

## OQ-7 — `src/app/auth/partners/page.tsx` looks broken against the backend contract — `OPEN`
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** AUTH-031.

The partners portal posts `{email, supabaseToken}` to `POST /auth/login` (`src/app/auth/partners/page.tsx:54-60`). The backend `LoginDto` accepts only `{email, password}`, and the global validation pipe is configured `whitelist: true, forbidNonWhitelisted: true` (`backend/src/main.ts:115-116`) — so this request should be rejected with a 400 (unknown property `supabaseToken`, missing `password`).

I have **not** run this, so I am not asserting it fails in production — only that the code as written contradicts the DTO plus pipe config.

**Question:** is the partners portal live and working? If it is broken, AUTH-031 should not be ported to mobile until the web flow is fixed, since I would be copying a broken contract.

---

## OQ-8 — Two deployment paths with different route prefixes — `OPEN` (informational)
**Raised by:** Pass 1 AUTH (2026-08-31). **Blocks:** nothing yet; flagged so it does not bite later passes.

`backend/src/main.ts` has **no** `setGlobalPrefix` call (grep returned no match), and listens directly (`main.ts:157`). `api-server/index.ts:11` wraps the same `AppModule` for a serverless deploy and **does** call `app.setGlobalPrefix('api')`, rewriting URLs to start with `/api` (`api-server/index.ts:27-29`).

Both clients target the same host with no `/api` prefix: web `src/lib/apiClient.ts:3` and mobile `src/lib/apiClient.ts:3` both default to `https://carmazium-hjoh9w.fly.dev`.

So `api-server/` appears to be an unused legacy Vercel path — consistent with the recent commit "fix(payments): stop sending paying customers to a dead deployment". **Question:** can I treat `backend/src/main.ts` (no prefix) as the only contract for all remaining passes and ignore `api-server/`?
