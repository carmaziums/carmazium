import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

function loadModule(path) {
    const source = readFileSync(new URL("../" + path, import.meta.url), "utf8")
    const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        reportDiagnostics: true,
    })
    assert.equal(output.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
    const exports = {}
    runInNewContext(output.outputText, { exports }, { filename: path })
    return exports
}

const { loadProviderJobLists } = loadModule("src/lib/tradeXchangeProviderJobLoad.ts")
const { checkoutPaymentNotice } = loadModule("src/lib/tradeXchangeCheckoutNotice.ts")

const page = (id) => ({ items: [{ id }], nextCursor: null })
const rejects = (message) => async () => { throw new Error(message) }

test("TradeXchange: loads available jobs and already assigned work independently", async () => {
    const result = await loadProviderJobLists(async () => page("open-1"), async () => page("mine-1"))
    assert.equal(result.available.items[0].id, "open-1")
    assert.equal(result.assigned.items[0].id, "mine-1")
    assert.equal(result.approvalRequired, false)
    assert.equal(result.availableError, null)
    assert.equal(result.assignedError, null)
})

test("expired verification blocks only NEW quotes, not an already assigned job", async () => {
    const result = await loadProviderJobLists(
        rejects("No approved services for this provider"),
        async () => page("paid-existing-job"),
    )
    assert.equal(result.approvalRequired, true)
    assert.equal(result.available, null)
    assert.equal(result.availableError, null)
    assert.equal(result.assigned.items[0].id, "paid-existing-job")
    assert.equal(result.assignedError, null)
})

test("a feed error cannot conceal assigned work or be mistaken for missing verification", async () => {
    const result = await loadProviderJobLists(
        rejects("Request timed out — try again"),
        async () => page("assigned-active"),
    )
    assert.equal(result.approvalRequired, false)
    assert.match(result.availableError, /timed out/)
    assert.equal(result.assigned.items[0].id, "assigned-active")
})

test("an assigned-work outage cannot hide available jobs", async () => {
    const result = await loadProviderJobLists(
        async () => page("open-2"),
        rejects("My Work API unavailable"),
    )
    assert.equal(result.available.items[0].id, "open-2")
    assert.match(result.assignedError, /unavailable/)
    assert.equal(result.assigned, null)
})

test("both endpoint errors remain separately visible rather than creating a false empty state", async () => {
    const result = await loadProviderJobLists(
        rejects("Feed API error"), rejects("Assigned API error"),
    )
    assert.match(result.availableError, /Feed API/)
    assert.match(result.assignedError, /Assigned API/)
    assert.equal(result.available, null)
    assert.equal(result.assigned, null)
})

test("a Stripe redirect never proves that payment was received", () => {
    assert.equal(checkoutPaymentNotice("1", null).tone, "pending")
    assert.equal(checkoutPaymentNotice("1", "PENDING").tone, "pending")
    assert.match(checkoutPaymentNotice("1", "PENDING").text, /do not pay again/)
    assert.equal(checkoutPaymentNotice("1", "PAID").tone, "success")
    assert.equal(checkoutPaymentNotice("1", "RELEASED").tone, "success")
    assert.equal(checkoutPaymentNotice("1", "REFUNDED").tone, "warning")
    assert.equal(checkoutPaymentNotice("1", "FAILED").tone, "warning")
    assert.equal(checkoutPaymentNotice("0", "PAID"), null)
    assert.equal(checkoutPaymentNotice(null, null), null)
})

test("customer and provider pages use independent access and payment status checks", () => {
    const providerPage = readFileSync(new URL("../src/app/dashboard/service/jobs/page.tsx", import.meta.url), "utf8")
    const customerPage = readFileSync(new URL("../src/app/services/jobs/[id]/page.tsx", import.meta.url), "utf8")
    assert.match(providerPage, /loadProviderJobLists\(getJobFeedPage, getAssignedJobsPage\)/)
    assert.match(providerPage, /tab === "open" && notApproved/)
    assert.match(providerPage, /const error = tab === "open" \? availableError : assignedError/)
    assert.match(customerPage, /checkoutPaymentNotice\(params\.get\("paid"\), job\.payment\?\.status\)/)
    assert.doesNotMatch(customerPage, /\? "Payment received\./)
})
