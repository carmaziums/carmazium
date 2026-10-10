#!/usr/bin/env node
/** Fail-closed validation of the existing Android release signing identity.
 * This utility never creates a production key, prints passwords, or publishes APKs.
 */
import { X509Certificate } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SHA256 = /^[a-f0-9]{64}$/i;

export function validateReleaseCertificate(pem, expectedDigest, now = new Date()) {
  if (typeof expectedDigest !== 'string' || !SHA256.test(expectedDigest))
    throw new Error('Missing valid owner-pinned signing certificate SHA-256');
  const cert = new X509Certificate(pem);
  const actual = cert.fingerprint256.replaceAll(':', '').toLowerCase();
  if (actual !== expectedDigest.toLowerCase())
    throw new Error('Release signing certificate does not match approved fingerprint');
  if (/Android Debug/i.test(cert.subject))
    throw new Error('Android debug signing certificate is not allowed');
  const from = Date.parse(cert.validFrom);
  const until = Date.parse(cert.validTo);
  const instant = new Date(now).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(until) || instant < from || until <= instant)
    throw new Error('Release signing certificate is not currently valid');
  if (until - instant < 90 * 24 * 60 * 60 * 1000)
    throw new Error('Release signing certificate expires within 90 days');
  const key = cert.publicKey;
  const keyType = key.asymmetricKeyType;
  if (keyType === 'rsa' || keyType === 'rsa-pss') {
    if ((key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048)
      throw new Error('Signing certificate RSA key is too weak');
  } else if (keyType === 'ec') {
    if (!['prime256v1', 'secp384r1', 'secp521r1'].includes(key.asymmetricKeyDetails?.namedCurve))
      throw new Error('Signing certificate EC curve is not approved');
  } else {
    throw new Error('Unexpected release signing certificate public-key type');
  }
  return { fingerprint: actual, validUntil: new Date(until).toISOString(), keyType };
}

export function verifyAndroidReleaseKeystore(env = process.env) {
  const file = env.CARMAZIUM_ANDROID_RELEASE_KEYSTORE_PATH;
  const alias = env.CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS;
  for (const [name, value] of Object.entries({
    CARMAZIUM_ANDROID_RELEASE_KEYSTORE_PATH: file,
    CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS: alias,
    CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD: env.CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD,
    CARMAZIUM_ANDROID_RELEASE_KEY_PASSWORD: env.CARMAZIUM_ANDROID_RELEASE_KEY_PASSWORD,
    CARMAZIUM_ANDROID_RELEASE_CERT_SHA256: env.CARMAZIUM_ANDROID_RELEASE_CERT_SHA256,
  })) {
    if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value))
      throw new Error('Signing preflight is missing or has malformed secret: ' + name);
  }
  if (/^(debug|androiddebugkey)$/i.test(alias))
    throw new Error('Debug signing alias cannot be used');
  const path = resolve(file);
  if (!existsSync(path) || !lstatSync(path).isFile() || (lstatSync(path).mode & 0o077) !== 0)
    throw new Error('Release keystore must be a private, regular file');

  // Passwords are supplied to keytool via environment variable names, never argv.
  const publicCertificate = spawnSync('keytool', [
    '-exportcert', '-rfc', '-keystore', path, '-alias', alias,
    '-storepass:env', 'CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD',
  ], { env, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
  if (publicCertificate.status !== 0 || !publicCertificate.stdout?.includes('BEGIN CERTIFICATE'))
    throw new Error('Release certificate unavailable: check keystore, alias and store password');
  const cert = validateReleaseCertificate(publicCertificate.stdout, env.CARMAZIUM_ANDROID_RELEASE_CERT_SHA256);

  // Prove access to the private signing key, not merely the public certificate.
  const dir = mkdtempSync(join(tmpdir(), 'carmazium-csr-proof-'));
  try {
    const proof = join(dir, 'private-key-proof.csr');
    const result = spawnSync('keytool', [
      '-certreq', '-keystore', path, '-alias', alias, '-file', proof,
      '-storepass:env', 'CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD',
      '-keypass:env', 'CARMAZIUM_ANDROID_RELEASE_KEY_PASSWORD',
    ], { env, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
    if (result.status !== 0 || !existsSync(proof))
      throw new Error('Release private-key proof failed: verify alias and key password');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return cert;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = verifyAndroidReleaseKeystore();
    console.log('Release keystore preflight PASSED (private key, certificate pin and validity verified).');
    console.log('Certificate valid until: ' + result.validUntil);
  } catch (error) {
    console.error('Release keystore preflight BLOCKED: ' + error.message);
    process.exitCode = 1;
  }
}
