#!/usr/bin/env node
// Regression contract: product availability schema must match robots and sitemap.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const read = (file) => readFileSync(resolve(root, file), "utf8")

test("InStock JSON-LD is emitted only for indexable active retail listings with a valid asking price", () => {
    const component = read("src/components/seo/RetailVehicleJsonLd.tsx")
    const page = read("src/app/buy-cars/[slug]/page.tsx")
    const client = read("src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx")

    // The server-rendered retail schema is the only vehicle Offer on this page.
    assert.match(page, /<RetailVehicleJsonLd listing=\{initialListing as Listing\} \/>/)
    assert.doesNotMatch(client, /<VehicleJsonLd\b/)

    // The helper enforces both sale channel, active status and test-slug exclusion.
    assert.match(component, /l\.type === "CLASSIFIED" && l\.status === "ACTIVE"/)
    assert.match(component, /!\/\(\^\|-\)\(undefined\|test\\d\*\|aaa\|qqq\|www\)\(-\|\$\)\/i\.test\(l\.slug \|\| ""\)/)
    // Neither unavailable listings nor invalid or non-positive prices may emit InStock.
    assert.match(component, /if \(!indexableRetail\(l\) \|\| !Number\.isFinite\(price\) \|\| price <= 0\) return null/)
    assert.match(component, /availability: "https:\/\/schema\.org\/InStock"/)
})

test("indexable metadata, public sitemap and Offer schema share the same eligibility contract", () => {
    const metadata = read("src/app/buy-cars/[slug]/page.tsx")
    const sitemap = read("src/app/sitemap.ts")
    const retailSchema = read("src/components/seo/RetailVehicleJsonLd.tsx")

    assert.match(metadata, /const indexable = indexableRetail\(listing as Listing\)/)
    assert.match(metadata, /robots: \{ index: indexable, follow: indexable \}/)
    assert.match(sitemap, /row\.type !== "CLASSIFIED" \|\| row\.status !== "ACTIVE"/)
    assert.match(sitemap, /isLikelyTestListingSlug\(row\.slug\)/)
    assert.match(retailSchema, /l\.type === "CLASSIFIED" && l\.status === "ACTIVE"/)
    assert.match(retailSchema, /if \(!indexableRetail\(l\) \|\| !Number\.isFinite\(price\) \|\| price <= 0\) return null/)
})

test("no client-side changes to auction, sold and offer accepted presentation", () => {
    const client = read("src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx")
    assert.match(client, /String\(listing\.status\) === 'SOLD'/)
    assert.match(client, /String\(listing\.status\) === 'OFFER_ACCEPTED'/)
    assert.match(client, /listing\.type === 'AUCTION'/)
})
