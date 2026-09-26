# Store Listing Asset Plan

Store screenshots and graphics must be captured from the release candidate, not
invented from design mocks. Use dedicated review/test data only; never expose
real customer names, chat content, KYC documents, bank details, phone numbers or
other sensitive information in store assets.

## Apple App Store

The current native config is iPhone-only (`supportsTablet: false`) and portrait
orientation.

For the en-GB product page:

- provide 1–10 iPhone screenshots;
- prefer one current highest-resolution 6.9-inch portrait set so App Store
  Connect can scale where allowed;
- an accepted current 6.9-inch portrait size is **1320 × 2868 px**;
- PNG/JPEG only, no alpha/transparency;
- app preview video is optional.

Recommended screenshot sequence:

1. Home / marketplace discovery.
2. Search and vehicle results.
3. Vehicle detail with genuine listing data.
4. Seller listing/valuation flow.
5. Live auction surface (using a dedicated review vehicle/account).
6. Dealer workspace (verified review dealer).
7. Messages / transaction workflow.
8. MaziuM AI after the consent disclosure.

Do not claim a calculated App Store age rating in artwork before App Store
Connect has produced it.

## Google Play

Required listing graphics should include:

- high-resolution Play app icon supplied in Play Console;
- **1024 × 500 px** feature graphic (JPEG or 24-bit PNG, no alpha);
- at least two screenshots;
- screenshots: JPEG or 24-bit PNG, 320–3840 px per dimension, with the longest
  dimension no more than twice the shortest.

Use a consistent portrait phone set, ideally captured from the same release
candidate and test data as the Apple screenshots.

## Asset content rules

- Show real app UI from the submitted build.
- Do not add competitor names/logos.
- Do not add unsupported rankings, awards or “#1” claims.
- Avoid temporary promotional/price overlay text in the marketing artwork;
  pricing visible naturally inside the real app UI is acceptable when accurate.
- Do not imply that retail buyers can bid in trade auctions.
- Do not imply CarMazium holds the vehicle purchase price.
- Do not expose a real vehicle/customer dispute, payment card, bank account,
  KYC document or private conversation.

## Release evidence

Store-console screenshot/feature-graphic upload remains external evidence.
Before final certification, set the strict workflow's store-assets confirmation
only after the release-candidate assets are uploaded in both consoles.
