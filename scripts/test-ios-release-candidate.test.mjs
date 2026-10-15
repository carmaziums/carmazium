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
  assert.match(flow, /if: github\.ref == 'refs\/heads\/main' && github\.event_name == 'workflow_dispatch'/);
  assert.match(flow, /REVIEW_SOURCE_SHA.*GITHUB_SHA/);
  assert.match(flow, /\^\[a-f0-9\]\{40\}\$/);
  assert.match(flow, /Build signed iOS App Store candidate without uploading or submitting/);
  assert.match(flow, /did \*\*not\*\* submit to App Store Connect/);
});

test('iOS candidate uses production app identity, locked dependencies and the owner's EAS credentials', () => {
  assert.equal(app.ios.bundleIdentifier, 'uk.carmazium.app');
  assert.equal(eas.build.production.channel, 'production');
  assert.equal(eas.build.production.env.APP_ENV, 'production');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
  assert.equal(eas.cli.appVersionSource, 'remote');
  assert.match(flow, /npm ci/);
  assert.match(flow, /npm run typescript/);
  assert.match(flow, /secrets\.EXPO_TOKEN \|\| secrets\.EAS_TOKEN/);
  assert.match(flow, /eas-cli@16\.18\.0 build --platform ios --profile production --non-interactive --wait --json/);
  assert.match(flow, /Signed iOS release candidate created for internal review/);
  assert.doesNotMatch(flow, /curl\s+.*upload/);
});
