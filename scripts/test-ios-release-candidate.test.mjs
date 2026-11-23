#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const flow = read('.github/workflows/carmazium-ios-release-candidate.yml');
const candidateFlow = flow.slice(0, flow.indexOf('  upload:'));
const historicalUpload = flow.slice(flow.indexOf('  upload:'), flow.indexOf('  reviewed_upload:'));
const reviewedUpload = flow.slice(flow.indexOf('  reviewed_upload:'));
const app = JSON.parse(read('carmazium app/carmazium app/app.json')).expo;
const eas = JSON.parse(read('carmazium app/carmazium app/eas.json'));

test('iOS customer-store candidate is a manual build, never an automatic distribution', () => {
  assert.match(flow, /workflow_dispatch:/);
  assert.doesNotMatch(flow, /\bon:\s*push:/);
  assert.doesNotMatch(candidateFlow, /eas-cli@[^\s]+ submit\b/);
  assert.doesNotMatch(flow, /\bautoSubmit\s*:\s*true/);
  assert.match(flow, /INTERNAL_REVIEW_ONLY/);
  assert.ok(candidateFlow.includes("if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.submission == 'NO_UPLOAD'"));
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
  assert.match(candidateFlow, /git clone --no-checkout --no-hardlinks/);
  assert.match(candidateFlow, /unset EAS_NO_VCS/);
  assert.doesNotMatch(candidateFlow, /export EAS_NO_VCS=1/);
  assert.ok(candidateFlow.includes("'**/.git'"), 'GitClient checks .git without a trailing slash before stripping cloned metadata');
  assert.ok(!candidateFlow.includes("'**/.git/'"));
  assert.match(candidateFlow, /verify-ios-release-candidate\.mjs" stage/);
  assert.ok(candidateFlow.includes('build.gitCommitHash !== process.env.REVIEW_SOURCE_SHA'));
  assert.match(flow, /EAS_PROJECT_ROOT="\$STAGE"/);
  assert.match(flow, /Missing native app source in staged archive/);
  assert.match(flow, /package-lock\.json/);
  assert.match(flow, /secrets\.EXPO_TOKEN \|\| secrets\.EAS_TOKEN/);
  assert.match(flow, /eas-cli@16\.18\.0 build --platform ios --profile production --non-interactive --wait --json/);
  assert.match(flow, /Signed iOS release candidate created for internal review/);
  assert.doesNotMatch(candidateFlow, /curl\s+.*upload/);
});

test('iOS candidate validates the same photo-picker permission policy as app.json after Expo plugins run', () => {
  const picker = app.plugins.find(p => Array.isArray(p) && p[0] === 'expo-image-picker');
  assert.ok(picker, 'expo-image-picker must remain explicitly configured');
  assert.equal(picker[1].cameraPermission, app.ios.infoPlist.NSCameraUsageDescription);
  assert.ok(app.android.blockedPermissions.includes('android.permission.CAMERA'));
  assert.equal(picker[1].microphonePermission, false);
  assert.ok(/camera/i.test(app.ios.infoPlist.NSCameraUsageDescription));

  // The old source-locked IPA upload remains separate from the new candidate.
  const candidateFlow = flow.slice(0, flow.indexOf('  upload:'));
  assert.ok(candidateFlow.includes('imagePicker?.[1]?.cameraPermission !== cameraPurpose'));
  assert.ok(candidateFlow.includes('imagePicker?.[1]?.microphonePermission !== false'));
  assert.ok(candidateFlow.includes('info.NSCameraUsageDescription !== cameraPurpose'));
  assert.ok(candidateFlow.includes('info.NSMicrophoneUsageDescription !== undefined'));
  assert.ok(candidateFlow.includes('expo config --type introspect --json'));
  assert.ok(candidateFlow.includes("throw new Error('Apple ITMS-90683:"));
  assert.ok(candidateFlow.includes('info.NSMicrophoneUsageDescription !== undefined'));
});

test('every inline iOS release validation script parses before a signed build is requested', () => {
  const openings = [...flow.matchAll(/^[ \t]*node -[^\r\n]* <<'NODE'\r?$/gm)];
  const scripts = [...flow.matchAll(/^([ \t]*)node -[^\r\n]* <<'NODE'\r?\n([\s\S]*?)^\1NODE[ \t]*\r?$/gm)];
  assert.ok(scripts.length > 0, 'The source, signing and Info.plist checks must remain present');
  assert.equal(scripts.length, openings.length, 'Every inline Node validation must have its closing heredoc');
  for (const [index, match] of scripts.entries()) {
    assert.doesNotThrow(
      () => new Script(match[2], { filename: `ios-release-inline-${index + 1}.js` }),
      `Inline validation ${index + 1} must parse before EAS consumes build minutes`,
    );
  }
});

test('new reviewed upload is explicit, main-only and uses the locally verified IPA without another build', () => {
  assert.ok(reviewedUpload.includes("if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.submission == 'UPLOAD_REVIEWED_CANDIDATE' && inputs.approval == 'INTERNAL_REVIEW_ONLY'"));
  assert.ok(reviewedUpload.includes('test "$(git rev-parse HEAD)" = "$REVIEW_SOURCE_SHA"'));
  assert.ok(flow.includes('candidate_build_id:'));
  assert.ok(flow.includes('expected_ipa_sha256:'));
  assert.ok(reviewedUpload.includes('node scripts/verify-ios-release-candidate.mjs request'));
  const metadataCheck = reviewedUpload.indexOf('node scripts/verify-ios-release-candidate.mjs fetch');
  const download = reviewedUpload.indexOf('curl --fail');
  const byteCheck = reviewedUpload.indexOf('python3 scripts/verify-ios-candidate-archive.py');
  const submit = reviewedUpload.indexOf('eas-cli@16.18.0 submit');
  assert.ok(metadataCheck >= 0 && download > metadataCheck && byteCheck > download && submit > byteCheck);
  assert.ok(reviewedUpload.includes("--proto '=https' --proto-redir '=https'"));
  assert.ok(reviewedUpload.includes('--path "$RUNNER_TEMP/carmazium-ios-reviewed.ipa"'));
  assert.ok(reviewedUpload.includes("--profile production --non-interactive --wait"));
  assert.ok(reviewedUpload.includes("ascAppId: '6837996479'"));
  assert.doesNotMatch(reviewedUpload, /eas-cli@[^\s]+ build\b|--latest|--id\b/);
  assert.ok(reviewedUpload.includes('does not submit for App Review'));
  assert.ok(reviewedUpload.includes('attest physical-device QA'));
});

test('historical upload remains locked to its original branch, source, app version and signed build', () => {
  assert.ok(historicalUpload.includes("github.ref == 'refs/heads/feature/tradexchange-block2-jobs-20261122'"));
  assert.ok(historicalUpload.includes("inputs.submission == 'UPLOAD_EXISTING_IPA_ONLY'"));
  assert.ok(historicalUpload.includes("inputs.source_sha == '7e8758c03ea004c42fc09203249f892f9aa11ffd'"));
  assert.ok(historicalUpload.includes("app.version !== '1.0.1'"));
  assert.ok(historicalUpload.includes('--id b2a6e3d5-2a85-4ecd-9c9e-75c698d77693'));
});

test('existing Release Certification exercises metadata and packaged IPA rejection tests', () => {
  const ci = read('.github/workflows/release-certification.yml');
  for (const file of ['verify-ios-release-candidate.mjs', 'verify-ios-candidate-archive.py', 'test-ios-candidate-metadata.test.mjs', 'test-ios-candidate-archive.py']) {
    assert.ok(ci.includes("- 'scripts/" + file + "'"), file + ' must trigger release contract CI');
  }
  assert.ok(ci.includes('node --test scripts/test-ios-release-candidate.test.mjs scripts/test-ios-candidate-metadata.test.mjs'));
  assert.ok(ci.includes('python3 scripts/test-ios-candidate-archive.py'));
});


test('completed candidate preserves only curated review metadata for independent IPA hashing', () => {
  assert.ok(candidateFlow.includes('CarMazium-iOS-REVIEW-ONLY'));
  assert.ok(candidateFlow.includes('carmazium-ios-candidate-metadata.json'));
  const evidence = candidateFlow.slice(candidateFlow.indexOf('const evidence = {'), candidateFlow.indexOf('const summary = ['));
  for (const key of ['source_sha', 'eas_build_id', 'project_id', 'bundle_identifier', 'app_version', 'app_build_version', 'runtime_version', 'channel', 'artifact_url']) {
    assert.ok(evidence.includes(key + ':'), key + ' must remain available for review');
  }
  assert.ok(evidence.includes('approved_for_customer_distribution: false'));
  assert.doesNotMatch(evidence, /EXPO_TOKEN|EAS_TOKEN|credentials|logFiles|JSON\.stringify\(build/);
});
