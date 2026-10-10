#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCustomerAppRelease } from './check-customer-app-release-acceptance.mjs';

const SHA = 'a'.repeat(40);
const APK = 'b'.repeat(64);
const CERT = 'c'.repeat(64);
const checks = [
  'install_cold_start',
  'existing_user_sign_in',
  'browse_and_search',
  'mazium_ai_consent_and_withdrawal',
  'mazium_filter_card_navigation',
  'mazium_account_switch_privacy',
  'keyboard_accessibility_and_large_text',
  'update_install_preserves_user_data',
];
const iosChecks = [
  'signed_testflight_build',
  'apple_external_beta_approved',
  'tested_on_physical_iphone',
  'mazium_ai_privacy_and_filters',
];
function completeDeclaredFixture() {
  return {
    source: { branch: 'main', commit_sha: SHA, reviewed_pr_sha: SHA },
    apk: {
      sha256: APK, signer_certificate_sha256: CERT, owner_pinned_cert_sha256: CERT,
      source_sha: SHA, package_name: 'uk.carmazium.app', version_code: '42',
      size_bytes: 64000000, independently_verified: true, signing_key_provenance_approved: true,
    },
    hosting: {
      url: 'https://www.carmazium.com/downloads/CarMazium-1.0.0-v42.apk',
      verified_from_exact_url: true, apk_sha256: APK, size_bytes: 64000000,
      signer_certificate_sha256: CERT, version_code: '42', source_sha: SHA,
    },
    android_device_qa: {
      tested_at: new Date().toISOString(), physical_device: true,
      device_model: 'Synthetic test phone', os_version: 'Synthetic test OS',
      installed_apk_sha256: APK, production_mutating_test_activity: false,
      checks: Object.fromEntries(checks.map(x => [x, true])),
    },
    mazium_visual_review: {
      website_source_commit: SHA, native_apk_sha256: APK,
      android_role_screenshots_reviewed: true, ios_role_screenshots_reviewed: true,
      accessibility_large_text_verified: true,
      roles: {buyer:{android_verified:true,ios_verified:true},trader:{android_verified:true,ios_verified:true}},
    },
    ios_testflight: {
      app_store_connect_build_verified: true, public_testflight_invitation_verified: true,
      physical_iphone_tested: true, checks: Object.fromEntries(iosChecks.map(x => [x, true])),
    },
    owner_signoff: {
      android_public_release_approved: true, ios_testflight_public_link_approved: true,
      approver: 'Synthetic fixture, NOT a real approval', approved_source_sha: SHA,
      approved_apk_sha256: APK,
    },
  };
}
const ids = arr => arr.map(x=>x.id);
test('empty evidence fails closed on both platforms, regardless of build source CI', () => {
  const result = assessCustomerAppRelease({});
  assert.equal(result.android.status, 'NO_GO');
  assert.equal(result.ios.status, 'NO_GO');
  assert.equal(result.public_download_approved, false);
  assert.ok(ids(result.android.blockers).includes('SIGNED_APK'));
  assert.ok(ids(result.android.blockers).includes('ANDROID_DEVICE_QA'));
  assert.ok(ids(result.android.blockers).includes('HOSTED_APK'));
  assert.ok(ids(result.android.blockers).includes('OWNER_ANDROID_SIGNOFF'));
  assert.ok(ids(result.ios.blockers).includes('IOS_TESTFLIGHT'));
});
test('even complete *assertions* do not approve customer distribution', () => {
  const result = assessCustomerAppRelease(completeDeclaredFixture());
  assert.equal(result.android.status, 'MANUAL_RELEASE_REVIEW_REQUIRED');
  assert.equal(result.ios.status, 'MANUAL_RELEASE_REVIEW_REQUIRED');
  assert.equal(result.public_download_approved, false);
  assert.equal(result.android.blockers.length, 0);
  assert.equal(result.ios.blockers.length, 0);
  assert.match(result.notes, /not independent proof/);
});
test('blocks candidate from an unmerged, unreviewed branch regardless of owner assertion', () => {
  const input = completeDeclaredFixture();
  input.source.branch = 'feature/qa';
  assert.ok(ids(assessCustomerAppRelease(input).android.blockers).includes('SOURCE_MAIN_MERGE'));
  input.source.branch = 'main';
  input.source.reviewed_pr_sha = 'd'.repeat(40);
  assert.ok(ids(assessCustomerAppRelease(input).android.blockers).includes('SOURCE_MAIN_MERGE'));
});
test('detects bad package, version, signer provenance and fake binary verification', () => {
  for (const mutation of [
    v => v.apk.package_name = 'uk.carmazium.qa',
    v => v.apk.version_code = '0',
    v => v.apk.version_code = '2147483648',
    v => v.apk.signer_certificate_sha256 = 'd'.repeat(64),
    v => v.apk.independently_verified = false,
    v => v.apk.signing_key_provenance_approved = false,
    v => v.apk.sha256 = 'invalid',
  ]) {
    const input = completeDeclaredFixture();
    mutation(input);
    assert.equal(assessCustomerAppRelease(input).android.status, 'NO_GO');
  }
});
test('rejects a hosted file with the wrong signer, hash, version or URL', () => {
  for (const mutation of [
    v => v.hosting.apk_sha256 = 'e'.repeat(64),
    v => v.hosting.signer_certificate_sha256 = 'e'.repeat(64),
    v => v.hosting.version_code = '41',
    v => v.hosting.source_sha = 'f'.repeat(40),
    v => v.hosting.url = 'https://evil.example/downloads/CarMazium-v42.apk',
    v => v.hosting.url = 'http://www.carmazium.com/downloads/CarMazium-v42.apk',
    v => v.hosting.url = 'https://www.carmazium.com/downloads/CarMazium-REVIEW-ONLY.apk',
    v => v.hosting.verified_from_exact_url = false,
  ]) {
    const input = completeDeclaredFixture();
    mutation(input);
    assert.ok(ids(assessCustomerAppRelease(input).android.blockers).includes('HOSTED_APK'));
  }
});
test('requires real Android device QA on same bytes with current tests for all features', () => {
  for(const mutation of [
    v => v.android_device_qa.physical_device = false,
    v => v.android_device_qa.device_model = '',
    v => v.android_device_qa.installed_apk_sha256 = 'f'.repeat(64),
    v => v.android_device_qa.tested_at = '2020-01-01T00:00:00.000Z',
    v => v.android_device_qa.production_mutating_test_activity = true,
    v => v.android_device_qa.checks.mazium_ai_consent_and_withdrawal = false,
    v => v.android_device_qa.checks.update_install_preserves_user_data = false,
  ]) {
    const input=completeDeclaredFixture(); mutation(input);
    assert.equal(assessCustomerAppRelease(input).android.status, 'NO_GO');
  }
});
test('release cannot silently bypass buyer/trader screenshot parity or source association', () => {
  for(const mutation of [
    v=>v.mazium_visual_review.android_role_screenshots_reviewed = false,
    v=>v.mazium_visual_review.roles.trader.android_verified = false,
    v=>v.mazium_visual_review.accessibility_large_text_verified = false,
    v=>v.mazium_visual_review.native_apk_sha256 = 'f'.repeat(64),
    v=>v.mazium_visual_review.website_source_commit = 'f'.repeat(40),
  ]) {
    const input=completeDeclaredFixture();mutation(input);
    assert.ok(ids(assessCustomerAppRelease(input).android.blockers).includes('MAZIUM_ANDROID_VISUAL'));
  }
});
test('iPhone invitation and review can be blocked without blocking Android review paperwork', () => {
  const input=completeDeclaredFixture();
  input.ios_testflight.public_testflight_invitation_verified = false;
  input.owner_signoff.ios_testflight_public_link_approved = false;
  const result=assessCustomerAppRelease(input);
  assert.equal(result.android.status, 'MANUAL_RELEASE_REVIEW_REQUIRED');
  assert.equal(result.ios.status, 'NO_GO');
  assert.equal(result.public_download_approved, false);
});
test('explicit Android release signoff still never turns on public download automatically', () => {
  const input=completeDeclaredFixture();
  input.owner_signoff.android_public_release_approved = false;
  assert.ok(ids(assessCustomerAppRelease(input).android.blockers).includes('OWNER_ANDROID_SIGNOFF'));
  input.owner_signoff.android_public_release_approved = true;
  assert.equal(assessCustomerAppRelease(input).public_download_approved,false);
});
