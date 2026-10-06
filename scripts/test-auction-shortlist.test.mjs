import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const dashboard = read("src/app/dashboard/dealer/auctions/page.tsx")
const shortlist = read("src/app/dashboard/dealer/auctions/shortlisted/page.tsx")
const browse = read("src/app/auctions/browse/page.tsx")
const detail = read("src/app/auctions/live/[id]/page.tsx")
const service = read("backend/src/watchlist/watchlist.service.ts")
const controller = read("backend/src/watchlist/watchlist.controller.ts")
const button = read("src/components/features/WishlistButton.tsx")
const shortlistApi = read("src/lib/auctionShortlistApi.ts")

test("dealer dashboard links to the saved auction tab", () => {
    assert.match(dashboard, /href="\/dashboard\/dealer\/auctions\/shortlisted"/)
    assert.match(shortlist, /aria-current="page"/)
})

test("live browsing and the auction room offer explicit shortlist controls", () => {
    assert.match(browse, /variant="shortlist"/)
    assert.match(detail, /variant="shortlist"/)
    assert.match(button, /Shortlist for later bidding/)
})

test("auction shortlist uses explicit verified-dealer endpoints, never generic retail mutations", () => {
    assert.match(button, /isShortlist[\s\S]*addAuctionToShortlist\(listingId\)/)
    assert.match(button, /isShortlist[\s\S]*removeAuctionFromShortlist\(listingId\)/)
    assert.match(button, /isAuctionShortlisted\(listingId\)/)
    assert.match(shortlistApi, /\/watchlist\/auctions\/check\//)
    assert.match(shortlistApi, /\/watchlist\/auctions\/"/)
    assert.match(controller, /@Get\('auctions\/check\/:listingId'\)[\s\S]*@UseGuards\(SessionAuthGuard, VerifiedDealerGuard\)/)
    assert.match(controller, /@Post\('auctions\/:listingId'\)[\s\S]*@UseGuards\(SessionAuthGuard, VerifiedDealerGuard\)/)
    assert.match(controller, /@Delete\('auctions\/:listingId'\)[\s\S]*@UseGuards\(SessionAuthGuard, VerifiedDealerGuard\)/)
    assert.match(service, /type: ListingType\.CLASSIFIED/)
    assert.match(service, /type: ListingType\.AUCTION/)
})

test("live saved auctions are filtered by authoritative deadline and publication status", () => {
    assert.match(service, /endTime:\s*\{ gt: now \}/)
    assert.match(service, /status: 'ACTIVE' as const/)
    assert.match(shortlist, /new Date\(a.endTime\).getTime\(\) > now/)
    assert.match(shortlist, /live \? "Open Auction to Bid" : "View Auction"/)
})

test("ended saved vehicles stay removable and never show an active bid CTA", () => {
    assert.match(shortlist, /All Saved/)
    assert.match(shortlist, /removeAuctionFromShortlist\(listingId\)/)
    assert.match(shortlist, /ENDED \/ UNAVAILABLE/)
})

test("responsive page includes accessible save and expiry controls", () => {
    assert.match(shortlist, /grid-cols-1 xl:grid-cols-2/)
    assert.match(shortlist, /aria-label=\{"Remove "/)
    assert.match(shortlist, /Refresh shortlisted auctions/)
})
