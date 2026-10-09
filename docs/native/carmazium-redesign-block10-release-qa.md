# CarMazium native redesign — Block 10 release-candidate QA

Date: 9 October 2026  
Scope: native Android and iOS apps built from `carmaziums/carmazium`.  
Programme: ten incremental website/app UI parity blocks; this is the final **source integration and release-readiness** block.

## Status interpretation

- **Implemented** means merged source code exists and passes applicable CI. It does not mean screenshots were compared on devices.
- **Not verified** means no current real-device, production-smoke or signed-store evidence has been supplied. Never present it as passed.
- **Release-ready** requires the separate manual `Release Certification` workflow's strict external gate, including signed artifacts and independent tester evidence, not merely a successful PR or Vercel web preview.
- This PR must not publish OTA updates, upload signed binaries, change real Stripe payment rules or release to customers.

## Code-level integration matrix

| Critical journey | Native entry point | Expected outcome on device | Evidence required |
| --- | --- | --- | --- |
| Buyer retail search | Home → Buy Cars → Search | Make/model/price/transmission filters, details and search work; no clipped buttons | Small/large Android + iPhone video |
| Retail Saved Cars | Save from a listing → Saved | Same saved listing persists and is visible after leaving/re-entering, including web-side updates | Sign in on web and device as same user |
| Live auction | Auctions → auction → bid | No buyer bidding without a verified dealer; correct auction context and £125 buyer fee shown | Verified dealer QA + auction API confirmation |
| Winning dealer checkout | Buyer Bids → Won → Pay fee | Pay **only the £125 platform fee** to CarMazium; no second charge after returning | Stripe sandbox or authorised non-live test, ledger check |
| Seller listing | Sell → DVLA → valuation → auction/retail | Model/transmission/variant pre-fill, image upload, consent and moderation work | Fresh registration test, network-error handling |
| Auction seller handover | Seller Auctions → won/ended | Seller confirms directly received vehicle funds before proof; rejection supports corrected proof; £100 incentive only after admin approval | Two-account and admin QA, never simulate paid without proof |
| Inspection refusal | Linked service inspection → faults found | Eligible buyer sees refusal route; backend determines refund of £125, not a client-only decision | Controlled inspection case and refund reconciliation |
| Delivery | Buyer Delivery Requests / Services | Job status reflects seller/provider changes; completion only after delivery; route + quote visible | Two-device customer/provider test |
| Contractor service job | Partner Dashboard → Jobs → Job detail | Approval and area gates, quote, accept, pay, start, inspection outcome/complete, customer confirmation | Contractor/customer end-to-end QA |
| Service website hand-off | Services → Post job, Finance, Warranty | Real website form opens **in browser**, never loops into native `services/jobs/:jobId` route | Android App Links device test, iOS Universal Links |
| MaziuM assistant | Assistant entry, listing and search | Responsive layout; consent before sharing with AI, reporting, dark theme, keyboard avoids input | iPhone + Android portrait, large-text and consent checks |
| Chat and alerts | Dashboard → Messages / Notifications | User role respected, correct online/presence, read/unread state; no fake verified badges | Foreground/background/killed-app push, offline replay |
| Buyer/dealer navigation | Drawer and five bottom tabs | Every destination resolves, no blank screen, staff permissions remain server-controlled | Buyer, dealer owner, dealer agent, contractor, provider sign-ins |
| Accessibility | All above | TalkBack/VoiceOver focus order, 44–48px controls, large-font clipping, contrast | Accessibility sign-off on physical phones |

### Current source-only checks

The CI regression test `scripts/test-mobile-redesign-block10.test.mjs` checks:
1. Drawer stack routes and tabs are actually registered.
2. All four TradeXchange service destinations, and the general job request, open in a browser, not via interceptable `Linking.openURL`. The installed app still supports real job-detail links.
3. Preview and production OTA channels come from the corresponding EAS build profiles. Hardcoded `production` update headers in `app.json` are forbidden.
4. Native splash, launcher and notification accents match the website palette.
5. Essential auction/handover/refund, contractor and AI-consent paths have not disappeared.
6. Store release remains governed by real evidence rather than a static TypeScript pass.

Those tests are intentionally lightweight integration contracts; they do **not** replace runtime or visual QA.

## Required release sequence (no shortcuts)

1. Freeze and tag one audited `main` commit as the release candidate, and review changes since the last signed mobile build. **Do not assume a web deployment updates native installations.**
2. Verify the Preview and Production EAS Update channels and runtime versions in **signed builds**. Changes to `app.json` require a new native binary. Test preview updates on preview builds only.
3. Produce a signed Android `.aab` and signed iOS `.ipa` from the **same** release SHA. Record build IDs, binary SHA-256, Android signing and 16 KB page-size compliance, Xcode and iOS SDK versions.
4. Upload the exact signed candidate to Google Play **internal testing** and Apple **TestFlight**. Do not submit a public rollout yet.
5. Perform the matrix above with realistic buyer/seller/dealer/contractor accounts on Android and iPhone. Obtain screenshots/videos; compare each principal screen against the corresponding live website UI.
6. Verify identity and business-type verification, data-consent prompts, permissions, push messages, authentication/expired session recovery, App Links/Universal Links, offline/error states and real-device accessibility.
7. Verify finance/warranty hand-offs with the existing website consent and provider terms. **Native request forms are still absent**; browser hand-off is an interim parity gap, not full native parity.
8. Complete Stripe authorised test transactions and reconciliation for fee and job-payment flows. CarMazium must never receive vehicle sale proceeds. Validate inspection-refusal refunds and handover bonus release separately.
9. Confirm website production routes and backend health with the manual `Release Certification` workflow, then provide genuine store-console and signed-build evidence to its strict release gate.
10. Obtain explicit release authorisation before publishing any OTA update or widening the app-store audience. Keep rollback: previous store version, known-good OTA branch and all ten independent PRs.

## Known blockers and limitations on 9 October 2026

- **No signed Android or iOS build was produced by the ten-block PR workflow.**
- **No installed-device visual comparison was executed** for all redesigned screens; screenshot parity, touchability and keyboard handling cannot be called verified.
- **No TestFlight or Play internal-testing candidate has been confirmed**, and no production store release was authorised.
- **No payment, notification or deep-link end-to-end tests on installed apps** have been evidenced in this programme.
- **Service request forms are still website forms**, intentionally opened in an explicit browser to avoid Android App Link interception. Closing the form in-browser does not automatically import its unauthenticated draft into the app.
- The native `app.json` theme and OTA-channel configuration changes from Block 10 require a fresh signed candidate before release.
- Preview and development EAS profiles currently point to the same live backend URL as production and include a live *publishable* Stripe key. Build/test accounts and test payment routes must be isolated or rigorously controlled before end-to-end payment QA. Do not make real charges just to test the redesign.
- App Store/Play metadata, signing artefacts, reviewer credentials, 16 KB memory-page compatibility, production deep-link association, accessibility and stores' release checks require independent confirmation.

## Final reporting rubric

Report **10/10 development blocks integrated** only when the Block 10 PR is merged with required checks passing. Do **not** report `100% website visual parity`, `apps live` or `release-ready` until the above evidence is supplied and audited. Record the exact store build versions and screenshots alongside this document before launch.
