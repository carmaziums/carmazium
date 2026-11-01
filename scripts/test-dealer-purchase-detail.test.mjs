import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const helper = ts.transpileModule(read("src/lib/dealerPurchaseDetail.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
})
assert.equal(helper.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
const exports = {}
runInNewContext(helper.outputText, { exports, URLSearchParams }, { filename: "dealerPurchaseDetail.js" })

const purchase = {
    retailSold: true, channel: "RETAIL", purchaseStatus: "AWAITING_CONFIRMATION",
    listingId: "test-listing", vehicle: {
        title: "Volvo XC60 2017", registration: "EX17 ABC", make: "Volvo", model: "XC60",
        year: 2017,
    },
}

test("retail SOLD is never shown as awaiting purchase confirmation", () => {
    assert.equal(exports.recordedPurchaseLabel(purchase), "Purchased")
    assert.equal(exports.recordedPurchaseLabel({
        ...purchase, channel: "AUCTION", retailSold: false,
    }), "Auction won")
})

test("delivery prefill only passes vehicle fields, never seller private information", () => {
    const url = exports.purchaseDeliveryHref(purchase)
    const params = new URLSearchParams(url.split("?")[1])
    assert.equal(url.split("?")[0], "/services/delivery/new")
    assert.equal(params.get("listingId"), "test-listing")
    assert.equal(params.get("registration"), "EX17 ABC")
    assert.equal(params.get("vehicleTitle"), "Volvo XC60 2017")
    assert.equal(params.has("sellerAddress"), false)
    assert.equal(params.has("sellerEmail"), false)
})

test("buyer-scoped read endpoints enforce VIEW_PURCHASES and separate seller PII", () => {
    const svc = read("backend/src/dealers/dealers.service.ts")
    const ctrl = read("backend/src/dealers/dealers.controller.ts")
    assert.match(svc, /async getDealerPurchaseDetail\(userId: string, saleId: string\)/)
    assert.match(svc, /async getDealerPurchaseLookup\(userId: string, listingIds: string\[\]\)/)
    assert.match(svc, /where: \{ id: saleId, buyerId \}/)
    assert.match(svc, /assertDealerPermission\(actor, 'VIEW_PURCHASES'\)/)
    assert.match(svc, /serviceType: 'DELIVERY'/)
    assert.match(svc, /vehicles: \{ some: \{ listingId: sale\.listingId \} \}/)
    assert.match(ctrl, /@Get\('purchases\/listing-lookup'\)/)
    assert.match(ctrl, /@Get\('purchases\/:id'\)/)
    assert.match(ctrl, /@Get\('purchases\/:id\/seller'\)/)
    const detail = svc.split("async getDealerPurchaseDetail")[1].split("async getPurchaseSellerDetails")[0]
    assert.doesNotMatch(detail, /sellerEmail:|sellerPhone:|sellerAddress:/)
})

test("web purchase detail has all sections, action sheet and fixed mobile bottom bar", () => {
    const page = read("src/app/dashboard/dealer/purchases/[id]/page.tsx")
    for (const section of ["Purchase summary", "Seller details", "Payment and fees",
        "Documents and handover", "Delivery details",
        "Purchase summary", "Adjustments & cancellations",
        "Seller&apos;s details", "Book delivery"]) {
        assert.ok(page.includes(section), section)
    }
    assert.match(page, /fixed bottom-0 inset-x-0/)
    assert.match(page, /\/dealers\/purchases\/\$\{encodeURIComponent\(id\)\}\/seller/)
    assert.match(page, /SaleCancellationModal/)
})

test("history and won-auction pages link only to real Sale IDs", () => {
    const history = read("src/components/dealer/DealerPurchasesView.tsx")
    const won = read("src/components/dealer/DealerAuctionWinsView.tsx")
    assert.match(history, /onViewSummary=\{openPurchaseDetail\}/)
    assert.match(won, /purchases\/listing-lookup\?listingIds=/)
    assert.match(won, /purchaseId=\{purchaseByListing\[a\.listingId\]\}/)
    assert.match(won, /canViewPurchases/)
})

test("native purchase detail is gated and routes booking to typed delivery form", () => {
    const stack = read("carmazium app/carmazium app/src/navigation/MainStackNavigator.tsx")
    const detail = read("carmazium app/carmazium app/src/screens/main/DealerPurchaseDetailScreen.tsx")
    const history = read("carmazium app/carmazium app/src/screens/main/DealerPurchasesScreen.tsx")
    const job = read("carmazium app/carmazium app/src/screens/main/CreateServiceJobScreen.tsx")
    assert.match(stack, /withDealerGate\(DealerPurchaseDetailScreen, 'VIEW_PURCHASES'\)/)
    assert.match(stack, /DealerPurchaseDetail: \{ saleId: string \}/)
    assert.match(history, /navigation\.navigate\('DealerPurchaseDetail', \{ saleId: item\.id \}\)/)
    assert.match(detail, /\/dealers\/purchases\/\$\{encodeURIComponent\(saleId\)\}\/seller/)
    assert.match(detail, /Book delivery/)
    assert.match(detail, /Adjustments & cancellations/)
    assert.match(job, /listingId: purchase\?\.listingId/)
    const nativeWins = read("carmazium app/carmazium app/src/screens/seller/SellerAuctionsScreen.tsx")
    assert.match(nativeWins, /purchases\/listing-lookup\?listingIds=/)
    assert.match(nativeWins, /navigate\('DealerPurchaseDetail', \{ saleId: purchaseId \}\)/)
    assert.match(nativeWins, /canViewPurchases/)
})

test("review fixes: existing delivery job is opened, not duplicated; app honours the delivery switch", () => {
    const web = readFileSync(new URL("../src/app/dashboard/dealer/purchases/[id]/page.tsx", import.meta.url), "utf8")
    assert.match(web, /\{purchase\.delivery \? \(/)
    assert.match(web, /href=\{`\/services\/jobs\/\$\{encodeURIComponent\(purchase\.delivery\.jobId\)\}`\}/)
    assert.ok(!web.includes("Reference ${"), "no stray $ before the reference")
    const app = readFileSync(new URL("../carmazium app/carmazium app/src/screens/main/DealerPurchaseDetailScreen.tsx", import.meta.url), "utf8")
    assert.match(app, /s\.availability\?\.DELIVERY !== false/)
    assert.match(app, /if \(!deliveryAvailable\) \{/)
    assert.ok(app.includes("detail.retailSold ? 'Purchased'"))
})
