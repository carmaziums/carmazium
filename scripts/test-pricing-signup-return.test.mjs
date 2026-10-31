import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8")
const helper = read("src/lib/sellPricingIntent.ts")
const compiled = ts.transpileModule(helper, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
})
assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
const exports = {}
runInNewContext(compiled.outputText, { exports, URL, URLSearchParams }, { filename: "sellPricingIntent.js" })
const { safeSellReturnPath } = exports

test("signup may continue only allowlisted internal seller channels and packages", () => {
    assert.equal(safeSellReturnPath("/sell?sellMode=retail&package=premium"), "/sell?sellMode=retail&package=premium")
    assert.equal(safeSellReturnPath("/sell?sellMode=retail&package=standard"), "/sell?sellMode=retail&package=standard")
    assert.equal(safeSellReturnPath("/sell?sellMode=retail&package=basic"), "/sell?sellMode=retail&package=basic")
    assert.equal(safeSellReturnPath("/sell?sellMode=auction&package=premium"), "/sell?sellMode=auction")
    assert.equal(safeSellReturnPath("/sell?sellMode=retail&package=unrecognised"), "/sell?sellMode=retail&package=basic")
    for (const unsafe of [
        null, "", "/dashboard/admin", "https://example.org/sell?sellMode=retail&package=premium",
        "//example.org/sell?sellMode=retail&package=premium",
        "/sell?sellMode=retail&package=premium&callback=https://example.org",
        "/sell?sellMode=other&package=premium", "/sell/../auth/login?sellMode=retail",
    ]) {
        if (typeof unsafe === "string" && unsafe.includes("&callback=")) {
            // Additional parameters are not carried through the validated return.
            assert.equal(safeSellReturnPath(unsafe), "/sell?sellMode=retail&package=premium")
        } else {
            assert.equal(safeSellReturnPath(unsafe), null, String(unsafe))
        }
    }
})

test("signup preserves the allowed return path in email confirmation and OAuth callback", () => {
    const signup = read("src/app/auth/signup/page.tsx")
    assert.match(signup, /safeSellReturnPath\(searchParams\.get\("redirect"\)\)/)
    assert.match(signup, /registrationDestination = \`\/auth\/registration-complete\?next=\/auth\/onboarding\$\{continuation\}\`/)
    assert.match(signup, /emailRedirectTo: getRegistrationCallbackUrl\(baseUrl\)/)
    assert.match(signup, /router\.push\(authData\.session \? getRegistrationCallbackPath\(\) : onboardingDestination\)/)
    assert.match(signup, /redirectTo: getRegistrationCallbackUrl\(window\.location\.origin\)/)
})

test("onboarding and registration completion retain the selection without bypassing profile verification", () => {
    const onboarding = read("src/app/auth/onboarding/page.tsx")
    const completed = read("src/app/auth/registration-complete/page.tsx")
    const callback = read("src/app/auth/callback/page.tsx")
    assert.match(onboarding, /safeSellReturnPath\(new URLSearchParams\(window\.location\.search\)\.get\("sellReturn"\)\)/)
    assert.match(onboarding, /router\.replace\(target[\s\S]*auth\/registration-complete\?sellReturn=/)
    assert.match(onboarding, /redirectTo: \`\$\{getBaseUrl\(\)\}\/auth\/callback\?redirect_to=\$\{encodeURIComponent\(onboardingDestination\(\)\)\}\`/)
    assert.match(completed, /safeSellReturnPath\(new URLSearchParams\(window\.location\.search\)\.get\("sellReturn"\)\)/)
    assert.match(completed, /if \(!user\.email_confirmed_at \|\| !profileComplete\)/)
    assert.match(completed, /router\.push\(sellReturn \|\| guide\.dashboardPath\)/)
    assert.match(callback, /const redirectTo = searchParams\?\.get\("redirect_to"\)/)
})

test("valuation and saved pre-auth handoffs preserve package only for retail", () => {
    const wizard = read("src/components/listing/ListingWizard.tsx")
    assert.match(wizard, /const landingBadgeTier = listingType === "AUCTION" \? "FREE"/)
    assert.match(wizard, /chosenPricing\?\.listingType === "CLASSIFIED" \? chosenPricing\.badgeTier : "BASIC"/)
    assert.match(wizard, /badgeTier: landingBadgeTier/)
    assert.match(wizard, /const resumeBadgeTier = pending\.listingType === "AUCTION" \? "FREE"/)
    assert.match(wizard, /badgeTier: resumeBadgeTier/)
    assert.match(wizard, /if \(isDashboard \|\| editId \|\| searchParams\.get\('hpi_success'\) === 'true'\) return/)
})
