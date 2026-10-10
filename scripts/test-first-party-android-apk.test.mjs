#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateFirstPartyApkUrl, validateInternalReviewEvidence, verifyFirstPartyAndroidApk } from './verify-first-party-android-apk.mjs';

const file = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(4096, 0x42)]);
const sha = createHash('sha256').update(file).digest('hex');
const cert = 'c'.repeat(64);
const url = 'https://www.carmazium.com/downloads/CarMazium-1.0.0-v42.apk';
const evidence = {
  evidence_schema: 1,
  artifact_kind: 'INTERNAL_REVIEW_ONLY',
  approved_for_customer_download: false,
  apk_filename: 'CarMazium-Android-REVIEW-ONLY.apk',
  package_name: 'uk.carmazium.app',
  version_code: '42',
  version_name: '1.0.0',
  source_sha: 'a'.repeat(40),
  signing_certificate_sha256: cert,
  apk_sha256: sha,
  apk_size_bytes: file.length,
};
const signer = 'Verifies\nSigner #1 certificate SHA-256 digest: ' + cert + '\n';
const badging = "package: name='uk.carmazium.app' versionCode='42' versionName='1.0.0'\n";
function makeResponse({ data = file, status = 200, contentType = 'application/vnd.android.package-archive',
  contentLength = String(file.length), redirected = false, responseUrl = url, encoding = null } = {}) {
  const headers = new Headers({ 'content-type': contentType });
  if (contentLength !== null) headers.set('content-length', contentLength);
  if (encoding) headers.set('content-encoding', encoding);
  return {
    status, redirected, url: responseUrl, headers,
    body: new ReadableStream({
      start(controller) {
        // Exercise chunked downloads, including a split ZIP header.
        controller.enqueue(data.subarray(0, 2));
        controller.enqueue(data.subarray(2));
        controller.close();
      },
    }),
  };
}
function makeRunner({ actualSigner = signer, actualBadging = badging, fail = false } = {}) {
  return (command, args) => {
    if (fail) return { status: 1, stdout: '', error: new Error('synthetic inspection failure') };
    if (command.endsWith('/apksigner') && args.includes('verify'))
      return { status: 0, stdout: actualSigner };
    if (command.endsWith('/aapt') && args.includes('badging'))
      return { status: 0, stdout: actualBadging };
    throw new Error('Unexpected inspection command');
  };
}
const check = (options = {}) => verifyFirstPartyAndroidApk({
  url: options.url ?? url,
  evidence: options.evidence ?? evidence,
  fetchImpl: async (target, args) => {
    assert.equal(target, options.url ?? url);
    assert.equal(args.redirect, 'manual');
    assert.equal(args.cache, 'no-store');
    return makeResponse(options.response);
  },
  commandRunner: makeRunner(options.runner),
  sdkHome: '/synthetic-android-sdk',
});

test('verifies staged CarMazium APK bytes and Android identity but never approves customer release', async () => {
  const observed = await check();
  assert.equal(observed.verified, true);
  assert.equal(observed.customer_release_approved, false);
  assert.equal(observed.sha256, sha);
  assert.equal(observed.package_name, 'uk.carmazium.app');
  assert.equal(observed.version_code, '42');
});

test('rejects unexpected domains, credentials, query strings, encoded paths and debug builds', () => {
  for (const bad of [
    'http://www.carmazium.com/downloads/CarMazium-v42.apk',
    'https://www.carmazium.com.evil.example/downloads/CarMazium-v42.apk',
    'https://evil.example/downloads/CarMazium-v42.apk',
    'https://www.carmazium.com:1234/downloads/CarMazium-v42.apk',
    'https://user:pass@www.carmazium.com/downloads/CarMazium-v42.apk',
    'https://www.carmazium.com/downloads/CarMazium-v42.apk?track=1',
    'https://www.carmazium.com/downloads/CarMazium-v42.apk#fragment',
    'https://www.carmazium.com/downloads/carmazium-preview.apk',
    'https://www.carmazium.com/downloads/CarMazium-REVIEW-ONLY.apk',
    'https://www.carmazium.com/downloads/%2e%2e%2fCarMazium.apk',
    'https://www.carmazium.com/downloads/another/file.apk',
    'https://www.carmazium.com/download-app',
  ]) assert.throws(() => validateFirstPartyApkUrl(bad), undefined, bad);
});

test('rejects wrong bytes, length, content type, encoded content and misleading redirects', async () => {
  for (const response of [
    { data: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(4096, 0x33)]) },
    { data: Buffer.from('not an APK'), contentLength: null },
    { contentType: 'text/html' },
    { contentLength: '1234' },
    { encoding: 'gzip' },
    { status: 404 },
    { status: 302 },
    { redirected: true },
    { responseUrl: 'https://cdn.evil.example/app.apk' },
  ]) await assert.rejects(check({ response }));
});

test('rejects wrong certificate, package, version, multiple signers or failed Android verification', async () => {
  for (const runner of [
    { actualSigner: signer.replace(cert, 'd'.repeat(64)) },
    { actualSigner: signer + 'Signer #2 certificate SHA-256 digest: ' + 'e'.repeat(64) },
    { actualBadging: "package: name='uk.carmazium.qa' versionCode='42' versionName='1.0.0'\n" },
    { actualBadging: "package: name='uk.carmazium.app' versionCode='41' versionName='1.0.0'\n" },
    { fail: true },
  ]) await assert.rejects(check({ runner }));
});

test('never accepts a forged public approval or corrupted original release evidence', async () => {
  for (const patch of [
    { approved_for_customer_download: true },
    { artifact_kind: 'PUBLIC_RELEASE' },
    { apk_sha256: 'f'.repeat(64) },
    { source_sha: 'invalid' },
    { version_code: '0' },
    { apk_size_bytes: 0 },
    { package_name: 'uk.carmazium.qa' },
  ]) {
    const altered = { ...evidence, ...patch };
    if (patch.apk_sha256) {
      await assert.rejects(check({ evidence: altered }));
    } else {
      assert.throws(() => validateInternalReviewEvidence(altered));
    }
  }
});
