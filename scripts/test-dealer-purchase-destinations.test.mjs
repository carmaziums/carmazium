import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

// Dealer mobile UX spec, items 1 and 2:
//  - an Auction Wins card opens that vehicle's purchase record, which carries
//    the full advert evidence but never seller contact before the fee gate;
//  - Auction Wins, All Purchases and Purchase History are three separate
//    destinations on web and app, and All Purchases no longer lands on a page
//    titled Purchase History.

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const APP = "carmazium app/carmazium app/src/"

function load(path, modules = {}) {
    const compiled = ts.transpileModule(read(path), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        reportDiagnostics: true,
    })
    assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
    const exports = {}
    const require = name => {
        if (name in modules) return modules[name]
        if (name === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) })
        throw new Error("Unexpected import " + name)
    }
    runInNewContext(compiled.outputText, { exports, require }, { filename: path })
    return exports
}

const dest = load("src/lib/purchaseDestinations.ts")
const { getDealerRoute } = load("src/config/dealerRouteConfig.ts")

test("three distinct purchase destinations, each with its own page", () => {
    const hrefs = Array.from(dest.PURCHASE_DESTINATIONS, d => d.href)
    assert.deepEqual(Array.from(dest.PURCHASE_DESTINATIONS, d => d.label), ["Auction Wins", "All Purchases", "Purchase History"])
    assert.equal(new Set(hrefs).size, 3)
    assert.ok(existsSync(new URL("../src/app/dashboard/dealer/auctions/won/page.tsx", import.meta.url)))
    assert.ok(existsSync(new URL("../src/app/dashboard/dealer/purchases/page.tsx", import.meta.url)))
    assert.ok(existsSync(new URL("../src/app/dashboard/dealer/purchases/history/page.tsx", import.meta.url)))
    assert.match(read("src/app/dashboard/dealer/purchases/page.tsx"), /<DealerPurchasesView mode="all" \/>/)
    assert.match(read("src/app/dashboard/dealer/purchases/history/page.tsx"), /<DealerPurchasesView mode="history" \/>/)
})

test("All Purchases is titled All Purchases, not Purchase History", () => {
    assert.equal(getDealerRoute("/dashboard/dealer/purchases").title, "All Purchases")
    assert.equal(getDealerRoute("/dashboard/dealer/purchases/history").title, "Purchase History")
    assert.equal(getDealerRoute("/dashboard/dealer/purchases/history").requiredPermission, "VIEW_PURCHASES")
    const view = read("src/components/dealer/DealerPurchasesView.tsx")
    assert.match(view, /title=\{isHistory \? "Purchase History" : "All Purchases"\}/)
    // No redirect from one destination to the other.
    assert.doesNotMatch(read("src/app/dashboard/dealer/purchases/page.tsx"), /redirect|router\.replace/)
})

test("the destination bar is on all three pages and never scrolls sideways", () => {
    const bar = read("src/components/dealer/PurchaseDestinations.tsx")
    assert.match(bar, /grid grid-cols-3/)
    assert.doesNotMatch(bar, /overflow-x-auto/)
    assert.match(bar, /aria-current="page"/)
    assert.match(bar, /min-h-\[56px\]/)
    assert.match(read("src/app/dashboard/dealer/auctions/won/page.tsx"), /<PurchaseDestinations active="wins" \/>/)
    assert.match(read("src/components/dealer/DealerPurchasesView.tsx"), /<PurchaseDestinations active=\{isHistory \? "history" : "all"\} \/>/)
})

test("Purchase History keeps finished stages only; it never changes a status", () => {
    for (const s of ["sold", "checks_complete", "delivery_requested"]) assert.ok(dest.isPurchaseHistoryStatus(s), s)
    for (const s of ["awaiting_confirmation", "sale_confirmed", "reviewing_docs"]) assert.ok(!dest.isPurchaseHistoryStatus(s), s)
    const view = read("src/components/dealer/DealerPurchasesView.tsx")
    // The status mapping (and the pending-vs-recorded rule) is unchanged.
    assert.match(view, /item\.status === "AWAITING_CONFIRMATION" && item\.retailSold/)
    assert.match(view, /isHistory && !isPurchaseHistoryStatus\(p\.status\)/)
})

