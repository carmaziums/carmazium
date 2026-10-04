# Block 2 — Account identity and verification: website / native evidence

**Scope:** #414 Block 2; code corrections under draft PR #419, based on main at `787d021767cda1178a30d45bd2610cff34454bac`. This is a source-level audit, not signed-app certification. Do not publish or mark the eight registry features complete without matching web + real iOS/Android account journeys.

## Observed source mappings and outstanding evidence

| Registered option | Website | Native Android/iOS | Code findings / remaining evidence |
| --- | --- | --- | --- |
| `auth.login` | `src/app/auth/login/page.tsx` | `src/screens/auth/LoginScreen.tsx` | Email/password, Google and Apple paths exist in both. Test verified/unverified and wrong credentials on actual builds, including user role and cookie isolation. |
| `auth.signup_account_type` | `src/app/auth/signup/page.tsx` | `src/screens/auth/SignupScreen.tsx` | User-facing Personal and Dealer / Sole Trader / Partner choices now use identical labels and underlying BUYER / DEALER values. Native label fix in PR #419; website still accepts legacy `role=SELLER` query value despite not displaying it, requiring separate product decision. Signup email and OAuth callbacks not proven end to end. |
| `auth.email_verification` | `src/app/auth/onboarding/page.tsx` | `src/screens/auth/VerifyEmailScreen.tsx` and `src/store/authStore.ts` | Both support email confirmation; real cross-device redirect, expired-token and resend-rate-limit tests outstanding. |
| `auth.password_recovery` | `src/app/auth/forgot-password/page.tsx`, `reset-password/page.tsx` | Native `ForgotPasswordScreen.tsx`, `ResetPasswordScreen.tsx`, `App.tsx`, `RootNavigator.tsx` | **Open mismatch:** website reset form accepts 6-character passwords, native requires 8. Keep stronger native rule pending aligned web/provider policy. **Open navigation risk:** native recovery deep-link session exchange may cause Auth/Main stack to switch while the callback attempts to navigate to `Auth > ResetPassword`. Confirm with real recovery email and prevent normal sign-in handling from pre-empting recovery before declaring safe. |
| `auth.account_onboarding` | Web auth onboarding and profile completion gate | `PostSignupOnboardingScreen.tsx` | Code mapped; test incomplete profiles, partner KYC handoff, Apple/Google missing names, locked-out and restored sessions. |
| `auth.dealer_staff_invite` | `src/app/auth/accept-invite/page.tsx` | `src/screens/main/AcceptInviteScreen.tsx` | **Corrected in PR #419:** after accepted staff invite, native refreshes account identity and sends staff to role-aware dealer Profile tab rather than seller dashboard. Backend checks invited email and elevates accepted membership to DEALER. Test owner/staff permissions, already-used/expired/wrong-account links and callback on both signed platforms. |
| `account.deletion` | Public `/delete-account` portal and `DeleteAccountSection` | Native Settings deletion modal | Both use typed DELETE confirmation and backend endpoint. Verify authentication, deletion success/failure, login/session invalidation and support/public access on each client. |
| `navigation.account_role_home` | Role-aware `/dashboard` routes | `TabNavigator.tsx` role-aware Profile tab | Confirm buyer, seller, verified/unverified owner, VIEW_TRADE/non-VIEW_TRADE staff, contractor and partner outcomes. Admin remains explicitly web-only. |

## Block 2 code changes and automated checks

- PR #419: accepted dealer invite now opens the real dealer workspace (`Tabs > Profile`) after `initializeAuth()` refreshes backend role. The backend's matching-email check remains authoritative; no privilege is granted by native navigation alone.
- PR #419: displayed native signup choices now match website's Personal Account and Dealer / Sole Trader / Partner Account language without changing signup role IDs.
- `scripts/test-staff-invite-parity.test.mjs`: five checks for invite identity/destination, website correspondence, server membership guard and signup option equality. Wired into Mobile Listing CI. These are source-contract tests and cannot replace real signed-device tests.

## Manual and integration acceptance, still NOT TESTED

1. Sign up Personal and Partner on website, signed iPhone and signed Android; confirm identical role/onboarding and no auto-KYC.
2. Sign in with password/Google/Apple, wrong password and unverified email; verify failed redirects do not expose a dashboard.
3. Complete verification using links opened on the other device; expired/reused links and resend cooldown must recover clearly.
4. Request password recovery and open one-time link with app installed and without; assert the reset form is actually reachable, reset policy is identical, an expired link fails safely, and old password no longer works.
5. Invite delegated staff, accept a valid link, confirm matching invited email and VIEW_TRADE permissions; reject wrong-account, reused and expired links. Confirm actual dealer dashboard is opened.
6. Switch roles and log out/in across two accounts; verify private profiles/dealer permissions/return navigation do not leak.
7. Delete account from web/app using typed confirmation; verify backend deletion, final session signout and required privacy follow-up.

Keep all actual signed-build identifiers, device screenshots and test account results out of code; link redacted evidence in the release review.

**Rollback:** PR #419 is isolated from unreleased PR #413; revert independently. No paid infrastructure, production migrations or credentials needed for these source-level changes.
