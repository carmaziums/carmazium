import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import {
  releaseSourceUrl, stageApprovedAndroidDownloads, validateAdvertisedDownload,
  validateApprovedDownloads, validateUpstreamUrl,
} from './stage-approved-android-downloads.mjs';

const manifest = JSON.parse(await readFile(new URL('./approved-android-downloads.json', import.meta.url), 'utf8'));
const published = manifest.releases[0];
const bytes = Buffer.alloc(2048, 0x5a);
Buffer.from([0x50, 0x4b, 0x03, 0x04]).copy(bytes);
const hash = data => createHash('sha256').update(data).digest('hex');
const fixture = () => ({ ...manifest, releases: [{ ...published, apk_size_bytes: bytes.length, apk_sha256: hash(bytes) }] });
const envFor = release => ({
  VERCEL: '1',
  NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED: 'true',
  NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL: 'https://www.carmazium.com/downloads/' + release.filename,
  NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256: release.apk_sha256,
});
const asset = 'https://release-assets.githubusercontent.com/github-production-release-asset/1342421207/fixture-approved-asset?token=synthetic';
const response = (data = bytes, headers = {}) => new Response(data, {
  status: 200, headers: { 'Content-Type': 'application/vnd.android.package-archive', ...headers },
});
async function isolated(fn) {
  const root = await mkdtemp(join(tmpdir(), 'carmazium-static-apk-test-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function assertCleanFailure(root) {
  assert.equal(existsSync(join(root, 'public', 'downloads', published.filename)), false);
  assert.equal((await readdir(root)).some(name => name.startsWith('.android-download-stage-')), false);
}

test('the hosting manifest preserves the exact already-public original build 126', () => {
  assert.deepEqual(validateApprovedDownloads(manifest).filter(release => release.version_code === 126), [{
    filename: 'CarMazium-1.0.1-v126.apk', publication_status: 'already-public',
    package_name: 'uk.carmazium.app', version_name: '1.0.1', version_code: 126,
    apk_size_bytes: 103020948,
    apk_sha256: 'c0ac76a6a14cba1e52558beb310dbbe515400e17eaf19a8acd0e711fc655a5a1',
    signing_certificate_sha256: 'ea9b8d6733ee68d6e36ce092e81c0e360330a56dde9ed0b4edb2c421c8600f24',
    source_sha: 'b7831ff86fdac30c91a622ce3dd585d9bfbd1cbf',
  }]);
});

test('ordinary local and CI builds perform no network or filesystem staging', async () => {
  await isolated(async root => {
    const result = await stageApprovedAndroidDownloads({
      root, env: { CI: 'true' }, manifest: null,
      fetchImpl: () => { throw new Error('Local build must not download'); },
    });
    assert.equal(result.skipped, true);
    assert.deepEqual(await readdir(root), []);
  });
});

test('approved advertisement must bind the canonical filename and checksum in the manifest', () => {
  const releases = validateApprovedDownloads(manifest);
  assert.equal(validateAdvertisedDownload({}, releases), null);
  assert.equal(validateAdvertisedDownload({ NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED: 'false' }, releases), null);
  for (const release of releases) {
    assert.equal(validateAdvertisedDownload(envFor(release), releases), release);
    assert.equal(release.signing_certificate_sha256, published.signing_certificate_sha256);
  }
  for (const change of [
    { NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256: undefined },
    { NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL: undefined },
    { NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED: undefined },
    { NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED: 'yes' },
    { NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256: '0'.repeat(64) },
    { NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL: 'https://www.carmazium.com/downloads/CarMazium-1.0.2-v127.apk' },
    { NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL: 'https://carmazium.com/downloads/' + published.filename },
    { NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL: 'https://www.carmazium.com/downloads/' + published.filename + '?tracking=1' },
  ]) assert.throws(() => validateAdvertisedDownload({ ...envFor(published), ...change }, releases));
});

test('inconsistent evidence and unapproved names fail before any fetch', async () => {
  const changes = [
    { filename: '../CarMazium-1.0.1-v126.apk' }, { filename: 'CarMazium-REVIEW-ONLY.apk' },
    { publication_status: 'awaiting-acceptance' }, { package_name: 'uk.carmazium.qa' },
    { version_name: '1.0.2' }, { version_code: 127 }, { apk_size_bytes: 0 },
    { apk_size_bytes: 350 * 1024 * 1024 + 1 }, { apk_sha256: 'bad' },
    { signing_certificate_sha256: 'bad' }, { source_sha: 'main' },
  ];
  for (const change of changes) assert.throws(() => validateApprovedDownloads({
    ...manifest, releases: [{ ...published, ...change }],
  }));
  assert.throws(() => validateApprovedDownloads({ ...manifest, releases: [published, published] }));
  await isolated(async root => {
    await assert.rejects(stageApprovedAndroidDownloads({
      root, env: { ...envFor(published), NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256: '' },
      manifest, fetchImpl: () => { throw new Error('Configuration must fail before download'); },
    }), /advertisement/);
    assert.deepEqual(await readdir(root), []);
  });
});

test('upstream trust is confined to the exact release and its repository asset host', () => {
  assert.equal(validateUpstreamUrl(releaseSourceUrl(published), published).hostname, 'github.com');
  assert.equal(validateUpstreamUrl(asset, published).hostname, 'release-assets.githubusercontent.com');
  for (const raw of [
    'http://github.com/carmaziums/carmazium/releases/download/a/a.apk',
    'https://user:password@github.com/carmaziums/carmazium/releases/download/a/a.apk',
    'https://github.com/other/repo/releases/download/a/a.apk',
    'https://github.com/carmaziums/carmazium/releases/latest/download/a.apk',
    'https://release-assets.githubusercontent.com.evil.example/github-production-release-asset/1342421207/asset',
    'https://release-assets.githubusercontent.com/github-production-release-asset/999999/asset',
    'https://release-assets.githubusercontent.com:444/github-production-release-asset/1342421207/asset',
    'https://release-assets.githubusercontent.com/github-production-release-asset/1342421207/asset#fragment',
    'https://127.0.0.1/asset.apk',
  ]) assert.throws(() => validateUpstreamUrl(raw, published), raw);
});

test('a Vercel preview with no advertisement variables stages only fully verified bytes', async () => {
  await isolated(async root => {
    const approved = fixture();
    const output = join(root, 'public', 'downloads', published.filename);
    let requests = 0;
    const result = await stageApprovedAndroidDownloads({
      root, env: { VERCEL: '1', VERCEL_ENV: 'preview' }, manifest: approved,
      fetchImpl: async (url, options) => {
        requests++;
        assert.equal(options.redirect, 'manual');
        assert.equal(options.headers['Accept-Encoding'], 'identity');
        assert.ok(options.signal);
        assert.equal(existsSync(output), false, 'nothing public before verification completes');
        if (requests === 1) {
          assert.equal(url, releaseSourceUrl(published));
          return new Response(null, { status: 302, headers: { Location: asset } });
        }
        assert.equal(url, asset);
        return response(new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.subarray(0, 2));
            controller.enqueue(bytes.subarray(2, 1000));
            controller.enqueue(bytes.subarray(1000));
            controller.close();
          },
        }), { 'Content-Length': String(bytes.length) });
      },
    });
    assert.equal(result.skipped, false);
    assert.equal(requests, 2);
    assert.deepEqual(await readFile(output), bytes);
    assert.equal((await readdir(root)).some(name => name.startsWith('.android-download-stage-')), false);
  });
});

