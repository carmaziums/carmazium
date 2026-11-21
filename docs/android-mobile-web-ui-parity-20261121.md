# Android / mobile website UI parity – 21 November 2026

## Requirement
The website mobile presentation is the canonical design for Android. Reproduce the same interface, layout, cards, labels, navigation, settings, and workflows using native screens. Do not redirect users into website pages or install a different test application. Preserve existing Android app data and the original production signing certificate.

## Evidence and baseline
- The user supplied nine screenshots: mobile website (admin, personal and dealer dashboards, menus, profile settings) and Android/BlueStacks (settings, partner services and personal card grid).
- BlueStacks has the production package uk.carmazium.app with Android versionCode 124 and versionName 1.0.1, updated 2026-11-21 21:26.
- Its current screen is the partner electronic-signature form. This audit did not accept declarations or sign a legal agreement.
- The website and emulator screenshots do not all show the same signed-in account. Verification/review/status differences require same-account verification before they are called bugs.

## Confirmed visual and structural differences
| Surface | Website reference | Installed Android difference |
| --- | --- | --- |
| Account settings | Top actions, partner agreement, visible profile photo, account/service badges and reviews, then section categories | App-only shortcuts previously appeared before profile and sections; partner agreement not in first fold |
| Account menu | Legible email and compact actions | Truncated email and excessive line wrapping |
| Dealer dashboard | Command centre, attention card, customisable cards | Different spacing, surrounding content and card framing |
| Buyer/seller dashboard | Coloured dashboard grid and role-appropriate bottom tabs | Different card and navigation treatment |
| Partner services | Website role navigation and service overview | Different native partner page design and approval cards |
| Guided tour | Replay website tour visible in settings | Replay reportedly missing from installed Android build; native source contains a control, so binary verification is necessary |
| Admin navigation | Website top/profile menus and mobile tabs | Native navigation presentation differs |

## Changes on this isolated code branch
1. Native settings now begin with back-to-dashboard, the website heading/subheading, Business Partner Agreement link for partners, tour replay and public-profile actions, profile photo, name and email, real profile API service badges and rating, and then category buttons.
2. Kept supplemental native shortcuts but moved them below the website-matching settings content; they stack vertically on narrow phones so Notifications does not split across words.
3. Increased account dropdown width responsively to keep longer email addresses legible.
4. Added a direct contract test verifying the 17 personal and 21 dealer website card IDs, labels, order, groups, icons and permission requirements against the native menus. All destinations remain native.
5. Added account-settings tests for partner badges, review data, website information hierarchy, agreement link, and back-to-dashboard navigation.

## Not yet certified; release blockers
DO NOT claim 100% parity or replace the public APK download based solely on source tests.

- Dealer signup, business verification, partner agreement, app tour, account persistence, services enrolment and insurance uploads.
- Buyer/seller signup, dashboards, listings, offers, guest enquiries, stock, saved cars, auctions, purchases, messages and payments.
- Admin dashboard/navigation and all admin pages.
- Top menus, bottom tabs, nested back navigation, permission gates, deep links, all light and dark views, responsive widths and font scaling.
- Listing photos, cover selection, fullscreen gallery, photo counter, native-page destination completeness, finance and warranty.
- Same-account visual screenshot baselines for every accessible route, comparing mobile website with native in equivalent dimensions and data.
- An in-place signed APK release with the *original* signing certificate, incremented versionCode, app data preserved, and live self-update checked.

## Safety
Work remains isolated from the live website download and installed build 124. No production legal signature, KYC approval, funds or account changes made in the audit.
