#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const readMobile = path => readFileSync(resolve(root, 'carmazium app/carmazium app', path), 'utf8');
const readBackend = path => readFileSync(resolve(root, 'backend', path), 'utf8');

test('mobile valuations only use authoritative backend values, never fabricated prices', () => {
  const api = readMobile('src/lib/valuationApi.ts');
  assert.doesNotMatch(api, /localFallbackValuation|BASE_NEW_VALUES/);
  assert.match(api, /fetch\(\x60\$\{API_URL\}\/listings\/valuation\?/);
  assert.match(api, /body\?\.success !== true/);
  assert.match(api, /Number\.isFinite\(marketValue\)/);
  assert.match(api, /error\?\.name === 'AbortError'/);
  assert.match(api, /throw new Error\('VALUATION_TIMEOUT'\)/);
  assert.match(api, /throw new Error\('VALUATION_UNAVAILABLE'\)/);
  const form = readMobile('src/screens/sell/SellCarFlowScreen.tsx');
  assert.match(form, /setBaseValuation\(null\)/);
  assert.match(form, /Valuation is temporarily unavailable\. You can still enter your own price/);
  assert.match(form, /valuation\.confidence === 'LOW' \? 'LOW-CONFIDENCE PRICE GUIDE'/);
});

test('switching registration invalidates old DVLA model MOT specs and price', () => {
  const form = readMobile('src/screens/sell/SellCarFlowScreen.tsx');
  const section = form.split('const handlePlateChange = (raw: string) => {')[1]?.split('// ─── DVLA Lookup ─')[0] ?? '';
  assert.ok(section.includes('const switchingVehicle = previousRegistration.length >= 7'));
  for (const expected of [
    "lookupRequestRef.current += 1", "setMake('')", "setModel('')", "setYear('')",
    "setMotStatus('')", "setMotHistory([])", "setTaxStatus('')", "setFuelType('')",
    "setMileage('')", "valuationRequestId.current += 1", "setBaseValuation(null)",
    "setValuation(null)", "setPriceAsking('')", "setReservePrice('')",
  ]) assert.ok(section.includes(expected), `Missing vehicle reset: ${expected}`);
  assert.match(form, /if \(requestId !== lookupRequestRef\.current \|\| clean !== currentVrmRef\.current\) return;/);
});

test('seller and winning auction lists load complete authoritative pages', () => {
  const api = readMobile('src/lib/myAuctionsApi.ts');
  assert.match(api, /\/auctions\/my\/\$\{kind\}\?page=\$\{page\}&limit=\$\{PAGE_SIZE\}/);
  assert.match(api, /seen|found\.size === total/);
  assert.match(api, /expectedTotal !== total/);
  assert.match(api, /if \(response\.data\.data\.length === 0\)/);
  const page = readMobile('src/screens/seller/SellerAuctionsScreen.tsx');
  assert.match(page, /fetchAllMyAuctions<AuctionItem>\('list'\)/);
  assert.match(page, /fetchAllMyAuctions<WonAuctionItem>\('won'\)/);
  assert.doesNotMatch(page, /auctions\/my\/list\?page=1&limit=50/);
  assert.doesNotMatch(page, /auctions\/my\/won\?page=1&limit=50/);
  assert.match(page, /<ErrorBanner/);
  assert.match(page, /setAuctionsFetchError/);
  assert.match(page, /setWonFetchError/);
  const controller = readBackend('src/auctions/auctions.controller.ts');
  assert.match(controller, /@Get\('my\/list'\)/);
  assert.match(controller, /@Get\('my\/won'\)/);
});
