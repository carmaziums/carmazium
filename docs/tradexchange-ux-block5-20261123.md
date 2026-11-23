# TradeXchange UX — Block 5: vehicle inspections
Date: 23 November 2026. Continuation of draft PR #987.

- Replaced inspection landing in place, with four requested scopes: pre-purchase, mechanical, cosmetic/bodywork, and multi-vehicle/dealer stock. One existing service engine and request form; no duplicate route.
- Manual inspection requests now accept up to 12 vehicles at one location, one quote and job-level completion outcome. Separate requests for individual outcomes or locations. Preserve the existing single-auction linked inspection and refusal/refund workflow.
- Added per-vehicle notes, automatic title, UK date/time, postcode and year checks, guest draft sign-in handoff and listing-scoped drafts. Fixed draft hydration before accepting edits. Updated native shared form and retail vehicle inspection entry.
- Quote cards display actual provider summary, scope, service area and whole-request price. No invented ratings, availability, profile pages or GDN approval. Inspection-only Public Liability Insurance requirement preserved. GDN publication remains conditional on verified onboarding/approval; no named provider promoted.
- Preserved canonical /services/inspection; request form noindex. Updated metadata, source fingerprints and regression guards.
- Verification: 254 targeted automated tests passed; 49 backend service tests passed including two-vehicle inspection lifecycle; web and native TypeScript passed before final hydration guard (final source checks to follow). Browser landing passed 1440/390/320 px light/dark; guest cosmetic two-vehicle request draft reload and noindex passed after hydration guard. No real job/payment or deployment. Real-account, native device and production testing remain release gates.
