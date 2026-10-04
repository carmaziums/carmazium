# Block 2 — Account identity and verification: website / native evidence

**Scope:** #414 Block 2; code corrections under draft PR #419, based on main at `787d021767cda1178a30d45bd2610cff34454bac`. This is a source-level audit, not signed-app certification. Do not publish or mark the eight registry features complete without matching web + real iOS/Android account journeys.

## Observed source mappings and outstanding evidence

| Registered option | Website | Native Android/iOS | Code findings / remaining evidence |
| --- | --- | --- | --- |
| `auth.login` | `src/app/auth/login/page.tsx` | `src/screens/auth/LoginScreen.tsx` | Email/password, Google and Apple paths exist in both. Test verified/unverified and wrong credentials on actual builds, including user role and cookie isolation. |
| `auth.signup_account_type` | `src/app/auth/signup/page.tsx` | `src/screens/auth/SignupScreen.tsx` | User-facing Personal and Dealer / Sole Trader / Partner choices now use identical labels and underlying BUYER / DEALER values. Native label fix in PR #419; legacy website `?role=SELLER` links now explicitly map to Personal Account (BUYER) instead of creating an invisible third account type. Signup email and OAuth callbacks not proven end to end. |
| `auth.email_verification` | `src/app/auth/onboarding/page.tsx` | `src/screens/auth/VerifyEmailScreen.tsx` and `src/store/authStore.ts` | Both support email confirmation; real cross-device redirect, expired-token and resend-rate-limit tests outstanding. |
| `auth.password_recovery` | `src/app/auth/forgot-password/page.tsx`, `reset-password/page.tsx` | Native `ForgotPasswordScreen.tsx`, `ResetPasswordScreen.tsx`, `App.tsx`, `RootNavigator.tsx`, `authStore.ts` | **Code corrected in draft:** website and native reset forms now both require eight characters. Native recovery sessions have a dedicated root route that takes precedence over ordinary login/onboarding, guards session hydration against recovery tokens, rejects duplicate single-use link delivery, and cancels via signout. Both implicit token and PKCE flows are handled. **Not yet release-certified:** signed iOS and Android must open real reset links, reject expired links and verify actual Supabase/SMTP redirects. |
| `auth.account_onboarding` | Web auth onboarding and profile completion gate | `PostSignupOnboardingScreen.tsx` | Code mapped; test incomplete profiles, partner KYC handoff, Apple/Google missing names, locked-out and restored sessions. |
| `auth.dealer_staff_invite` | `src/app/auth/accept-invite/page.tsx` | `src/screens/main/AcceptInviteScreen.tsx` | **Draft corrections:** after acceptance native refreshes identity and opens the role-aware dealer dashboard. Signed-out recipients' valid CarMazium invite deep links are now held only in memory until login and required onboarding finish; duplicate React Navigation dispatch is filtered. Backend still checks invited email and role. Physical Android/iPhone universal links, real email links, wrong-email accounts, expiry and staff permissions are NOT tested. |
| `account.deletion` | Public `/delete-account` portal and `DeleteAccountSection` | Native Settings deletion modal | Both use typed DELETE confirmation and backend endpoint. Verify authentication, deletion success/failure, login/session invalidation and support/public access on each client. |
| `navigation.account_role_home` | Role-aware `/dashboard` routes | `TabNavigator.tsx` role-aware Profile tab | Confirm buyer, seller, verified/unverified owner, VIEW_TRADE/non-VIEW_TRADE staff, contractor and partner outcomes. Admin remains explicitly web-only. |

## Block 2 code changes and automated checks

- PR #419: accepted dealer invite now opens the real dealer workspace (`Tabs > Profile`) after `initializeAuth()` refreshes backend role. The backend's matching-email check remains authoritative; no privilege is granted by native navigation alone.
- PR #419: displayed native signup choices now match website's Personal Account and Dealer / Sole Trader / Partner Account language without changing signup role IDs.
- `scripts/test-password-recovery-parity.test.mjs`: ten additional checks covering in-process auth lifecycle, cold-start races, previously signed-in dealer isolation, late signout events and timeout behaviour, plus source-contract coverage for recovery-only routing, implicit/PKCE ordering, minimum password policy and signout cancellation. Runs in Mobile Listing CI, One Product Parity and Release Certification.
- `scripts/test-dealer-invite-link.test.mjs`: seven executable trusted-link/invalid-link/token-state cases, plus source routing checks for preserving invite through unauthenticated and incomplete-onboarding states. Included in all three code workflows; web-host association and signed Android/iOS evidence still required.
- `scripts/test-staff-invite-parity.test.mjs`: nine source-contract checks for invite identity/destination, website correspondence, server membership guard, signup options, login providers, recovery email requests and deletion confirmation. Wired into Mobile Listing CI. These are source-contract tests and cannot replace real signed-device tests.

## Manual and integration acceptance, still NOT TESTED

1. Sign up Personal and Partner on website, signed iPhone and signed Android; confirm identical role/onboarding and no auto-KYC.
2. Sign in with password/Google/Apple, wrong password and unverified email; verify failed redirects do not expose a dashboard.
3. Complete verification using links opened on the other device; expired/reused links and resend cooldown must recover clearly.
4. Request password recovery and open one-time link with app installed and without; assert the reset form is actually reachable, reset policy is identical, an expired link fails safely, and old password no longer works.
5. Send a real invite to an email with no account, cold-open the link on signed Android/iPhone, create the invited account, verify email, finish onboarding and confirm the invitation auto-opens once; repeat with an existing signed-in account and with the app not installed (web fallback). Verify invited-email matching and VIEW_TRADE permissions; reject wrong-account, reused and expired links. Confirm the dealer dashboard opens, and check both carmazium.com and www.carmazium.com association files and signed app IDs.
6. Switch roles and log out/in across two accounts; verify private profiles/dealer permissions/return navigation do not leak.
7. Delete account from web/app using typed confirmation; verify backend deletion, final session signout and required privacy follow-up.

Keep all actual signed-build identifiers, device screenshots and test account results out of code; link redacted evidence in the release review.

**Rollback:** PR #419 is isolated from unreleased PR #413; revert independently. No paid infrastructure, production migrations or credentials needed for these source-level changes.
