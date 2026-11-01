import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

// Dealer mobile UX spec, items 1 and 2:
//  - an Auction Wins card opens that vehicle's purchase record, which carries
//    the full advert evidence but never seller contact before the fee gate;
//  - Retail Purchases is a fourth web destination between Auction Wins
//    and All Purchases; existing native app destinations remain unchanged.
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


test("one canonical Purchases page keeps old auction, retail and history deep links", () => {
    const page = read("src/app/dashboard/dealer/purchases/page.tsx")
    assert.match(page, /DealerPurchasesView mode="all"/)
    assert.match(page, /params.get\("detail"\) === "wins"/)
    assert.match(page, /DealerAuctionWinsView/)
    const urls = [
        ["src/app/dashboard/dealer/auctions/won/page.tsx", "detail=wins&tab=progress&channel=auction"],
        ["src/app/dashboard/dealer/purchases/retail/page.tsx", "tab=progress&channel=retail"],
        ["src/app/dashboard/dealer/purchases/history/page.tsx", "tab=completed&channel=all"],
    ]
    for (const [file, query] of urls) {
        assert.match(read(file), /redirect\(/)
        assert.ok(read(file).includes("/dashboard/dealer/purchases?" + query), file)
    }
    assert.equal(getDealerRoute("/dashboard/dealer/purchases").requiredPermission, "VIEW_PURCHASES")
})

test("Purchases has a clear canonical title, but historical route permissions remain", () => {
    assert.equal(getDealerRoute("/dashboard/dealer/purchases").title, "Purchases")
    for (const path of ["/dashboard/dealer/purchases/retail", "/dashboard/dealer/purchases/history", "/dashboard/dealer/auctions/won"]) {
        assert.equal(getDealerRoute(path).requiredPermission, "VIEW_PURCHASES", path)
    }
    const view = read("src/components/dealer/DealerPurchasesView.tsx")
    assert.match(view, /PageHeader title="Purchases"/)
    assert.doesNotMatch(read("src/app/dashboard/dealer/purchases/page.tsx"), /redirect\(/)
})

test("Purchases uses a single accessible row of three stage tabs and compact channel chips", () => {
    const view = read("src/components/dealer/DealerPurchasesView.tsx")
    assert.match(view, /aria-label="Purchase stages"/)
    assert.match(view, /grid grid-cols-3 gap-1/)
    for (const [id, label] of [["progress", "In progress"], ["completed", "Completed"], ["cancelled", "Cancelled"]]) {
        assert.ok(view.includes('["' + id + '","' + label + '"]'), id)
    }
    assert.match(view, /aria-current=\{stage === value/)
    assert.match(view, /channel=\$\{value\}/)
    assert.match(view, /\["all","auction","retail"\]/)
    assert.doesNotMatch(view, /<PurchaseDestinations/)
    assert.doesNotMatch(view, /<Columns3/)
})

test("Retail channel includes accepted retail deals and recorded retail sales but excludes auction purchases", () => {
    const eligible = [
        { id: "retail-pending", purchaseChannel: "RETAIL", retailSold: false },
        { id: "retail-complete", purchaseChannel: "RETAIL", retailSold: true },
        { id: "auction-won", purchaseChannel: "AUCTION", retailSold: false },
        { id: "legacy-retail", retailSold: true },
    ]
    assert.deepEqual(Array.from(eligible.filter(dest.isRetailPurchase), x => x.id),
        ["retail-pending", "retail-complete", "legacy-retail"])
    const view = read("src/components/dealer/DealerPurchasesView.tsx")
    assert.match(view, /if \(isRetail && !isRetailPurchase\(p\)\) return false/)
    assert.match(view, /if \(channel === "auction" && isRetailPurchase\(p\)\) return false/)
    assert.match(view, /<PendingRetailPurchaseRow key=\{offer\.id\} offer=\{offer\} onCompleted=/)
    assert.match(read("backend/src/dealers/dealers.service.ts"), /purchaseChannel: isAuctionPurchase \? 'AUCTION' : 'RETAIL'/)
})

test("Completed and In progress stages partition recorded purchases without changing backend statuses", () => {
    for (const status of ["sold", "checks_complete", "delivery_requested"]) assert.ok(dest.isPurchaseHistoryStatus(status))
    for (const status of ["awaiting_confirmation", "sale_confirmed", "reviewing_docs"]) assert.ok(!dest.isPurchaseHistoryStatus(status))
    const view = read("src/components/dealer/DealerPurchasesView.tsx")
    assert.match(view, /item\.status === "AWAITING_CONFIRMATION" && item\.retailSold/)
    assert.match(view, /if \(isHistory !== isPurchaseHistoryStatus\(p\.status\)\) return false/)
    assert.match(view, /Delivery Requested remains under Completed/)
    assert.match(view, /const isCancelled = stage === "cancelled"/)
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


test("Purchases retains search, compact channel filtering, accepted retail offers and financial actions", () => {
    const view = read("src/components/dealer/DealerPurchasesView.tsx")
    assert.match(view, /type="search"/)
    assert.match(view, /aria-label="Purchase type"/)
    assert.match(view, /const shownPendingRetail = isHistory \|\| isCancelled/)
    assert.match(view, /getMySaleCancellations\("purchase-history"\)/)
    assert.match(view, /buyerCancelledSales\(cancelled, dealershipBuyerId\)/)
    for (const action of ["onViewSummary={openPurchaseDetail}", "onViewSeller={openSellerDetails}",
        "onRequestCancellation={setCancelItem}", 'href="/dashboard/cancellations"', "setRefreshVersion(n => n + 1)"]) {
        assert.ok(view.includes(action), action)
    }
})

test("historical Auction Wins redirect retains the original fee and purchase-record cards", () => {
    const redirect = read("src/app/dashboard/dealer/auctions/won/page.tsx")
    assert.match(redirect, /detail=wins&tab=progress&channel=auction/)
    const wins = read("src/components/dealer/DealerAuctionWinsView.tsx")
    assert.match(wins, /recordHref=\{purchaseId \?/)
    assert.match(wins, /after:absolute after:inset-0/)
    assert.match(wins, /getWonAuctions/)
    assert.match(wins, /BuyerFeeCountdown/)
    assert.match(wins, /purchaseByListing/)
    assert.match(wins, /for \(let i = 0; i < ids.length; i \+= 50\) batches.push/)
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


test("native app uses the same stage tabs while keeping the auction-win and document records", () => {
    const appBar = read(APP + "components/dealer/PurchaseDestinations.tsx")
    for (const label of ["In progress", "Completed", "Cancelled"]) assert.ok(appBar.includes("label: '" + label + "'"), label)
    assert.doesNotMatch(appBar, /<ScrollView|horizontal\b(?! strip)/)
    const screen = read(APP + "screens/main/DealerPurchasesScreen.tsx")
    assert.match(screen, /const stage: PurchaseDestination/)
    assert.match(screen, /const isHistory = stage === 'completed'/)
    assert.match(screen, /const isCancelled = stage === 'cancelled'/)
    assert.match(screen, /const isRetail = channel === 'retail'/)
    assert.match(screen, /HISTORY_STATUSES/)
    assert.match(screen, /getMySaleCancellations/)
    assert.match(screen, /loadAllPurchasePages\(\)/)
    assert.match(screen, /navigation.navigate\('DealerPurchaseDetail', \{ saleId: item.id \}\)/)
    assert.match(screen, /navigation.navigate\('SellerAuctions', \{ initialTab: 'WON' \}\)/)
    const wins = read(APP + "screens/seller/SellerAuctionsScreen.tsx")
    assert.match(wins, /purchaseByListing/)
    const detail = read(APP + "screens/main/DealerPurchaseDetailScreen.tsx")
    assert.match(detail, /ImageLightbox/)
    assert.match(detail, /listingRecord/)
    assert.match(detail, /<BuyerDamageViewer records=\{r.damage\}/)
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
    for (const label of ["Auction Wins", "Retail Purchases", "All Purchases", "Purchase History"]) assert.ok(!tabs.includes(`label: "${label}"`), label)
})

test("free purchase grants: a settled fee never shows a deadline or a second £125 checkout", () => {
    // A Free Purchase Grant sets buyerFeePaid + a £0 transaction, so the API
    // reports buyerFee.settled = true (backend spec covers that mapping).
    const web = read("src/app/dashboard/dealer/purchases/[id]/page.tsx")
    assert.match(web, /purchase\.auction\?\.buyerFeeDeadlineAt && !purchase\.buyerFee\.settled/)
    assert.match(web, /purchase\.buyerFee\.required && !purchase\.buyerFee\.settled[\s\S]{0,400}mode=auction_fee/)
    assert.match(web, /const canArrange = !!purchase && \(!purchase\.buyerFee\.required \|\| purchase\.buyerFee\.settled\)/)
    const app = read(APP + "screens/main/DealerPurchaseDetailScreen.tsx")
    assert.match(app, /detail\.buyerFee\.required && !detail\.buyerFee\.settled/)
    const deadline = read("backend/src/auctions/buyer-fee-deadline.ts")
    assert.match(deadline, /a\.buyerFeePaid \|\| !a\.wonAt\) return null/)
})
