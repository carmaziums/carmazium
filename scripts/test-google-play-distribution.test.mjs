import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareGooglePlayDistribution } from './prepare-google-play-distribution.mjs';
const native = new URL('../carmazium app/carmazium app/', import.meta.url);
test('Play preparation retains identity and strips installer permission and OTA channel', () => {
  const directory = mkdtempSync(join(tmpdir(), 'carmazium-play-'));
  try {
    mkdirSync(join(directory, 'src/lib'), { recursive: true });
    const original = JSON.parse(readFileSync(new URL('app.json', native), 'utf8'));
    original.expo.android.versionCode = 135;
    original.expo.updates.requestHeaders = { 'expo-channel-name': 'production' };
    writeFileSync(join(directory, 'app.json'), JSON.stringify(original));
    const play = readFileSync(new URL('src/lib/appUpdater.play.ts', native), 'utf8');
    writeFileSync(join(directory, 'src/lib/appUpdater.play.ts'), play);
    prepareGooglePlayDistribution(directory);
    const result = JSON.parse(readFileSync(join(directory, 'app.json'), 'utf8')).expo;
    assert.equal(result.android.package, 'uk.carmazium.app');
    assert.equal(result.android.versionCode, 135);
    assert.equal(result.version, original.expo.version);
    assert.deepEqual(result.ios, original.expo.ios);
    assert.deepEqual(result.extra, original.expo.extra);
    assert.equal(result.updates.enabled, false);
    assert.equal(result.updates.requestHeaders, undefined);
    assert.ok(!result.android.permissions.includes('android.permission.REQUEST_INSTALL_PACKAGES'));
    assert.ok(result.android.blockedPermissions.includes('android.permission.REQUEST_INSTALL_PACKAGES'));
    assert.equal(readFileSync(join(directory, 'src/lib/appUpdater.ts'), 'utf8'), play);
    prepareGooglePlayDistribution(directory);
    assert.deepEqual(JSON.parse(readFileSync(join(directory, 'app.json'), 'utf8')).expo, result);
    original.expo.android.package = 'example.other';
    writeFileSync(join(directory, 'app.json'), JSON.stringify(original));
    assert.throws(() => prepareGooglePlayDistribution(directory), /identity/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('only Play workflow prepares store distribution and validates the final merged manifest', () => {
  const flow = readFileSync(new URL('../.github/workflows/carmazium-android-play-candidate.yml', import.meta.url), 'utf8');
  assert.ok(flow.indexOf('prepare-google-play-distribution.mjs') < flow.indexOf('npx expo prebuild'));
  assert.match(flow, /dump manifest --bundle=.*play-manifest.xml/);
  assert.match(flow, /Play AAB contains forbidden self-install permission/);
  assert.match(flow, /Play AAB must keep direct-channel OTA disabled/);
  const direct = readFileSync(new URL('../.github/workflows/carmazium-android-release-candidate.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(direct, /prepare-google-play-distribution/);
});
