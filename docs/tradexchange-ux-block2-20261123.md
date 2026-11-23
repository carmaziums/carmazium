# TradeXchange UX redesign — Block 2 (homepage and public navigation)

Date: 23 November 2026
Continuation: draft PR #987 / Block 1 commit 8356cfe4.

## Implemented

- Replaced the existing /auctions homepage in place with a server-rendered, customer-first service directory: auctions, transport, inspections, finance, warranty and business partnerships. Kept the canonical route, service-specific links, feature flags and CollectionPage/ItemList schema; no new public route.
- Responsive grid, brand hero, consistent light/dark tokens, readable 16px body content, minimum 48px action targets, keyboard focus, no animated card dependency, and a concise three-step explanation of paid services. Separate business integrations from paid-job onboarding and clearly distinguish vehicle payments from service payments.
- Signed-in users see their own service requests and warranty history. Existing dealer/contractor accounts open the existing Partner workspace; staff use the existing dealer dashboard. No public provider job feed or approval inference from a role. The guest partner guide remains available before authentication hydrates.
- Removed nested public transport/inspection provider actions on desktop/mobile header and native menu/homepage. Native shortcuts open existing job forms, not a new chooser or WebView. Existing provider dashboard/job routes are unchanged. Full native visual parity is Block 9.
- Corrected public Partner guide insurance wording (Motor Trade + Public Liability for transport; Public Liability for inspection only). No backend approval/insurance/payment policies changed.
- Updated reviewed MaziuM source fingerprints and introduced six new homepage regression tests, including rendered role/identity checks. Existing native menu and chooser guards were updated to assert direct routes and no public provider links.

## Verification

- 174 targeted automated tests passed (including six new homepage checks and native menu tests); web TypeScript no-emit check passed; one-product parity and 74 knowledge source fingerprints passed.
- Local Edge/Playwright browser: desktop 1440, tablet 768, mobile 390 and 320 px, each light/dark: HTTP 200, six cards, no detected horizontal overflow, no public provider feed links or page errors, canonical /auctions. Legacy /services returned HTTP 308 to /auctions. Visually reviewed desktop and mobile screenshots.
- Final two browser runs (1440 light, 390 dark) confirmed both anchor actions and the guest Partner guide link, no card overflow and no page errors.
- Local guest browser used an isolated preview without production credentials; signed-in role logic tested with synthetic profiles, not real authenticated accounts. No live transactions, deployment, native binary or physical-device release testing. These remain release gates.

Next: Block 3 — auction and trading journey. Retain canonical public pages and do not add parallel interfaces.
