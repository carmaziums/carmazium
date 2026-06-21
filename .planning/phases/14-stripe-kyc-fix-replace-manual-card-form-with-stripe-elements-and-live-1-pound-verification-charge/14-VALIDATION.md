---
phase: 14
slug: stripe-kyc-fix-replace-manual-card-form-with-stripe-elements-and-live-1-pound-verification-charge
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (NestJS backend unit tests) |
| **Config file** | `backend/src/dealers/dealers.service.spec.ts` (Wave 0 gap — to be created) |
| **Quick run command** | `cd backend && npx jest dealers.service --testPathPattern dealers` |
| **Full suite command** | `cd backend && npx jest` |
| **Estimated runtime** | ~15 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest dealers.service --testPathPattern dealers`
- **After every plan wave:** Run `cd backend && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 0 | KYC-PAY-01 through KYC-PAY-05 | unit stubs | `cd backend && npx jest dealers.service --testPathPattern dealers` | ❌ Wave 0 | ⬜ pending |
| 14-02-01 | 02 | 1 | KYC-PAY-01 | unit | `cd backend && npx jest dealers.service -t "already paid"` | ❌ Wave 0 | ⬜ pending |
| 14-02-02 | 02 | 1 | KYC-PAY-02 | unit | `cd backend && npx jest dealers.service -t "existing PI"` | ❌ Wave 0 | ⬜ pending |
| 14-02-03 | 02 | 1 | KYC-PAY-03 | unit | `cd backend && npx jest dealers.service -t "PI not succeeded"` | ❌ Wave 0 | ⬜ pending |
| 14-02-04 | 02 | 1 | KYC-PAY-04 | unit | `cd backend && npx jest dealers.service -t "saves stripe fields"` | ❌ Wave 0 | ⬜ pending |
| 14-02-05 | 02 | 1 | KYC-PAY-05 | unit | `cd backend && npx jest dealers.service -t "auto approve"` | ❌ Wave 0 | ⬜ pending |
| 14-03-01 | 03 | 2 | KYC-PAY-06 | manual | n/a — Stripe test card 4000000000000002 | manual | ⬜ pending |
| 14-03-02 | 03 | 2 | KYC-PAY-07 | manual | n/a — visual UI state (already-paid green tick) | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/dealers/dealers.service.spec.ts` — stubs for KYC-PAY-01 through KYC-PAY-05
  - Mock `PrismaService`, `EmailService`, `NotificationsService` — follow pattern from `bids.service.spec.ts` (Phase 12)
  - Mock Stripe SDK (`jest.mock('stripe')`)

*All other infrastructure is covered by the existing Jest/NestJS setup in the backend.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card decline shows inline error, blocks submission | KYC-PAY-06 | Requires live Stripe test card interaction; no DOM-level unit hook available for Stripe Elements | Load KYC form step 3; enter Stripe test card `4000000000000002` (always declines); click Submit; verify inline error appears and form does not submit |
| Already-paid dealer sees green tick, no card form | KYC-PAY-07 | Visual UI state based on `alreadyPaid: true` API response; requires a seeded dealer record | Use a dealer account with `stripeChargedAt` set; open KYC form step 3; verify green tick shown, no `CardElement` rendered |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
