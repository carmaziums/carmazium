#!/usr/bin/env node
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const read = (path) => readFileSync(resolve(root, path), "utf8")

test("blog index returns 404 for confirmed non-existent paginated archives", () => {
  const page = read("src/app/blog/page.tsx")
  assert.match(page, /import \{ notFound \} from "next\/navigation"/)
  assert.match(page, /loaded && page > 1 && \(page > totalPages \|\| posts\.length === 0\)\) notFound\(\)/)
  assert.match(page, /Number\.isSafeInteger\(json\.pagination\?\.totalPages\)/)
  assert.match(page, /loaded: false/)
  assert.match(page, /loaded: true/)
  assert.match(page, /const canonical = page === 1/)
  assert.match(page, /SITE_URL/)
})

test("blog tag archives return 404 only when authoritative API data is empty or out of range", () => {
  const page = read("src/app/blog/tag/[tag]/page.tsx")
  assert.match(page, /import \{ notFound \} from "next\/navigation"/)
  assert.match(page, /loaded && \(posts\.length === 0 \|\| page > totalPages\)\) notFound\(\)/)
  assert.match(page, /Number\.isSafeInteger\(json\.pagination\?\.totalPages\)/)
  assert.match(page, /loaded: false/)
  assert.match(page, /loaded: true/)
  assert.match(page, /page === 1 \? base/)
  assert.doesNotMatch(page, /posts\.length === 0 && page === 1/)
})

test("retail search metadata describes adverts, not independently verified vehicles", () => {
  const metadata = read("src/app/search/layout.tsx")
  assert.match(metadata, /Used Cars for Sale Across the UK/)
  assert.match(metadata, /Compare vehicle adverts and filter/)
  assert.match(metadata, /canonical: "\/search"/)
  assert.doesNotMatch(metadata, /Browse Verified Vehicles|verified vehicle listings|Search verified used cars/i)
})
