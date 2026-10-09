#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const native = path => readFileSync(resolve(root, 'carmazium app/carmazium app', path), 'utf8');

test('retail and auction detail use one gearbox formatter without guessing automatic', () => {
  const formatter = native('src/lib/transmission.ts');
  for (const [raw, mapped] of [
    ['MANUAL', 'Manual'], ['AUTOMATIC', 'Automatic'], ['SEMI_AUTOMATIC', 'Semi-Automatic'],
    ['CVT', 'CVT'], ['Not specified', 'Not specified'],
  ]) {
    assert.match(formatter, new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(formatter.includes(`return '${mapped}'`), `Missing ${mapped} mapping`);
  }
  assert.match(formatter, /default: return 'Not specified'/);
  const retail = native('src/lib/listingsApi.ts');
  assert.match(retail, /return formatTransmission\(raw\)/);
  const auction = native('src/lib/auctionApi.ts');
  assert.match(auction, /transmission: mapTransmission\(l\?\.transmission\)/);
  assert.doesNotMatch(auction, /l\?\.transmission === 'MANUAL' \? 'Manual' : 'Automatic'/);
});

test('gearbox is visible without opening auction or compact retail cards', () => {
  const auctionChips = native('src/components/AuctionCardBadges.tsx');
  assert.match(auctionChips, /Gearbox: \$\{formatTransmission\(transmission\)\}/);
  assert.match(native('src/components/LiveBidCard.tsx'), /transmission=\{auction\.transmission\}/);
  const home = native('src/screens/main/HomeScreen.tsx');
  assert.match(home, /mapTransmission\(l\?\.transmission\)/);
  assert.doesNotMatch(home, /l\.transmission === 'MANUAL' \? 'Manual' : 'Auto'/);
  const card = native('src/components/VehicleCard.tsx');
  const row = card.split('{/* Spec row */}')[1]?.split('{!compact &&')[0];
  assert.ok(row && row.includes("Gearbox:"), 'Gearbox must appear above compact-only footer');
  assert.match(card, /listing\.bhp > 0 &&/);
});

test('buy/search and saved cars show gearbox even when not disclosed', () => {
  const horizontal = native('src/components/HorizontalVehicleCard.tsx');
  assert.match(horizontal, /Gearbox: \$\{listing\.transmission \|\| 'Not specified'\}/);
  const saved = native('src/screens/main/SavedScreen.tsx');
  assert.match(saved, /Gearbox: \{listing\.transmission \|\| 'Not specified'\}/);
  assert.match(saved, /Gearbox: \$\{listing\.transmission \|\| 'Not specified'\}/);
});

test('auction cards use actual feature flags and never fake a car photo', () => {
  const live = native('src/screens/main/LiveScreen.tsx');
  assert.match(live, /images: a\.listing\.images \?\? \[\]/);
  assert.match(live, /isFeatured: a\.listing\.isFeatured === true/);
  assert.doesNotMatch(live, /isFeatured: true,/);
  assert.doesNotMatch(live, /images\.unsplash\.com/);
  assert.match(live, /transmission: mapTransmission\(a\.listing\.transmission\)/);
  const images = native('src/components/ImageCarousel.tsx');
  assert.match(images, /if \(data\.length === 0\)/);
  assert.match(images, /No photo available/);
});
