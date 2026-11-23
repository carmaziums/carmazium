#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  validateIosCandidateRequest,
  validateIosCandidateMetadata,
  verifyStagedIosSource,
} from './verify-ios-release-candidate.mjs';

const sha = 'a'.repeat(40);
const buildId = '11111111-2222-4333-8444-555555555555';
const request = () => ({
  GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_SHA: sha, REVIEW_SOURCE_SHA: sha,
  REVIEW_APPROVAL: 'INTERNAL_REVIEW_ONLY', REVIEW_SUBMISSION: 'UPLOAD_REVIEWED_CANDIDATE',
  REVIEW_BUILD_ID: buildId, REVIEW_IPA_SHA256: 'b'.repeat(64),
});
const metadata = () => ({
  id: buildId, status: 'FINISHED', platform: 'IOS', distribution: 'STORE',
  buildProfile: 'production', channel: 'production',
  isForIosSimulator: false, developmentClient: false,
  project: { id: '9c77bb81-205c-42f8-913e-b69a0953ec10', ownerAccount: { name: 'carmazium' } },
  appIdentifier: 'uk.carmazium.app', appVersion: '1.0.2', appBuildVersion: '127',
  runtimeVersion: '1.0.2', gitCommitHash: sha,
  artifacts: { applicationArchiveUrl: 'https://expo.dev/artifacts/eas/reviewed-candidate.ipa' },
});

test('exact manual main request and original finished candidate produce review evidence only', () => {
  const evidence = validateIosCandidateMetadata(metadata(), request());
  assert.equal(evidence.source_sha, sha);
  assert.equal(evidence.eas_build_id, buildId);
  assert.equal(evidence.bundle_identifier, 'uk.carmazium.app');
  assert.equal(evidence.expected_ipa_sha256, 'b'.repeat(64));
  assert.equal(evidence.artifact_kind, 'INTERNAL_REVIEW_ONLY');
  assert.equal(evidence.approved_for_customer_distribution, false);
});

test('upload request rejects missing and incorrect ref, event, choice, SHA, UUID and checksum', () => {
  const invalid = {
    GITHUB_REF: 'refs/heads/feature/test', GITHUB_EVENT_NAME: 'push',
    REVIEW_APPROVAL: 'NOT_APPROVED', REVIEW_SUBMISSION: 'NO_UPLOAD',
    GITHUB_SHA: 'c'.repeat(40), REVIEW_SOURCE_SHA: 'd'.repeat(40),
    REVIEW_BUILD_ID: '--latest', REVIEW_IPA_SHA256: 'b'.repeat(63),
  };
  for (const [key, value] of Object.entries(invalid)) {
    for (const supplied of [value, undefined, '']) {
      const env = { ...request(), [key]: supplied };
      assert.throws(() => validateIosCandidateRequest(env), undefined, key + ' must fail closed');
    }
  }
});

test('candidate metadata rejects every mismatched or missing release identity and completion field', () => {
  const invalid = {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    status: 'IN_PROGRESS', platform: 'ANDROID', distribution: 'INTERNAL',
    buildProfile: 'preview', channel: 'preview', isForIosSimulator: true,
    appIdentifier: 'uk.carmazium.qa', appVersion: '1.0.1',
    runtimeVersion: '1.0.1', gitCommitHash: 'c'.repeat(40),
    appBuildVersion: '127; echo invalid',
  };
  for (const [key, value] of Object.entries(invalid)) {
    for (const supplied of [value, undefined, null, '']) {
      const build = { ...metadata(), [key]: supplied };
      assert.throws(() => validateIosCandidateMetadata(build, request()), undefined, key + ' must fail closed');
    }
  }
  assert.throws(() => validateIosCandidateMetadata({ ...metadata(), developmentClient: true }, request()));
  for (const project of [
    undefined, {}, { id: 'other' },
    { id: metadata().project.id, ownerAccount: { name: 'other-owner' } },
    { id: metadata().project.id },
  ]) assert.throws(() => validateIosCandidateMetadata({ ...metadata(), project }, request()));
});

