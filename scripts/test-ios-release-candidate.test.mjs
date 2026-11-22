#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const flow = read('.github/workflows/carmazium-ios-release-candidate.yml');
const app = JSON.parse(read('carmazium app/carmazium app/app.json')).expo;
const eas = JSON.parse(read('carmazium app/carmazium app/eas.json'));

test('iOS customer-store candidate is a manual build, never an automatic distribution', () => {
  assert.match(flow, /workflow_dispatch:/);
  assert.doesNotMatch(flow, /\bon:\s*push:/);
  assert.doesNotMatch(flow, /\beas submit\b/);
  assert.doesNotMatch(flow, /\bautoSubmit\s*:\s*true/);
  assert.match(flow, /INTERNAL_REVIEW_ONLY/);
  assert.match(flow, /if: github\.event_name == 'workflow_dispatch' && \(github\.ref == 'refs\/heads\/main' \|\| github\.ref == 'refs\/heads\/feature\/tradexchange-block2-jobs-20261122'\)/);
  assert.match(flow, /REVIEW_SOURCE_SHA.*GITHUB_SHA/);
  assert.match(flow, /\^\[a-f0-9\]\{40\}\$/);
  assert.match(flow, /Build signed iOS App Store candidate without uploading or submitting/);
  assert.match(flow, /did \*\*not\*\* submit to App Store Connect/);
});

test("iOS candidate uses production app identity, locked dependencies and the owner's EAS credentials", () => {
  assert.equal(app.ios.bundleIdentifier, 'uk.carmazium.app');
  assert.equal(eas.build.production.channel, 'production');
  assert.equal(eas.build.production.env.APP_ENV, 'production');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
  assert.equal(eas.cli.appVersionSource, 'remote');
  assert.match(flow, /npm ci/);
  assert.match(flow, /npm audit --omit=dev --audit-level=critical/);
  assert.match(flow, /npm run typescript/);
  // Preserve the original app and reviewed SHA, but avoid CocoaPods scripts
  // breaking on the repository's space-containing parent directories.
  assert.match(flow, /STAGE="\$RUNNER_TEMP\/carmazium-ios-stage"/);
  assert.match(flow, /rsync -a/);
  assert.match(flow, /EAS_NO_VCS=1/);
  assert.match(flow, /EAS_PROJECT_ROOT="\$STAGE"/);
  assert.match(flow, /Missing native app source in staged archive/);
  assert.match(flow, /package-lock\.json/);
  assert.match(flow, /secrets\.EXPO_TOKEN \|\| secrets\.EAS_TOKEN/);
  assert.match(flow, /eas-cli@16\.18\.0 build --platform ios --profile production --non-interactive --wait --json/);
  assert.match(flow, /Signed iOS release candidate created for internal review/);
  assert.doesNotMatch(flow, /curl\s+.*upload/);
});

test('iOS candidate validates the same photo-picker permission policy as app.json after Expo plugins run', () => {
  const picker = app.plugins.find(p => Array.isArray(p) && p[0] === 'expo-image-picker');
  assert.ok(picker, 'expo-image-picker must remain explicitly configured');
  assert.equal(picker[1].cameraPermission, false);
  assert.equal(picker[1].microphonePermission, false);
  assert.equal(app.ios.infoPlist.NSCameraUsageDescription, undefined);

  // The old source-locked IPA upload remains separate from the new candidate.
  const candidateFlow = flow.slice(0, flow.indexOf('  upload:'));
  assert.ok(candidateFlow.includes('imagePicker?.[1]?.cameraPermission !== false'));
  assert.ok(candidateFlow.includes('imagePicker?.[1]?.microphonePermission !== false'));
  assert.ok(candidateFlow.includes('info.NSCameraUsageDescription !== undefined'));
  assert.ok(candidateFlow.includes('info.NSMicrophoneUsageDescription !== undefined'));
  assert.ok(candidateFlow.includes('expo config --type introspect --json'));
  assert.ok(!candidateFlow.includes('!cameraPurpose || imagePicker'));
});
