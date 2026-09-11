# Trade Exchange — Service Marketplace

The four "Coming soon" cards on `/auctions`: Delivery & Recovery, Vehicle
Inspections, Vehicle Finance, Warranty Providers. Customers post work; approved
contractors quote; the customer accepts and pays through CarMazium; the
contractor is paid out on completion.

This document is the design of record. **Phase 0** (this document, the schema
and its migration) is complete and awaiting sign-off. Nothing here is built yet.

---

## 1. Where this came from

The client supplied a "TradeXchange" reference pack. It turned out to be our own
repository at commit `05afd027` plus a handoff README, and nine empty
`tradexchange_*` tables drafted with AI directly in Supabase. **The tables are a
reference for the shape they want, not a system.** We keep the sound parts of
that shape (jobs → quotes → payment with a fee split; leads for finance and
warranty) and design the rest properly.

The reference tables are dropped by
`backend/prisma/migrations/drop_reference_tradexchange_tables.sql` — a
deliberate, separate step, guarded by a row-count check.

## 2. Decisions (settled 2026-09-11)

| # | Decision | Chosen | Why |
|---|---|---|---|
| 1 | Who is a provider | **`CONTRACTOR` role** (existing) | Owner's call. Reuses the existing role and `/dashboard/service`. Not dealers — a transport firm is not a car dealer. |
| 2 | Who may post a job | **Anyone signed in** | Matches the reference; a retail buyer needing delivery is the biggest audience. |
| 3 | Vehicles per job | **Many** (`service_job_vehicles`) | "Single and multi-car moves" is in the card copy. One truck, one price. |
| 4 | Capability approval | **Admin toggle** in phase 1; document upload later | Fastest to a clickable slice. Approval is per contractor *per service*. |
| 5 | Platform fee | **9%** of the quoted gross, deducted from the contractor's payout | What the reference encodes (`platform_fee_rate 0.0900`). Customer pays the quote; contractor receives 91%. |
| 6 | Payment mechanics | **Charge on acceptance, release on confirmed completion** | Funds held by the platform until the job is done. Same pattern as the existing £100 seller bonus (Connect transfer after handover approval). |
| 7 | Provider staff | **Not in scope**; reuse `DealerStaff` later if needed | Avoids a second staff system. |
| 8 | Post-purchase hook | **Phase 1** | "Arrange delivery" after a win/accepted offer creates a pre-filled delivery job. Legacy ask-the-seller `DeliveryRequest` stays alongside. |
| 9 | Reference tables | **Drop and recreate** under Prisma | Confirmed empty. Modelling a truncated column dump is riskier than a clean schema. |
| 10 | First slice | **Delivery & Recovery, end to end** | Exercises everything hard once; Inspections is then a parameter change. |

## 3. A fact that shaped scope

`CONTRACTOR` is accepted at signup but **nothing in the backend has ever created
a `ContractorProfile`**. The role is a shell: `/dashboard/service` and the
`/service-requests/contractor*` endpoints cannot function for anyone. Phase 1
makes it real by creating the profile lazily on first capability application —
the same lazy pattern dealers use (`submitKyc` upserts the `DealerProfile`).

`/users/elevate` now allows self-service switching to `CONTRACTOR`. The role
alone grants nothing; the work is behind an approved capability.

The legacy `ServiceRequest` model (a customer targets one contractor directly)
is left untouched. The marketplace is new tables; nothing builds on it.

## 4. Roles and gating

| Actor | Who | Can |
|---|---|---|
| Customer | Any signed-in user | Post jobs, see quotes on own jobs, accept, pay, confirm completion, cancel while OPEN |
| Contractor | `CONTRACTOR` + `ContractorCapability` **APPROVED** for that `serviceType` | See the OPEN feed for their approved services, quote, withdraw, start, mark complete |
| Admin | `ADMIN` | Approve/reject/suspend capabilities, view all jobs, resolve DISPUTED |

Enforced server-side in a new `ApprovedContractorGuard` (reads the capability
from the DB per request, as `VerifiedDealerGuard` does with KYC). The frontend
gates match but are presentation only.

**Stripe Connect is a precondition for approval.** Admin cannot approve a
capability until the contractor's `User.stripeConnectAccountId` exists with
payouts enabled. This prevents "job done, nowhere to send the money". Uses the
existing `POST /users/stripe-connect/onboard`.

**What a contractor sees before acceptance:** full postcodes (they cannot quote a
route without them), vehicle details, timing, description. **Not** the
customer's name, phone, email or street address. Those are revealed to the
accepted contractor only — "Contact shared only with your pick".

## 5. Job lifecycle

```
OPEN ──accept quote──▶ ACCEPTED ──checkout paid──▶ PAID ──contractor starts──▶ IN_PROGRESS
 │                                                                                │
 ├─ customer cancels ──▶ CANCELLED                              contractor marks done
 └─ expiresAt (7d) ────▶ EXPIRED                                                  ▼
                                                                             COMPLETED
                                                  customer confirms, or 48h auto ──▶ RELEASED (payout sent)
Any paid state ── admin ──▶ DISPUTED (frozen; admin resolves to RELEASED or REFUNDED)
```

Rules:
- Cancellation is free while OPEN. After ACCEPTED it is admin-mediated
  (DISPUTED → refund), because a contractor may already have committed a truck.
- A contractor has one live quote per job and edits it in place.
- Accepting one quote sets every other ACTIVE quote on that job to DECLINED and
  notifies those contractors.