test('only the EAS HTTPS IPA endpoint can supply candidate bytes', () => {
  for (const url of [
    undefined, 'http://expo.dev/artifacts/eas/app.ipa',
    'https://expo.dev.attacker.invalid/artifacts/eas/app.ipa',
    'https://attacker.invalid/artifacts/eas/app.ipa',
    'https://user:password@expo.dev/artifacts/eas/app.ipa',
    'https://expo.dev:8443/artifacts/eas/app.ipa',
    'https://expo.dev/artifacts/eas/app.apk',
    'https://expo.dev/other/app.ipa', 'file:///tmp/app.ipa',
  ]) {
    const build = metadata();
    build.artifacts = { applicationArchiveUrl: url };
    assert.throws(() => validateIosCandidateMetadata(build, request()), undefined, String(url));
  }
});

function withStage(fn) {
  const base = mkdtempSync(join(tmpdir(), 'ios-reviewed-source-'));
  const repository = join(base, 'source'), stage = join(base, 'stage');
  const appPath = join(repository, 'carmazium app', 'carmazium app');
  const git = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    mkdirSync(appPath, { recursive: true });
    git('-c', 'init.defaultBranch=main', 'init', '--quiet');
    git('config', 'core.autocrlf', 'false');
    const hooks = join(base, 'empty-hooks');
    mkdirSync(hooks);
    git('config', 'core.hooksPath', hooks);
    const files = { 'app.json': '{"expo":{}}', 'package-lock.json': '{}', 'index.js': 'export default {};\n', 'eas.json': '{}' };
    for (const [name, bytes] of Object.entries(files)) writeFileSync(join(appPath, name), bytes);
    git('add', '--all');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@localhost', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Temporary source verification fixture');
    const sourceSha = git('rev-parse', 'HEAD');
    git('clone', '--quiet', '--no-checkout', '--no-hardlinks', repository, stage);
    for (const [name, bytes] of Object.entries(files)) writeFileSync(join(stage, name), bytes);
    writeFileSync(join(stage, '.easignore'), '**/.git/\n**/node_modules/\n');
    fn({ repository, appPath, stage, sourceSha });
  } finally { rmSync(base, { recursive: true, force: true }); }
}

test('space-free relocated working tree retains real Git SHA and exact tracked app bytes', () => withStage(({ repository, stage, sourceSha }) => {
  const evidence = verifyStagedIosSource(repository, stage, sourceSha);
  assert.equal(evidence.source_sha, sourceSha);
  assert.equal(evidence.checked_files, 4);
}));

test('same HEAD cannot hide changed original source, even when copied bytes match', () => withStage(({ repository, appPath, stage, sourceSha }) => {
  writeFileSync(join(appPath, 'index.js'), 'tampered\n');
  writeFileSync(join(stage, 'index.js'), 'tampered\n');
  assert.throws(() => verifyStagedIosSource(repository, stage, sourceSha), /Original app source differs/);
}));

test('staging rejects changed bytes, unexpected source, missing files and a different commit', () => {
  withStage(({ repository, stage, sourceSha }) => {
    writeFileSync(join(stage, 'index.js'), 'tampered\n');
    assert.throws(() => verifyStagedIosSource(repository, stage, sourceSha), /Staged app differs/);
  });
  withStage(({ repository, stage, sourceSha }) => {
    writeFileSync(join(stage, 'unexpected.js'), 'unreviewed\n');
    assert.throws(() => verifyStagedIosSource(repository, stage, sourceSha), /Unexpected file/);
  });
  withStage(({ repository, stage, sourceSha }) => {
    rmSync(join(stage, 'app.json'));
    assert.throws(() => verifyStagedIosSource(repository, stage, sourceSha));
  });
  withStage(({ repository, stage }) => {
    assert.throws(() => verifyStagedIosSource(repository, stage, 'c'.repeat(40)), /actual reviewed Git commit/);
  });
});
