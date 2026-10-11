# CarMazium native Light/Dark/System programme — Block 9/10
Date: 11 October 2026 · Parent: Issue #502 · **90% of planned SOURCE checkpoints, NOT actual customer release readiness**.

This draft branch is stacked on PR #510 (Blocks 1–8, including Samsung navigation/menu repairs). Do not merge older overlapping drafts independently.

## New UI surfaces migrated
- Login, Signup, PostSignupOnboarding, DealerOnboarding: website-style light/dark body, form labels and inputs, Personal vs Partner account options, consent/terms and password feedback. Real role selection, password validation, DVLA/profile/API calls are unchanged.
- DealerKYCScreen: current business type (company vs sole trader), document capture and upload labels, pending/approved/rejected evidence cards, verification checkout shell, £1 payment outstanding notice and skeleton. FormField and pending helper surfaces also subscribe to the theme. No KYC approval, document access, Stripe collection, ID verification or payment bypass.
- ProviderVerificationScreen, ProviderJobsScreen, ProviderJobDetailScreen: contractor/finance/warranty verification, evidence and approved-service status, job browsing, inspection outcomes, quotes and contractor payment-adjacent amounts. Only visual colour tokens changed; no quotation, job status, acceptance, escrow, chat or payout semantics.
- PurchaseFlowScreen: £125 auction buyer-fee payment summary, direct seller payment note, CTA and success visual panels. The original Stripe PaymentSheet and 72-hour fee reminder, auth and reconciliation logic remain exactly as before.
- PaymentHistoryScreen and DealerPurchasesScreen: buyer receipt filters, transaction cards, dealer purchases and seller-contact modal typography/surfaces. Real ledger figures, fees, details and seller actions unchanged.
- The previous Blocks 1–8 (PR #510) include native navigation, role-based account settings, dealer inventory/CRM, seller/auction listings, messages/MaziuM and privacy consent.

## Checks and release rules
- New `scripts/test-native-theme-onboarding-kyc-provider-block9.test.mjs` checks all 11 screens have semantic mappings and protects signup consent, KYC fee/document gates, provider-job outcomes, fee collection, payment reconciliation and account navigation. Wired into GitHub Release Certification.
- Full CI results must pass on the exact PR head (Release Certification, One Product Parity, Mobile Listing CI, Mobile Chat CI, Vercel).
- **No active appearance selector yet.** A partial theme on legacy/specialist screens remains risky. Prior themes are available internally to the provider, but the Account Settings warning must stay until visual cross-device audits are complete and all key paths are readable.
- Source tests and TypeScript are not pixel comparison. Before any real release, audit remaining specialised screens (buy/sell/account/provider/legal/footer), both phone types, app permission and theme switching; capture screen videos, test 200% text, TalkBack/VoiceOver, account navigation, bid/fee rules. If key screens are unreadable, gate remains off.
- No production signed APK, customer download link, iOS TestFlight build or Google Play release, source merge, credential/DB/payment/auth/security/role mutation. QA-only APK must have separate package/signing and owner approval. Public `/download-app` remains disabled.
- The 90% percentage is a ten-block development-plan checkpoint, **not** a verified count of every app screen completed.

**Stop at Block 9 / 90% for explicit owner approval before Block 10 final audit and private QA build.**
