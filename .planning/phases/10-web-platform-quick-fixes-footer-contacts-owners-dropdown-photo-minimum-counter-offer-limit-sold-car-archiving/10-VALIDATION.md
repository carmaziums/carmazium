---
phase: 10
slug: web-platform-quick-fixes-footer-contacts-owners-dropdown-photo-minimum-counter-offer-limit-sold-car-archiving
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-20
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest (backend) + manual browser checks (frontend) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern=offers\|listings --passWithNoTests` |
| **Full suite command** | `cd backend && npx jest --passWithNoTests` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --testPathPattern=offers\|listings --passWithNoTests`
- **After every plan wave:** Run `cd backend && npx jest --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 10-01-01 | DB migration | 1 | Owners+DepartedSale+CounterAttempts columns | manual SQL | Check Supabase schema via `prisma db pull` | ⬜ pending |
| 10-01-02 | Owners dropdown DTO | 1 | owners enum validation | unit | `npx jest listings.service` | ⬜ pending |
| 10-01-03 | Counter attempt logic | 1 | counterAttemptsBuyer/Seller increment | unit | `npx jest offers.service` | ⬜ pending |
| 10-01-04 | Photo min backend | 1 | < 10 images rejected on publish | unit | `npx jest listings.service` | ⬜ pending |
| 10-02-01 | Owners frontend dropdown | 2 | 5 options rendered, required validation | manual | Open listing wizard, verify dropdown | ⬜ pending |
| 10-02-02 | Departed Sale checkbox | 2 | Checkbox shows/hides relationship field | manual | Check wizard conditional field | ⬜ pending |
| 10-02-03 | Photo counter UX | 2 | 6/10 counter, disabled publish, progress bar | manual | Upload < 10 photos, verify button disabled | ⬜ pending |
| 10-02-04 | Counter-offer remaining count | 2 | Remaining count shown in offer thread | manual | Make 2 counters, verify "3 remaining" | ⬜ pending |
| 10-02-05 | Counter lock state UI | 2 | Banner + greyed input + 48h countdown | manual | Exhaust counters, verify locked state | ⬜ pending |
| 10-03-01 | Sold badge in inventory | 3 | SOLD listings appear with badge | manual | Mark listing sold, check inventory | ⬜ pending |
| 10-03-02 | Relist action | 3 | Seller can reactivate SOLD listing | manual | Click Relist, verify status change | ⬜ pending |
| 10-03-03 | SOLD overlay on detail page | 3 | SOLD overlay shown, not in search | manual | Visit sold listing URL directly | ⬜ pending |
| 10-03-04 | SOLD at bottom of search | 3 | SOLD listings appear at bottom of results | manual | Search, verify SOLD cards at bottom | ⬜ pending |
| 10-03-05 | Analytics include SOLD | 3 | Income/transaction counts include SOLD | manual | Check admin analytics after marking sold | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing Jest infrastructure covers backend unit tests — no new setup needed
- Frontend checks are manual browser verification only

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Owners dropdown in listing wizard | React component, no unit test | Open /dashboard/user or /dashboard/dealer, create listing, verify 5 dropdown options including 5+ |
| Departed Sale conditional field | React state, no unit test | Check "Departed Sale", verify relationship text field appears |
| Photo count progress bar | React UI, no unit test | Upload 6 photos, verify disabled button shows "6/10 photos" |
| Counter remaining count in thread | Socket + UI, no unit test | Place offer, counter 2x, verify "3 counter-offers remaining" visible |
| 48h countdown on locked thread | Time-based UI | Exhaust buyer/seller counters, verify countdown timer appears |
| SOLD badge on listing card | CSS visual | Mark listing as sold, visit buy-cars search, verify SOLD badge at bottom |
| Deceased Estate badge on detail page | React conditional render | Publish listing with isDepartedSale=true, verify "Deceased Estate" badge visible to buyers |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
