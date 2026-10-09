#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const load = path => readFileSync(resolve(root, path), 'utf8');
const mobile = path => load('carmazium app/carmazium app/' + path);

test('QA read-only flag blocks backend writes while production semantics are unchanged', () => {
  const src = mobile('src/lib/apiClient.ts');
  assert.ok(src.includes("process.env.EXPO_PUBLIC_QA_READ_ONLY === '1'"));
  assert.ok(src.includes("options.method || 'GET'"));
  assert.ok(src.includes("!['GET', 'HEAD', 'OPTIONS'].includes(method)"));
  assert.ok(src.includes('QA_READ_ONLY: This installer is for visual review only.'));
  assert.ok(src.includes("'/auth/supabase-session'"));
  assert.ok(src.includes("'/users/sync'"));
  assert.ok(!JSON.stringify(JSON.parse(mobile('eas.json'))).includes('EXPO_PUBLIC_QA_READ_ONLY'));
});

test('QA read-only build prohibits direct photo uploads and deletion', () => {
  const source = mobile('src/lib/storageHelper.ts');
  const occurrences = source.match(/EXPO_PUBLIC_QA_READ_ONLY === '1'/g) || [];
  assert.equal(occurrences.length, 3);
  for (const method of ['uploadToStorage(', 'uploadToSignedStorage(', 'deletePublicStorageObject(']) {
    const start = source.indexOf(method), body = source.slice(start, start + 550);
    assert.ok(body.includes("EXPO_PUBLIC_QA_READ_ONLY === '1'"), method);
  }
});

test('native QA workflow has no Expo secret dependency and keeps production install isolated', () => {
  const workflow = load('.github/workflows/carmazium-android-offline-qa-apk.yml');
  assert.ok(workflow.includes("EXPO_PUBLIC_QA_READ_ONLY: '1'"));
  assert.ok(workflow.includes("app.expo.android.package = 'uk.carmazium.qa'"));
  assert.ok(workflow.includes("app.expo.updates.enabled = false"));
  assert.ok(workflow.includes('app.expo.android.intentFilters = []'));
  assert.ok(workflow.includes(':app:assembleRelease'));
  assert.ok(workflow.includes('apksigner'));
  assert.ok(workflow.includes('upload-artifact@v4'));
  assert.ok(workflow.includes('actions/setup-java@v4'));
  assert.ok(workflow.includes("'platforms;android-36'"));
  assert.ok(workflow.includes("'build-tools;36.0.0'"));
  assert.ok(workflow.includes('buildProps[1].android.enableProguardInReleaseBuilds = false;'));
  assert.ok(workflow.includes('buildProps[1].android.enableShrinkResourcesInReleaseBuilds = false;'));
  assert.ok(workflow.includes("android.enableProguardInReleaseBuilds=false"));
  assert.ok(workflow.includes("android.enableShrinkResourcesInReleaseBuilds=false"));
  assert.doesNotMatch(workflow, /android-actions\/setup-android@v3/);
  assert.ok(workflow.includes('node-version: \'20\''));
  assert.doesNotMatch(workflow, /secrets\.EXPO_TOKEN|secrets\.EAS_TOKEN|eas-cli|eas build/);
  assert.ok(workflow.includes('run: npx expo prebuild --platform android --non-interactive --clean'));
});

test('existing production APK signing and iOS build workflows are never overwritten', () => {
  const current = JSON.parse(mobile('app.json')).expo;
  assert.equal(current.android.package, 'uk.carmazium.app');
  assert.equal(current.ios.bundleIdentifier, 'uk.carmazium.app');
  assert.equal(current.updates.enabled, true);
  const eas = JSON.parse(mobile('eas.json'));
  assert.equal(eas.build.preview.channel, 'preview');
  assert.equal(eas.build.production.channel, 'production');
  assert.ok(load('.github/workflows/carmazium-ios-preview-ipa.yml').includes('workflow_dispatch'));
});
