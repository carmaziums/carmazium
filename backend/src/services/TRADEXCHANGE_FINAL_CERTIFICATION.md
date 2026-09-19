# TradeXchange Final Certification — Block 10/10

This file is the release-gate manifest for the final TradeXchange remediation block.
It does not change runtime behaviour. Its presence under `backend/**` intentionally
causes the final pull request to run the complete backend test/build workflow.

## Paid Delivery / Inspection lifecycle

Required flow:

`OPEN -> ACCEPTED -> PENDING Checkout -> PAID -> IN_PROGRESS -> COMPLETED -> RELEASED`

Verified by:

- `services.payment-hardening.spec.ts`
  - fixed 9% / 91% split
  - Checkout-session reuse and replacement safety
  - repeated paid-webhook idempotency
  - concurrent release/refund claim exclusion
- `services.lifecycle-hardening.spec.ts`
  - PAID -> IN_PROGRESS -> COMPLETED lifecycle ordering
  - invalid timestamp rejection
  - customer confirmation and automatic release guards
- `services-lifecycle.service.spec.ts`
  - abandoned Checkout recovery
  - paid Checkout recovery
  - fail-closed Stripe uncertainty
- `services.service.regression.spec.ts`
  - atomic paid transition
  - duplicate paid notification suppression
  - deterministic payout/refund idempotency keys

## Purchase-created Delivery integrity

Verified by `services.purchase-delivery-hardening.spec.ts`:

- accepted-offer and auction ownership
- source exclusivity
- auction fee / sale prerequisites
- repeated-click idempotency
- concurrent unique-index race recovery

## Finance / Warranty enquiry lifecycle

Verified by:

- `service-leads.e2e.spec.ts`
- `service-leads.matching-privacy.spec.ts`
- `service-leads.service.spec.ts`

Acceptance includes service-type separation, approved-provider matching, geographic and
product eligibility, deliberate contact disclosure, recipient closure on enquiry
closure/expiry, retention anonymisation, and no Delivery/Inspection payment model.

## Provider / Partner owner / authorised staff

Verified by `trade-team.service.spec.ts`:

- business provider identity
- service-scoped permissions
- independent view/chat/quote/manage/complete permissions
- inactive-staff revocation
- staff action audit logging
- payout destination remains business-owner controlled

## Admin / disputes / settlement audit

Verified by `service-operations.service.spec.ts`:

- private evidence ownership and validation
- durable settlement operation before money movement
- reconciliation classification
- immutable resolved dispute evidence
- settlement and payment audit history

## Verification documents and provider lifecycle

Verified by:

- `capability-verification.spec.ts`
- `service-operations.service.spec.ts`
- `services-lifecycle.service.spec.ts`

Acceptance includes private storage, signed access, expiry/re-verification and
approval-state enforcement.

## Emergency service switches

Verified by `service-availability.spec.ts` and server-side request guards.
Omitted flags mean live; exact `false` disables new requests only; malformed values
fail configuration validation.

## Production certification checks

The final release also requires:

- all TradeXchange database integrity queries return zero violations
- no pending settlement reconciliation row
- both Vercel production projects READY on the merge commit
- Fly backend deployment healthy
- live TradeXchange public pages return HTTP 200
- production runtime errors reviewed
- Supabase security/performance advisors reviewed

Block 10 is complete only after these gates pass on the final merge.
