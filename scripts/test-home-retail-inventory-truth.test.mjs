#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');

test('homepage previews active public retail listings beyond boosted inventory', () => {
  const page = read('src/app/page.tsx');
  const home = read('src/app/HomeClient.tsx');
  const backend = read('backend/src/listings/listings.controller.ts');
  assert.match(page, /\/listings\?page=1&limit=20&sortBy=newest/);
  assert.match(page, /listing\.status === "ACTIVE"/);
  assert.match(page, /getRecentRetailListings\(\)/);
  assert.match(page, /getFeaturedListings\(\)/);
  assert.match(page, /latestRetailListings=\{latestRetailListings\}/);
  assert.match(backend, /filterDto\.listingType === 'AUCTION'/);
  assert.match(home, /featuredIds\.has\(listing\.id\)/);
  assert.match(home, /moreRetailCars\.map\(\(listing\)/);
  assert.match(home, /More Cars to Explore/);
  assert.match(home, /Explore the Full Car Marketplace/);
  assert.match(home, /href="\/search"/);
  assert.doesNotMatch(home, /\{\s*\d+\s*\}\s*(?:cars|vehicles) available/i);
});

test('marketplace cards never substitute a different car for missing seller photographs', () => {
  const home = read('src/app/HomeClient.tsx');
  const card = read('src/components/features/CarCard.tsx');
  assert.doesNotMatch(home, /image=\{listing\.images\?\.\[0\] \|\| "\/assets\/images\/featured-sports\.png"\}/);
  assert.match(home, /image=\{listing\.images\?\.\[0\] \|\| ""\}/);
  assert.match(card, /gallery\.length > 0 \? \(/);
  assert.match(card, /Vehicle photos not supplied/);
  assert.match(card, /<CardImageCarousel/);
});

test('homepage does not imply CarMazium holds or guarantees vehicle funds', () => {
  const home = read('src/app/HomeClient.tsx');
  assert.match(home, /Pay the Seller Directly/);
  assert.match(home, /Independent checks advised/);
  assert.doesNotMatch(home, /title: "Secure Transaction"/);
});
