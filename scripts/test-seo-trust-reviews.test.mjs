#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('Reviews page does not contain unsupported claims or repeated invented testimonials', () => {
  const page = read('src/app/reviews/page.tsx')
  for (const falseClaim of [
    '50k+', '4.9/5', '100%', 'thousands of satisfied customers',
    'James Wilson', 'Bought a Porsche 911', 'Absolutely fantastic service',
    'Recent Reviews',
  ]) {
    assert.ok(!page.includes(falseClaim), 'Unsupported review claim: ' + falseClaim)
  }
  assert.doesNotMatch(page, /AggregateRating|reviewRating|reviewCount|ratingValue/)
  assert.match(page, /do not currently display a sourced customer-review feed/i)
  assert.match(page, /feedback by email does not automatically publish a public review/i)
})

test('Reviews page has canonical metadata and genuine feedback channel', () => {
  const page = read('src/app/reviews/page.tsx')
  const footer = read('src/components/layout/Footer.tsx')
  const sitemap = read('src/app/sitemap.ts')
  assert.match(page, /export const metadata: Metadata/)
  assert.match(page, /canonical: SITE_URL \+ "\/reviews"/)
  assert.match(page, /mailto:info@carmazium\.com\?subject=CarMazium%20customer%20feedback/)
  assert.match(page, /href="\/search"/)
  assert.match(page, /href="\/used-car-types"/)
  assert.match(page, /buyers pay the seller directly/i)
  assert.match(footer, /href="\/reviews"/)
  assert.match(sitemap, /"\/reviews"/)
})
