import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const read = path => readFileSync(new URL(path, import.meta.url), "utf8")
const result = ts.transpileModule(read("../src/lib/pendingRetailPurchases.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
})
assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
const exports = {}
runInNewContext(result.outputText, { exports }, { filename: "pendingRetailPurchases.js" })
const { pendingRetailPurchases } = exports

const offer = (id, status = "ACCEPTED", listingStatus = "OFFER_ACCEPTED", updatedAt = "2026-10-30T15:00:00Z", listingId = id) => ({
    id, listingId, status, updatedAt, listing: { id: listingId, status: listingStatus },
})

test("accepted sale-pending retail offers appear before a Sale exists", () => {
    const results = pendingRetailPurchases([offer("volvo")], [])
    assert.deepEqual(Array.from(results, o => o.id), ["volvo"])
})

test("sale records replace pending offer cards without duplicate purchase entries", () => {
    assert.equal(pendingRetailPurchases([offer("volvo")], ["volvo"]).length, 0)
})

test("non-accepted, sold, cancelled, and missing listing offers are not pending purchases", () => {
    const rows = [
        offer("pending", "PENDING"),
        offer("declined", "REJECTED"),
        offer("sold", "ACCEPTED", "SOLD"),
        offer("withdrawn", "CANCELLED"),
        offer("active", "ACCEPTED", "ACTIVE"),
        { ...offer("no-listing"), listing: undefined },
    ]
    assert.equal(pendingRetailPurchases(rows, []).length, 0)
})

test("duplicate accepted offers collapse to one pending vehicle, newest first", () => {
    const rows = [
        offer("earlier", "ACCEPTED", "OFFER_ACCEPTED", "2026-10-30T10:00:00Z", "same-car"),
        offer("other", "ACCEPTED", "OFFER_ACCEPTED", "2026-10-30T12:00:00Z", "other-car"),
        offer("later", "ACCEPTED", "OFFER_ACCEPTED", "2026-10-30T16:00:00Z", "same-car"),
    ]
    assert.deepEqual(Array.from(pendingRetailPurchases(rows, []), o => o.id), ["later", "other"])
})

test("dealer purchase history joins offer feed and refreshes on demand", () => {
    const page = read("../src/components/dealer/DealerPurchasesView.tsx")
    assert.match(page, /Promise\.allSettled\(\[/)
    assert.match(page, /getMyOffers\(\)/)
    assert.match(page, /pendingRetailPurchases\(acceptedOffers, purchases\.map/)
    assert.match(page, /Retail purchases — Sale Pending/)
    assert.match(page, /setRefreshVersion\(n => n \+ 1\)/)
    const row = read("../src/components/dealer/PendingRetailPurchaseRow.tsx")
    // onCompleted refreshes the list after the buyer completes the sale (#713).
    assert.ok(page.includes('<PendingRetailPurchaseRow key={offer.id} offer={offer} onCompleted={() => setRefreshVersion(v => v + 1)} />'))
    assert.ok(row.includes('const OFFER_DESTINATION = "/dashboard/buyer/offers"'))
    assert.ok(row.includes('listing?.images?.find(Boolean)'))
    assert.ok(row.includes('dealer-glass-card p-0 group hover:border-white/8'))
    assert.ok(row.includes('w-16 h-16 md:w-20 md:h-16'))
    assert.ok(row.includes('<span>Sale Pending</span>'))
    assert.ok(row.includes('Seller: Contact through accepted offer'))
    assert.ok(row.includes('createPortal('))
    // An agreed retail Offer must not offer Sale cancellation, auction fee, or fake purchase-summary actions.
    assert.ok(!row.includes('Purchase Summary'))
    assert.ok(!row.includes('Request cancellation'))
    assert.ok(!row.includes('buyerFeePaid'))
})

test("dealer navigation distinguishes auction wins from all purchases without removing either page", () => {
    const nav = read("../src/lib/purchaseDestinations.ts")
    assert.match(nav, /\/dashboard\/dealer\/auctions\/won", label: "Auction Wins"/)
    assert.match(nav, /\/dashboard\/dealer\/purchases", label: "All Purchases"/)
    assert.match(nav, /\/dashboard\/dealer\/purchases\/history", label: "Purchase History"/)
})

test("recorded retail sales display SOLD, not awaiting confirmation", () => {
    const dealerPurchases = read("../src/components/dealer/DealerPurchasesView.tsx")
    const row = read("../src/components/dealer/PipelineRow.tsx")
    assert.match(dealerPurchases, /item\.status === "AWAITING_CONFIRMATION" && item\.retailSold/)
    assert.match(dealerPurchases, /\? "sold"/)
    assert.match(dealerPurchases, /sold: \{ label: "Purchased"/)
    assert.match(row, /sold: \{\s*label: "Purchased"/)
    assert.match(row, /Retail sale recorded · No buyer fee/)
})

test("retail seller contact is not locked by an old ended auction record", () => {
    const service = read("../backend/src/dealers/dealers.service.ts")
    assert.match(service, /const isAuctionPurchase = listing\.type === 'AUCTION' \|\| !!auction\?\.winnerId;/)
    assert.match(service, /const isAuctionPurchase = l\?\.type === 'AUCTION' \|\| !!auction\?\.winnerId;/)
    assert.match(service, /retailSold: l\?\.type === 'CLASSIFIED' && l\?\.status === 'SOLD'/)
})
