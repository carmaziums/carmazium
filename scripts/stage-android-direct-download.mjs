#!/usr/bin/env node
/**
 * Stage an exact, already-signed CarMazium INTERNAL REVIEW APK for later manual
 * customer release. Never publishes, approves, signs or uploads anything.
 * Requires a separate, owner-pinned certificate SHA-256 (not merely the one
 * claimed by the review evidence) and Android SDK inspection of actual bytes.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync,
  statSync, writeFileSync, createReadStream,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEX64 = /^[a-f\d]{64}$/i;
const HEX40 = /^[a-f\d]{40}$/i;
const MIME = 'application/vnd.android.package-archive';
const MAX_BYTES = 350 * 1024 * 1024;
const REVIEW_NAME = 'CarMazium-Android-REVIEW-ONLY.apk';

async function sha256File(file) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}

function inspectApk(apk, sdkHome, commandRunner) {
  if (typeof sdkHome !== 'string' || !sdkHome.trim())
    throw new Error('ANDROID_HOME must point to Android SDK for independent signature inspection');
  const dir = join(sdkHome, 'build-tools', '36.0.0');
  const command = (name, args) => {
    const result = commandRunner(join(dir, name), args, { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string')
      throw new Error('Android SDK inspection failed: ' + name);
    return result.stdout;
  };
  const signer = command('apksigner', ['verify', '--verbose', '--print-certs', apk]);
  const matches = [...signer.matchAll(/Signer #(\d+) certificate SHA-256 digest:\s*([a-f\d]{64})/gi)];
  if (matches.length !== 1 || matches[0][1] !== '1') throw new Error('APK must have one verified release signer');
  const badging = command('aapt', ['dump', 'badging', apk]);
  const pkg = badging.split(/\r?\n/).find(x => x.startsWith('package: '))
    ?.match(/^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/);
  if (!pkg) throw new Error('APK package metadata not available');
  return { certificate: matches[0][2].toLowerCase(), package: pkg[1], versionCode: pkg[2], versionName: pkg[3] };
}

/** Creates an immutable-by-convention local staging directory; NOT release authorization. */
export async function stageAndroidDirectDownload({
  apkPath, evidencePath, outputDirectory, ownerPinnedCertificateSha256,
  sdkHome = process.env.ANDROID_HOME, commandRunner = spawnSync,
}) {
  const apk = resolve(apkPath);
  const destination = resolve(outputDirectory);
  if (basename(apk) !== REVIEW_NAME) throw new Error('Input must be the original REVIEW-ONLY APK');
  const apkStat = lstatSync(apk);
  if (!apkStat.isFile() || apkStat.size < 1024 || apkStat.size > MAX_BYTES)
    throw new Error('Input APK is not a valid-size regular file');
  if (typeof ownerPinnedCertificateSha256 !== 'string' || !HEX64.test(ownerPinnedCertificateSha256))
    throw new Error('Provide the separately verified, owner-pinned release certificate SHA-256');
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  if (evidence.evidence_schema !== 1 || evidence.artifact_kind !== 'INTERNAL_REVIEW_ONLY' ||
      evidence.approved_for_customer_download !== false || evidence.apk_filename !== REVIEW_NAME ||
      evidence.package_name !== 'uk.carmazium.app' ||
      !HEX40.test(evidence.source_sha || '') || !HEX64.test(evidence.apk_sha256 || '') ||
      !HEX64.test(evidence.signing_certificate_sha256 || '') ||
      !/^[1-9]\d{0,9}$/.test(evidence.version_code || '') ||
      Number(evidence.version_code) > 2147483647 ||
      typeof evidence.version_name !== 'string' || !/^\d+\.\d+\.\d+$/.test(evidence.version_name) ||
      evidence.apk_size_bytes !== apkStat.size)
    throw new Error('Unverified or invalid original internal review evidence');
  if (evidence.signing_certificate_sha256.toLowerCase() !== ownerPinnedCertificateSha256.toLowerCase())
    throw new Error('Review evidence does not match owner-pinned signing certificate');
  if ((await sha256File(apk)) !== evidence.apk_sha256.toLowerCase())
    throw new Error('APK SHA-256 differs from original build evidence');
  const inspected = inspectApk(apk, sdkHome, commandRunner);
  if (inspected.package !== 'uk.carmazium.app' ||
      inspected.certificate !== ownerPinnedCertificateSha256.toLowerCase() ||
      inspected.versionCode !== evidence.version_code || inspected.versionName !== evidence.version_name)
    throw new Error('APK signer, package, version or build evidence mismatch');
  if (existsSync(destination)) throw new Error('Staging directory already exists; refusing overwrite');
  const filename = `CarMazium-${inspected.versionName}-v${inspected.versionCode}.apk`;
  const manifest = {
    schema: 1,
    state: 'STAGED_NOT_APPROVED_FOR_PUBLIC_DISTRIBUTION',
    source_sha: evidence.source_sha.toLowerCase(),
    package_name: inspected.package,
    version_code: inspected.versionCode,
    version_name: inspected.versionName,
    signing_certificate_sha256: inspected.certificate,
    apk_sha256: evidence.apk_sha256.toLowerCase(),
    apk_size_bytes: apkStat.size,
    filename,
    suggested_url: `https://www.carmazium.com/downloads/${filename}`,
    mime_type: MIME,
    customer_release_approved: false,
  };
  // Only copy after all input checks pass; never write under the website root automatically.
  mkdirSync(destination, { mode: 0o700 });
  try {
    const target = join(destination, filename);
    copyFileSync(apk, target);
    if (statSync(target).size !== apkStat.size || await sha256File(target) !== manifest.apk_sha256)
      throw new Error('Staged APK differs from independently verified input');
    writeFileSync(join(destination, 'staging-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    writeFileSync(join(destination, 'SHA256SUMS.txt'), `${manifest.apk_sha256}  ${filename}\n`, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    rmSync(destination, { recursive: true, force: true });
    throw error;
  }
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [apkPath, evidencePath, outputDirectory] = process.argv.slice(2);
  try {
    if (!apkPath || !evidencePath || !outputDirectory) throw new Error('Usage: node scripts/stage-android-direct-download.mjs <REVIEW-ONLY.apk> <release-evidence.json> <NEW-staging-dir>');
    const result = await stageAndroidDirectDownload({
      apkPath, evidencePath, outputDirectory,
      ownerPinnedCertificateSha256: String(process.env.CARMAZIUM_ANDROID_RELEASE_CERT_SHA256 ?? '').replace(/^\s*SHA-?256\s*:?/i, '').replace(/[\s:]/g, '').toLowerCase(),
    });
    console.log(`Validated and staged ${result.filename}. This is NOT customer release approval.`);
    console.log(`SHA-256: ${result.apk_sha256}`);
  } catch (error) {
    console.error('Android direct APK staging BLOCKED: ' + error.message);
    process.exitCode = 1;
  }
}