test('upstream errors, transformed bodies and inconsistent headers leave no public APK', async () => {
  const cases = [
    () => new Response('not found', { status: 404 }),
    () => new Response('<html>error</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    () => response(bytes, { 'Content-Encoding': 'gzip' }),
    () => response(bytes, { 'Content-Length': String(bytes.length - 1) }),
    () => new Response(null, { status: 302, headers: { Location: 'https://evil.example/app.apk' } }),
    () => { throw new Error('Synthetic upstream timeout'); },
  ];
  for (const fetchImpl of cases) await isolated(async root => {
    await assert.rejects(stageApprovedAndroidDownloads({ root, env: { VERCEL: '1' }, manifest: fixture(), fetchImpl }));
    await assertCleanFailure(root);
  });
});

test('redirect loops are bounded and an implicitly followed redirect is rejected', async () => {
  await isolated(async root => {
    let calls = 0;
    await assert.rejects(stageApprovedAndroidDownloads({
      root, env: { VERCEL: '1' }, manifest: fixture(),
      fetchImpl: () => { calls++; return new Response(null, { status: 302, headers: { Location: releaseSourceUrl(published) } }); },
    }), /redirect limit/);
    assert.equal(calls, 4);
    await assertCleanFailure(root);
  });
  await isolated(async root => {
    const followed = response();
    Object.defineProperty(followed, 'redirected', { value: true });
    await assert.rejects(stageApprovedAndroidDownloads({
      root, env: { VERCEL: '1' }, manifest: fixture(), fetchImpl: () => followed,
    }), /unexpectedly followed/);
    await assertCleanFailure(root);
  });
});

test('hash, truncation, overflow without Content-Length and ZIP magic are checked on actual bytes', async () => {
  const tampered = Buffer.from(bytes); tampered[100] ^= 1;
  const wrongMagic = Buffer.from(bytes); wrongMagic[0] = 0;
  for (const data of [tampered, bytes.subarray(0, -1), Buffer.concat([bytes, Buffer.from([1])]), wrongMagic]) {
    await isolated(async root => {
      const approved = fixture();
      if (data === wrongMagic) approved.releases[0].apk_sha256 = hash(data);
      await assert.rejects(stageApprovedAndroidDownloads({
        root, env: { VERCEL: '1' }, manifest: approved, fetchImpl: () => response(data),
      }), /APK/);
      await assertCleanFailure(root);
    });
  }
});

test('cached files are independently rehashed; a corrupted cache fails closed without replacement', async () => {
  await isolated(async root => {
    const options = { root, env: { VERCEL: '1' }, manifest: fixture(), fetchImpl: () => response() };
    await stageApprovedAndroidDownloads(options);
    const cached = await stageApprovedAndroidDownloads({
      ...options, fetchImpl: () => { throw new Error('Verified cache should not download again'); },
    });
    assert.equal(cached.releases[0].reused, true);
    const corrupt = Buffer.from(bytes); corrupt[100] ^= 1;
    await writeFile(join(root, 'public', 'downloads', published.filename), corrupt);
    await assert.rejects(stageApprovedAndroidDownloads({
      ...options, fetchImpl: () => { throw new Error('Corruption must fail before another download'); },
    }), /Cached APK failed/);
    await assertCleanFailure(root);
  });
});
