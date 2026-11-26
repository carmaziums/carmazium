#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');
const flow = read('.github/workflows/carmazium-android-play-candidate.yml');
const app = JSON.parse(read('carmazium app/carmazium app/app.json')).expo;
const eas = JSON.parse(read('carmazium app/carmazium app/eas.json'));

test('Play workflow retains exact-main manual approval and never submits', () => {
  assert.match(flow, /workflow_dispatch:/);
  assert.match(flow, /if: github\.ref == 'refs\/heads\/main' && github\.event_name == 'workflow_dispatch'/);
  assert.match(flow, /CARMAZIUM_CANDIDATE_SOURCE_SHA: \$\{\{ inputs.source_sha \}\}/);
  assert.match(flow, /node ..\/..\/scripts\/check-android-release-candidate.mjs/);
  assert.match(flow, /INTERNAL_REVIEW_ONLY/);
  assert.doesNotMatch(flow, /\beas submit\b|\bautoSubmit\s*:\s*true/);
  assert.match(flow, /This workflow does \*\*not\*\* submit to Google Play/);
});

test('Play bundle and generated test APK use the retained customer signing key', () => {
  assert.equal(app.android.package, 'uk.carmazium.app');
  assert.equal(eas.build.production.channel, 'production');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
  assert.equal(eas.build.production.env.APP_ENV, 'production');
  assert.match(flow, /npm ci/);
  assert.match(flow, /npm audit --omit=dev --audit-level=critical/);
  assert.match(flow, /npm run typescript/);
  assert.match(flow, /secrets\.CARMAZIUM_ANDROID_RELEASE_KEYSTORE_BASE64/);
  assert.match(flow, /verify-android-release-keystore.mjs/);
  assert.ok(flow.indexOf('verify-android-release-keystore.mjs') < flow.indexOf(':app:bundleRelease'));
  assert.match(flow, /:app:bundleRelease/);
  assert.doesNotMatch(flow, /eas-cli.*build/);
  assert.match(flow, /VerifyAndroidAppBundle.java/);
  assert.match(flow, /build-apks.*--mode=universal/);
  assert.match(flow, /--ks=keystores\/customer-release.jks/);
  assert.match(flow, /--ks-pass="file:/);
  assert.doesNotMatch(flow, /--ks-pass="?pass:/);
  assert.match(flow, /apksigner" verify --verbose/);
  assert.match(flow, /android-apk-release-evidence.mjs verify/);
  assert.match(flow, /Play App Signing identity/);
  assert.match(flow, /if: always\(\)/);
});

test('bundletool is checksum-pinned and AAB identity is read from its manifest', () => {
  assert.match(flow, /a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29/);
  assert.match(flow, /sha256sum --check --strict/);
  assert.ok(flow.indexOf('sha256sum --check --strict') < flow.indexOf('validate --bundle'));
  for (const attribute of ['package', 'android:versionCode', 'android:versionName'])
    assert.ok(flow.includes('/manifest/@' + attribute));
  assert.match(flow, /play-release-evidence.json/);
  assert.match(flow, /sha256sum \*\.apk \*\.aab/);
  assert.doesNotMatch(flow, /continue-on-error|\|\| true/);
});
