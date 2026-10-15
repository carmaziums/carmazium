#!/usr/bin/env node
// Customer-facing SEO/trust contract for marketing examples and the finance URL.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const read = (path) => readFileSync(resolve(root, path), "utf8")

test("finance sitemap entry is the indexable canonical target, not its redirect", () => {
  const sitemap = read("src/app/sitemap.ts")
  const legacy = read("src/app/finance/page.tsx")
  const target = read("src/app/services/finance/layout.tsx")
  assert.match(legacy, /redirect\("\/services\/finance"\)/)
  assert.match(sitemap, /"\/services\/finance"/)
  assert.ok(!sitemap.includes('    "/finance",'), "legacy finance redirect must not be in sitemap")
  assert.match(target, /canonical: "\/services\/finance"/)
})

test("How It Works distinguishes retail shoppers from verified auction bidders", () => {
  const guide = read("src/app/how-it-works/page.tsx")
  assert.match(guide, /only verified motor traders can bid in dealer auctions/i)
  assert.match(guide, /Only verified dealer accounts can place bids/)
  assert.match(guide, /highlight="dealers"/)
  assert.match(guide, /steps=\{DEALER_STEPS\}/)
  assert.match(guide, /Buying as a private customer\?/)
  assert.match(guide, /href="\/search"/)
  assert.doesNotMatch(guide, /highlight="buyers"/)
  assert.doesNotMatch(guide, /142 found/)
})

test("worked examples cannot be presented as live bids or guaranteed payouts", () => {
  const guide = read("src/app/how-it-works/page.tsx")
  assert.match(guide, /EXAMPLE · NOT LIVE/)
  assert.match(guide, /Demonstration amounts, bid times and countdown only/)
  assert.match(guide, /Example figures only: not live bids/)
  assert.match(guide, /Illustrative seller auction example/)
  assert.match(guide, /Illustrative dealer auction example/)
  assert.match(guide, /qualifying auction sales earn a £100 reward/)
  assert.doesNotMatch(guide, />LIVE NOW</)
  assert.doesNotMatch(guide, /ID: #83921/)
  assert.doesNotMatch(guide, /desc: "24\/7 Expert help"/)
  assert.match(guide, /Mon–Fri, 9am–6pm UK time/)
  assert.match(guide, /final price is not guaranteed/)
})
