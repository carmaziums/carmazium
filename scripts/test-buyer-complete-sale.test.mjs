import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// Owner rule: either the seller or the buyer can complete an accepted retail
// sale, so it is never stuck at Sale Pending when a seller abandons the
// account. Web and app show the buyer's action only while OFFER_ACCEPTED.

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const APP = "carmazium app/carmazium app/src/"

test("backend: buyer endpoint reuses the guarded completion at the accepted price", () => {
    const controller = read("backend/src/listings/listings.controller.ts")
    const service = read("backend/src/listings/listings.service.ts")
    assert.match(controller, /@Post\(':id\/complete-purchase'\)/)
    assert.match(service, /async completeRetailSaleAsBuyer\(id: string, userId: string\)/)
    assert.match(service, /listing\.status !== 'OFFER_ACCEPTED'/)
    assert.match(service, /assertDealerPermission\(actor, 'MANAGE_OFFERS'/)
    assert.match(service, /this\.completeRetailSale\(listing, userId, \{ soldPrice: 0 \}, 'BUYER'\)/)
    assert.match(service, /type: 'SALE_COMPLETED_BY_BUYER'/)
    // The seller path is unchanged: management check, then the same completion.
    assert.match(service, /'You do not have permission to mark this listing as sold',\s*\);\s*return this\.completeRetailSale\(listing, userId, dto\);/)
    // A buyer completion never records the buyer as the seller.
    assert.match(service, /listing\.sellerId \|\| \(completedBy === 'SELLER' \? userId : null\)/)
})

test("web: buyer can complete from dealer purchases, private purchases and offers", () => {
    const button = read("src/components/purchases/CompletePurchaseButton.tsx")
    assert.match(button, /completePurchaseAsBuyer\(listingId\)/)
    assert.match(button, /Only confirm once you have paid the seller/)
    assert.match(read("src/lib/listingApi.ts"), /\/complete-purchase`, \{ method: 'POST' \}/)
    assert.match(read("src/components/dealer/PendingRetailPurchaseRow.tsx"), /<CompletePurchaseButton listingId=\{offer\.listingId\} onCompleted=\{onCompleted\}/)
    assert.match(read("src/components/dealer/DealerPurchasesView.tsx"), /<PendingRetailPurchaseRow key=\{offer\.id\} offer=\{offer\} onCompleted=/)
    assert.match(read("src/components/dashboard/PrivatePurchasesTab.tsx"), /offer\.listing\?\.status === "OFFER_ACCEPTED"[\s\S]{0,600}<CompletePurchaseButton/)
    // /dashboard/buyer/offers redirects to the unified My Offers tab, which is
    // where buyers actually land, so the action must be there (mobile + desktop rows).
    const unified = read("src/app/dashboard/user/page.tsx")
    assert.equal((unified.match(/offer\.listing\.status === 'OFFER_ACCEPTED' && \(\s*(?:\/\/[^\n]*\n\s*)?<CompletePurchaseButton/g) || []).length, 2)
    assert.match(read("src/app/dashboard/buyer/offers/page.tsx"), /listing\.status === 'OFFER_ACCEPTED' && \([\s\S]{0,240}<CompletePurchaseButton/)
})

test("app parity: same action and confirmation on buyer and dealer offer screens", () => {
    const button = read(APP + "components/purchases/CompletePurchaseButton.tsx")
    assert.match(button, /\/complete-purchase`, \{ method: 'POST' \}/)
    assert.match(button, /Only confirm once you have paid the seller/)
    for (const screen of ["screens/buyer/BuyerOffersScreen.tsx", "screens/main/DealerMyOffersScreen.tsx"]) {
        const src = read(APP + screen)
        assert.match(src, /offer\.listing\?\.status === 'OFFER_ACCEPTED'[\s\S]{0,120}<CompletePurchaseButton/, screen)
        assert.match(src, /either of you can complete the sale/, screen)
    }
})

test("app parity: All Purchases shows Sale Pending retail deals like web, with completion", () => {
    const src = read(APP + "screens/main/DealerPurchasesScreen.tsx")
    // Same rule as web pendingRetailPurchases(): accepted offer, listing still
    // OFFER_ACCEPTED, no recorded Sale for it, one row per listing.
    assert.match(src, /o\.status === 'ACCEPTED' && o\.listing\?\.status === 'OFFER_ACCEPTED' && !recordedListingIds\.has\(o\.listingId\)/)
    assert.match(src, /'\/offers\/my'/)
    assert.match(src, /<CompletePurchaseButton listingId=\{o\.listingId\}/)
    // Current work only: never in Purchase History.
    assert.match(src, /isHistory\s*\?\s*Promise\.resolve\(\[\] as PendingRetailOffer\[\]\)/)
})

test("web: buyer dashboard vehicle links use the live /buy-cars route", () => {
    for (const page of ["src/app/dashboard/buyer/bids/page.tsx", "src/app/dashboard/buyer/page.tsx"]) {
        assert.doesNotMatch(read(page), /href=\{`\/cars\//, page)
    }
})

test("web: a failed payout status check is shown, not treated as not connected", () => {
    const src = read("src/app/dashboard/user/page.tsx")
    assert.doesNotMatch(src, /getStripeConnectStatus\(\)\.then\(setConnectStatus\)\.catch\(\(\) => \{\}\)/)
    assert.match(src, /We couldn't check your payout status/)
})
