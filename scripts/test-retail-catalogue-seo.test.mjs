import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const exports = {};
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(code, { exports, URL, URLSearchParams, require: name => name in mocks ? mocks[name] : require(name) });
  return exports;
}
const seo = load('src/components/seo/RetailVehicleJsonLd.tsx');
const car = (n, overrides = {}) => ({
  id: `id-${n}`, slug: `ford-focus-2020-${n}`, title: 'Ford Focus 2020', type: 'CLASSIFIED', status: 'ACTIVE',
  year: 2020, make: 'Ford', model: 'Focus', variant: 'ST-Line', transmission: 'AUTOMATIC', fuelType: 'PETROL',
  price: 9995, mileage: 40000, location: 'Birmingham', images: [], ...overrides,
});
function app(fetch) {
  const catalogue = load('src/lib/retailCatalogue.ts', {
    react: { cache: fn => fn }, '@/lib/serverBackendFetch': { serverBackendFetch: fetch },
    '@/components/seo/RetailVehicleJsonLd': seo,
  });
  const page = load('src/app/used-cars/page.tsx', {
    '@/lib/retailCatalogue': catalogue, '@/components/seo/RetailVehicleJsonLd': seo,
    'next/navigation': { notFound() { throw new Error('404'); } },
    'next/link': { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) },
    '@/lib/listingApi': { formatPrice: value => `£${value}` },
  });
  return { catalogue, page };
}
const props = page => ({ searchParams: Promise.resolve(page === undefined ? {} : { page }) });
const response = payload => ({ ok: true, json: async () => payload });

test('every eligible vehicle across all catalogue pages is in server HTML with real pagination anchors', async () => {
  const rows = Array.from({ length: 83 }, (_, n) => car(n));
  rows[5] = car(5, { status: 'SOLD' });
  rows[44] = car(44, { type: 'AUCTION' });
  rows[80] = car(80, { slug: 'kia-aaa-2023-abcd' });
  const { page } = app(async url => {
    const p = new URLSearchParams(url.split('?')[1]);
    assert.equal(p.get('limit'), '40');
    const n = Number(p.get('page'));
    return response({ data: rows.slice((n - 1) * 40, n * 40), pagination: { total: 83, totalPages: 3 } });
  });
  const all = new Set();
  for (let n = 1; n <= 3; n++) {
    const html = renderToStaticMarkup(await page.default(props(String(n))));
    const meta = await page.generateMetadata(props(String(n)));
    assert.equal(meta.alternates.canonical, 'https://www.carmazium.com/used-cars' + (n > 1 ? `?page=${n}` : ''));
    assert.equal(meta.robots.index, true);
    assert.equal(meta.robots.googleBot.index, true);
    assert.match(html, /href="\/used-cars\?page=2"/);
    assert.match(html, /href="\/used-cars\?page=3"/);
    for (const [, slug] of html.matchAll(/href="\/buy-cars\/([^"]+)"/g)) {
      assert.equal(all.has(slug), false); all.add(slug);
    }
  }
  assert.equal(all.size, 80);
  assert.equal(all.has(rows[82].slug), true);
  for (const i of [5, 44, 80]) assert.equal(all.has(rows[i].slug), false);
});

test('invalid pages and confirmed missing pages return 404, but outages and malformed pagination throw', async () => {
  let calls = 0;
  const { page } = app(async () => { calls++; return response({ data: [], pagination: { total: 0, totalPages: 0 } }); });
  for (const value of ['0', '-1', '1.5', 'abc', '9007199254740992', ['1', '2']]) {
    await assert.rejects(page.generateMetadata(props(value)), /404/);
  }
  assert.equal(calls, 0);
  await assert.rejects(page.default(props('2')), /404/);
  const empty = await page.generateMetadata(props());
  assert.equal(empty.robots.index, false);
  assert.equal(empty.robots.follow, true);
  for (const fetch of [
    async () => ({ ok: false, status: 503 }),
    async () => { throw new Error('network outage'); },
    async () => response({ data: [car(1)], pagination: { total: '1', totalPages: 1 } }),
    async () => response({ data: [car(1)], pagination: { total: 81, totalPages: 1 } }),
    async () => response({ data: null, pagination: { total: 0, totalPages: 0 } }),
  ]) await assert.rejects(app(fetch).page.generateMetadata(props()), /unavailable|outage|Invalid/);
});

test('unsafe and duplicate slugs are excluded and vehicle text cannot inject HTML or JSON-LD', async () => {
  const malicious = car(1, { make: '</script><script>alert(1)</script>' });
  const { page } = app(async () => response({ data: [malicious, malicious, car(2, { slug: '../private' })], pagination: { total: 3, totalPages: 1 } }));
  const html = renderToStaticMarkup(await page.default(props()));
  assert.equal([...html.matchAll(/href="\/buy-cars\//g)].length, 1);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /\\u003c\/script>/);
});

test('specific car titles use real year, make, model, trim, gearbox and location without duplicate trim', () => {
  assert.equal(seo.retailTitle(car(1)), '2020 Ford Focus ST-Line automatic for sale in Birmingham');
  assert.equal(seo.retailVehicleName(car(1, { model: 'Focus ST-Line' })), '2020 Ford Focus ST-Line');
  assert.match(seo.retailDescription(car(1)), /ST-Line/);
  assert.match(seo.retailDescription(car(1)), /9,995/);
  assert.equal(seo.RetailVehicleJsonLd({ listing: car(1, { status: 'SOLD' }) }), null);
  const html = renderToStaticMarkup(seo.RetailVehicleJsonLd({ listing: car(1) }));
  const schema = JSON.parse(html.match(/<script[^>]*>([\s\S]*)<\/script>/)[1]);
  const vehicle = schema['@graph'].find(v => v['@id'].endsWith('#vehicle'));
  assert.deepEqual(vehicle['@type'], ['Car', 'Product']);
  assert.equal(vehicle.offers.price, '9995.00');
  assert.equal(vehicle.offers.priceCurrency, 'GBP');
  assert.equal(vehicle.offers.availability, 'https://schema.org/InStock');
});
