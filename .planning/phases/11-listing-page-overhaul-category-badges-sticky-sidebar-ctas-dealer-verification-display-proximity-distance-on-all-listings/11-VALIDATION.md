---
phase: 11
slug: listing-page-overhaul-category-badges-sticky-sidebar-ctas-dealer-verification-display-proximity-distance-on-all-listings
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | tsc --noEmit (TypeScript) + manual browser checks (UI/UX) |
| **Config file** | tsconfig.json |
| **Quick run command** | `cd d:/carmazium && npx tsc --noEmit` |
| **Full suite command** | `cd d:/carmazium && npx tsc --noEmit && cd backend && npx jest --passWithNoTests` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 11-01-01 | vehicleLabels + LocationContext | 1 | Shared label maps, location context | tsc | `npx tsc --noEmit` | ⬜ pending |
| 11-01-02 | backend listingCount field | 1 | listingCount on seller in API response | manual | Inspect API response JSON | ⬜ pending |
| 11-02-01 | Category badge eyebrow | 2 | bodyType+fuelType+Auction pills above H1 | manual | Open any listing detail | ⬜ pending |
| 11-02-02 | Sidebar CTAs | 2 | Save/Share/Compare buttons in sidebar | manual | Click each button, verify behaviour | ⬜ pending |
| 11-02-03 | Mobile sticky bottom bar | 2 | Fixed bar with Offer+Enquire on mobile | manual | Resize to mobile, scroll page | ⬜ pending |
| 11-02-04 | Dealer trust panel | 2 | KYC badge + name + listing count in sidebar | manual | View a dealer listing sidebar | ⬜ pending |
| 11-03-01 | Distance on CarCard | 3 | ~X mi chip on cards when location known | manual | Grant geolocation, browse cards | ⬜ pending |
| 11-03-02 | Distance on detail sidebar | 3 | X miles away next to MapPin | manual | View listing detail with location active | ⬜ pending |
| 11-03-03 | Distance filter chips on search | 3 | 10/25/50/100/200 mi preset chips filter results | manual | Apply distance chip, verify result count drops | ⬜ pending |
| 11-03-04 | Seller profile page KYC badge | 3 | Verified badge + listing count on /seller/:id | manual | Visit a dealer profile page | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- `src/lib/vehicleLabels.ts` — extract BODY_TYPE_LABELS + FUEL_TYPE_LABELS from CarCard into a shared module
- `src/context/LocationContext.tsx` — new file; export LocationProvider + useLocation hook

*These are new files Wave 1 must create before detail-page and CarCard tasks can reference them.*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Category badge eyebrow placement | React/CSS layout | Open a listing, verify pills appear above the H1 title |
| Sidebar Save toggle state | API round-trip + UI state | Click Save, reload page, verify heart icon stays filled |
| Compare → navigate to /compare | Context + routing | Click Compare, verify navigation to compare page with car added |
| Share button invokes Web Share / copies URL | Browser API | Click Share, verify share sheet or clipboard copy |
| Geolocation prompt triggers | Browser permission API | Visit buy-cars, allow/deny location, verify distance shows/hides |
| Postcode fallback input | UI interaction | Deny geolocation, enter postcode, verify distance updates |
| Distance filter sorts closest first | UI + sort logic | Apply 50mi filter, verify sorted order |
| Mobile sticky bar | Responsive CSS | Resize to <1024px, scroll down, verify bar stays fixed at bottom |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 25s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
