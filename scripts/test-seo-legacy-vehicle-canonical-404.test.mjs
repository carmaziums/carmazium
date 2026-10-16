#!/usr/bin/env node
// Protect legacy vehicle URLs from soft-404s and false canonical identities.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = (p) => readFileSync(resolve(root, p), 'utf8')

test('legacy vehicle route gives real 404 only for definitive missing responses', () => {
    const legacy = read('src/app/vehicle/[id]/page.tsx')
    const modern = read('src/app/buy-cars/[slug]/page.tsx')
    for (const page of [legacy, modern]) {
        assert.match(page, /import \{ notFound \} from "next\/navigation"/)
        assert.match(page, /if \(res\.status === 404 \|\| res\.status === 410\) return \{ listing: null, missing: true \} as const/)
        assert.match(page, /if \(!res\.ok\) return \{ listing: null, missing: false \} as const/)
        assert.match(page, /return \{ listing: json\.data \?\? null, missing: false \} as const/)
        assert.match(page, /catch \{\s*return \{ listing: null, missing: false \} as const\s*\}/)
        assert.match(page, /if \(missing\) notFound\(\)/)
    }
    assert.match(legacy, /const \{ listing, missing \} = await getListingBySlug\(id\)/)
    assert.match(legacy, /const \{ listing: initialListing, missing \} = await getListingBySlug\(id\)/)
})

test('legacy URL is noindex and canonical to actual published listing slug', () => {
    const legacy = read('src/app/vehicle/[id]/page.tsx')
    assert.match(legacy, /const canonicalUrl =/)
    assert.match(legacy, /listing\.slug \|\| id/)
    assert.match(legacy, /alternates: \{ canonical: canonicalUrl \}/)
    assert.match(legacy, /robots: \{ index: false, follow: true \}/)
    assert.doesNotMatch(legacy, /Verified listing on CarMazium/)
    assert.match(legacy, /Vehicle listing on CarMazium/)
    assert.match(legacy, /<VehicleDetailPageClient params=\{params\} initialListing=\{initialListing\} \/>/)
})

test('new canonical vehicle routes remain indexable only for active classifieds', () => {
    const modern = read('src/app/buy-cars/[slug]/page.tsx')
    assert.match(modern, /listing\.type === 'CLASSIFIED'/)
    assert.match(modern, /listing\.status === 'ACTIVE'/)
    assert.match(modern, /robots: \{ index: indexable, follow: indexable \}/)
    assert.match(modern, /listing\.slug \|\| slug/)
})
