# MaziuM AI — verified end-to-end customer knowledge

**Owner:** CarMazium product & customer support. **Maintained:** 18 November 2026.

This guide records the boundaries of the first-party knowledge used by the floating website MaziuM chat and the official customer-support AI. It is a **verified, source-linked retrieval catalogue**, not model-weight fine-tuning or a grant of access to a customer's private account.

## How the assistant answers

1. `backend/src/ai/mazium-platform-knowledge.ts` stores public platform facts by topic, each linked to the feature's owning source files. `platformKnowledgeFor(query)` retrieves the most relevant workflows for the **current** customer question, with specific tasks ranked above broad words such as "dealer" or "account."
2. `backend/src/ai/mazium-site-navigation.ts` contains verified, role-aware URLs and a deterministic response for editing an existing listing. Both public chat and official support use the same guidance.
3. `backend/src/ai/ai.service.ts` injects verified platform knowledge into public chat and official support. A route validator withholds generated answers containing unknown CarMazium paths or invented edit IDs.
4. Known support FAQs are handled locally through `backend/src/chat/support-automatic-responses.ts`. Unsupported or sensitive account-specific actions, monetary decisions, identity checks and complaints stay with authorised staff.
5. Search-filter suggestions reflect only filter requirements explicitly requested in the current query. A model is not permitted to assert actual stock availability, specific vehicle facts or that it accessed an account.

## Verified customer journeys

| Journey | Start or management destination | What MaziuM must distinguish |
| --- | --- | --- |
| New private listing or valuation | `/sell` | Auction free vs Retail; registration lookup or permitted manual route; not an existing-listing editor |
| Edit a seller vehicle | `/dashboard/user?tab=cars` | Select the saved vehicle and Edit; status/ownership restrictions apply |
| Add dealer stock | `/dashboard/dealer/add-listing` | New listing; not the same as editing a saved vehicle |
| Edit dealer stock | `/dashboard/dealer/inventory` | Find saved stock, Edit; do not invent dealer-listings URLs |
| Listing validation and approval | Seller My Cars or Dealer Inventory | Draft, Pending Review, Rejected, Active, Offer Accepted, Sold; minimum-photo exceptions |
| Caravan and campervan | `/sell` | Manual listing; do not require car-specific VIN/registration for touring caravans |
| Seller auctions and provisional offers | `/dashboard/seller/auctions` | Reserve not met, re-auction, retail relist, payment, collection and seller reward are distinct |
| Dealer bidding and auctions | `/auctions`, `/dashboard/dealer/auctions` | Verified dealer permission; bids and winning status must be checked live |
| Dealer Auction Wins | `/dashboard/dealer/auctions/won` | Won auction is not proof of handover |
| Dealer Retail Purchases | `/dashboard/dealer/purchases/retail` | Distinct from Auction Wins |
| Dealer All Purchases | `/dashboard/dealer/purchases` | Includes recorded in-progress purchases |
| Dealer Purchase History | `/dashboard/dealer/purchases/history` | Completed and cancelled records |
| Car search and buying | `/search` | Actual listing facts/stock must not be invented |
| Consumer package prices | `/pricing` | Basic, Standard, Premium and optional add-ons |
| Dealer auction buyer prices | `/pricing/traders` | £125 winning-buyer fee is not vehicle purchase price |
| Account, verification, payouts | `/profile` | Do not collect banking credentials through AI |
| Notifications and messages | `/notifications` and actual listing/support chat | Role, conversation and notification type decide destination |
| Finance | `/services/finance` or eligible vehicle's finance form | Lender decides eligibility; CarMazium does not lend |
| Warranty | `/services/warranty` | Actual quote and policy issuance are separate steps |
| TradeXchange jobs | `/services/jobs/new`, `/services/jobs` | Posting, receiving quotes, accepting, checkout and completion are separate |
| Approved service providers | `/dashboard/service/jobs`, `/dashboard/service/capabilities` | Capability enabled does not imply verification |
| App installation | `/download-app` | Installed native app may lag behind website release |
| Human support / disputes | Official support conversation | Human handoff and financial decisions are handled by authorised staff |

## Correction and release contract

When a button, API, dashboard, price, eligibility rule or workflow changes:

- Update the owning feature implementation, the relevant topic's `sources` and `facts`, and the verified navigation allowlist if necessary.
- Add a regression case to `backend/src/ai/mazium-platform-knowledge.spec.ts`, `backend/src/ai/ai.service.spec.ts`, or `backend/src/chat/support-automatic-responses.spec.ts`.
- Validate that source files still exist and the suggested URL actually leads to the named customer action; do not infer a route merely from naming conventions.
- Test against representative buyer, seller, dealer and service-provider prompts, including status restrictions and privacy-sensitive requests.
- Review reported inaccurate AI answers and update the source-linked catalogue. Do not claim a real customer's action succeeded without an authenticated account/transaction read.

## Boundaries

- No model sees private customer data from this public catalogue, and it cannot autonomously edit listings or release money. Only authenticated, authorised tools could perform an account action.
- A source-linked prompt can reduce hallucinations but cannot guarantee every free-form generative answer. Keep route validation, human escalation, AI reports and regression checks enabled.
- Features controlled by account permissions, live pricing, service availability, auction status or partner contracts must be verified at the time of an actual customer transaction; do not promise them solely from static guidance.