test("cancelled sales in history are approved, buyer-side requests only", () => {
    const rows = [
        { id: "a", status: "APPROVED", buyerId: "me" },
        { id: "b", status: "APPROVED", buyerId: "someone-else" },
        { id: "c", status: "PENDING_ADMIN", buyerId: "me" },
        { id: "d", status: "REJECTED", buyerId: "me" },
        { id: "e", status: "WITHDRAWN", buyerId: "me" },
    ]
    assert.deepEqual(Array.from(dest.buyerCancelledSales(rows, "me"), r => r.id), ["a"])
    assert.equal(dest.buyerCancelledSales(rows, undefined).length, 0)
    // Staff: the server's viewer.isBuyer (resolved to the dealership) wins
    // over comparing with the signed-in staff member's own id.
    const staffRows = [
        { id: "s1", status: "APPROVED", buyerId: "owner", viewer: { isBuyer: true } },
        { id: "s2", status: "APPROVED", buyerId: "owner", viewer: { isBuyer: false } },
        { id: "s3", status: "APPROVED", buyerId: "owner" },
    ]
    assert.deepEqual(Array.from(dest.buyerCancelledSales(staffRows, "owner"), r => r.id), ["s1", "s3"])
    assert.deepEqual(Array.from(dest.buyerCancelledSales(staffRows, "staff-member"), r => r.id), ["s1"])
    const view = read("src/components/dealer/DealerPurchasesView.tsx")
    assert.match(view, /const dealershipBuyerId = access\?\.ownerUserId \?\? user\?\.id/)
    assert.match(view, /buyerCancelledSales\(cancelled, dealershipBuyerId\)/)
    assert.match(view, /getMySaleCancellations\("purchase-history"\)/)
    const svc = read("backend/src/sale-cancellations/sale-cancellations.service.ts")
    assert.match(svc, /isBuyer: row\.buyerId === canonicalId/)
    assert.match(svc, /\{ buyerId: canonicalId, status: 'APPROVED' as any \}/)
})

test("search matches vehicle, registration with or without spaces, seller and reference", () => {
    const item = { id: "sale-123", vehicleTitle: "Volvo XC60 2017", vehicleSubtitle: "EX17 ABC · 84,000 miles", sellerName: "Smith Motors" }
    for (const q of ["", "volvo", "ex17abc", "EX17 ABC", "smith", "sale-123"]) assert.ok(dest.matchesPurchaseSearch(item, q), q)
    assert.ok(!dest.matchesPurchaseSearch(item, "ford"))
})

test("All Purchases has search and a Status dropdown; agreed retail deals stay out of history", () => {
    const view = read("src/components/dealer/DealerPurchasesView.tsx")
    assert.match(view, /type="search"/)
    assert.match(view, /<select[\s\S]*?value=\{statusFilter\}/)
    assert.match(view, /Sale Pending \(retail offer\)/)
    assert.match(view, /const shownPendingRetail = isHistory/)
    // Existing actions remain.
    for (const action of ["onViewSummary={openPurchaseDetail}", "onViewSeller={openSellerDetails}", "onRequestCancellation={setCancelItem}", 'href="/dashboard/cancellations"', "Refresh purchases"]) {
        assert.ok(view.includes(action), action)
    }
})

test("an Auction Wins card links to that vehicle's purchase record on web", () => {
    const won = read("src/app/dashboard/dealer/auctions/won/page.tsx")
    assert.match(won, /recordHref=\{purchaseId \? `\/dashboard\/dealer\/purchases\/\$\{encodeURIComponent\(purchaseId\)\}` : undefined\}/)
    // The whole card opens the record (stretched link); actions sit above it.
    assert.match(won, /after:absolute after:inset-0/)
    assert.match(won, /relative z-10 flex md:flex-col/)
    assert.match(won, /relative z-10 flex flex-wrap items-center gap-x-3/)
    // Every win is looked up, in batches of 50, not just the first 50.
    assert.doesNotMatch(won, /\.slice\(0, 50\)/)
    assert.match(won, /for \(let i = 0; i < ids\.length; i \+= 50\) batches\.push/)
    assert.match(won, /purchaseId=\{purchaseByListing\[a\.listingId\]\}/)
})

