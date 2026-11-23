# TradeXchange UX redesign — Block 1 (architecture and SEO)

Date: 23 November 2026
Base: 12428592e5e23c89189341af0359074a7e0a1f74 (main, after PR #986)
Scope: source architecture only; no production deployment, database or payment changes.

## Canonical route inventory

| Route | Disposition |
| --- | --- |
| /auctions | Single existing public TradeXchange homepage; self-canonical, CollectionPage and ItemList structured data |
| /services | Retired duplicate interface; exact HTTP 308 permanent redirect to /auctions in Next config; not in sitemap |
| /auctions/how-it-works, /auctions/browse | Retain auction guide and functional browsing |
| /auctions/live/[id], /auctions/won/[id] | Retain auction records and access gates |
| /services/delivery, /services/inspection, /services/finance, /services/warranty | Retain distinct service landing pages, self-canonical, direct links and sitemap entries |
| /services/delivery/new, /services/inspection/new, /services/jobs/new | Retain active request forms and service selector; integrate unnecessary selector step with form in Block 4 |
| /services/jobs, /services/jobs/[id] | Retain customer history, job details and payment return URLs; noindex |
| /services/leads, /services/leads/[id] | Retain historical account records until lifecycle and data retention reviewed; noindex |
| /services/warranty/order, /services/warranty/terms | Retain existing warranty checkout/terms workflow; review metadata and indexing in Block 6 |
| /dashboard/partner, /dashboard/service/jobs, /dashboard/service/jobs/[id] | Retain provider approvals, existing jobs and workspaces |
| /dashboard/admin/services, /dashboard/warranties | Retain admin/customer workspaces |
| /contact?topic=finance-partnership, warranty-partnership, insurance-partnership | Retain preselected partnership routes |

## Changes

- Delete the old 333-line services homepage and its 34-line duplicate parent metadata layout, without adding any replacement page. Redirect the exact old URL, not its subpaths.
- Update current web root-hub links, footer, public breadcrumbs, sitemap, MaziuM verified routes and source references. The existing native Services screen handles both canonical and compatibility paths; no duplicate native screen.
- Align home SEO metadata and schema with the multiple service areas actually offered. Retain canonical www origin and all distinct indexable service paths.
- Correct insurance wording in the web and native guided tours and regenerate the narration catalog. Preserve the admin module's relative path.
- Add route-contract regression tests to CI and preserve existing transactional URLs, feature flags and provider workflow.

## QA gates and future work

- 155 local targeted automated tests passed (TradeXchange, SEO, navigation, iOS compact dashboard/posted jobs and guided tours, including 5 new canonical route tests).
- One-product parity guard passed; 74 MaziuM source fingerprints verified.
- Runtime visual/role-based browser and app testing, production redirect verification, Google Search Console sitemap/resubmission and index monitoring are release gates. Do not assert SEO ranking improvement without post-release measurements.
- Retain existing published URL compatibility; do not create a second hub or layer a second dashboard over completed provider journeys. Block 2 replaces existing homepage layout in place; later blocks simplify actual service forms and dashboards.
- Review stale wording on /become-a-partner in the relevant provider/partnership content block. No provider policy or backend changes made here.
