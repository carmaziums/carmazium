#!/usr/bin/env node
/**
 * Block 10: independently review *claimed* APK/device/hosting evidence.
 * Does NOT verify a binary, manufacture evidence, approve a release,
 * upload an APK, or switch on the website download.
 *
 * Output is always NO_GO or MANUAL_RELEASE_REVIEW_REQUIRED. A matching manifest
 * alone must NEVER be interpreted as customer release authorisation.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFirstPartyApkUrl } from './verify-first-party-android-apk.mjs';

const sha40 = /^[a-f0-9]{40}$/i;
const sha64 = /^[a-f0-9]{64}$/i;
const codeRegex = /^[1-9][0-9]{0,9}$/;
const requiredAndroidChecks = Object.freeze([
  'install_cold_start',
  'existing_user_sign_in',
  'browse_and_search',
  'mazium_ai_consent_and_withdrawal',
  'mazium_filter_card_navigation',
  'mazium_account_switch_privacy',
  'keyboard_accessibility_and_large_text',
  'update_install_preserves_user_data',
]);
const requiredVisualRoles = Object.freeze(['buyer', 'trader']);
const requiredIosChecks = Object.freeze([
  'signed_testflight_build',
  'apple_external_beta_approved',
  'tested_on_physical_iphone',
  'mazium_ai_privacy_and_filters',
]);

export function assessCustomerAppRelease(input = {}) {
  const blockers = [];
  const add = (id, reason) => blockers.push({ id, reason });
  const source = input.source || {};
  const apk = input.apk || {};
  const hosting = input.hosting || {};
  const android = input.android_device_qa || {};
  const visual = input.mazium_visual_review || {};
  const ios = input.ios_testflight || {};

  if (!sha40.test(source.commit_sha || '') || source.branch !== 'main' ||
      source.reviewed_pr_sha !== source.commit_sha)
    add('SOURCE_MAIN_MERGE', 'Confirm exact reviewed commit merged to main');
  if (!sha64.test(apk.sha256 || '') || !sha64.test(apk.signer_certificate_sha256 || '') ||
      apk.package_name !== 'uk.carmazium.app' ||
      !codeRegex.test(apk.version_code || '') ||
      Number(apk.version_code) > 2147483647 ||
      apk.source_sha !== source.commit_sha ||
      apk.owner_pinned_cert_sha256 !== apk.signer_certificate_sha256 ||
      !Number.isSafeInteger(apk.size_bytes) || apk.size_bytes < 1024 ||
      apk.independently_verified !== true)
    add('SIGNED_APK', 'Requires genuine APK SHA, production certificate pin, exact source, package and independent binary verification');
  if (apk.signing_key_provenance_approved !== true)
    add('SIGNER_PROVENANCE', 'Owner must independently verify original private signing key provenance and future update continuity');

  let validUrl = false;
  try {
    validUrl = Boolean(validateFirstPartyApkUrl(hosting.url));
  } catch { /* invalid or missing */ }
  if (!validUrl ||
      hosting.verified_from_exact_url !== true ||
      hosting.apk_sha256 !== apk.sha256 ||
      hosting.signer_certificate_sha256 !== apk.signer_certificate_sha256 ||
      hosting.version_code !== apk.version_code ||
      hosting.source_sha !== source.commit_sha ||
      hosting.size_bytes !== apk.size_bytes)
    add('HOSTED_APK', 'Exact first-party HTTPS APK must independently match actual source, size, hash, version and signing certificate');

  const runTime = Date.parse(android.tested_at || '');
  const fresh = Number.isFinite(runTime) &&
      runTime <= Date.now() && runTime >= Date.now() - (30 * 86400000);
  if (android.physical_device !== true || typeof android.device_model !== 'string' ||
      !android.device_model.trim() || typeof android.os_version !== 'string' ||
      !android.os_version.trim() || !fresh || android.installed_apk_sha256 !== apk.sha256)
    add('ANDROID_DEVICE_QA', 'Signed APK must be installed on a named physical Android device; QA evidence must match exact APK within 30 days');
  for (const name of requiredAndroidChecks) {
    if (android.checks?.[name] !== true)
      add('ANDROID_' + name.toUpperCase(), 'Missing independent device QA: ' + name);
  }
  if (android.production_mutating_test_activity !== false)
    add('PRODUCTION_SAFETY', 'No synthetic test bids, KYC, payments or other mutating production activity permitted');

  if (visual.website_source_commit !== source.commit_sha ||
      visual.native_apk_sha256 !== apk.sha256 ||
      visual.android_role_screenshots_reviewed !== true ||
      requiredVisualRoles.some(role => visual.roles?.[role]?.android_verified !== true) ||
      visual.accessibility_large_text_verified !== true)
    add('MAZIUM_ANDROID_VISUAL', 'Need website versus Android screenshot review by buyer and trader, with accessibility');
  if (visual.ios_role_screenshots_reviewed !== true ||
      requiredVisualRoles.some(role => visual.roles?.[role]?.ios_verified !== true))
    add('MAZIUM_IOS_VISUAL', 'Website versus iPhone screenshots for buyer and trader not independently signed off');

  if (ios.app_store_connect_build_verified !== true ||
      ios.public_testflight_invitation_verified !== true ||
      ios.physical_iphone_tested !== true ||
      requiredIosChecks.some(check => ios.checks?.[check] !== true))
    add('IOS_TESTFLIGHT', 'Apple-signed TestFlight build, review/invitation and real iPhone QA are not verified');

  // This audit never grants release authorisation. Owner sign-off must be
  // verified independently and outside the JSON by a human release reviewer.
  if (input.owner_signoff?.android_public_release_approved !== true ||
      !input.owner_signoff?.approver ||
      input.owner_signoff?.approved_source_sha !== source.commit_sha ||
      input.owner_signoff?.approved_apk_sha256 !== apk.sha256)
    add('OWNER_ANDROID_SIGNOFF', 'Written owner approval must bind to exact merged source and APK SHA');
  if (input.owner_signoff?.ios_testflight_public_link_approved !== true)
    add('OWNER_IOS_SIGNOFF', 'Separate owner approval needed for public iPhone TestFlight invitation');

  const androidIds = new Set(['SOURCE_MAIN_MERGE','SIGNED_APK','SIGNER_PROVENANCE','HOSTED_APK','ANDROID_DEVICE_QA',
    'PRODUCTION_SAFETY','MAZIUM_ANDROID_VISUAL','OWNER_ANDROID_SIGNOFF']);
  const androidBlockers = blockers.filter(item =>
    androidIds.has(item.id) || item.id.startsWith('ANDROID_'));
  const iosBlockers = blockers.filter(item =>
    item.id === 'SOURCE_MAIN_MERGE' || item.id === 'MAZIUM_IOS_VISUAL' ||
    item.id === 'IOS_TESTFLIGHT' || item.id === 'OWNER_IOS_SIGNOFF');
  return {
    review_schema: 1,
    android: {
      status: androidBlockers.length ? 'NO_GO' : 'MANUAL_RELEASE_REVIEW_REQUIRED',
      blockers: androidBlockers,
    },
    ios: {
      status: iosBlockers.length ? 'NO_GO' : 'MANUAL_RELEASE_REVIEW_REQUIRED',
      blockers: iosBlockers,
    },
    public_download_approved: false,
    notes: 'Source declarations are not independent proof. This audit never enables customer downloads.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  try {
    const input = arg ? JSON.parse(readFileSync(arg, 'utf8')) : {};
    const report = assessCustomerAppRelease(input);
    console.log(JSON.stringify(report, null, 2));
    // A successful invocation is not a release approval. The CLI fails
    // closed until evidence is complete; then still requires manual review.
    if (report.android.status === 'NO_GO' || report.ios.status === 'NO_GO')
      process.exitCode = 2;
  } catch (error) {
    console.error('Customer app release acceptance audit BLOCKED: ' + error.message);
    process.exitCode = 2;
  }
}
