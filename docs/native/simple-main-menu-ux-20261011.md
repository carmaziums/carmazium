# CarMazium native app — simplified main menu

Date: 2026-10-11. Draft source change, not merged or released.

## Main drawer
Ten top-level destinations shared by personal and dealer accounts:
1. Home → Home tab
2. Get Valuation → existing SellLanding registration/mileage valuation form
3. Buy Cars → Retail Listings (Search tab), Live Auctions (Live tab)
4. Sell Cars → Sell by Auction (SellCarFlow with AUCTION), Retail Listing (SellCarFlow with CLASSIFIED)
5. TradeXchange → existing Services hub (delivery/recovery, vehicle inspection, finance, warranty, job tracking and provider links)
6. Compare → Compare screen
7. Pricing → Pricing screen
8. About → About screen
9. Profile Settings → existing dedicated Account Settings screen (nine sections)
10. User Dashboard → role-appropriate Profile dashboard for buyer/seller/service or DealerHome for active dealer workspace

## UX decisions
- Only Buy and Sell expand. Tapping an expanded heading collapses it. All child choices are 48dp rows, with chevrons, accessible expanded state, labelled destinations and Android Back support.
- Remove duplicate Account Tools, Dealer Tools and More Pages navigation lists from this menu. Dealer tab bar permissions/role gates are **unchanged** and management shortcuts live on DealerProfileScreen; buyers and sellers retain their own dashboard. The same simple menu is available in both drawer layouts.
- Keep verified switch between personal/dealer views in Profile Settings → Account Type (server elevation only for previously verified users). New dealer onboarding is still possible. Sign Out is available from full Profile Settings rather than adding an eleventh primary menu item.
- Profile Settings already includes: Personal details, Business profile when permitted, Verification, Notifications & privacy, Payouts, Appearance, Security, Ratings & reviews, Account type. It also retains Support, Saved Cars, Messages and Notifications.
- No native payment, fee logic, trade role permission, public website, listing data or backend mutation changed.

## Verification
- Main menu source contract `scripts/test-native-simplified-main-menu.test.mjs`, plus pre-existing website/native menu parity and unified settings tests updated to new user-approved hierarchy.
- One Product Parity native + web + backend typechecks and source tests must pass.
- Real Samsung accessibility, Android hardware back, dealer bottom-sheet clipping and 200% font scaling remain acceptance checks before release.
- This is stacked on draft Block 10 PR #527. Do not merge, publicly release or publish an APK without explicit owner approval.

Rollback: close this separate draft PR; no DB migrations or product data changes.
