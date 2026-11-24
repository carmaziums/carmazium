#!/usr/bin/env node
/**
 * Stage already-public, reviewed Android releases as verified static assets.
 * This does not build, sign, approve or publish a new customer app.
 * Only Vercel builds download assets; local/ordinary CI builds remain offline.
 */
import { createHash } from 'node:crypto';
import { createReadStream, closeSync, openSync, writeSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(REPO_ROOT, 'scripts', 'approved-android-downloads.json');
const APK_TYPE = 'application/vnd.android.package-archive';
const MAX_APK_BYTES = 350 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const SHA256 = /^[a-f0-9]{64}$/;
const SHA40 = /^[a-f0-9]{40}$/;
const APK_NAME = /^CarMazium-(\d+\.\d+\.\d+)-v([1-9]\d{0,9})\.apk$/;

export function validateApprovedDownloads(manifest) {
  if (manifest?.schema_version !== 1 || !Array.isArray(manifest.releases) || !manifest.releases.length)
    throw new Error('Approved Android download manifest is missing or invalid');
  const seen = new Set();
  for (const release of manifest.releases) {
    const name = APK_NAME.exec(release?.filename || '');
    if (!name || seen.has(release.filename) || release.publication_status !== 'already-public' ||
        release.package_name !== 'uk.carmazium.app' ||
        release.version_name !== name[1] || !Number.isSafeInteger(release.version_code) ||
        release.version_code !== Number(name[2]) || release.version_code > 2147483647 ||
        !Number.isSafeInteger(release.apk_size_bytes) || release.apk_size_bytes < 1024 ||
        release.apk_size_bytes > MAX_APK_BYTES || !SHA256.test(release.apk_sha256 || '') ||
        !SHA256.test(release.signing_certificate_sha256 || '') || !SHA40.test(release.source_sha || ''))
      throw new Error('Approved Android download manifest contains inconsistent release evidence');
    seen.add(release.filename);
  }
  return manifest.releases;
}

export function validateAdvertisedDownload(env, releases) {
  const approved = env.NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED;
  const url = env.NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL;
  const hash = env.NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256;
  if ([approved, url, hash].every(value => value === undefined || value === '')) return null;
  if (approved === 'false') return null; // Disabling the CTA does not unpublish historical releases.
  if (approved !== 'true')
    throw new Error('Partially configured Android advertisement: approval must be explicitly true or false');
  const release = releases.find(item => url === 'https://www.carmazium.com/downloads/' + item.filename);
  if (!release || typeof hash !== 'string' || hash.toLowerCase() !== release.apk_sha256)
    throw new Error('Approved Android advertisement must exactly match a staged manifest URL and checksum');
  return release;
}

export function releaseSourceUrl(release) {
  const tag = release.filename.slice(0, -4);
  return 'https://github.com/carmaziums/carmazium/releases/download/' + tag + '/' + release.filename;
}

export function validateUpstreamUrl(raw, release) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('APK upstream URL is invalid'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash)
    throw new Error('APK upstream must use trusted HTTPS without credentials');
  const exactRelease = url.toString() === releaseSourceUrl(release);
  const trustedAsset = url.hostname === 'release-assets.githubusercontent.com' &&
    /^\/github-production-release-asset\/1342421207\/[a-zA-Z0-9-]+$/.test(url.pathname);
  if (!exactRelease && !trustedAsset)
    throw new Error('APK upstream redirect host or repository path is not trusted');
  return url;
}

