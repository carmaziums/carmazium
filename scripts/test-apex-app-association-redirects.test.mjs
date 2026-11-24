#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, parse as parseUrl, format as formatUrl } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(new URL('../next.config.ts', import.meta.url));
// Match Next's server bootstrap before loading its production routing helpers.
require('next/dist/server/node-environment-baseline');
const ts = require('typescript');
const { unstable_getResponseFromNextConfig } = require('next/experimental/testing/server');
const configPath = fileURLToPath(new URL('../next.config.ts', import.meta.url));
const compiled = ts.transpileModule(readFileSync(configPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const configModule = { exports: {} };
runInNewContext(compiled, { module: configModule, exports: configModule.exports, require }, { filename: configPath });
const nextConfig = configModule.exports.default;

async function route(url) {
  return unstable_getResponseFromNextConfig({
    url, nextConfig, headers: { host: new URL(url).host },
  });
}

test('both declared hosts serve exact association endpoints through the existing handlers without a redirect', async () => {
  for (const host of ['carmazium.com', 'www.carmazium.com']) {
    for (const [endpoint, destination] of [
      ['/.well-known/assetlinks.json', '/api/app-links/android'],
      ['/.well-known/apple-app-site-association', '/api/app-links/apple'],
    ]) {
      const response = await route('https://' + host + endpoint + '?probe=association');
      assert.equal(response.status, 200, host + endpoint);
      assert.equal(response.headers.get('location'), null, 'Association request must not leave its declared host');
      const rewritten = new URL(response.headers.get('x-middleware-rewrite'));
      assert.equal(rewritten.hostname, host);
      assert.equal(rewritten.pathname, destination);
      assert.equal(rewritten.searchParams.get('probe'), 'association');
    }
  }
});

test('ordinary apex requests permanently canonicalize to www with their path and query values preserved', async () => {
  for (const path of [
    '/',
    '/auctions',
    '/services/delivery/new?vehicleId=fixture-vehicle&source=details',
    '/services/warranty/order?id=fixture-order&payment=success',
    '/auth/login?next=%2Fdashboard%2Fservice&campaign=provider',
    '/contact?topic=vehicle%20delivery',
  ]) {
    const original = new URL('https://carmazium.com' + path);
    const response = await route(original.href);
    assert.equal(response.status, 308, path);
    const destination = new URL(response.headers.get('location'));
    assert.equal(destination.origin, 'https://www.carmazium.com');
    assert.equal(destination.pathname, original.pathname);
    assert.deepEqual([...destination.searchParams], [...original.searchParams]);
  }
});

test('www, preview and similar-looking hostnames do not match the apex redirect', async () => {
  for (const host of ['www.carmazium.com', 'carmazium-review.vercel.app', 'carmaziumXcom', 'carmazium.com.attacker.invalid']) {
    const response = await route('https://' + host + '/auctions?source=review');
    assert.equal(response.status, 200, host);
    assert.equal(response.headers.get('location'), null, host);
  }
});

test('association exceptions do not exempt unrelated well-known paths or endpoint suffixes', async () => {
  for (const path of [
    '/.well-known/security.txt',
    '/.well-known/assetlinks.json.backup',
    '/.well-known/apple-app-site-association.json',
    '/.well-known/apple-app-site-association/extra',
    '/other/.well-known/assetlinks.json',
  ]) {
    const response = await route('https://carmazium.com' + path);
    assert.equal(response.status, 308, path);
    assert.equal(new URL(response.headers.get('location')).href, 'https://www.carmazium.com' + path);
  }
});

test('existing canonical-host redirects retain their destinations', async () => {
  for (const [from, to] of [
    ['/services', '/auctions'],
    ['/finance', '/services/finance'],
    ['/admin/analytics', '/dashboard/admin/analytics'],
  ]) {
    const response = await route('https://www.carmazium.com' + from);
    assert.equal(response.status, 308, from);
    assert.equal(new URL(response.headers.get('location')).href, 'https://www.carmazium.com' + to);
  }
});


test('production redirect serialization preserves repeated query values and encoded return destinations', async () => {
  // Next 16's experimental config utility coerces array query values to a
  // comma-separated string. Exercise the actual production routing helpers
  // used by resolve-routes.js and router-server.js for this concrete case.
  const { match } = require('next/dist/compiled/path-to-regexp');
  const { prepareDestination } = require('next/dist/shared/lib/router/utils/prepare-destination');
  const { stringifyQuery } = require('next/dist/server/server-route-utils');
  const { addRequestMeta } = require('next/dist/server/request-meta');
  const redirect = (await nextConfig.redirects()).find(rule => rule.destination === 'https://www.carmazium.com/:path');
  const original = new URL('https://carmazium.com/auth/login?next=%2Fdashboard%2Fservice%3Fstatus%3Dnew&tag=one&tag=two');
  const parsed = parseUrl(original.href, true);
  const params = match(redirect.source)(parsed.pathname).params;
  const request = { headers: { host: original.host } };
  addRequestMeta(request, 'initQuery', parsed.query);
  const { parsedDestination } = prepareDestination({
    appendParamsToQuery: false, destination: redirect.destination, params, query: parsed.query,
  });
  const query = parsedDestination.query;
  delete parsedDestination.query;
  parsedDestination.search = stringifyQuery(request, query);
  const destination = new URL(formatUrl(parsedDestination));
  assert.equal(destination.origin, 'https://www.carmazium.com');
  assert.equal(destination.pathname, original.pathname);
  assert.deepEqual([...destination.searchParams], [...original.searchParams]);
});
