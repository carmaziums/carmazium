# MaziuM knowledge review — Android parity PR #969

Date: 2026-11-21. This is a narrow, human-readable review of the dashboard and listing-entry workflow changes before updating the knowledge-source fingerprint manifest.

## Reviewed source changes

1. `carmazium app/carmazium app/src/components/DashboardCards.tsx`: The existing dashboard cards remain permission-filtered and independently customisable by account/device. Replacing literal colours and font sizes with equivalent design tokens does **not** change what cards users may access. Dealer Add Vehicle now leads to `DealerListingMethod` before starting a new listing; editing an existing vehicle remains direct.
2. `carmazium app/carmazium app/src/navigation/TabNavigator.tsx`: The personal account dashboard uses four role-specific shortcuts. Seller: Home, My cars, Offers Received, Messages. Buyer: Home, My Offers, Purchases, Messages. Public marketplace navigation remains available away from the personal dashboard. Role permissions are not granted by a tab being displayed.
3. `carmazium app/carmazium app/src/screens/main/DealerProfileScreen.tsx`: The dealer dashboard uses the new explicit Auction/Retail listing-choice route; the existing `MANAGE_INVENTORY` permission is unchanged. The dealership-services setup notice and unsold-auction recommendation are informational; neither starts a paid listing, places a bid or finalises a sale. Typography tokens retain equivalent sizes.

## Guidance updated

The `dashboard-customisation` knowledge topic now describes the role-specific bottom shortcuts, without claiming cross-device layout synchronisation. The `create-new-listing` topic now distinguishes the website entry path from the Android Auction/Retail selector and preserves direct editing for existing stock.

No changed source in this review alters:
- Auction listing fee (free), the £125 auction buyer fee, the £100 qualifying seller incentive, or retail listing pricing.
- Permissions to bid, dealership KYC/verification, sale completion, handover or payment confirmation.
- The fact that customer funds are paid directly to the seller rather than held by CarMazium.

## Fingerprint review scope

Only the three source fingerprints listed above were refreshed in `backend/evaluations/mazium-knowledge-sources.json`. The update script checked *all* knowledge-source hashes, with Windows line endings normalised to repository LF, and refused unreviewed changes. The review did not bulk-reset unrelated source fingerprints or treat hashes as proof of functional UI parity.

## Release status

This is a knowledge-consistency fix for the draft production-app PR #969, not an Android release approval. Installed production build 121 and website APK build 111 remain unchanged. Signed install-over-update, account/device verification and remaining feature gaps continue to block a 100% certification.
