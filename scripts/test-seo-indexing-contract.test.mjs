#!/usr/bin/env node
// Source-contract regression tests: independent of a live API connection.
// Runtime sitemap and browser output still require separate HTTP/Google checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');

test('published blog articles marked noindex are excluded from XML sitemap', () => {
  const sitemap = read('src/app/sitemap.ts');
  const article = read('src/app/blog/[slug]/page.tsx');
  const postType = read('src/lib/blogApi.ts');
  assert.match(sitemap, /noIndex\?: boolean \| null/);
  assert.match(sitemap, /row\.status !== "PUBLISHED" \|\| row\.noIndex === true/);
  assert.match(article, /robots:\s*\{\s*index:\s*!post\.noIndex,\s*follow:\s*true\s*\}/);
  assert.match(postType, /noIndex:\s*boolean;/);
});

test('sitemap vehicle eligibility matches active classified indexing policy', () => {
  const sitemap = read('src/app/sitemap.ts');
  const vehicle = read('src/app/buy-cars/[slug]/page.tsx');
  const retailSeo = read('src/components/seo/RetailVehicleJsonLd.tsx');
  assert.match(sitemap, /row\.type !== "CLASSIFIED" \|\| row\.status !== "ACTIVE"/);
  assert.match(vehicle, /const indexable = indexableRetail\(listing as Listing\)/);
  assert.match(retailSeo, /l\.type === "CLASSIFIED" && l\.status === "ACTIVE"/);
  assert.match(vehicle, /robots:\s*\{\s*index:\s*indexable,\s*follow:\s*indexable\s*\}/);
});

test('sitemap remains paginated, bounded, and stays on canonical www host', () => {
  const sitemap = read('src/app/sitemap.ts');
  const robots = read('src/app/robots.ts');
  assert.match(sitemap, /const BASE_URL = "https:\/\/www\.carmazium\.com"/);
  assert.match(sitemap, /const PAGE_SIZE = 250/);
  assert.match(sitemap, /const MAX_LISTING_URLS = 35_000/);
  assert.match(sitemap, /const MAX_BLOG_URLS = 12_000/);
  assert.match(sitemap, /page:\s*String\(page\)/);
  assert.match(sitemap, /payload\.pagination\?\.totalPages/);
  assert.match(robots, /sitemap: \x60\$\{SITE_URL\}\/sitemap\.xml\x60/);
});
