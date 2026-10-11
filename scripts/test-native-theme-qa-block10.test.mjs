#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { auditNativeThemeQaRepository, assessNativeThemeQaSource, REQUIRED_CRITICAL_SCREENS } from './audit-native-theme-qa-block10.mjs';
import { evaluateVisualAcceptance, REQUIRED_SCENARIOS, VIEWPORTS, MANUAL_CHECKS } from './verify-native-visual-acceptance.mjs';
import { assessCustomerAppRelease } from './check-customer-app-release-acceptance.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const audit = () => auditNativeThemeQaRepository(root);
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Block 10 inventories every native Screen.tsx instead of declaring untested screens complete', () => {
  const report = audit();
  assert.ok(report.coverage.total_screen_files >= 70, 'unexpectedly small native screen inventory');
  assert.ok(report.coverage.semantic_palette_source_markers > 10, 'the source migration must be present');
  assert.ok(report.coverage.semantic_palette_source_markers <= report.coverage.total_screen_files);
  assert.equal(report.coverage.critical_screen_count, REQUIRED_CRITICAL_SCREENS.length);
  assert.deepEqual(report.coverage.critical_screens_missing, []);
  assert.match(report.coverage.warning, /neither.*screenshot evidence/);
  assert.equal(report.conclusion, 'NO_GO_DEVICE_EVIDENCE_REQUIRED');
  assert.equal(report.public_download_approved, false);
  assert.equal(report.appearance_toggle_approved, false);
  assert.equal(report.private_qa_build_verified, false);
  assert.equal(report.device_visual_accepted, false);
});

test('safety inventory recognises separate QA app, readonly guard, disabled OTA and private artifact', () => {
  const report = audit();
  assert.equal(report.source_safeguards.qa_package_readonly_ota_off_private_artifact, true);
  const workflow = read('.github/workflows/carmazium-android-offline-qa-apk.yml');
  assert.match(workflow, /EXPO_PUBLIC_QA_READ_ONLY: '1'/);
  assert.match(workflow, /app\.expo\.android\.package = 'uk\.carmazium\.qa'/);
  assert.match(workflow, /app\.expo\.updates\.enabled = false/);
  assert.match(workflow, /name: CarMazium-Android-QA/);
  assert.match(workflow, /retention-days: 7/);
  assert.match(workflow, /signed with ephemeral Android \*\*debug\*\* signing key/);
  assert.match(workflow, /security sandbox for real customer data/i);
  assert.doesNotMatch(workflow, /NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED\s*=\s*true/);
});

test('website public APK link stays behind explicit approval, exact SHA-256 and HTTPS first-party URL', () => {
  const report = audit();
  assert.equal(report.source_safeguards.public_apk_flag_host_sha_gate, true);
  const downloads = read('src/lib/mobileAppDownloads.ts');
  assert.match(downloads, /NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED !== "true"/);
  assert.match(downloads, /downloads/);
  assert.match(downloads, /\(qa\|preview\|staging\|debug\|dev\|test\|review-only\)/);
  assert.match(downloads, /\^\[a-f0-9\]\{64\}\$/i);
});

test('existing independent device/screenshot and customer release review gates stay fail closed', () => {
  const report = audit();
  assert.equal(report.source_safeguards.independent_private_png_visual_checker, true);
  assert.equal(report.source_safeguards.customer_release_evidence_fails_closed, true);
  assert.equal(evaluateVisualAcceptance(null, { expectedSha: 'a'.repeat(40) }).approved, false);
  assert.equal(assessCustomerAppRelease({}).android.status, 'NO_GO');
  assert.equal(assessCustomerAppRelease({}).ios.status, 'NO_GO');
  assert.equal(assessCustomerAppRelease({}).public_download_approved, false);
  assert.equal(REQUIRED_SCENARIOS.length, 16);
  assert.equal(VIEWPORTS.length, 2);
  assert.ok(MANUAL_CHECKS.includes('nativeLightTheme'));
  assert.ok(MANUAL_CHECKS.includes('noDeadControls'));
  assert.ok(MANUAL_CHECKS.includes('maziumDisclosureAndConsent'));
});

test('genuine production signing is restricted to main and still requires pinned certificate', () => {
  const signing = read('.github/workflows/carmazium-android-release-candidate.yml');
  assert.match(signing, /github\.ref == 'refs\/heads\/main'/);
  assert.match(signing, /approval:/);
  assert.match(signing, /INTERNAL_REVIEW_ONLY/);
  assert.match(signing, /CARMAZIUM_ANDROID_RELEASE_CERT_SHA256/);
  assert.doesNotMatch(signing, /NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED/);
});

test('device review is always required even when every source file is annotated as theme aware', () => {
  const fake = assessNativeThemeQaSource({
    screens: REQUIRED_CRITICAL_SCREENS.map(path => ({path, content:'useNativeAppearance(); palette.bgBody;'})),
    settings:'A live light/dark switch is not yet supported by the native theme engine.',
    qaWorkflow:"EXPO_PUBLIC_QA_READ_ONLY: '1'\napp.expo.android.package = 'uk.carmazium.qa'\napp.expo.updates.enabled = false\nCarMazium-Android-QA\nactions/upload-artifact@v4",
    downloads:'NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED !== "true"\nNEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256\n["carmazium.com", "www.carmazium.com"]',
    visualChecker:'readPngEvidence\nstaging.separateFromProduction !== true\nREQUIRED_SCENARIOS\nVIEWPORTS',
    releaseChecker:'public_download_approved: false\nMANUAL_RELEASE_REVIEW_REQUIRED',
    sourceSha:'a'.repeat(40),
  });
  assert.equal(fake.coverage.critical_screens_without_palette_source_markers.length, 0);
  assert.equal(fake.conclusion, 'NO_GO_DEVICE_EVIDENCE_REQUIRED');
  assert.equal(fake.public_download_approved, false);
  assert.ok(fake.blockers.some(x=>x.id==='PHYSICAL_ANDROID_QA_PENDING'));
  assert.ok(fake.blockers.some(x=>x.id==='PHYSICAL_IOS_QA_PENDING'));
  assert.ok(fake.blockers.some(x=>x.id==='QA_BACKEND_NOT_ISOLATED'));
  assert.ok(fake.blockers.some(x=>x.id==='APPEARANCE_SELECTOR_DISABLED'));
});

test('missing critical theme code and removed safety controls are conspicuous blockers', () => {
  const incomplete=assessNativeThemeQaSource({screens:[
    {path:'main/HomeScreen.tsx',content:'const color = Colors.bgPrimary;'}
  ]});
  const ids=new Set(incomplete.blockers.map(x=>x.id));
  for(const id of ['CRITICAL_SCREENS_MISSING','CRITICAL_THEME_SOURCE_GAPS','QA_PACKAGE_GUARD_MISSING','WEBSITE_DOWNLOAD_GUARD_MISSING','EVIDENCE_GATES_MISSING'])
    assert.ok(ids.has(id),id);
  assert.equal(incomplete.public_download_approved,false);
  assert.equal(incomplete.source_sha,null);
});

test('the user Appearance selector stays informational and not falsely functional',()=>{
  const settings=read('carmazium app/carmazium app/src/screens/main/SettingsScreen.tsx');
  assert.match(settings,/A live light\/dark switch is not yet supported by the native theme engine/);
  assert.doesNotMatch(settings,/setAppearancePreference\(/);
  const state=read('carmazium app/carmazium app/src/theme/NativeAppearanceProvider.tsx');
  assert.match(state,/setAppearancePreference/);
  assert.match(state,/useColorScheme\(\)/);
  assert.equal(audit().appearance_toggle_approved,false);
});
