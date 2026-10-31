import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const source = read("src/lib/outgoingOfferFilters.ts")
const parsed = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
})
assert.equal(parsed.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
const exports = {}
runInNewContext(parsed.outputText, { exports }, { filename: "outgoingOfferFilters.js" })
const { filterOutgoingOffers, OUTGOING_OFFER_VIEWS, outgoingOfferEmptyMessage } = exports

const statuses = ["PENDING", "COUNTERED", "ACCEPTED", "REJECTED", "WITHDRAWN", "CANCELLED"]
const offers = statuses.map((status, i) => ({ id: String(i), status }))

test("private My Offers provides all six view modes", () => {
    assert.deepEqual(Array.from(OUTGOING_OFFER_VIEWS, tab => tab.value),
        ["current", "history", "all", "accepted", "rejected", "cancelled"])
})

test("current, history and all preserve the existing offer membership", () => {
    assert.deepEqual(Array.from(filterOutgoingOffers(offers, "current"), o => o.status),
        ["PENDING", "COUNTERED"])
    assert.deepEqual(Array.from(filterOutgoingOffers(offers, "history"), o => o.status),
        ["ACCEPTED", "REJECTED", "WITHDRAWN", "CANCELLED"])
    assert.deepEqual(Array.from(filterOutgoingOffers(offers, "all"), o => o.status), statuses)
})

test("accepted, rejected and cancelled never mix statuses", () => {
    assert.deepEqual(Array.from(filterOutgoingOffers(offers, "accepted"), o => o.status), ["ACCEPTED"])
    assert.deepEqual(Array.from(filterOutgoingOffers(offers, "rejected"), o => o.status), ["REJECTED"])
    assert.deepEqual(Array.from(filterOutgoingOffers(offers, "cancelled"), o => o.status), ["WITHDRAWN", "CANCELLED"])
})

test("filter does not change or reorder offers; empty statuses stay empty", () => {
    const before = JSON.stringify(offers)
    assert.equal(filterOutgoingOffers(offers.filter(o => o.status === "ACCEPTED"), "rejected").length, 0)
    assert.equal(JSON.stringify(offers), before)
    assert.match(outgoingOfferEmptyMessage("accepted"), /accepted offers/i)
    assert.match(outgoingOfferEmptyMessage("rejected"), /rejected offers/i)
    assert.match(outgoingOfferEmptyMessage("cancelled"), /cancelled or withdrawn/i)
})

test("live private dashboard exposes six touch-friendly accessible tabs and filters both layouts", () => {
    const page = read("src/app/dashboard/user/page.tsx")
    assert.ok(page.includes('role="group" aria-label="Filter my offers by status"'))
    assert.ok(page.includes('aria-pressed={viewMode === value}'))
    assert.ok(page.includes("OUTGOING_OFFER_VIEWS.map"))
    assert.ok(page.includes("min-h-10 items-center"))
    assert.ok(page.includes("const displayedOffers = filterOutgoingOffers(offers, viewMode)"))
    assert.ok(page.includes("outgoingOfferEmptyMessage(viewMode)"))
    const renders = page.match(/displayedOffers\.map\(offer =>/g) ?? []
    assert.equal(renders.length, 2, "mobile cards and desktop table must use the same filtered data")
})
