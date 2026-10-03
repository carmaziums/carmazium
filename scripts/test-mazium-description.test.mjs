import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const wizard = readFileSync(new URL("../src/components/listing/ListingWizard.tsx", import.meta.url), "utf8")
const sellerPage = readFileSync(new URL("../src/app/sell/page.tsx", import.meta.url), "utf8")
const buttonVariants = readFileSync(new URL("../src/components/ui/buttonVariants.ts", import.meta.url), "utf8")

const start = wizard.indexOf('data-testid="seller-mazium-description"')
const end = wizard.indexOf("</Button>", start)
assert.ok(start > 0 && end > start, "MaziuM description CTA must exist")
const cta = wizard.slice(start, end)

test("retail and auction share the MaziuM description CTA", () => {
    assert.match(sellerPage, /import \{ ListingWizard \}/)
    assert.match(wizard, /MaziuM description/)
    assert.doesNotMatch(cta, /Auto-generate with AI/)
    assert.equal((wizard.match(/data-testid="seller-mazium-description"/g) || []).length, 1)
})

test("description action retains consent and does not alter its API contract", () => {
    const action = wizard.slice(wizard.lastIndexOf("onClick={async () => {", start), start)
    assert.match(action, /if \(!ensureAiSharingConsent\(\)\) return/)
    assert.match(action, /aiGenerateDescription\(/)
    assert.match(action, /set\("description", res\.text\)/)
    assert.match(cta, /shared with OpenAI only after you consent/)
    assert.match(cta, /aria-busy=\{isGeneratingDesc\}/)
})

test("button overrides the shared no-wrap style and fits small mobile widths", () => {
    assert.match(buttonVariants, /whitespace-nowrap/)
    assert.match(cta, /\bw-full min-w-0 max-w-full\b/)
    assert.match(cta, /\boverflow-hidden whitespace-normal break-words\b/)
    assert.match(cta, /\bmin-w-0 flex-1 whitespace-normal break-words/)
    assert.match(cta, /\[overflow-wrap:anywhere\]/)
    assert.match(cta, /\bh-auto\b/)
    assert.doesNotMatch(cta, /text-\[10px\]/)
})

test("light and dark modes and even the disabled state remain readable", () => {
    for (const className of [
        "border-indigo-500", "bg-indigo-50", "text-indigo-950",
        "dark:border-indigo-400", "dark:bg-indigo-950", "dark:text-indigo-50",
        "disabled:opacity-100", "disabled:border-slate-500",
        "disabled:bg-slate-100", "disabled:text-slate-900",
        "dark:disabled:border-slate-400", "dark:disabled:bg-slate-800",
        "dark:disabled:text-slate-100",
    ]) assert.ok(cta.includes(className), `missing theme or state: ${className}`)
    assert.match(cta, /Add the vehicle make, model or year above to enable MaziuM/)
    assert.match(cta, /MaziuM is drafting your description/)
})
