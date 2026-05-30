---
phase: 2
slug: buyer-seller-and-dealer-role-dashboards
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (via Expo/React Native — `jest-expo`) |
| **Config file** | `mobile/package.json` (jest config) |
| **Quick run command** | `cd mobile && npx tsc --noEmit` |
| **Full suite command** | `cd mobile && npx tsc --noEmit && npx jest --passWithNoTests` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd mobile && npx tsc --noEmit`
- **After every plan wave:** Run `cd mobile && npx tsc --noEmit && npx jest --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | BUYER-01 | type-check | `cd mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | BUYER-02 | type-check | `cd mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | BUYER-03 | type-check | `cd mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | BUYER-04 | type-check | `cd mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | SELL-DASH-01 | type-check | `cd mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | SELL-DASH-02 | type-check | `cd mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 2 | SELL-DASH-03 | type-check | `cd mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 2-02-04 | 02 | 2 | SELL-DASH-04 | manual | — | ✅ | ⬜ pending |
| 2-03-01 | 03 | 2 | DEALER-01 | type-check | `cd mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 2 | DEALER-02 | type-check | `cd mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 2-03-03 | 03 | 2 | DEALER-03 | manual | — | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. TypeScript compilation validates all new screen files and component props at build time.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Seller can Accept/Decline/Counter an offer and status updates in list | SELL-DASH-04 | Requires live Supabase backend and real offer in DB | 1. Log in as seller 2. Navigate to seller dashboard 3. Tap an offer 4. Tap Accept/Decline/Counter 5. Verify list updates |
| Each role sees only their dashboard (no cross-role tiles) | DEALER-03 | Requires multiple test accounts with different roles in Supabase | 1. Log in as buyer — confirm no dealer/seller tiles 2. Log in as seller — confirm no buyer/dealer tiles 3. Log in as dealer — confirm no buyer/seller tiles |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
