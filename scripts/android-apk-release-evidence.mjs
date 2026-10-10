#!/usr/bin/env node
/**
 * Generate / independently recheck evidence for the exact INTERNAL REVIEW APK.
 * This tool never signs, uploads, publishes, or enables public download.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE = 'uk.carmazium.app';
const APK_NAME = 'CarMazium-Android-REVIEW-ONLY.apk';
const SHA40 = /^[0-9a-f]{40}$/i;
const SHA64 = /^[0-9a-f]{64}$/i;
const VERSION = /^[1-9][0-9]{0,9}$/;

function expectedInputs(env) {
  const sha = env.GITHUB_SHA;
  const requested = env.CARMAZIUM_CANDIDATE_SOURCE_SHA;
  const cert = env.CARMAZIUM_ANDROID_RELEASE_CERT_SHA256;
  const rawVersion = env.CARMAZIUM_ANDROID_CANDIDATE_VERSION_CODE;
  if (!SHA40.test(sha || '') || !SHA40.test(requested || '') ||
      sha.toLowerCase() !== requested.toLowerCase())
    throw new Error('Source revision is not the requested 40-character commit SHA');
  if (!SHA64.test(cert || ''))
    throw new Error('Expected signing certificate digest is absent or invalid');
  const numericVersion = Number(rawVersion);
  if (!VERSION.test(rawVersion || '') || !Number.isSafeInteger(numericVersion) ||
      numericVersion > 2147483647)
    throw new Error('Requested Android versionCode is invalid');
  if (!env.ANDROID_HOME)
    throw new Error('Android build tools directory is missing');
  return {
    source_sha: sha.toLowerCase(),
    expected_cert_sha256: cert.toLowerCase(),
    version_code: String(numericVersion),
    tools: join(env.ANDROID_HOME, 'build-tools', '36.0.0'),
  };
}

function invoke(run, path, args) {
  const result = run(path, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  if (result.error || result.status !== 0 || typeof result.stdout !== 'string')
    throw new Error('Android APK inspection command failed: ' + basename(path));
  return result.stdout;
}

export function parseApkInspection(signerOutput, badging) {
  const signers = [...signerOutput.matchAll(/Signer #(\d+) certificate SHA-256 digest:\s*([0-9a-fA-F]{64})/g)];
  if (signers.length !== 1 || signers[0][1] !== '1')
    throw new Error('APK must have exactly one valid signing certificate');
  const line = badging.split(/\r?\n/).find(s => s.startsWith('package: '));
  const match = line?.match(/^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/);
  if (!match) throw new Error('APK package/version metadata unavailable');
  return {
    signing_certificate_sha256: signers[0][2].toLowerCase(),
    package_name: match[1],
    version_code: match[2],
    version_name: match[3],
  };
}

async function hashApk(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function collectAndroidApkEvidence(apkPath, env = process.env, run = spawnSync) {
  const inputs = expectedInputs(env);
  const path = resolve(apkPath);
  if (basename(path) !== APK_NAME) throw new Error('Only the internal review APK is permitted');
  const file = lstatSync(path);
  if (!file.isFile() || file.size === 0) throw new Error('APK file is empty or not a regular file');
  const signer = invoke(run, join(inputs.tools, 'apksigner'), ['verify', '--verbose', '--print-certs', path]);
  const badging = invoke(run, join(inputs.tools, 'aapt'), ['dump', 'badging', path]);
  const inspected = parseApkInspection(signer, badging);
  if (inspected.signing_certificate_sha256 !== inputs.expected_cert_sha256)
    throw new Error('APK signer differs from owner-approved release certificate');
  if (inspected.package_name !== PACKAGE)
    throw new Error('APK has the wrong production package identity');
  if (inspected.version_code !== inputs.version_code)
    throw new Error('APK versionCode differs from requested release version');
  return {
    evidence_schema: 1,
    artifact_kind: 'INTERNAL_REVIEW_ONLY',
    approved_for_customer_download: false,
    apk_filename: APK_NAME,
    package_name: inspected.package_name,
    version_code: inspected.version_code,
    version_name: inspected.version_name,
    source_sha: inputs.source_sha,
    signing_certificate_sha256: inspected.signing_certificate_sha256,
    apk_sha256: await hashApk(path),
    apk_size_bytes: file.size,
  };
}

export async function verifyAndroidApkEvidence(apkPath, evidencePath, env = process.env, run = spawnSync) {
  const supplied = JSON.parse(readFileSync(evidencePath, 'utf8'));
  const observed = await collectAndroidApkEvidence(apkPath, env, run);
  if (JSON.stringify(supplied) !== JSON.stringify(observed))
    throw new Error('APK bytes, package, signer or source do not match evidence manifest');
  return observed;
}

const directlyInvoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (directlyInvoked) {
  const [mode, apk, evidenceFile] = process.argv.slice(2);
  try {
    if (!['create', 'verify'].includes(mode) || !apk || !evidenceFile)
      throw new Error('Usage: create|verify <review-only.apk> <release-evidence.json>');
    if (mode === 'create') {
      const evidence = await collectAndroidApkEvidence(apk);
      writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      console.log('Internal Android APK evidence generated; not approved for public download.');
    } else {
      await verifyAndroidApkEvidence(apk, evidenceFile);
      console.log('Internal APK bytes, source, signer, package and version rechecked successfully.');
    }
  } catch (error) {
    console.error('Android release evidence BLOCKED: ' + error.message);
    process.exitCode = 1;
  }
}
