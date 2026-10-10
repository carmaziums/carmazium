#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = p => readFileSync(resolve(root,p), 'utf8');

test('Android test APK includes phone ARM64 and x86 emulator architectures', () => {
  const workflow = read('.github/workflows/carmazium-android-offline-qa-apk.yml');
  assert.ok(workflow.includes('-PreactNativeArchitectures=arm64-v8a,x86_64'));
  assert.ok(workflow.includes("app.expo.android.package = 'uk.carmazium.qa'"));
  assert.ok(workflow.includes("app.expo.updates.enabled = false"));
  assert.ok(workflow.includes("EXPO_PUBLIC_QA_READ_ONLY: '1'"));
  assert.ok(workflow.includes("EXPO_PUBLIC_QA_COMMIT_SHA: ${{ github.sha }}"));
  assert.ok(workflow.includes("name: CarMazium-Android-QA"));
  const app = JSON.parse(read('carmazium app/carmazium app/app.json')).expo;
  assert.equal(app.android.package, 'uk.carmazium.app');
  assert.equal(app.updates.enabled, true);
});

test('emulator smoke test installs only the same-run artifact, with no login', () => {
  const workflow = read('.github/workflows/carmazium-android-offline-qa-apk.yml');
  assert.ok(workflow.includes('emulator-smoke:'));
  assert.ok(workflow.includes('needs: build-qa'));
  assert.ok(workflow.includes('actions/download-artifact@v4'));
  assert.ok(workflow.includes('reactivecircus/android-emulator-runner@v2'));
  assert.ok(workflow.includes('arch: x86_64'));
  assert.ok(workflow.includes('api-level: 35'));
  assert.ok(workflow.includes('bash scripts/ci/android-qa-emulator-smoke.sh'));
  assert.ok(workflow.includes('name: CarMazium-QA-Emulator-Report'));
  assert.ok(workflow.includes('retention-days: 7'));
  assert.doesNotMatch(workflow, /secrets\.EXPO_TOKEN|secrets\.EAS_TOKEN|eas build|eas submit|expo publish/);
});

test('launch script checks application process and captures a PNG without authentication', () => {
  const script = read('scripts/ci/android-qa-emulator-smoke.sh');
  assert.ok(script.includes("APP_ID='uk.carmazium.qa'"));
  assert.ok(script.includes("'^lib/x86_64/[^/]+[.]so$'"));
  assert.ok(script.includes('adb install -r "$APK"'));
  assert.ok(script.includes('adb shell am start -W -n "$APP_ID/.MainActivity"'));
  assert.ok(script.includes('adb shell pidof "$APP_ID"'));
  assert.ok(script.includes('adb exec-out screencap -p'));
  assert.ok(script.includes('logged-out-launch.png'));
  assert.ok(script.includes('No sign-in, payment, bid, chat or seller transaction attempted'));
  assert.doesNotMatch(script, /adb shell input tap|adb shell input text|adb shell input keyevent|curl .*token|adb shell pm grant/);
});
