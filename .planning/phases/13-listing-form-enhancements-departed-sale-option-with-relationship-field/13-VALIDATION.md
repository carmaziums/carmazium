---
phase: 13
slug: listing-form-enhancements-departed-sale-option-with-relationship-field
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No web test framework at project root — UI-only phase; TypeScript type-check serves as automated gate |
| **Config file** | none at web root (`npx tsc --noEmit` from project root) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

Note: All functional/visual verification for this phase is manual. TypeScript compile-check confirms type safety. Mobile Jest exists but these are visual chip additions — manual testing sufficient.

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** TypeScript must be clean + manual visual checks pass
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | FORM-01, FORM-02 | manual + tsc | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | FORM-03, FORM-04 | manual + tsc | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 13-02-01 | 02 | 2 | BADGE-01 | manual + tsc | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 13-02-02 | 02 | 2 | BADGE-02 | manual + tsc | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 13-02-03 | 02 | 2 | MOBILE-01 | manual + tsc | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

No Wave 0 needed — no new test files required. All verifications are manual (visual/functional) or covered by `tsc --noEmit`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Relationship dropdown renders 7 options | FORM-01 | CSS/UI — not unit-testable | Open listing wizard, tick departed checkbox, open dropdown, count options |
| 'Other' reveals inline freetext input | FORM-02 | Conditional UI render | Select 'Other' in dropdown, verify text input appears |
| Submit blocked when relationship empty | FORM-03 | Form flow — not unit-testable | Tick departed, leave relationship blank, try to advance wizard step |
| Inline error shown below dropdown | FORM-04 | Visual error state | Trigger validation failure, verify red border + error message |
| Estate chip on CarCard | BADGE-01 | Visual rendering | Load Buy Cars grid with a departed listing, verify grey 'Estate' chip |
| "Listed by [relationship]" on detail page | BADGE-02 | Visual rendering | Open departed listing detail page, verify text near Deceased Estate badge |
| Estate chip in mobile VehicleCard | MOBILE-01 | React Native visual | Run mobile app, navigate to listing card for departed listing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
