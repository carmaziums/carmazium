#!/usr/bin/env node
/**
 * Fail-closed, read-only validation of an APK staged at CarMazium's HTTPS domain.
 * Run before enabling the download button, and rerun after website deployment.
 * Passing is NOT permission to publish or approval of the app's functionality.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, openSync, closeSync, writeSync, rmSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseApkInspection } from './android-apk-release-evidence.mjs';

const SHA256 = /^[a-f0-9]{64}$/i;
const SHA40 = /^[a-f0-9]{40}$/i;
const MAX_APK_BYTES = 350 * 1024 * 1024;
const MIME = 'application/vnd.android.package-archive';

export function validateFirstPartyApkUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('APK URL is missing');
  let url;
  try { url = new URL(raw); } catch { throw new Error('Invalid APK URL'); }
  if (url.protocol !== 'https:' ||
      !['www.carmazium.com', 'carmazium.com'].includes(url.hostname) ||
      url.port || url.username || url.password || url.search || url.hash ||
      !/^\/downloads\/[a-z0-9][a-z0-9._-]{2,127}\.apk$/i.test(url.pathname) ||
      /(?:^|[-_.])(qa|debug|preview|staging|test|dev|review-only)(?:[-_.]|$)/i.test(basename(url.pathname)))
    throw new Error('APK must have a clean first-party versioned HTTPS download URL');
  return url;
}

export function validateInternalReviewEvidence(evidence) {
  if (!evidence || evidence.evidence_schema !== 1 ||
      evidence.artifact_kind !== 'INTERNAL_REVIEW_ONLY' ||
      evidence.approved_for_customer_download !== false ||
      evidence.apk_filename !== 'CarMazium-Android-REVIEW-ONLY.apk')
    throw new Error('Only the original, non-public internal review evidence is permitted');
  if (evidence.package_name !== 'uk.carmazium.app' ||
      !/^[1-9][0-9]{0,9}$/.test(evidence.version_code) ||
      Number(evidence.version_code) > 2147483647 ||
      typeof evidence.version_name !== 'string' || !evidence.version_name.trim() ||
      !SHA40.test(evidence.source_sha || '') ||
      !SHA256.test(evidence.signing_certificate_sha256 || '') ||
      !SHA256.test(evidence.apk_sha256 || '') ||
      !Number.isSafeInteger(evidence.apk_size_bytes) ||
      evidence.apk_size_bytes < 1024 || evidence.apk_size_bytes > MAX_APK_BYTES)
    throw new Error('Release evidence lacks valid APK provenance and size');
  return evidence;
}

function runInspection(commandRunner, sdkHome, apkPath) {
  if (typeof sdkHome !== 'string' || !sdkHome.trim()) throw new Error('Android SDK required for signer verification');
  const tools = join(sdkHome, 'build-tools', '36.0.0');
  const call = (tool, args) => {
    const result = commandRunner(join(tools, tool), args,
      { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string')
      throw new Error('Downloaded APK failed Android SDK inspection: ' + tool);
    return result.stdout;
  };
  return parseApkInspection(
    call('apksigner', ['verify', '--verbose', '--print-certs', apkPath]),
    call('aapt', ['dump', 'badging', apkPath]),
  );
}

export async function verifyFirstPartyAndroidApk({
  url: rawUrl, evidence, fetchImpl = fetch, commandRunner = spawnSync, sdkHome = process.env.ANDROID_HOME,
}) {
  const url = validateFirstPartyApkUrl(rawUrl);
  const expected = validateInternalReviewEvidence(evidence);
  const response = await fetchImpl(url.toString(), {
    method: 'GET',
    redirect: 'manual',
    cache: 'no-store',
    headers: { Accept: MIME, 'Accept-Encoding': 'identity' },
    signal: AbortSignal.timeout(120000),
  });
  if (response?.status !== 200 || response.redirected ||
      response.url !== url.toString() || !response.body)
    throw new Error('Download is not a direct HTTP 200 response from the expected CarMazium URL');
  const type = response.headers?.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type !== MIME)
    throw new Error('Download did not return Android APK content type');
  const encoding = response.headers.get('content-encoding');
  if (encoding && encoding.toLowerCase() !== 'identity')
    throw new Error('APK download must not use content encoding');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^[0-9]+$/.test(length) || Number(length) !== expected.apk_size_bytes))
    throw new Error('HTTP content length differs from signed APK evidence');

  const temp = mkdtempSync(join(tmpdir(), 'carmazium-hosted-apk-check-'));
  const filePath = join(temp, 'hosted-apk.apk');
  try {
    const handle = openSync(filePath, 'wx', 0o600);
    let bytes = 0;
    const sha256 = createHash('sha256');
    const prefix = Buffer.alloc(4);
    let prefixBytes = 0;
    try {
      for await (const part of response.body) {
        const chunk = Buffer.from(part);
        bytes += chunk.length;
        if (bytes > MAX_APK_BYTES || bytes > expected.apk_size_bytes)
          throw new Error('Downloaded APK exceeds attested size');
        if (prefixBytes < 4) {
          const take = Math.min(4 - prefixBytes, chunk.length);
          chunk.copy(prefix, prefixBytes, 0, take);
          prefixBytes += take;
        }
        sha256.update(chunk);
        writeSync(handle, chunk);
      }
    } finally { closeSync(handle); }
    if (prefixBytes !== 4 || !prefix.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])))
      throw new Error('Downloaded content is not a ZIP-format APK');
    if (bytes !== expected.apk_size_bytes || sha256.digest('hex') !== expected.apk_sha256.toLowerCase())
      throw new Error('Hosted APK bytes do not match internal signer-verified artifact');
    const actual = runInspection(commandRunner, sdkHome, filePath);
    if (actual.signing_certificate_sha256 !== expected.signing_certificate_sha256.toLowerCase() ||
        actual.package_name !== expected.package_name ||
        actual.version_code !== expected.version_code ||
        actual.version_name !== expected.version_name)
      throw new Error('Hosted APK signer, package or version differs from release evidence');
    return {
      verified: true,
      customer_release_approved: false,
      url: url.toString(),
      sha256: expected.apk_sha256.toLowerCase(),
      size_bytes: bytes,
      package_name: actual.package_name,
      version_code: actual.version_code,
      signing_certificate_sha256: actual.signing_certificate_sha256,
    };
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [url, evidencePath] = process.argv.slice(2);
  try {
    if (!url || !evidencePath)
      throw new Error('Usage: node scripts/verify-first-party-android-apk.mjs <HTTPS APK URL> <release-evidence.json>');
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    const result = await verifyFirstPartyAndroidApk({ url, evidence });
    console.log('Hosted Android APK bytes, signature, package and version: VERIFIED');
    console.log('Source evidence APK SHA-256: ' + result.sha256);
    console.log('Website customer release approval: NOT GRANTED BY THIS CHECK');
  } catch (error) {
    console.error('Hosted Android APK verification BLOCKED: ' + error.message);
    process.exitCode = 1;
  }
}
