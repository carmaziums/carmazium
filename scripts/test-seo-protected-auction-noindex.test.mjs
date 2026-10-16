#!/usr/bin/env node
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const read = path => readFileSync(resolve(root, path), "utf8")

test("all authentication-gated auction pages emit noindex, nofollow metadata", () => {
    for (const segment of ["browse", "live/[id]", "won/[id]"]) {
        const route = "src/app/auctions/" + segment
        const metadata = read(route + "/layout.tsx")
        const page = read(route + "/page.tsx")
        assert.match(metadata, /export const metadata: Metadata\s*=\s*\{/, route)
        assert.match(metadata, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/, route)
        assert.match(page, /RequireAuth/, route)
    }
})

test("public auction hub and education pages retain their indexable metadata", () => {
    const parent = read("src/app/auctions/layout.tsx")
    const guide = read("src/app/auctions/how-it-works/layout.tsx")
    const robots = read("src/app/robots.ts")
    const sitemap = read("src/app/sitemap.ts")

    assert.match(parent, /canonical:\s*"\/auctions"/)
    assert.match(guide, /canonical:\s*"\/auctions\/how-it-works"/)
    assert.doesNotMatch(parent, /robots:\s*\{\s*index:\s*false/)
    assert.doesNotMatch(guide, /robots:\s*\{\s*index:\s*false/)
    assert.match(sitemap, /"\/auctions"/)
    assert.match(sitemap, /"\/auctions\/how-it-works"/)
    assert.ok(!sitemap.includes('"/auctions/browse"'))
    assert.ok(!sitemap.includes('"/auctions/live/"'))
    assert.ok(!sitemap.includes('"/auctions/won/"'))
    // Keep crawlers allowed to read the child robots meta noindex directive.
    assert.ok(!robots.includes('"/auctions"'))
})
