#!/usr/bin/env node
// Source contract: public blog 404s must reflect actual missing/unpublished posts.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const read = file => readFileSync(resolve(root, file), "utf8")

test("blog article route returns 404 only for confirmed missing/unpublished responses", () => {
  const page = read("src/app/blog/[slug]/page.tsx")
  const controller = read("backend/src/blog/blog.controller.ts")
  const service = read("backend/src/blog/blog.service.ts")
  assert.match(page, /if \(res\.status === 404 \|\| res\.status === 410\) return null/)
  assert.match(page, /if \(!post\) notFound\(\)/)
  assert.match(controller, /return new StandardResponse\(post\)/)
  assert.match(service, /if \(!post\) throw new NotFoundException\('Blog post not found'\)/)
  assert.match(service, /status: 'PUBLISHED'/)
})

test("blog API outages and malformed responses cannot masquerade as removed posts", () => {
  const page = read("src/app/blog/[slug]/page.tsx")
  const fetchStart = page.indexOf("async function getPostBySlug(")
  const fetchEnd = page.indexOf("async function getRelatedPosts(", fetchStart)
  assert.ok(fetchStart >= 0 && fetchEnd > fetchStart)
  const lookup = page.slice(fetchStart, fetchEnd)
  assert.match(lookup, /if \(!res\.ok\) throw new Error\(/)
  assert.match(lookup, /if \(!json\?\.data \|\| typeof json\.data !== "object"\)/)
  assert.match(lookup, /throw new Error\("\[blog\] Malformed post lookup payload"\)/)
  assert.match(lookup, /return json\.data as BlogPost/)
  assert.doesNotMatch(lookup, /catch\s*\{|if \(!res\.ok\) return null|return json\.data \?\? null/)
})

test("existing editorial indexing and blog structured-data behaviour is preserved", () => {
  const page = read("src/app/blog/[slug]/page.tsx")
  const sitemap = read("src/app/sitemap.ts")
  assert.match(page, /robots: \{ index: !post\.noIndex, follow: true \}/)
  assert.match(page, /alternates: \{ canonical: url \}/)
  assert.match(page, /"@type": "BlogPosting"/)
  assert.match(sitemap, /row\.status !== "PUBLISHED" \|\| row\.noIndex === true/)
})