- OPEN jobs expire on a cron (same shape as `delivery-expiry.service.ts`).
- COMPLETED auto-confirms after 48h if the customer is silent, so a contractor is
  never held hostage by an inattentive customer.

## 6. Money

All amounts are integer pence. The fee split is **frozen onto the job and the
payment at acceptance** — a later change to the platform rate never rewrites what
a contractor was promised.

- `grossPence` = accepted quote amount (what the customer pays)
- `platformFeePence` = round(gross × 0.09)
- `contractorPence` = gross − fee

Flow: acceptance creates a Stripe Checkout session (`metadata.type =
SERVICE_JOB`) → existing webhook marks `ServicePayment` PAID and the job PAID →
on RELEASED, a Connect transfer of `contractorPence` to the contractor's account
(pattern: existing seller-bonus transfer).

**Open question for the client's accountant:** is 9% inclusive or exclusive of
VAT? The schema stores rate and pence, so either works; the number shown to
contractors must be right from day one.

## 7. API surface (Phase 1)

All under `SessionAuthGuard`. `ServicesModule` at `backend/src/services/`.

**Customer**
| Method | Route | Notes |
|---|---|---|
| POST | `/services/jobs` | `{serviceType, isRecovery, title, description, pickupPostcode, pickupAddress, deliveryPostcode, deliveryAddress, requestedFor, vehicles[]}` |
| POST | `/services/jobs/from-purchase` | `{offerId}` or `{auctionId}` → pre-filled DELIVERY job (pickup = seller postcode, vehicle = listing) |
| GET | `/services/jobs/my` | Own jobs with quote counts |
| GET | `/services/jobs/:id` | Customer, quoting contractors, admin. Contact fields redacted for non-accepted contractors |
| POST | `/services/jobs/:id/cancel` | OPEN only |
| POST | `/services/jobs/:id/quotes/:quoteId/accept` | → `{checkoutUrl}` |
| POST | `/services/jobs/:id/confirm` | COMPLETED → RELEASED |

**Contractor**
| Method | Route | Notes |
|---|---|---|
| POST | `/services/capabilities` | `{serviceType}` — creates `ContractorProfile` if missing |
| GET | `/services/capabilities/my` | |
| GET | `/services/jobs/feed?serviceType=` | OPEN jobs for approved services, redacted |
| GET | `/services/jobs/assigned` | Jobs where this contractor's quote was accepted |
| PUT | `/services/jobs/:id/quote` | Create or update own quote |
| DELETE | `/services/jobs/:id/quote` | Withdraw |
| POST | `/services/jobs/:id/start` | PAID → IN_PROGRESS |
| POST | `/services/jobs/:id/complete` | IN_PROGRESS → COMPLETED |

**Admin**
| Method | Route | Notes |
|---|---|---|
| GET | `/admin/services/capabilities?status=` | Review queue; shows Connect status |
| PATCH | `/admin/services/capabilities/:id` | `{status, reviewNote}` |
| GET | `/admin/services/jobs?status=` | |
| POST | `/admin/services/jobs/:id/resolve` | DISPUTED → RELEASED or REFUNDED |

## 8. Frontend (Phase 1)

- `/auctions` — Delivery card flips live (drop `href` into `SECTIONS`).
- `/services/delivery` — public landing (what it is, how it works) + **Post a job**
  (`RequireAuth` with no `allowedRoles`: any account).
- `/services/delivery/new` — the form, with a vehicles repeater.
- `/services/jobs/[id]` — customer view: quotes, accept, pay, confirm.
- `/dashboard/user` (and buyer/seller) — "My service jobs".
- `/dashboard/service/*` — contractor: capabilities, feed, my quotes, assigned jobs.
- `/dashboard/admin/services` — capability queue, jobs, disputes.
- Post-purchase: an **Arrange delivery** button on won-auction and accepted-offer
  screens that calls `from-purchase`.
- Contractor entry point: a **Become a provider** CTA on the landing page → role
  switch (existing `/profile#upgrade-role`, now with a Contractor option) →
  capability application.

## 9. Notifications and email

New in-app notifications + branded emails (existing `EmailService`, Gmail):
new quote received · quote accepted (winner) · quote declined (others) · payment
received / job is go · job started · job marked complete, please confirm ·
payout released · capability approved / rejected.

## 10. Later phases

- **Phase 2 — Inspections.** Same tables. `serviceType = INSPECTION`,
  `servicePostcode` instead of pickup/delivery, one vehicle. Mostly form and copy.
- **Phase 3 — Finance + Warranty.** Enquiry model: `service_leads` +
  `service_lead_recipients` fanned out to every approved provider; no payment
  through the platform. **Open question:** are finance/warranty providers also
  `CONTRACTOR`s, or the existing `FINANCE_PARTNER` / `INSURANCE_PARTNER` roles?
- **Phase 4 — Provider staff**, only if phase 1 shows contractors want it.
- Capability documents (insurance certificate etc.) when the client wants
  approval to be evidence-based.

## 11. Applying Phase 0

1. Review this document and `backend/prisma/schema.prisma` (search
   `TRADE EXCHANGE — SERVICE MARKETPLACE`).
2. Run the row-count check in `drop_reference_tradexchange_tables.sql`; if all
   zero, run the drop.
3. `psql "$DIRECT_URL" -f backend/prisma/migrations/service_marketplace_phase0.sql`
4. Deploy the backend (the migration must land first — the generated client now
   knows these tables).

Nothing in the running application reads the new tables until Phase 1 ships, so
steps 3–4 are safe in either order for now, but the habit matters.
