#!/usr/bin/env node
// SEO route regression: notFound only after a definitive backend 404/410.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const read = (path) => readFileSync(resolve(root, path), "utf8")

test("vehicle route issues real HTTP notFound for confirmed missing/deleted slugs", () => {
    const page = read("src/app/buy-cars/[slug]/page.tsx")
    assert.match(page, /import \{ notFound \} from "next\/navigation"/)
    assert.match(page, /if \(res\.status === 404 \|\| res\.status === 410\) return \{ listing: null, missing: true \} as const/)
    assert.match(page, /const \{ listing, missing \} = await getListingBySlug\(slug\)\s*if \(missing\) notFound\(\)/)
    assert.match(page, /const \{ listing: initialListing, missing \} = await getListingBySlug\(slug\)\s*if \(missing\) notFound\(\)/)
})

test("backend errors and malformed responses must not fake confirmed notFound", () => {
    const page = read("src/app/buy-cars/[slug]/page.tsx")
    assert.match(page, /if \(!res\.ok\) return \{ listing: null, missing: false \} as const/)
    assert.match(page, /return \{ listing: json\.data \?\? null, missing: false \} as const/)
    assert.match(page, /catch \{\s*return \{ listing: null, missing: false \} as const\s*\}/)
    assert.match(page, /if \(!listing\) \{\s*return \{ title: "Vehicle Not Found", robots: \{ index: false, follow: false \} \}/)
})

test("retail-only indexing and existing sold/auction detail display are preserved", () => {
    const page = read("src/app/buy-cars/[slug]/page.tsx")
    const client = read("src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx")
    const retailEligibility = read("src/components/seo/RetailVehicleJsonLd.tsx")
    assert.match(page, /const indexable = indexableRetail\(listing as Listing\)/)
    assert.match(retailEligibility, /l\.type === "CLASSIFIED" && l\.status === "ACTIVE"/)
    assert.match(retailEligibility, /!\/\(\^\|-\)\(undefined\|test\\d\*\|aaa\|qqq\|www\)\(-\|\$\)\/i\.test\(l\.slug \|\| ""\)/)
    assert.match(page, /robots: \{ index: indexable, follow: indexable \}/)
    assert.match(page, /<VehicleDetailsPageClient params=\{params\} initialListing=\{initialListing\} \/>/)
    assert.match(client, /String\(listing\.status\) === 'SOLD'/)
    assert.match(client, /String\(listing\.status\) === 'OFFER_ACCEPTED'/)
})
