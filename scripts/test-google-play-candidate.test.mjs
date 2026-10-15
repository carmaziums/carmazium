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

test('Google Play AAB candidate builds only on an approved exact main SHA', () => {
  assert.match(flow, /workflow_dispatch:/);
  assert.doesNotMatch(flow, /\bon:\s*push:/);
  assert.match(flow, /if: github\.ref == 'refs\/heads\/main' && github\.event_name == 'workflow_dispatch'/);
  assert.match(flow, /REVIEW_SOURCE_SHA.*GITHUB_SHA/);
  assert.match(flow, /INTERNAL_REVIEW_ONLY/);
  assert.match(flow, /\^\[a-f0-9\]\{40\}\$/);
  assert.doesNotMatch(flow, /\beas submit\b/);
  assert.doesNotMatch(flow, /\bautoSubmit\s*:\s*true/);
  assert.match(flow, /This workflow does \*\*not\*\* submit to Google Play/);
});

test('Google Play candidate is an Android AAB with correct identity and EAS credentials', () => {
  assert.equal(app.android.package, 'uk.carmazium.app');
  assert.equal(eas.build.production.channel, 'production');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
  assert.equal(eas.build.production.env.APP_ENV, 'production');
  assert.equal(eas.cli.appVersionSource, 'remote');
  assert.match(flow, /npm ci/);
  assert.match(flow, /npm run typescript/);
  assert.match(flow, /secrets\.EXPO_TOKEN \|\| secrets\.EAS_TOKEN/);
  assert.match(flow, /eas-cli@16\.18\.0 build --platform android --profile production --non-interactive --wait --json/);
  assert.match(flow, /Play App Signing identity/);
});
