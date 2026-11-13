# CarMazium warranty implementation review

Updated 13 November 2026. Status: **warranty paid launch blocked; admin controls and finance routing prepared for deployment**. This replaces earlier pricing proposals in this pack.

## Confirmed retail tariff

12 months. All amounts include VAT. These are Pulse Cars retail prices, not Warrantywise public quotations or dealer purchase costs. The base labour allowance is £75/hour. The repair limit is per repair, subject to the actual schedule and terms; it is not a promise of every repair being covered.

| Single repair limit | Car | SUV |
|---|---:|---:|
| £1,000 | £330 | £415 |
| £2,000 | £360 | £445 |

| Labour allowance | Car surcharge | SUV surcharge |
|---|---:|---:|
| £75/hour | £0 | £0 |
| £100/hour | £180 | £222.50 |
| £150/hour | £270 | £333.75 |
| £200/hour | £360 | £445 |

Labour surcharges use the original £360/£445 standard price, including when a customer selects the £1,000 repair limit. Add the surcharge once; do not compound upgrades or apply a multiplier to extras.

| Optional addition | Retail surcharge |
|---|---:|
| Airbag protection | £20 |
| Driver assistance | £20 |
| Emissions | £20 |
| Multimedia | £80 |
| All four | £140 |

**Total = repair-limit base + labour surcharge + selected additions.** Example: £2,000 limit, £100/hour labour and all four extras is £680 for a car or £807.50 for an SUV. Air conditioning and MOT protection were included in the inspected account quote; do not charge for them again. Verify inclusion per issuing product before wider launch.

**Excluded:** £5,000 repair limit, £125/hour labour, unsupported/unpriced durations or extras. The user expressly removed the first two after the loaded dealer form did not offer them. Generic loading placeholders are not evidence of availability.

The arithmetic implementation passed all 256 combinations (two vehicle categories, two limits, four labour rates, sixteen extra combinations), plus explicit rejection tests. This does not prove supplier eligibility or checkout readiness.

## Roles and permissions

CarMazium is the platform. Pulse Cars Limited is the intended current partner/broker. Warrantywise administers the warranty product. Exact contractual responsibilities and the ability to issue standalone warranties for other sellers' vehicles require confirmation against the correct account agreement.

- **Admin:** appoint partners; manage verification, product authority, available products, prices and eligibility; review applications; monitor payments; record issuance/reference/start date/documents; handle failed issuance and refunds. Future partners are added by admin, not self-registration.
- **Dealer/provider:** no warranty tab, button, application, upload, product setup or approval controls, including the Pulse Cars dashboard. Partnerships are discussed directly with admin through the public contact page. Existing delivery and inspection workflows remain separate.
- **Customer:** vehicle lookup and manual missing fields; instant itemised quote once eligible; pay the approved partner; see own payment/issuance status and documents. No access to others' applications.
- **Pulse Cars:** receives the agreed application and notification; purchases the supplier warranty after confirmed payment. Under the latest instruction, CarMazium admin controls the platform workflow.

Provider wording: **Want to provide vehicle warranties through CarMazium? Contact our team to discuss becoming a warranty partner.** Preserve all four service pillars: delivery, inspection, finance and warranty.

## Launch findings that need resolution

1. **Product scope and terms conflict.** The actual dealer form links to `https://plan-books.s3.us-east-2.amazonaws.com/Trade+CAR+Terms.pdf`. Its metadata dates from June 2023 and its wording describes the supplying dealer selling the vehicle with a dealer-provided warranty. Its general age/mileage expiry is 15 years/150,000 miles, with 18 years/200,000 miles for Bronze. The public current dealer book and public plan pages differ. Do not assume the portal booklet or a generic on-screen card establishes eligibility for every vehicle, every package or a standalone broker sale.
2. **Pulse Cars warranty approval is incomplete.** The live CarMazium record is PENDING with verification REJECTED and no verification expiry. Business identity evidence is approved; the inspected record does not contain approved product-authority evidence. This is a platform record, not a conclusion that Warrantywise has rejected Pulse Cars. Admin must review the correct agreement/product authority before activation.
3. **Payment routing is unverified.** CarMazium stores an onboarded Pulse Cars Connect account, but the Stripe account accessible in this review returned no connected accounts; Accounts v2 is not enabled there. This may be a different Stripe platform from the backend's configured key. It does not establish that Pulse Cars cannot accept payment. Identify the actual payment platform, verify the Pulse Cars merchant account and direct-charge capability, webhook destination, settlement, refund and dispute behaviour. Do not charge through CarMazium by fallback.
4. **The walkthrough stopped before payment.** A new unpaid quote reached customer details with all price options inspected. Genuine customer details were not supplied; no customer data was fabricated, no payment was made and no warranty was issued. Payment-stage fields and declarations remain unverified.
5. **Vehicle eligibility and category mapping are incomplete.** Only one vehicle/account quote was exhaustively tested. A generic CAR label cannot determine SUV pricing. Crossovers, imports, modified vehicles, specialist uses, EV/hybrid cover, high-value vehicles and service/fault declarations need supplier-backed rules. Unsupported cases must not get a purchasable quote.

