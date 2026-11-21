# Website/app comparison — 21 November 2026

The requested acceptance target is the same options, pages, labels, workflows and dashboard presentation as the live website, implemented in the original native app. A menu or file existing is not evidence that a workflow is equivalent. This is an incomplete comparison and an initial dashboard correction, not full-app sign-off.

## Baseline and laptop observations

- Website source baseline: main `7abd37badf761f1bdbdafca8d8eeaedcb093172c` (PR #946).
- User laptop: DESKTOP-LPIB4R3, BlueStacks emulator-5554.
- Installed production identity: `uk.carmazium.app`, versionCode 110, versionName 1.0.1; firstInstallTime 2026-11-20 11:36:34; lastUpdateTime 2026-11-21 00:53:46. No uninstall, clearing data or replacement package was performed.
- Original installed app homepage and Dashboard were opened. Dashboard requires sign-in at present.
- Laptop Chrome's prior CarMazium session expired on interaction. The normal Google sign-in returned `info@carmazium.com`, which is stopped by “Complete Your Account”. No profile fields were invented or submitted. Correct dealer and personal sessions are needed for authenticated acceptance.
- Signed candidate 111, run 44849568481, was already in progress before this work. It contains PR #946, not these new changes. No new APK, OTA or customer distribution was published by this work.

## Confirmed mismatches and corrections in this branch

| Area | Website/current app difference | Correction |
| --- | --- | --- |
| Personal dashboard entry | Website has a combined buyer/seller home. Native BUYER opens a separate cards-only screen while SELLER opens a bespoke profile/dashboard. | Both entry points use the same native personal home, website header, My Dashboard title, task panel and existing configurable cards. |
| Buyer who also sells | Native seller follow-ups were either absent or restricted by original account role. | Read the same authenticated owner-auction and summary sources for all personal accounts. Backend permissions remain authoritative. |
| Delivery requests | Website includes pending delivery requests in its attention list; app home omitted them. | Fetch received requests and open the existing native delivery-request screen. |
| Task wording/order | Native task text and ordering drifted from the website. | Generated native copies of the website's pure personal/dealer attention rules; CI compares them against the website sources. |
| Provisional offers | Native showed only a count and general destination. Website names the vehicle and its UK decision deadline. | Same vehicle-specific copy and direct native auction navigation. |
| Dealer buyer fees | Native read only the first 50 won auctions and showed a count. | Use complete paginated won-auction retrieval, website vehicle/deadline copy and native purchases destination. |
| Dealer handover eligibility | Native simplified condition could request handover before the buyer fee was paid. | Use the website seller-stage rules through the shared attention builder. |
| Failure/retry | Missing data could hide checks or look like no work. | Independently settle sources, show successful tasks plus a failure notice, retry all checks and never display all-clear after a failed/malformed source. |
| Permissions/focus | Dealer checks could run before access resolved; personal tasks did not refresh after returning. | Wait for dealer permission loading, skip forbidden collections, refresh on focus and invalidate stale requests. |
| Card alignment | Dealer cards had an extra nested horizontal inset. | Remove the extra outer inset while retaining heading/task spacing. |
| Blog manifest | Existing native blog screens were incorrectly declared web-only. | Record the existing native implementation; this does not itself certify content parity. |

The native personal delivery link goes directly to BuyerDeliveryRequests; the web attention action currently points at the seller offers page. The shared rule retains the website's wording, while the native action resolves to the existing delivery workflow.

## Confirmed outstanding scope

AdminDashboardScreen still opens these 12 first-party destinations in a browser:

| Menu | Website route |
| --- | --- |
| Messages | /dashboard/admin/messages |
| Auctions | /dashboard/admin/auctions |
| Sale Cancellations | /dashboard/admin/cancellations |
| Transactions | /dashboard/admin/transactions |
| Vehicle History Reports | /dashboard/admin/hpi |
| Free Listing Grants | /dashboard/admin/free-listings |
| All Dealers | /dashboard/admin/dealers |
| Trade Services | /dashboard/admin/services |
| Analytics | /dashboard/admin/analytics |
| AI Reports | /dashboard/admin/ai-reports |
| Marketing Popup | /dashboard/admin/marketing-popup |
| Blog | /dashboard/admin/blog |

Other admin differences: account detail/list pages direct management actions to the website; handover reward payment controls remain on the website; listing review references the website vehicle-history queue. These are not fixed by this branch.

Still required: authenticated dealer and buyer/seller page-by-page comparison; complete admin and partner parity; listing/editing, filters, offers/bidding, purchases, services, settings, messages and notifications acceptance; mobile light/dark and large-text visual review; correct-account native upgrade testing; iOS verification; production download/automatic-update verification for the final candidate. The public/personal forms and marketplace pages have not all been visually compared. No completion percentage is asserted.

The existing product-parity check verifies file presence plus selected business contracts. Passing it must not be presented as all-page functional or visual parity.

## Validation

- 778 repository tests passed.
- 53 native/component tests passed, including actual personal and dealer screen rendering against controlled data, role permissions, native destinations, partial failures, retries, malformed responses, delivery requests, buyer-role seller tasks and correct handover eligibility.
- Native TypeScript passed before final packaging; final validation is recorded in the PR.
- Website and native dashboard-card catalog remains unchanged and matching.
- No live listings, offers, bids, account profiles or financial transactions were created or changed.

## Continuation

Use the existing original package and the user's correct signed-in laptop sessions. Finish the authenticated comparison before treating this branch as ready for release. Preserve the explicit outstanding admin list. Do not confuse a successful candidate 111 with an APK containing this branch.