async function fetchApk(release, fetchImpl) {
  let url = validateUpstreamUrl(releaseSourceUrl(release), release);
  const signal = AbortSignal.timeout(120_000);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const response = await fetchImpl(url.toString(), {
      method: 'GET', redirect: 'manual', cache: 'no-store', signal,
      headers: { Accept: APK_TYPE, 'Accept-Encoding': 'identity' },
    });
    if (response?.redirected || (response?.url && response.url !== url.toString())) {
      await response?.body?.cancel();
      throw new Error('APK fetch unexpectedly followed a redirect');
    }
    if ([301, 302, 303, 307, 308].includes(response?.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || redirects === MAX_REDIRECTS)
        throw new Error('APK upstream redirect limit or missing destination');
      url = validateUpstreamUrl(new URL(location, url).toString(), release);
      continue;
    }
    const type = response?.headers?.get('content-type')?.split(';')[0].trim().toLowerCase();
    const encoding = response?.headers?.get('content-encoding');
    const length = response?.headers?.get('content-length');
    if (response?.status !== 200 || !response.body || type !== APK_TYPE ||
        (encoding && encoding.toLowerCase() !== 'identity') ||
        (length !== null && length !== undefined &&
          (!/^[0-9]+$/.test(length) || Number(length) !== release.apk_size_bytes))) {
      await response?.body?.cancel();
      throw new Error('APK upstream did not return the attested, unencoded APK response');
    }
    return response.body;
  }
  throw new Error('APK upstream redirect limit exceeded');
}

async function verifyChunks(chunks, release, consume = () => {}) {
  const hash = createHash('sha256');
  const prefix = Buffer.alloc(4);
  let prefixBytes = 0;
  let bytes = 0;
  for await (const part of chunks) {
    const chunk = Buffer.from(part);
    bytes += chunk.length;
    if (bytes > release.apk_size_bytes || bytes > MAX_APK_BYTES)
      throw new Error('APK bytes exceed the attested size');
    if (prefixBytes < 4) {
      const count = Math.min(4 - prefixBytes, chunk.length);
      chunk.copy(prefix, prefixBytes, 0, count);
      prefixBytes += count;
    }
    hash.update(chunk);
    consume(chunk);
  }
  if (bytes !== release.apk_size_bytes || prefixBytes !== 4 ||
      !prefix.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
      hash.digest('hex') !== release.apk_sha256)
    throw new Error('APK size, ZIP signature or checksum differs from approved evidence');
}

async function stageRelease(release, root, fetchImpl) {
  const outputDir = join(root, 'public', 'downloads');
  const output = join(outputDir, release.filename);
  await mkdir(outputDir, { recursive: true });
  let existing;
  try { existing = await lstat(output); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing) {
    if (!existing.isFile() || existing.isSymbolicLink())
      throw new Error('APK output path must be a regular file');
    try {
      await verifyChunks(createReadStream(output), release);
    } catch {
      await rm(output, { force: true });
      throw new Error('Cached APK failed verification; refusing to reuse or silently replace it');
    }
    return { filename: release.filename, reused: true, size_bytes: release.apk_size_bytes, sha256: release.apk_sha256 };
  }

  // The private temporary file is outside public, on the same volume for rename.
  const temporary = await mkdtemp(join(root, '.android-download-stage-'));
  const partial = join(temporary, 'download.part');
  try {
    const body = await fetchApk(release, fetchImpl);
    const descriptor = openSync(partial, 'wx', 0o600);
    try {
      await verifyChunks(body, release, chunk => {
        let offset = 0;
        while (offset < chunk.length) {
          const written = writeSync(descriptor, chunk, offset, chunk.length - offset);
          if (!written) throw new Error('APK staging write did not make progress');
          offset += written;
        }
      });
    } finally { closeSync(descriptor); }
    await rename(partial, output);
    return { filename: release.filename, reused: false, size_bytes: release.apk_size_bytes, sha256: release.apk_sha256 };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function stageApprovedAndroidDownloads({
  root = REPO_ROOT, env = process.env, manifest, fetchImpl = globalThis.fetch,
} = {}) {
  if (env.VERCEL !== '1') return { skipped: true, reason: 'not a Vercel build', releases: [] };
  const approved = manifest ?? JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const releases = validateApprovedDownloads(approved);
  validateAdvertisedDownload(env, releases);
  const staged = [];
  for (const release of releases) staged.push(await stageRelease(release, root, fetchImpl));
  return { skipped: false, releases: staged };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await stageApprovedAndroidDownloads();
    if (result.skipped) console.log('Approved static APK staging skipped outside Vercel; no download performed.');
    else for (const release of result.releases)
      console.log('Verified static APK: ' + release.filename + ' (' + release.size_bytes + ' bytes, SHA-256 ' + release.sha256 + ')');
  } catch (error) {
    console.error('Approved static APK staging BLOCKED: ' + error.message);
    process.exitCode = 1;
  }
}
