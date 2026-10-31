import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const compiled = ts.transpileModule(read("src/lib/sellPricingIntent.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
})
assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
const exports = {}
runInNewContext(compiled.outputText, { exports }, { filename: "sellPricingIntent.js" })
const { parseSellPricingIntent } = exports

test("pricing CTAs retain the correct channel and package", () => {
    const page = read("src/app/pricing/page.tsx")
    for (const [label, target] of [
        ["Start Free Auction", "/sell?sellMode=auction#sell-options"],
        ["Choose Basic", "/sell?sellMode=retail&package=basic#sell-options"],
        ["Choose Standard", "/sell?sellMode=retail&package=standard#sell-options"],
        ["Choose Premium", "/sell?sellMode=retail&package=premium#sell-options"],
    ]) {
        assert.ok(page.includes(`href="${target}"`), `${label} lost its target`)
    }
})

test("the auction remains free, regardless of a conflicting retail package parameter", () => {
    const x = parseSellPricingIntent("auction", "premium")
    assert.equal(x.listingType, "AUCTION")
    assert.equal(x.badgeTier, "FREE")
    assert.equal(x.key, "auction:FREE")
})

test("all retail packages map to the corresponding listing tier", () => {
    for (const [input, tier] of [["basic", "BASIC"], ["standard", "STANDARD"], ["premium", "PREMIUM"]]) {
        const x = parseSellPricingIntent("retail", input)
        assert.equal(x.listingType, "CLASSIFIED")
        assert.equal(x.badgeTier, tier)
        assert.equal(x.key, `retail:${tier}`)
    }
})

test("unsupported or missing packages cannot create an unpriced listing tier", () => {
    for (const invalid of [null, "", "enterprise", "FREE", "xyz"]) {
        assert.equal(parseSellPricingIntent("retail", invalid).badgeTier, "BASIC")
    }
    for (const mode of [null, "", "dealer", "classified", "RETAIL"]) {
        assert.equal(parseSellPricingIntent(mode, "premium"), null)
    }
})

test("wizard only applies quick intent outside edit and payment-return flows", () => {
    const wizard = read("src/components/listing/ListingWizard.tsx")
    assert.ok(wizard.includes("parseSellPricingIntent(sellMode, searchParams.get('package'))"))
    assert.ok(wizard.includes("quickSellModeAppliedRef.current === pricingIntent.key"))
    assert.ok(wizard.includes("badgeTier: pricingIntent.badgeTier"))
    assert.ok(wizard.includes("isDashboard || editId || searchParams.get('hpi_success') === 'true'"))
    assert.ok(wizard.includes("if (!isAuthenticated)"))
    assert.ok(wizard.includes("if (!isEmailVerified)"))
    assert.ok(wizard.includes("if (profile?.role === 'DEALER' && !isVerifiedDealer)"))
    // Package selection may be changed by the seller later; it is only a default.
    assert.ok(wizard.includes("onClick={() => set('badgeTier', 'BASIC')}"))
    assert.ok(wizard.includes("onClick={() => set('badgeTier', 'STANDARD')}"))
    assert.ok(wizard.includes("onClick={() => set('badgeTier', 'PREMIUM')}"))
})

test("seller reward image does not suggest a reward for listing without a sale", () => {
    const wizard = read("src/components/listing/ListingWizard.tsx")
    assert.ok(wizard.includes("£100 seller reward for qualifying completed auction sales after approved handover"))
    assert.ok(!wizard.includes("incentive to list and complete the sale"))
})