### Confirmation needed from Warrantywise

Ask Warrantywise to confirm in writing whether Pulse Cars may sell these warranties through CarMazium for vehicles sold by private sellers or other dealers, rather than by Pulse Cars itself; which dealer/broker agreement and plan book applies; who supplies the warranty and administers approved repairs; the eligibility rules and available options for that channel; and approved branding. Ask for the correct terms link and a sample schedule. This is a concrete product-scope question, not a request to approve the software generally.

## Application data and vehicle lookup

Use the existing combined official DVLA and DVSA MOT lookup. Customer confirms current mileage; a historical MOT reading is not current mileage. Keep MOT lookup failure/identity mismatch distinct from no test records. Do not infer service history or fault-free condition. Ignore stale lookup responses after a registration change and invalidate earlier quotes after material edits.

Observed supplier fields: registration, current mileage, model, fuel, engine cc, manufacture date, retail value, origin (UK/EU/Japan/Other), service history (Full/Part/Last service only/Unknown), purchase date, warranty start date, title, first/last name, email, telephone, address line 1, optional line 2, town, optional county, postcode, and optional postal plan documents. Add terms-specific eligibility declarations once the correct agreement is confirmed. Do not invent day/month from a year-only record.

## Intended payment and fulfillment sequence

Complete details → server eligibility and price validation → immutable expiring quote → consent to exact terms and data sharing → payment to verified Pulse Cars merchant → signed webhook confirms paid funds → email and in-app notifications to admin/Pulse → **Paid — awaiting issue** → manual supplier purchase → admin records **Issued** with reference, dates and documents.

Success-page redirects alone must not activate cover. Use idempotent quote/payment/webhook operations, validate the amount/currency/merchant, and support failure/refund states. Only the admin-controlled workflow may issue or amend warranty records. Do not request card details in the CarMazium form; use hosted checkout.

## Code prepared in this review

This release closes contractor and Partner warranty self-application endpoints, blocks provider verification read/upload/delete and warranty matching changes, removes all dealer/provider warranty dashboard buttons and tabs (including Pulse Cars), retains public team contact, and adds an admin Warranty Partners shortcut/filter, and implements the tested retail tariff. It also retires provider inbox/response HTTP routes for finance and warranty while retaining customer/admin history. Admin can appoint a warranty partner for evidence review without automatically approving it. It does not enable the new consumer quote/order/payment/issuance flow. The remaining form, customer dashboard, notification and fulfillment implementation must follow the confirmed supplier agreement.

## Supporting files

`Live-quote-checks.md` records 23 distinct inspected configurations on the single sample vehicle, including all 16 extra combinations. It contains supplier cost observations, not universal costs or customer tariffs. `Public-packages.md` is reference material, not proof that consumer and dealer products are identical. Official unaltered logo assets were obtained from the dealer portal; publishing branding awaits confirmation of the appropriate sales channel. No browser screenshots containing personal or payment data are included.

## Validation completed

- Backend typecheck passed.
- Full backend Jest suite: 152 suites / 1,697 tests passed; four environment-dependent suites / 32 tests skipped.
- Production frontend build passed.
- 21 dealer navigation and retail warranty CTA regression checks passed.
- No live warranty checkout, payment, refund, issuance or end-to-end notification test was performed. These remain release gates, not passed checks.

## Finance administration in this release

Dealer dashboards retain only the seller-controlled finance calculator preference. Provider applications, provider contact cards and the old finance/warranty provider inbox are removed from dealer/provider dashboards, including Pulse Cars. Public finance and warranty pages retain contact-the-team instructions.

Admin can create/edit/disable finance providers, choose a default, and assign an individual retail listing to that default, a named enabled provider or OFF. Jigsaw is seeded as the initial enabled default using the supplied application link. An unavailable explicit override does not silently fall back. The customer sees the chosen provider name and disclosure before consenting; stale provider/version submissions are rejected. Referral records snapshot the chosen route, remain idempotent, notify admin by email and appear in an admin-only recent-referral view. Seller opt-out takes precedence.

Deploy the additive `admin_finance_routing` database migration before the backend release. Both new tables have RLS enabled and direct access revoked from anonymous/authenticated clients. Only admin-guarded backend endpoints mutate configuration. The migration makes no new provider active beyond the already-approved Jigsaw route.

## Temporary public warranty state

The old matching form and provider response routes are retired. Until the paid warranty launch gates are satisfied, the warranty page directs customers to the CarMazium team and clearly states online quotes/purchases are being prepared. The old public matching availability returns unavailable; the old create-matched-lead HTTP endpoint rejects new requests. Automatic hourly matching, approval-triggered matching and the admin rematch HTTP route are also retired. Existing customer/admin history is retained. This avoids collecting an application into a workflow that no longer has a provider inbox.

## Native app alignment

The mobile source removes the same provider application cards, warranty inbox navigation and response screens, while preserving the finance calculator switch. The backend rejects retired operations from already-installed versions. Updated native screens require a new signed app release; this website deployment does not update an installed APK. Native TypeScript and cross-product navigation/parity checks passed.
