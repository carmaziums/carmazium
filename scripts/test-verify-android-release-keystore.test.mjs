#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, chmodSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { validateReleaseCertificate, verifyAndroidReleaseKeystore } from './verify-android-release-keystore.mjs';

// Synthetic CI fixture ONLY, ephemeral and never approved for customer signing.
const dir = mkdtempSync(join(tmpdir(), 'carmazium-ephemeral-signing-test-'));
const keystore = join(dir, 'test-only.jks');
const password = 'synthetic-fixture-password';
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
execFileSync('keytool', [
  '-genkeypair', '-alias', 'synthetic-fixture', '-keyalg', 'RSA', '-keysize', '2048',
  '-validity', '3650', '-dname', 'CN=Local CI fixture for CarMazium tests',
  '-keystore', keystore, '-storetype', 'JKS',
  '-storepass', password, '-keypass', password, '-noprompt',
], { stdio: 'pipe' });
chmodSync(keystore, 0o600);
const pem = execFileSync('keytool', [
  '-exportcert', '-rfc', '-alias', 'synthetic-fixture', '-keystore', keystore,
  '-storepass', password,
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const fingerprint = new X509Certificate(pem).fingerprint256.replaceAll(':', '').toLowerCase();
const env = {
  CARMAZIUM_ANDROID_RELEASE_KEYSTORE_PATH: keystore,
  CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS: 'synthetic-fixture',
  CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD: password,
  CARMAZIUM_ANDROID_RELEASE_KEY_PASSWORD: password,
  CARMAZIUM_ANDROID_RELEASE_CERT_SHA256: fingerprint,
};

test('synthetic keystore proves certificate pin and private-key ownership', () => {
  assert.equal(verifyAndroidReleaseKeystore(env).fingerprint, fingerprint);
});
test('reject swapped certificate fingerprint and malformed expected pin', () => {
  assert.throws(() => verifyAndroidReleaseKeystore({ ...env, CARMAZIUM_ANDROID_RELEASE_CERT_SHA256: '0'.repeat(64) }), /does not match/);
  assert.throws(() => validateReleaseCertificate(pem, 'invalid'), /owner-pinned/);
});
test('reject wrong alias, store password and private-key password', () => {
  assert.throws(() => verifyAndroidReleaseKeystore({ ...env, CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS: 'wrong' }), /unavailable/);
  assert.throws(() => verifyAndroidReleaseKeystore({ ...env, CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD: 'wrong' }), /unavailable/);
  assert.throws(() => verifyAndroidReleaseKeystore({ ...env, CARMAZIUM_ANDROID_RELEASE_KEY_PASSWORD: 'wrong' }), /proof failed/);
});
test('reject missing secrets, debug alias and unsafe file permissions', () => {
  assert.throws(() => verifyAndroidReleaseKeystore({ ...env, CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS: 'androiddebugkey' }), /Debug signing/);
  assert.throws(() => verifyAndroidReleaseKeystore({ ...env, CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD: '' }), /missing/);
  chmodSync(keystore, 0o644);
  try {
    assert.throws(() => verifyAndroidReleaseKeystore(env), /private, regular file/);
  } finally {
    chmodSync(keystore, 0o600);
  }
});
