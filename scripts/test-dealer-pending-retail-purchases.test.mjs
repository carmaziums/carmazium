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
    const page = read("../src/app/dashboard/dealer/purchases/page.tsx")
    assert.match(page, /Promise\.allSettled\(\[/)
    assert.match(page, /getMyOffers\(\)/)
    assert.match(page, /pendingRetailPurchases\(acceptedOffers, purchases\.map/)
    assert.match(page, /Retail purchases — Sale Pending/)
    assert.match(page, /Refresh purchases/)
    assert.match(page, /href="\/dashboard\/buyer\/offers"/)
})

test("dealer navigation distinguishes auction wins from all purchases without removing either page", () => {
    const nav = read("../src/components/dealer/BuyAndBidTabs.tsx")
    assert.match(nav, /\/dashboard\/dealer\/auctions\/won", label: "Auction Wins"/)
    assert.match(nav, /\/dashboard\/dealer\/purchases", label: "All Purchases"/)
})

test("recorded retail sales display SOLD, not awaiting confirmation", () => {
    const dealerPurchases = read("../src/app/dashboard/dealer/purchases/page.tsx")
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
