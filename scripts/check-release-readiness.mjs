#!/usr/bin/env node

/**
 * CarMazium release-readiness gate.
 *
 * Default mode checks everything that can be certified from repository state.
 * --strict additionally requires external release artefacts that cannot be
 * invented in code (store identifiers and verified universal-link files).
 *
 * The strict mode is intended for the manual Release Certification workflow
 * immediately before a signed store release.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const strict = process.argv.includes('--strict');

let failures = 0;
let warnings = 0;

const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8');
const readJson = (p) => JSON.parse(read(p));

function ok(message) {
  console.log(`RELEASE OK: ${message}`);
}

function warn(message) {
  warnings += 1;
  console.warn(`RELEASE WARNING: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`RELEASE ERROR: ${message}`);
}

function external(message) {
  if (strict) fail(message);
  else warn(`${message} (strict release gate will fail until this is supplied)`);
}

function hasPlaceholder(value) {
  return typeof value === 'string' && /FILL_IN|REPLACE_WITH|YOUR_[A-Z_]+|CHANGE_ME/i.test(value);
}

function requiredFile(filePath, label = filePath) {
  if (!exists(filePath)) fail(`${label} is missing: ${filePath}`);
  else ok(`${label} exists`);
}

// ---------------------------------------------------------------------------
// 1. Machine-readable one-product contract.
// ---------------------------------------------------------------------------
const manifest = readJson('product-parity.json');
const required = manifest.features.filter((feature) => feature.status === 'required');
const webOnly = manifest.features.filter((feature) => feature.status === 'web_only');
const unresolved = manifest.features.filter(
  (feature) => feature.status === 'gap' || feature.status === 'web_only_candidate',
);

if (unresolved.length) {
  fail(`Parity manifest still contains unresolved entries: ${unresolved.map((f) => f.id).join(', ')}`);
} else {
  ok(`Parity manifest has zero unresolved gaps (${required.length} required, ${webOnly.length} approved web-only)`);
}

for (const feature of required) {
  if (!feature.web?.length || !feature.mobile?.length) {
    fail(`${feature.id} is required but does not declare both web and mobile surfaces`);
    continue;
  }
  for (const filePath of [...feature.web, ...feature.mobile]) {
    if (!exists(filePath)) fail(`${feature.id} references missing file ${filePath}`);
  }
}

for (const feature of webOnly) {
  if (!feature.reason?.trim()) fail(`${feature.id} is web_only without an explicit reason`);
  if (!feature.web?.length || feature.mobile?.length) {
    fail(`${feature.id} has an invalid web_only platform declaration`);
  }
}

// ---------------------------------------------------------------------------
// 2. Store-policy privacy and deletion surfaces.
// ---------------------------------------------------------------------------
requiredFile('src/app/privacy-policy/page.tsx', 'Public privacy policy');
requiredFile('src/app/delete-account/page.tsx', 'Public account-deletion page');
requiredFile('carmazium app/carmazium app/src/screens/main/PrivacyPolicyScreen.tsx', 'Native privacy policy screen');
requiredFile('docs/privacy/ACCOUNT_DELETION_RETENTION.md', 'Account deletion retention contract');
requiredFile('backend/prisma/manual-migrations/20260925_account_deletion_auth_trigger_safety.sql', 'Auth deletion trigger safety migration');

const webPrivacy = read('src/app/privacy-policy/page.tsx');
const webDelete = read('src/app/delete-account/page.tsx');
const webFooter = read('src/components/layout/Footer.tsx');
const webSignup = read('src/app/auth/signup/page.tsx');
const mobilePrivacy = read('carmazium app/carmazium app/src/screens/main/PrivacyPolicyScreen.tsx');
const mobileSignup = read('carmazium app/carmazium app/src/screens/auth/SignupScreen.tsx');
const mobileDrawer = read('carmazium app/carmazium app/src/components/GlobalDrawer.tsx');
const mobileSettings = read('carmazium app/carmazium app/src/screens/main/SettingsScreen.tsx');
const accountDeletionService = read('backend/src/users/users.service.ts');
const deletionRetention = read('docs/privacy/ACCOUNT_DELETION_RETENTION.md');
const authDeletionTrigger = read('backend/prisma/manual-migrations/20260925_account_deletion_auth_trigger_safety.sql');

if (
  !webPrivacy.includes('MaziuM AI') ||
  !webPrivacy.includes('OpenAI') ||
  !webPrivacy.includes('Account deletion') ||
  !webPrivacy.includes('Your rights')
) {
  fail('Privacy policy must disclose AI processing, deletion and user rights');
} else {
  ok('Public privacy policy contains core store/privacy disclosures');
}

if (
  !webFooter.includes('href="/privacy-policy"') ||
  !webFooter.includes('href="/delete-account"') ||
  !webSignup.includes('href="/privacy-policy"')
) {
  fail('Website must expose privacy and account-deletion links from normal user journeys');
} else {
  ok('Website exposes public privacy and deletion surfaces');
}

if (
  !webDelete.includes('DeleteAccountPortal') ||
  !mobileSettings.includes("method: 'DELETE'") ||
  !mobileSignup.includes("navigation.navigate('PrivacyPolicy')") ||
  !mobileDrawer.includes("stackScreen: 'PrivacyPolicy'") ||
  !mobilePrivacy.includes('https://www.carmazium.com/privacy-policy')
) {
  fail('Native/web privacy or account-deletion access regressed');
} else {
  ok('Privacy policy and account deletion remain reachable across web and native');
}

if (
  !accountDeletionService.includes('FROM storage.objects') ||
  !accountDeletionService.includes('owner_id::text') ||
  !accountDeletionService.includes('auth.admin') ||
  !accountDeletionService.includes('deleteUser(userId)') ||
  !accountDeletionService.includes('dealerKyc.delete') ||
  !accountDeletionService.includes('addressVerification.deleteMany') ||
  !accountDeletionService.includes('analyticsEvent.deleteMany') ||
  !accountDeletionService.includes('location: null') ||
  !accountDeletionService.includes('postcode: null') ||
  !accountDeletionService.includes('this.prisma.$transaction') ||
  !deletionRetention.includes('Supabase Auth identity')
) {
  fail('Account deletion no longer performs the required Auth/Storage/PII erasure lifecycle');
} else {
  ok('Account deletion erases Auth, Storage, KYC and transient PII while retaining only documented record classes');
}

if (
  !authDeletionTrigger.includes('UPDATE public.users') ||
  authDeletionTrigger.includes('DELETE FROM public.users') ||
  !authDeletionTrigger.includes("SET search_path = ''") ||
  !authDeletionTrigger.includes('REVOKE ALL ON FUNCTION public.carmazium_pseudonymize_local_user_after_auth_delete()') ||
  !authDeletionTrigger.includes('AFTER DELETE ON auth.users')
) {
  fail('Supabase Auth deletion trigger must pseudonymise local identity without exposing a SECURITY DEFINER RPC');
} else {
  ok('Supabase Auth deletion trigger preserves shared history and is not publicly executable');
}

// ---------------------------------------------------------------------------
// 3. User-generated-content safety and moderation.
// ---------------------------------------------------------------------------
requiredFile('backend/src/chat/chat-content-safety.service.ts', 'Server-side chat content filter');
requiredFile('src/components/admin/AdminChatModerationQueue.tsx', 'Admin chat moderation queue');

const chatService = read('backend/src/chat/chat.service.ts');
const chatSafety = read('backend/src/chat/chat-content-safety.service.ts');
const webChat = read('src/components/chat/ChatWindow.tsx');
const nativeChat = read('carmazium app/carmazium app/src/screens/main/ChatScreen.tsx');
const nativeChatApi = read('carmazium app/carmazium app/src/lib/chatApi.ts');

if (
  !chatSafety.includes("model: 'omni-moderation-latest'") ||
  !chatSafety.includes('LOCAL_HIGH_CONFIDENCE_RULES') ||
  !chatService.includes("assertAllowedText(dto.content, 'MESSAGE')") ||
  !chatService.includes("assertAllowedText(content, 'ATTACHMENT_CAPTION')")
) {
  fail('Member-authored chat must pass one server-side moderation boundary before persistence');
} else {
  ok('REST/WebSocket chat share a server-side objectionable-content filter');
}

if (
  !webChat.includes('Report message') ||
  !webChat.includes('Block this conversation') ||
  !nativeChat.includes('Report message') ||
  !nativeChat.includes('Block conversation?') ||
  !nativeChat.includes('Messaging blocked') ||
  !nativeChatApi.includes('reportChatMessage') ||
  !nativeChatApi.includes('blockChatRoom') ||
  !nativeChatApi.includes('unblockChatRoom')
) {
  fail('Report/block controls must remain available on both web and native chat');
} else {
  ok('Web and native expose report, block and unblock controls');
}

// ---------------------------------------------------------------------------
// 4. MaziuM AI safety, consent and reporting.
// ---------------------------------------------------------------------------
requiredFile('backend/prisma/manual-migrations/20260926_ai_reports.sql', 'AI report database migration');
requiredFile('src/app/dashboard/admin/ai-reports/page.tsx', 'Admin AI report review queue');

const aiBackend = read('backend/src/ai/ai.service.ts');
const aiController = read('backend/src/ai/ai.controller.ts');
const aiReportMigration = read('backend/prisma/manual-migrations/20260926_ai_reports.sql');
const chatRateLimit = read('backend/src/chat/chat-rate-limit.service.ts');
const webMazium = read('src/components/features/MaziumWidget.tsx');
const nativeMazium = read('carmazium app/carmazium app/src/components/GlobalAIChatBot.tsx');
const webAiApi = read('src/lib/aiApi.ts');
const nativeAiApi = read('carmazium app/carmazium app/src/lib/aiApi.ts');
const adminAiReports = read('src/app/dashboard/admin/ai-reports/page.tsx');
const webListingAi = read('src/components/listing/ListingWizard.tsx');
const nativeListingAi = read('carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx');
const nativeSearchAi = read('carmazium app/carmazium app/src/screens/main/SearchScreen.tsx');
const dvlaControllerAi = read('backend/src/dvla/dvla.controller.ts');
const dvlaServiceAi = read('backend/src/dvla/dvla.service.ts');
const aiDto = read('backend/src/ai/ai.dto.ts');

if (
  !aiReportMigration.includes('"id" text NOT NULL') ||
  !aiReportMigration.includes('ENABLE ROW LEVEL SECURITY')
) {
  fail('AI report migration must use Prisma-compatible text IDs and RLS');
} else {
  ok('AI report storage uses Prisma-compatible IDs and RLS');
}

if (
  !aiBackend.includes("model: 'omni-moderation-latest'") ||
  !aiBackend.includes('LOCAL_AI_BLOCK_RULES') ||
  !aiBackend.includes('safeResult') ||
  !aiBackend.includes('createReport') ||
  !aiController.includes("@Post('report')") ||
  !aiController.includes('consumeAiReport(source)') ||
  !chatRateLimit.includes('consumeAiReport(sourceKey') ||
  !aiController.includes("@Get('admin/reports')") ||
  !aiController.includes("@Patch('admin/reports/:id')")
) {
  fail('MaziuM AI safety/reporting backend regressed');
} else {
  ok('MaziuM AI moderates inputs/outputs and persists user reports');
}

if (
  !webMazium.includes('mazium_ai_consent_v1') ||
  !webMazium.includes('I understand & continue') ||
  !webMazium.includes('Report AI response') ||
  !webAiApi.includes('reportAiResponse') ||
  !nativeMazium.includes('mazium_ai_consent_v1') ||
  !nativeMazium.includes('I understand & continue') ||
  !nativeMazium.includes('Report AI response') ||
  !nativeAiApi.includes('reportAiResponse')
) {
  fail('AI consent/report controls must remain available on both web and native');
} else {
  ok('Web and native require first-use AI acknowledgement and expose in-app reporting');
}

if (
  !adminAiReports.includes('AI response reports') ||
  !adminAiReports.includes('REVIEWING') ||
  !adminAiReports.includes('RESOLVED') ||
  !adminAiReports.includes('DISMISSED')
) {
  fail('Admin AI report review workflow regressed');
} else {
  ok('Admin AI report queue supports review and closure states');
}

if (
  !webListingAi.includes('ensureAiSharingConsent') ||
  !webListingAi.includes('dvlaLookup(formData.vrm, hasAiSharingConsent())') ||
  !nativeListingAi.includes('ensureSellerAiConsent') ||
  !nativeListingAi.includes('allowAiEnrichment') ||
  !nativeSearchAi.includes('ensureAiSearchConsent') ||
  !dvlaControllerAi.includes('dto.allowAiEnrichment === true') ||
  !dvlaServiceAi.includes('allowAiEnrichment = false') ||
  !aiDto.includes("AI data-sharing consent is required")
) {
  fail('Optional seller/search AI data sharing must remain explicitly consent-gated');
} else {
  ok('Seller AI, AI Search and DVLA AI enrichment remain consent-gated');
}

// ---------------------------------------------------------------------------
// 5. Native production identity/build configuration.
// ---------------------------------------------------------------------------
const app = readJson('carmazium app/carmazium app/app.json').expo;
const eas = readJson('carmazium app/carmazium app/eas.json');
const mobilePackage = readJson('carmazium app/carmazium app/package.json');

const expectedBundleId = 'uk.carmazium.app';

if (app.name !== 'CarMazium') {
  fail(`Native display name must be CarMazium, got ${app.name ?? 'missing'}`);
} else {
  ok('Native display name uses canonical CarMazium branding');
}

if (app.runtimeVersion?.policy !== 'appVersion') {
  fail('EAS Update runtimeVersion must use appVersion so native compatibility changes are separated by store release');
} else {
  ok('EAS Update runtimeVersion is tied to the user-facing app version');
}

if (eas.cli?.appVersionSource !== 'remote') {
  fail('EAS appVersionSource must be remote for authoritative store build numbers');
} else {
  ok('EAS developer-facing build versions are managed remotely');
}

if (app.ios?.bundleIdentifier !== expectedBundleId) {
  fail(`iOS bundleIdentifier must be ${expectedBundleId}, got ${app.ios?.bundleIdentifier ?? 'missing'}`);
} else {
  ok(`iOS bundle identifier = ${expectedBundleId}`);
}

if (app.android?.package !== expectedBundleId) {
  fail(`Android package must be ${expectedBundleId}, got ${app.android?.package ?? 'missing'}`);
} else {
  ok(`Android package = ${expectedBundleId}`);
}

const easProjectId = app.extra?.eas?.projectId;
if (
  typeof easProjectId !== 'string' ||
  hasPlaceholder(easProjectId) ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(easProjectId)
) {
  fail('Expo EAS projectId is missing, placeholder, or not a UUID');
} else {
  ok(`Expo EAS projectId is configured (${easProjectId})`);
}

const production = eas.build?.production;
if (!production) {
  fail('EAS production build profile is missing');
} else {
  if (production.channel !== 'production') fail('EAS production profile must use the production update channel');
  else ok('EAS production update channel is production');

  if (production.autoIncrement !== true) {
    fail('EAS production profile must auto-increment developer-facing build numbers');
  } else {
    ok('EAS production build numbers auto-increment');
  }

  if (production.android?.buildType !== 'app-bundle') {
    fail('EAS production Android build must produce an app-bundle');
  } else {
    ok('EAS production Android output is app-bundle');
  }

  const apiUrl = production.env?.EXPO_PUBLIC_API_URL;
  if (typeof apiUrl !== 'string' || !apiUrl.startsWith('https://')) {
    fail('Production mobile API URL must be an explicit HTTPS URL');
  } else {
    ok(`Production mobile API URL is HTTPS (${apiUrl})`);
  }
}

const associatedDomains = app.ios?.associatedDomains ?? [];
for (const domain of ['applinks:carmazium.com', 'applinks:www.carmazium.com']) {
  if (!associatedDomains.includes(domain)) fail(`iOS associatedDomains is missing ${domain}`);
}
if (
  associatedDomains.includes('applinks:carmazium.com') &&
  associatedDomains.includes('applinks:www.carmazium.com')
) {
  ok('iOS declares both production associated domains');
}

const androidIntentJson = JSON.stringify(app.android?.intentFilters ?? []);
for (const host of ['"host":"carmazium.com"', '"host":"www.carmazium.com"']) {
  if (!androidIntentJson.includes(host)) fail(`Android HTTPS intent filters are missing ${host}`);
}
if (androidIntentJson.includes('"autoVerify":true') && androidIntentJson.includes('"scheme":"https"')) {
  ok('Android HTTPS app-link intent filter is autoVerify-enabled');
} else {
  fail('Android HTTPS app-link intent filter is not autoVerify-enabled');
}

requiredFile('carmazium app/carmazium app/scripts/release-android.mjs', 'Android signed-release script');
requiredFile('carmazium app/carmazium app/plugins/withAndroidReleaseSigning.js', 'Android release-signing config plugin');

const androidReleaseScript = read('carmazium app/carmazium app/scripts/release-android.mjs');
if (
  !androidReleaseScript.includes("'bundleRelease'") ||
  !androidReleaseScript.includes("'bundle', 'release', 'app-release.aab'") ||
  androidReleaseScript.includes("['assembleRelease'")
) {
  fail('Guarded Android release command must produce a signed Play Store AAB, not an APK');
} else {
  ok('Guarded Android release command produces a signed Play Store AAB');
}

const appPlugins = JSON.stringify(app.plugins ?? []);
if (!appPlugins.includes('./plugins/withAndroidReleaseSigning')) {
  fail('app.json does not register withAndroidReleaseSigning');
} else {
  ok('Android release-signing plugin is registered');
}

if (mobilePackage.scripts?.['android:release'] !== 'node scripts/release-android.mjs') {
  fail('Mobile package does not expose the guarded android:release command');
} else {
  ok('Mobile package exposes guarded android:release command');
}

// Sentry is not currently installed in the native dependency graph. A placeholder
// DSN therefore cannot be treated as release telemetry. Keep it visible as a
// warning without blocking code certification.
const sentryDsn = production?.env?.EXPO_PUBLIC_SENTRY_DSN;
const hasSentryDependency = Object.keys(mobilePackage.dependencies ?? {}).some((name) =>
  name.toLowerCase().includes('sentry'),
);
if (hasPlaceholder(sentryDsn) && !hasSentryDependency) {
  warn('Production EAS profile contains a Sentry placeholder but the native app has no Sentry dependency; crash telemetry is not certified');
}

// ---------------------------------------------------------------------------
// 6. External distribution/deep-link evidence.
// ---------------------------------------------------------------------------
const iosSubmit = eas.submit?.production?.ios ?? {};
if (Object.values(iosSubmit).some((value) => hasPlaceholder(value))) {
  fail('EAS iOS submit profile must not contain placeholder store identifiers');
} else {
  ok('EAS iOS submit profile contains no fake store identifiers');
}

const ascAppId = iosSubmit.ascAppId ?? process.env.CARMAZIUM_ASC_APP_ID;
if (!ascAppId) {
  external('App Store Connect app ID is not supplied for release certification');
} else if (!/^\d+$/.test(String(ascAppId))) {
  fail('App Store Connect app ID must be numeric');
} else {
  ok('App Store Connect app ID is supplied for release certification');
}

const androidSubmit = eas.submit?.production?.android ?? {};
if (androidSubmit.serviceAccountKeyPath) {
  ok('EAS Android submit path is declared (credential file remains external by design)');
} else {
  warn('EAS Android submit uses managed external credentials; strict certification proves them by requiring a successful Play internal-test upload');
}

const nextConfigSource = read('next.config.ts');
const androidAssociationRoute = 'src/app/api/app-links/android/route.ts';
const appleAssociationRoute = 'src/app/api/app-links/apple/route.ts';
requiredFile(androidAssociationRoute, 'Android Digital Asset Links route');
requiredFile(appleAssociationRoute, 'Apple app-site-association route');

if (
  !nextConfigSource.includes("source: '/.well-known/assetlinks.json'") ||
  !nextConfigSource.includes("destination: '/api/app-links/android'") ||
  !nextConfigSource.includes("source: '/.well-known/apple-app-site-association'") ||
  !nextConfigSource.includes("destination: '/api/app-links/apple'")
) {
  fail('Canonical /.well-known routes are not wired to the association handlers');
} else {
  ok('Canonical Android and Apple association URLs are wired without redirects');
}

if (exists(androidAssociationRoute)) {
  const source = read(androidAssociationRoute);
  if (
    !source.includes("package_name: PACKAGE_NAME") ||
    !source.includes("'uk.carmazium.app'") ||
    !source.includes('ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS') ||
    !source.includes('delegate_permission/common.handle_all_urls') ||
    !source.includes('FINGERPRINT_RE')
  ) {
    fail('Android association route must bind the real signing fingerprint to uk.carmazium.app');
  } else {
    ok('Android association route is package-bound and signing-fingerprint gated');
  }
}

if (exists(appleAssociationRoute)) {
  const source = read(appleAssociationRoute);
  if (
    !source.includes("'uk.carmazium.app'") ||
    !source.includes('APPLE_APP_TEAM_ID') ||
    !source.includes('TEAM_ID_RE') ||
    !source.includes('/auctions/live/*') ||
    !source.includes('/dashboard/earnings*')
  ) {
    fail('Apple association route must bind a validated Team ID to the declared native deep-link surface');
  } else {
    ok('Apple association route is Team-ID gated and scoped to supported native routes');
  }
}

if (strict) {
  ok('Live /.well-known identity checks are delegated to the strict workflow HTTP verification');
} else {
  warn('Live /.well-known identity checks run only in the manual strict release workflow');
}

// ---------------------------------------------------------------------------
// 7. Native privacy manifest and least-privilege permission contract.
// ---------------------------------------------------------------------------
const iosInfoPlist = app.ios?.infoPlist ?? {};
const privacyManifest = app.ios?.privacyManifests ?? {};
const androidBlockedPermissions = new Set(app.android?.blockedPermissions ?? []);

if ('NSCameraUsageDescription' in iosInfoPlist) {
  fail('iOS camera usage description must not be present while CarMazium has no camera-capture flow');
} else {
  ok('iOS does not advertise unused camera access');
}

if (
  typeof iosInfoPlist.NSPhotoLibraryUsageDescription !== 'string' ||
  !iosInfoPlist.NSPhotoLibraryUsageDescription.includes('choose photos')
) {
  fail('iOS photo permission copy must explain user-selected uploads');
} else {
  ok('iOS photo permission copy is purpose-specific');
}

if (
  typeof iosInfoPlist.NSLocationWhenInUseUsageDescription !== 'string' ||
  !iosInfoPlist.NSLocationWhenInUseUsageDescription.includes('Locate Me')
) {
  fail('iOS foreground-location permission copy must identify the user-triggered Locate Me action');
} else {
  ok('iOS foreground-location permission copy is contextual');
}

if (privacyManifest.NSPrivacyTracking !== false) {
  fail('Native privacy manifest must explicitly declare tracking=false while no native tracking SDK is integrated');
} else {
  ok('Native privacy manifest explicitly declares tracking=false');
}

if (
  !Array.isArray(privacyManifest.NSPrivacyTrackingDomains) ||
  privacyManifest.NSPrivacyTrackingDomains.length !== 0
) {
  fail('Native privacy manifest must not declare tracking domains while tracking=false');
} else {
  ok('Native privacy manifest has no tracking domains');
}

const requiredReasonCategories = new Set(
  (privacyManifest.NSPrivacyAccessedAPITypes ?? []).map((entry) => entry.NSPrivacyAccessedAPIType),
);
for (const category of [
  'NSPrivacyAccessedAPICategoryUserDefaults',
  'NSPrivacyAccessedAPICategoryFileTimestamp',
  'NSPrivacyAccessedAPICategoryDiskSpace',
]) {
  if (!requiredReasonCategories.has(category)) {
    fail(`Native privacy manifest is missing required-reason coverage for ${category}`);
  }
}
if (
  requiredReasonCategories.has('NSPrivacyAccessedAPICategoryUserDefaults') &&
  requiredReasonCategories.has('NSPrivacyAccessedAPICategoryFileTimestamp') &&
  requiredReasonCategories.has('NSPrivacyAccessedAPICategoryDiskSpace')
) {
  ok('Native privacy manifest covers current Expo required-reason API categories');
}

const imagePickerPlugin = (app.plugins ?? []).find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker',
);
if (
  !Array.isArray(imagePickerPlugin) ||
  imagePickerPlugin[1]?.cameraPermission !== false ||
  imagePickerPlugin[1]?.microphonePermission !== false
) {
  fail('expo-image-picker must explicitly disable unused camera and microphone permissions');
} else {
  ok('expo-image-picker disables unused camera and microphone permissions');
}

for (const permission of [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
]) {
  if (!androidBlockedPermissions.has(permission)) {
    fail(`Android blockedPermissions is missing ${permission}`);
  }
}
if (
  androidBlockedPermissions.has('android.permission.CAMERA') &&
  androidBlockedPermissions.has('android.permission.RECORD_AUDIO') &&
  androidBlockedPermissions.has('android.permission.READ_MEDIA_IMAGES') &&
  androidBlockedPermissions.has('android.permission.READ_MEDIA_VIDEO')
) {
  ok('Android blocks unused camera/microphone and broad photo/video permissions');
}

const locationPlugin = (app.plugins ?? []).find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-location',
);
if (
  !Array.isArray(locationPlugin) ||
  locationPlugin[1]?.isIosBackgroundLocationEnabled !== false ||
  locationPlugin[1]?.isAndroidBackgroundLocationEnabled !== false ||
  locationPlugin[1]?.isAndroidForegroundServiceEnabled !== false
) {
  fail('expo-location must remain foreground-only with all background/foreground-service modes disabled');
} else {
  ok('Location permission is configured as foreground-only');
}

const nativeChatSource = read('carmazium app/carmazium app/src/screens/main/ChatScreen.tsx');
if (nativeChatSource.includes('requestMediaLibraryPermissionsAsync')) {
  fail('Native chat must use the system picker without requesting broad media-library access');
} else if (!nativeChatSource.includes('launchImageLibraryAsync')) {
  fail('Native chat photo attachment picker is missing');
} else {
  ok('Native chat uses the system image picker without a broad media-library permission request');
}

const publicPrivacyPolicy = read('src/app/privacy-policy/page.tsx');
if (
  !publicPrivacyPolicy.includes('system picker') ||
  !publicPrivacyPolicy.includes('background-location permission') ||
  !publicPrivacyPolicy.includes('microphone')
) {
  fail('Public privacy policy must describe native permission boundaries');
} else {
  ok('Public privacy policy describes native permission boundaries');
}

requiredFile('docs/native/STORE_PRIVACY_PERMISSIONS.md', 'Native store privacy/permission declaration contract');

// ---------------------------------------------------------------------------
// 8. Accessibility, motion and current Android store compatibility.
// ---------------------------------------------------------------------------
const mobileRoot = 'carmazium app/carmazium app/';
const iconButtonSource = read(`${mobileRoot}src/components/IconButton.tsx`);
const hamburgerSource = read(`${mobileRoot}src/components/HamburgerButton.tsx`);
const buttonSource = read(`${mobileRoot}src/components/Button.tsx`);
const tabSource = read(`${mobileRoot}src/navigation/TabNavigator.tsx`);
const reduceMotionSource = read(`${mobileRoot}src/hooks/useReduceMotionPreference.ts`);
const aiChatSource = read(`${mobileRoot}src/components/GlobalAIChatBot.tsx`);

if (
  !iconButtonSource.includes('accessibilityLabel: string') ||
  !iconButtonSource.includes('accessibilityRole="button"') ||
  !iconButtonSource.includes('minWidth: MIN_HIT_TARGET') ||
  !iconButtonSource.includes('minHeight: MIN_HIT_TARGET')
) {
  fail('Shared IconButton must enforce labels, button semantics and a minimum touch target');
} else {
  ok('Shared IconButton enforces labels and minimum touch targets');
}

if (
  !hamburgerSource.includes('accessibilityLabel="Open navigation menu"') ||
  !hamburgerSource.includes('accessibilityRole="button"')
) {
  fail('Hamburger navigation control must expose screen-reader semantics');
} else {
  ok('Hamburger navigation control is screen-reader labelled');
}

if (
  !buttonSource.includes('accessibilityRole="button"') ||
  !buttonSource.includes('busy: loading') ||
  !buttonSource.includes('hitSlop={expandedHitSlop}')
) {
  fail('Shared Button must expose loading/disabled semantics and expanded compact touch targets');
} else {
  ok('Shared Button exposes state semantics and compact touch-target expansion');
}

if (
  !tabSource.includes('accessibilityRole="tab"') ||
  !tabSource.includes('accessibilityState={{ selected: isFocused }}') ||
  !tabSource.includes('minHeight: 48') ||
  !tabSource.includes('useReduceMotionPreference')
) {
  fail('Custom bottom tabs must be accessible, selected-state aware, 48dp high and reduced-motion aware');
} else {
  ok('Custom bottom tabs expose accessible tab semantics and reduced-motion support');
}

if (
  !reduceMotionSource.includes('AccessibilityInfo.isReduceMotionEnabled') ||
  !reduceMotionSource.includes("'reduceMotionChanged'")
) {
  fail('Shared reduced-motion hook must follow the operating-system accessibility setting');
} else {
  ok('Reduced-motion preference follows the operating-system setting');
}

if (
  !nativeChatSource.includes('useReduceMotionPreference') ||
  !nativeChatSource.includes('accessibilityRole="radio"') ||
  !nativeChatSource.includes('accessibilityLabel="Message seen"')
) {
  fail('Native chat must protect reduced motion and expose report/read-state semantics');
} else {
  ok('Native chat exposes report/read-state semantics and reduced-motion handling');
}

if (
  !aiChatSource.includes('useReduceMotionPreference') ||
  !aiChatSource.includes("accessibilityLabel={isOpen ? 'Close MaziuM AI assistant' : 'Open MaziuM AI assistant'}") ||
  !aiChatSource.includes('accessibilityLiveRegion="polite"')
) {
  fail('MaziuM AI must expose assistant controls/status and reduced-motion handling');
} else {
  ok('MaziuM AI exposes accessible controls/status and reduced-motion handling');
}

const buildPropertiesPlugin = (app.plugins ?? []).find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
);
if (
  !Array.isArray(buildPropertiesPlugin) ||
  buildPropertiesPlugin[1]?.android?.compileSdkVersion !== 36 ||
  buildPropertiesPlugin[1]?.android?.targetSdkVersion !== 36
) {
  fail('Android production build must compile and target API 36 for the current Google Play submission baseline');
} else {
  ok('Android production build explicitly compiles and targets API 36');
}

requiredFile('docs/native/STORE_ACCESSIBILITY_DEVICE_QA.md', 'Native accessibility/device QA contract');
warn('Physical VoiceOver/TalkBack, large-text, payment, push and installed-link checks still require a signed build on real devices');

// ---------------------------------------------------------------------------
// 9. Store listing metadata, reviewer access and submission completeness.
// ---------------------------------------------------------------------------
const storeMetadataPath = 'docs/native/store-metadata.en-GB.json';
requiredFile(storeMetadataPath, 'Canonical en-GB store metadata');
requiredFile('docs/native/STORE_REVIEW_ACCESS.md', 'Store reviewer-access contract');
requiredFile('docs/native/STORE_CONTENT_DECLARATIONS.md', 'Store content/audience declaration contract');
requiredFile('docs/native/STORE_LISTING_ASSETS.md', 'Store listing asset plan');
requiredFile('src/app/app-support/page.tsx', 'Public app support page');

if (exists(storeMetadataPath)) {
  const store = readJson(storeMetadataPath);
  const apple = store.apple ?? {};
  const play = store.googlePlay ?? {};
  const appStore = store.app ?? {};
  const utf8 = (value) => Buffer.byteLength(String(value ?? ''), 'utf8');

  if (appStore.name !== app.name || apple.name !== app.name || play.appName !== app.name) {
    fail('Store names must match the canonical native app name');
  } else {
    ok('Apple/Google store names match the native CarMazium identity');
  }

  if (String(apple.name ?? '').length < 2 || String(apple.name ?? '').length > 30) {
    fail('Apple app name must be 2–30 characters');
  }
  if (String(apple.subtitle ?? '').length > 30) {
    fail('Apple subtitle exceeds 30 characters');
  }
  if (String(apple.promotionalText ?? '').length > 170) {
    fail('Apple promotional text exceeds 170 characters');
  }
  if (String(apple.description ?? '').length === 0 || String(apple.description).length > 4000) {
    fail('Apple description must be present and <= 4000 characters');
  }
  if (utf8(apple.keywords) === 0 || utf8(apple.keywords) > 100) {
    fail('Apple keywords must be present and <= 100 UTF-8 bytes');
  } else {
    ok(`Apple metadata fits name/subtitle/promo/description/keyword limits (keywords=${utf8(apple.keywords)} bytes)`);
  }

  if (String(play.appName ?? '').length > 30) {
    fail('Google Play app name exceeds 30 characters');
  }
  if (String(play.shortDescription ?? '').length === 0 || String(play.shortDescription).length > 80) {
    fail('Google Play short description must be present and <= 80 characters');
  }
  if (String(play.fullDescription ?? '').length === 0 || String(play.fullDescription).length > 4000) {
    fail('Google Play full description must be present and <= 4000 characters');
  } else {
    ok('Google Play listing copy fits current length limits');
  }

  for (const [label, value] of [
    ['support URL', appStore.supportUrl],
    ['privacy URL', appStore.privacyPolicyUrl],
    ['account deletion URL', appStore.accountDeletionUrl],
    ['marketing URL', appStore.marketingUrl],
    ['accessibility URL', appStore.accessibilityUrl],
  ]) {
    if (
      typeof value !== 'string' ||
      (value !== 'https://www.carmazium.com' && !value.startsWith('https://www.carmazium.com/'))
    ) {
      fail(`Store ${label} must use the canonical HTTPS CarMazium domain`);
    }
  }

  if (appStore.supportUrl !== 'https://www.carmazium.com/app-support') {
    fail('Store support URL must point to the dedicated app-support page');
  }
  if (appStore.privacyPolicyUrl !== 'https://www.carmazium.com/privacy-policy') {
    fail('Store privacy URL must point to the production Privacy Policy');
  }
  if (appStore.accountDeletionUrl !== 'https://www.carmazium.com/delete-account') {
    fail('Store account deletion URL must point to the public deletion flow');
  }

  if (appStore.accountMinimumAge !== 18 || !Array.isArray(play.targetAudience) || !play.targetAudience.includes('18_AND_OVER')) {
    fail('Store audience contract must preserve the 18+ CarMazium account rule');
  } else {
    ok('Store audience contract is aligned to the 18+ account requirement');
  }

  const declarationFacts = store.declarationFacts ?? {};
  for (const fact of ['userGeneratedVehicleListings', 'privateMemberMessaging', 'aiAssistant']) {
    if (declarationFacts[fact] !== true) {
      fail(`Store declaration facts must truthfully declare ${fact}=true`);
    }
  }
  for (const fact of [
    'realMoneyGambling',
    'simulatedGambling',
    'nativeAdvertisingSdkPresent',
    'backgroundLocation',
    'broadPhotoVideoPermission',
    'cameraPermission',
    'microphonePermission',
  ]) {
    if (declarationFacts[fact] !== false) {
      fail(`Store declaration facts must preserve current ${fact}=false contract`);
    }
  }

  const nativePackage = readJson('carmazium app/carmazium app/package.json');
  const nativeDependencyNames = Object.keys({
    ...(nativePackage.dependencies ?? {}),
    ...(nativePackage.devDependencies ?? {}),
  }).join('\n');
  if (/admob|react-native-google-mobile-ads|facebook-audience|applovin|ironsource|unity-ads/i.test(nativeDependencyNames)) {
    fail('Native advertising dependency detected while store metadata declares Contains ads: No');
  } else if (play.containsAds !== false) {
    fail('Google Play metadata must declare containsAds=false while no native ad SDK is present');
  } else {
    ok('Google Play advertising declaration matches the current native dependency graph');
  }

  const forbiddenKeywordNames = ['carwow', 'motorway', 'autotrader', 'cinch'];
  const keywordText = String(apple.keywords ?? '').toLowerCase();
  const badKeywords = forbiddenKeywordNames.filter((name) => keywordText.includes(name));
  if (badKeywords.length) {
    fail(`Apple keywords must not contain competitor/company names: ${badKeywords.join(', ')}`);
  }

  const storeCopy = `${apple.description ?? ''}\n${play.fullDescription ?? ''}`;
  for (const phrase of ['18 or over', 'paid directly between buyer and seller', 'approved motor']) {
    if (!storeCopy.toLowerCase().includes(phrase.toLowerCase())) {
      fail(`Store descriptions must disclose core marketplace constraint: "${phrase}"`);
    }
  }

  const notificationPlugin = (app.plugins ?? []).find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications',
  );
  if (!Array.isArray(notificationPlugin) || notificationPlugin[1]?.androidCollapsedTitle !== 'CarMazium') {
    fail('Android notification collapsed title must use canonical CarMazium branding');
  } else {
    ok('Android notification branding matches the store identity');
  }
}

const appSupportSource = read('src/app/app-support/page.tsx');
for (const expected of ['info@carmazium.com', '0121 838 5040', 'Company number 17053307', '/delete-account', '/privacy-policy']) {
  if (!appSupportSource.includes(expected)) {
    fail(`Public app support page is missing required support detail: ${expected}`);
  }
}
if (
  appSupportSource.includes('info@carmazium.com') &&
  appSupportSource.includes('0121 838 5040') &&
  appSupportSource.includes('/delete-account') &&
  appSupportSource.includes('/privacy-policy')
) {
  ok('Public app support page exposes contact, privacy and deletion help');
}

const reviewAccessConfirmed = process.env.CARMAZIUM_REVIEW_ACCESS_CONFIRMED === 'true';
const storeConsoleMetadataConfirmed = process.env.CARMAZIUM_STORE_CONSOLE_METADATA_CONFIRMED === 'true';
const storeAssetsConfirmed = process.env.CARMAZIUM_STORE_ASSETS_CONFIRMED === 'true';

if (reviewAccessConfirmed) ok('Store reviewer access has been externally confirmed');
else external('Working reusable reviewer credentials/demo access have not been confirmed in both store consoles');

if (storeConsoleMetadataConfirmed) ok('Store-console metadata/content declarations have been externally confirmed');
else external('Canonical metadata, privacy/data-safety, age/content and app-content declarations have not been confirmed in both store consoles');

if (storeAssetsConfirmed) ok('Release-candidate store screenshots/graphics have been externally confirmed');
else external('Release-candidate screenshots/feature graphics have not been confirmed in both store consoles');

// ---------------------------------------------------------------------------
// 10. Signed release-candidate and final store certification contract.
// ---------------------------------------------------------------------------
requiredFile(
  'scripts/check-release-candidate-evidence.mjs',
  'Signed release-candidate evidence checker',
);
requiredFile(
  'docs/native/STORE_FINAL_RELEASE_CERTIFICATION.md',
  'Final store release certification contract',
);
requiredFile(
  'carmazium app/carmazium app/.eas/workflows/create-store-release-candidate.yml',
  'EAS signed store-candidate build workflow',
);

const easConfig = readJson('carmazium app/carmazium app/eas.json');
const productionBuild = easConfig.build?.production ?? {};
const productionSubmit = easConfig.submit?.production ?? {};
const releaseEvidenceScript = read('scripts/check-release-candidate-evidence.mjs');
const releaseWorkflow = read('.github/workflows/release-certification.yml');
const easCandidateWorkflow = read(
  'carmazium app/carmazium app/.eas/workflows/create-store-release-candidate.yml',
);

if (
  productionBuild.android?.buildType !== 'app-bundle' ||
  productionBuild.ios?.simulator === true
) {
  fail('Production EAS profile must produce an Android AAB and a physical-device/store iOS archive');
} else {
  ok('Production EAS profile produces store-format Android/iOS candidates');
}

if (
  productionSubmit.android?.track !== 'internal' ||
  'serviceAccountKeyPath' in (productionSubmit.android ?? {})
) {
  fail('Android EAS Submit must target internal testing and use externally managed Play credentials');
} else {
  ok('Android submit profile targets Play internal testing without a repository-local service-account path');
}

if (
  !easCandidateWorkflow.includes('platform: android') ||
  !easCandidateWorkflow.includes('platform: ios') ||
  !easCandidateWorkflow.includes('profile: production')
) {
  fail('EAS release-candidate workflow must build both platforms from the production profile');
} else {
  ok('EAS release-candidate workflow builds both signed production candidates');
}

for (const requiredInput of [
  'release_sha',
  'ios_build_id',
  'ios_artifact_sha256',
  'ios_xcode_version',
  'ios_sdk_version',
  'android_build_id',
  'android_artifact_sha256',
  'android_16kb_page_size_confirmed',
  'device_qa_confirmed',
  'accessibility_qa_confirmed',
  'push_qa_confirmed',
  'payment_qa_confirmed',
  'deep_link_qa_confirmed',
  'testflight_upload_confirmed',
  'play_internal_upload_confirmed',
]) {
  if (!releaseWorkflow.includes(`${requiredInput}:`)) {
    fail(`Manual Release Certification workflow is missing final evidence input: ${requiredInput}`);
  }
}

if (
  !releaseWorkflow.includes('node scripts/check-release-candidate-evidence.mjs') ||
  !releaseEvidenceScript.includes('CARMAZIUM_RELEASE_SHA') ||
  !releaseEvidenceScript.includes('CARMAZIUM_IOS_ARTIFACT_SHA256') ||
  !releaseEvidenceScript.includes('CARMAZIUM_ANDROID_ARTIFACT_SHA256') ||
  !releaseEvidenceScript.includes('CARMAZIUM_TESTFLIGHT_UPLOAD_CONFIRMED') ||
  !releaseEvidenceScript.includes('CARMAZIUM_PLAY_INTERNAL_UPLOAD_CONFIRMED')
) {
  fail('Final strict workflow must bind certification to signed artifact, device-QA and pre-release store-upload evidence');
} else {
  ok('Final strict workflow is bound to signed artifact, device-QA and store-upload evidence');
}

const finalExternalChecks = [
  ['CARMAZIUM_ANDROID_16KB_PAGE_SIZE_CONFIRMED', 'Final Android AAB 16 KB memory-page compatibility is not yet externally confirmed'],
  ['CARMAZIUM_DEVICE_QA_CONFIRMED', 'Representative physical-device QA is not yet externally confirmed'],
  ['CARMAZIUM_ACCESSIBILITY_QA_CONFIRMED', 'VoiceOver/TalkBack and large-text QA are not yet externally confirmed'],
  ['CARMAZIUM_PUSH_QA_CONFIRMED', 'Foreground/background/killed-state push QA is not yet externally confirmed'],
  ['CARMAZIUM_PAYMENT_QA_CONFIRMED', 'Native payment QA is not yet externally confirmed'],
  ['CARMAZIUM_DEEP_LINK_QA_CONFIRMED', 'Installed Universal/App Link QA is not yet externally confirmed'],
  ['CARMAZIUM_TESTFLIGHT_UPLOAD_CONFIRMED', 'TestFlight upload of the exact release candidate is not yet externally confirmed'],
  ['CARMAZIUM_PLAY_INTERNAL_UPLOAD_CONFIRMED', 'Play internal-test upload of the exact release candidate is not yet externally confirmed'],
];

for (const [name, message] of finalExternalChecks) {
  if (process.env[name] === 'true') ok(message.replace(' is not yet externally confirmed', ' confirmed'));
  else external(message);
}

// ---------------------------------------------------------------------------
// Result.
// ---------------------------------------------------------------------------
console.log(
  `\nRelease-readiness summary: mode=${strict ? 'strict' : 'code'}, failures=${failures}, warnings=${warnings}`,
);

if (failures > 0) {
  process.exit(1);
}

console.log(
  strict
    ? 'Strict release-readiness gate passed.'
    : 'Code-controlled release-readiness gate passed. External release evidence is reported as warnings until strict mode is run.',
);
