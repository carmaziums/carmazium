#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collectAndroidApkEvidence, verifyAndroidApkEvidence, parseApkInspection } from './android-apk-release-evidence.mjs';

const cert = 'b'.repeat(64);
const sha = 'a'.repeat(40);
const env = {
  GITHUB_SHA: sha,
  CARMAZIUM_CANDIDATE_SOURCE_SHA: sha,
  CARMAZIUM_ANDROID_RELEASE_CERT_SHA256: cert,
  CARMAZIUM_ANDROID_CANDIDATE_VERSION_CODE: '42',
  ANDROID_HOME: '/fake-test-android-sdk',
};
const signer = 'Verifies\nSigner #1 certificate SHA-256 digest: ' + cert + '\n';
const badging = "package: name='uk.carmazium.app' versionCode='42' versionName='1.0.0'\n";

function fixture(options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'carmazium-apk-evidence-test-'));
  const apk = join(dir, 'CarMazium-Android-REVIEW-ONLY.apk');
  const evidenceFile = join(dir, 'release-evidence.json');
  writeFileSync(apk, 'synthetic TEST BYTES only, not an installable APK');
  const run = (tool, args) => {
    if (options.failTool) return { status: 1, stdout: '', stderr: 'test failure' };
    if (tool.endsWith('/apksigner') && args.includes('verify'))
      return { status: 0, stdout: options.signer ?? signer };
    if (tool.endsWith('/aapt') && args.includes('badging'))
      return { status: 0, stdout: options.badging ?? badging };
    throw new Error('Unexpected synthetic tool invocation');
  };
  return { dir, apk, evidenceFile, run, close: () => rmSync(dir, { recursive: true, force: true }) };
}

test('emits private review evidence from measured bytes, signer, version and Git revision', async () => {
  const f = fixture();
  try {
    const evidence = await collectAndroidApkEvidence(f.apk, env, f.run);
    assert.equal(evidence.artifact_kind, 'INTERNAL_REVIEW_ONLY');
    assert.equal(evidence.approved_for_customer_download, false);
    assert.equal(evidence.signing_certificate_sha256, cert);
    assert.equal(evidence.source_sha, sha);
    assert.equal(evidence.package_name, 'uk.carmazium.app');
    assert.equal(evidence.version_code, '42');
    assert.match(evidence.apk_sha256, /^[a-f0-9]{64}$/);
    assert.equal(evidence.apk_size_bytes, 49);
    writeFileSync(f.evidenceFile, JSON.stringify(evidence));
    assert.deepEqual(await verifyAndroidApkEvidence(f.apk, f.evidenceFile, env, f.run), evidence);
  } finally { f.close(); }
});

test('rejects modified APK bytes and tampered metadata', async () => {
  const f = fixture();
  try {
    const evidence = await collectAndroidApkEvidence(f.apk, env, f.run);
    writeFileSync(f.evidenceFile, JSON.stringify(evidence));
    writeFileSync(f.apk, 'replaced synthetic bytes');
    await assert.rejects(verifyAndroidApkEvidence(f.apk, f.evidenceFile, env, f.run), /do not match/);
    writeFileSync(f.apk, 'synthetic TEST BYTES only, not an installable APK');
    writeFileSync(f.evidenceFile, JSON.stringify({ ...evidence, approved_for_customer_download: true }));
    await assert.rejects(verifyAndroidApkEvidence(f.apk, f.evidenceFile, env, f.run), /do not match/);
  } finally { f.close(); }
});

test('rejects invalid package, wrong version, extra signers and failed apksigner', async () => {
  for (const options of [
    { badging: "package: name='uk.carmazium.qa' versionCode='42' versionName='1.0.0'\n" },
    { badging: "package: name='uk.carmazium.app' versionCode='41' versionName='1.0.0'\n" },
    { signer: signer + 'Signer #2 certificate SHA-256 digest: ' + 'c'.repeat(64) },
    { failTool: true },
  ]) {
    const f = fixture(options);
    try { await assert.rejects(collectAndroidApkEvidence(f.apk, env, f.run)); }
    finally { f.close(); }
  }
});

test('rejects missing or wrong expected signer, Git SHA and version code', async () => {
  const f = fixture();
  try {
    for (const patch of [
      { CARMAZIUM_ANDROID_RELEASE_CERT_SHA256: 'c'.repeat(64) },
      { CARMAZIUM_ANDROID_RELEASE_CERT_SHA256: '' },
      { CARMAZIUM_CANDIDATE_SOURCE_SHA: 'f'.repeat(40) },
      { GITHUB_SHA: 'invalid' },
      { CARMAZIUM_ANDROID_CANDIDATE_VERSION_CODE: '0' },
      { CARMAZIUM_ANDROID_CANDIDATE_VERSION_CODE: '2147483648' },
    ]) await assert.rejects(collectAndroidApkEvidence(f.apk, { ...env, ...patch }, f.run));
  } finally { f.close(); }
});

test('rejects bogus inspection output and keeps customer-download gate closed', () => {
  assert.throws(() => parseApkInspection('', badging), /exactly one/);
  assert.throws(() => parseApkInspection(signer, 'package: missing'), /metadata unavailable/);
  const root = new URL('..', import.meta.url);
  const workflow = readFileSync(new URL('.github/workflows/carmazium-android-release-candidate.yml', root), 'utf8');
  const ci = readFileSync(new URL('.github/workflows/release-certification.yml', root), 'utf8');
  assert.match(workflow, /android-apk-release-evidence\.mjs create/);
  assert.match(workflow, /android-apk-release-evidence\.mjs verify/);
  assert.match(workflow, /CarMazium-Android-REVIEW-ONLY/);
  assert.doesNotMatch(workflow, /deploy-to-production|eas submit|curl --upload-file/);
  assert.match(ci, /test-android-apk-release-evidence\.test\.mjs/);
});
