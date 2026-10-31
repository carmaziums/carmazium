// Pages retired in #720 must redirect, not 404 (bookmarks, old links).
import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const config = readFileSync("next.config.ts", "utf8")

test("retired pages redirect to their replacements", () => {
    for (const [source, destination] of [
        ["/admin/analytics", "/dashboard/admin/analytics"],
        ["/auth/partners", "/auth/login"],
    ]) {
        const block = new RegExp(`source: '${source}',\\s*destination: '${destination}',\\s*permanent: true`)
        assert.match(config, block, source)
    }
    // A page file at the old path would shadow nothing here, but keep them gone.
    assert.ok(!existsSync("src/app/admin/analytics/page.tsx"))
    assert.ok(!existsSync("src/app/auth/partners/page.tsx"))
})

test("the admin destination stays behind the admin access gate", () => {
    assert.match(readFileSync("src/app/dashboard/admin/layout.tsx", "utf8"), /<AdminAccessGate>/)
})

test("the footer no longer shows a newsletter form that cannot submit", () => {
    const footer = readFileSync("src/components/layout/Footer.tsx", "utf8")
    assert.doesNotMatch(footer, /Newsletter/)
    assert.doesNotMatch(footer, /<form/)
})