test("purchase record shows every photo, the advert and declared damage, labelled honestly", () => {
    const record = read("src/components/dealer/PurchaseVehicleRecord.tsx")
    assert.match(record, /ImageLightbox/)
    assert.match(record, /record\.images/)
    assert.match(record, /record\.damage/)
    assert.match(record, /PURCHASE_SNAPSHOT/)
    // Declared damage can be inspected on the same 3D model and pins as the advert.
    assert.match(record, /buildBuyerDamagePins\(record\.damage/)
    assert.match(record, /<ThreeDVehicleViewer[\s\S]*?damagePins=\{damagePins\}/)
    assert.match(record, /ThreeDErrorBoundary/)
    // Without a purchase-time snapshot the page must say it is the current advert.
    assert.match(record, /The seller may have changed it since you bought the vehicle/)
    assert.match(read("src/app/dashboard/dealer/purchases/[id]/page.tsx"), /<PurchaseVehicleRecord record=\{purchase\.listingRecord\}/)
    // The record never carries seller contact; that stays on the fee-gated seller page.
    for (const key of ["sellerEmail", "sellerPhone", "sellerAddress"]) assert.ok(!record.includes(key), key)
})

test("app parity: same destinations, wins card opens the record, history and search", () => {
    const appBar = read(APP + "components/dealer/PurchaseDestinations.tsx")
    for (const label of ["Auction Wins", "All Purchases", "Purchase History"]) assert.ok(appBar.includes(`label: '${label}'`), label)
    assert.doesNotMatch(appBar, /<ScrollView|horizontal\b(?! strip)/)
    const screen = read(APP + "screens/main/DealerPurchasesScreen.tsx")
    assert.match(screen, /const isHistory = route\.params\?\.view === 'history'/)
    assert.match(screen, /HISTORY_STATUSES: PurchaseStatus\[\] = \['SOLD', 'CHECKS_COMPLETE', 'DELIVERY_REQUESTED'\]/)
    assert.match(screen, /const dealershipBuyerId = access\?\.ownerUserId \?\? userId/)
    assert.match(screen, /c\.viewer\.isBuyer/)
    assert.match(screen, /getMySaleCancellations\('purchase-history'\)/)
    assert.match(screen, /loadAllPurchasePages\(\)/)
    assert.match(screen, /<TextInput/)
    assert.match(screen, /flexWrap: 'wrap'/)
    assert.match(screen, /navigation\.navigate\('DealerPurchaseDetail', \{ saleId: item\.id \}\)/)
    assert.match(read(APP + "navigation/MainStackNavigator.tsx"), /DealerPurchases: \{ view\?: 'all' \| 'history' \} \| undefined/)
    const wins = read(APP + "screens/seller/SellerAuctionsScreen.tsx")
    assert.match(wins, /onPress=\{\(\) => purchaseId\s*\? navigation\?\.navigate\('DealerPurchaseDetail', \{ saleId: purchaseId \}\)\s*: handleTap\(item as any\)\}/)
    assert.match(wins, /View advert/)
    assert.match(wins, /activeTab === 'WON' && canViewPurchases && \(\s*<PurchaseDestinations/)
    const detail = read(APP + "screens/main/DealerPurchaseDetailScreen.tsx")
    assert.match(detail, /ImageLightbox/)
    assert.match(detail, /listingRecord/)
    assert.match(detail, /<BuyerDamageViewer records=\{r\.damage\}/)
})

test("purchase views load every page, not only the first 100", async () => {
    const result = await dest.loadAllPages(async page => ({ data: [page], pagination: { totalPages: 3 } }))
    assert.deepEqual(Array.from(result.data), [1, 2, 3])
    assert.equal(result.truncated, false)
    const capped = await dest.loadAllPages(async page => ({ data: [page], pagination: { totalPages: 99 } }))
    assert.equal(capped.data.length, dest.PURCHASE_MAX_PAGES)
    assert.equal(capped.truncated, true)
    const view = read("src/components/dealer/DealerPurchasesView.tsx")
    assert.match(view, /loadAllPages\(page => apiClient/)
    assert.doesNotMatch(view, /\/dealers\/purchases\?limit=100"/)
})

test("Auction Wins does not repeat the purchase destinations in the Buy & Bid tabs", () => {
    const tabs = read("src/components/dealer/BuyAndBidTabs.tsx")
    assert.match(tabs, /label: "Purchases", icon: Trophy, permission: "VIEW_PURCHASES"/)
    assert.match(tabs, /activePaths: \["\/dashboard\/dealer\/purchases", "\/dashboard\/dealer\/purchases\/history"\]/)
    for (const label of ["Auction Wins", "All Purchases", "Purchase History"]) assert.ok(!tabs.includes(`label: "${label}"`), label)
})
