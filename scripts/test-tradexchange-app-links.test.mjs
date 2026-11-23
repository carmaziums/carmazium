import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function handler(platform, env = {}) {
  const exports = {};
  const source = readFileSync(new URL('../src/app/api/app-links/' + platform + '/route.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, Response, process: { env } });
  return exports.GET;
}
function matches(pattern, path) {
  return new RegExp('^' + pattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replaceAll('*', '.*') + '$').test(path);
}

test('Apple association covers the existing TradeXchange and provider destinations with the original app identity', async () => {
  const response = await handler('apple', { APPLE_APP_TEAM_ID: 'ABC1234567' })();
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.applinks.details.length, 1);
  const association = payload.applinks.details[0];
  assert.equal(association.appID, 'ABC1234567.uk.carmazium.app');
  for (const path of [
    '/auctions', '/services', '/auctions/how-it-works', '/auctions/browse',
    '/services/jobs', '/services/jobs/new', '/services/jobs/fixture',
    '/services/delivery', '/services/delivery/new', '/services/inspection/new',
    '/services/finance', '/finance', '/services/warranty', '/services/warranty/terms',
    '/dashboard/warranties', '/dashboard/service', '/dashboard/service/jobs',
    '/dashboard/service/jobs/fixture', '/dashboard/partner', '/become-a-partner', '/contact',
  ]) assert.ok(association.paths.some(pattern => matches(pattern, path)), path);
  for (const path of ['/dashboard/admin', '/services/not-a-service', '/auctions/unrecognised', '/services/warranty/order', '/services/warranty/orders/fixture', '/services/delivery/new/unsupported', '/services/inspection/unsupported', '/services/finance/unsupported']) {
    assert.equal(association.paths.some(pattern => matches(pattern, path)), false, 'only known native destinations: ' + path);
  }
  assert.match(response.headers.get('Cache-Control'), /max-age=300/);
});

test('missing or malformed Apple identity remains unavailable and uncached', async () => {
  for (const value of [undefined, '', 'placeholder', 'TOO-LONG-TEAM-ID']) {
    const response = await handler('apple', { APPLE_APP_TEAM_ID: value })();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal((await response.json()).applinks, undefined);
  }
});

test('Android association binds the original package to the supplied verified certificate and fails closed otherwise', async () => {
  const fingerprint = Array(32).fill('AB').join(':');
  const response = await handler('android', { ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS: fingerprint })();
  assert.equal(response.status, 200);
  const [association] = await response.json();
  assert.equal(association.target.package_name, 'uk.carmazium.app');
  assert.deepEqual(association.target.sha256_cert_fingerprints, [fingerprint]);
  assert.deepEqual(association.relation, ['delegate_permission/common.handle_all_urls']);
  for (const invalid of [undefined, '', 'debug', fingerprint + ',invalid']) {
    const failed = await handler('android', { ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS: invalid })();
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get('Cache-Control'), 'no-store');
  }
});
