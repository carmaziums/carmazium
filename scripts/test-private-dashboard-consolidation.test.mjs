import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")

const redirects = {
    "buyer/page.tsx": "overview",
    "buyer/offers/page.tsx": "bids",
    "buyer/bids/page.tsx": "bids",
    "buyer/watchlist/page.tsx": "watchlist",
    "buyer/history/page.tsx": "purchases",
    "buyer/messages/page.tsx": "messages",
    "seller/page.tsx": "overview",
    "seller/auctions/page.tsx": "cars",
    "seller/listings/page.tsx": "cars",
    "seller/offers/page.tsx": "offers",
    "seller/earnings/page.tsx": "earnings",
    "seller/performance/page.tsx": "stats",
    "seller/messages/page.tsx": "messages",
    "seller/add-listing/page.tsx": null,
}

test("all fourteen legacy buyer and seller routes point to their canonical destination", () => {
    assert.equal(Object.keys(redirects).length, 14)
    for (const [path, tab] of Object.entries(redirects)) {
        const source = read("src/app/dashboard/" + path)
        const target = tab ? "/dashboard/user?tab=" + tab : "/sell"
        assert.ok(source.includes(target), path + " missing " + target)
        if (path !== "seller/listings/page.tsx") {
            assert.match(source, /LegacyDashboardRedirect/, path)
        }
    }
})

test("specialist old actions remain available under explicit ?legacy=1 links", () => {
    const redirect = read("src/components/dashboard/LegacyDashboardRedirect.tsx")
    const main = read("src/app/dashboard/user/page.tsx")
    const auctions = read("src/components/dashboard/MyCarsAuctionPanel.tsx")
    assert.match(redirect, /search\.get\("legacy"\) === "1"/)
    assert.match(redirect, /search\.get\("room"\)/)
    for (const url of ["buyer/offers", "buyer/bids", "seller/offers", "seller/earnings"]) {
        assert.ok(main.includes(`/dashboard/${url}?legacy=1`), url)
    }
    assert.ok(auctions.includes("/dashboard/seller/auctions?manage=1"))
})

test("web buyer and seller menus have one My cars and Purchases destination", () => {
    const sidebar = read("src/components/dashboard/DashboardSidebar.tsx")
    const page = read("src/app/dashboard/user/page.tsx")
    assert.match(sidebar, /label: "My cars"/)
    assert.match(sidebar, /label: "Purchases"/)
    assert.doesNotMatch(sidebar, /Offers & Delivery Requests|Earnings & Receipts|My Offers & Delivery|Payments & Receipts/)
    assert.match(page, /<MyCarsTab onRefreshStats=/)
    assert.match(page, /<PrivatePurchasesTab/)
    assert.match(page, /<MyCarsAuctionPanel/)
    assert.match(page, /aria-label="Filter your listing status"/)
})

test("native private dashboard groups selling and buying consistently", () => {
    const drawer = read("carmazium app/carmazium app/src/components/GlobalDrawer.tsx")
    const stack = read("carmazium app/carmazium app/src/navigation/MainStackNavigator.tsx")
    const cars = read("carmazium app/carmazium app/src/screens/account/MyCarsScreen.tsx")
    assert.match(drawer, /id: 'user-cars',\s*label: 'My cars'/)
    assert.match(drawer, /id: 'user-purchases',\s*label: 'Purchases'/)
    assert.doesNotMatch(drawer, /id: 'user-auctions',/)
    assert.match(stack, /name="MyCars" component=\{MyCarsScreen\}/)
    assert.match(cars, /fetchAllMyAuctions/)
    assert.match(cars, /fetchAllMyListings/)
    assert.match(cars, /Filter/)
    assert.match(cars, /navigate\(channel === 'Listings' \? 'SellerListings' : 'SellerAuctions'\)/)
    const buyerPurchases = read("carmazium app/carmazium app/src/screens/buyer/BuyerPurchaseHistoryScreen.tsx")
    assert.match(buyerPurchases, /AGREED RETAIL PURCHASES/)
    assert.match(buyerPurchases, /o\.status === 'ACCEPTED'/)
    assert.match(buyerPurchases, /PAID PLATFORM TRANSACTIONS/)
    assert.match(buyerPurchases, /PLATFORM RECEIPTS/)
})

test("status filters use full private inventory instead of only one API page", () => {
    const view = read("src/app/dashboard/user/page.tsx")
    const full = read("src/lib/privateCarsListings.ts")
    assert.match(view, /getCompletePrivateListings\(\)/)
    assert.match(view, /matchingListings\.slice\(\(page - 1\) \* 10, page \* 10\)/)
    assert.match(view, /setStatusFilter\(value\); setPage\(1\)/)
    assert.match(full, /for \(let page = 1; page <= maxPages; page\+\+\)/)
    assert.match(full, /found\.size !== total/)
})

test("private purchases do not confuse agreed offers with recorded funds or platform fees", () => {
    const purchases = read("src/components/dashboard/PrivatePurchasesTab.tsx")
    assert.match(purchases, /o\.status === "ACCEPTED"/)
    assert.match(purchases, /Vehicle sale proceeds go directly to the seller/)
    assert.match(purchases, /A platform fee receipt is not evidence/)
})
