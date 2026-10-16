#!/usr/bin/env node
// Regression contract: product availability schema must match robots and sitemap.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const read = (file) => readFileSync(resolve(root, file), "utf8")

test("InStock vehicle JSON-LD is gated by active classified retail status", () => {
    const client = read("src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx")
    const marker = client.indexOf("{/* Match the listing's robots metadata and the public sitemap:")
    const jsonLd = client.indexOf("<VehicleJsonLd", marker)
    assert.ok(marker !== -1 && jsonLd > marker, "Expected guarded vehicle JSON-LD render")
    const guard = client.slice(marker, jsonLd)

    assert.match(guard, /listing\.type === 'CLASSIFIED'/)
    assert.match(guard, /listing\.status === 'ACTIVE'/)
    assert.match(guard, /!\/\(\^\|-\)\(undefined\|test\\d\*\|aaa\|qqq\|www\)\(-\|\$\)\/i\.test\(listing\.slug\)/)
    assert.match(guard, /&& \(\s*$/)
    assert.match(client.slice(jsonLd), /<VehicleJsonLd[\s\S]*?\/>\s*\)\}/)
})

test("indexable metadata, public sitemap and Offer schema agree on availability", () => {
    const metadata = read("src/app/buy-cars/[slug]/page.tsx")
    const sitemap = read("src/app/sitemap.ts")
    const schema = read("src/components/seo/JsonLd.tsx")
    assert.match(metadata, /listing\.type === 'CLASSIFIED'\s*&&\s*listing\.status === 'ACTIVE'/)
    assert.match(metadata, /!isLikelyTestListingSlug\(listing\.slug \|\| slug\)/)
    assert.match(metadata, /robots: \{ index: indexable, follow: indexable \}/)
    assert.match(sitemap, /row\.type !== "CLASSIFIED" \|\| row\.status !== "ACTIVE"/)
    assert.match(sitemap, /isLikelyTestListingSlug\(row\.slug\)/)
    assert.match(schema, /availability: "https:\/\/schema\.org\/InStock"/)
})

test("no client-side changes to auction, sold and offer accepted presentation", () => {
    const client = read("src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx")
    assert.match(client, /String\(listing\.status\) === 'SOLD'/)
    assert.match(client, /String\(listing\.status\) === 'OFFER_ACCEPTED'/)
    assert.match(client, /listing\.type === 'AUCTION'/)
})
