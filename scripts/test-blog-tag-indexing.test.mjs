import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import ts from "typescript"

const require = createRequire(import.meta.url)
const source = readFileSync(new URL("../src/app/blog/tag/[tag]/page.tsx", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function metadataFor(payload, { ok = true, page = "1" } = {}) {
    const exports = {}
    vm.runInNewContext(compiled, {
        exports, URLSearchParams,
        require(name) {
            if (name === "@/lib/serverBackendFetch") return {
                serverBackendFetch: async () => ({ ok, json: async () => payload }),
            }
            if (name === "next/navigation") return { notFound() { throw new Error("404") } }
            return require(name)
        },
    })
    return exports.generateMetadata({ params: Promise.resolve({ tag: "non-runner%20car" }), searchParams: Promise.resolve({ page }) })
}

test("one-article archives stay navigable but are excluded from both general and Google indexing", async () => {
    const meta = await metadataFor({ data: [{}], pagination: { total: 1, totalPages: 1 } })
    assert.equal(meta.robots.index, false)
    assert.equal(meta.robots.follow, true)
    assert.equal(meta.robots.googleBot.index, false)
    assert.equal(meta.robots.googleBot.follow, true)
    assert.equal(meta.alternates.canonical, "https://www.carmazium.com/blog/tag/non-runner%20car")
})

test("a one-card final page of a larger archive is still indexable and self-canonical", async () => {
    const meta = await metadataFor({ data: [{}], pagination: { total: 13, totalPages: 2 } }, { page: "2" })
    assert.equal(meta.robots.index, true)
    assert.equal(meta.robots.googleBot.index, true)
    assert.equal(meta.alternates.canonical, "https://www.carmazium.com/blog/tag/non-runner%20car?page=2")
})

test("missing or inconsistent totals and upstream outages never cause accidental noindex", async () => {
    for (const total of [undefined, "1", -1, 0]) {
        await assert.rejects(metadataFor({ data: [{}], pagination: { total, totalPages: 1 } }), /temporarily unavailable/)
    }
    await assert.rejects(metadataFor({}, { ok: false }), /temporarily unavailable/)
})

test("confirmed empty or out-of-range archives remain 404", async () => {
    await assert.rejects(metadataFor({ data: [], pagination: { total: 0, totalPages: 0 } }), /404/)
    await assert.rejects(metadataFor({ data: [], pagination: { total: 2, totalPages: 1 } }, { page: "2" }), /404/)
})
