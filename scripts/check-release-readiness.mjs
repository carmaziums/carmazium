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
for (const [key, value] of Object.entries({
  appleId: iosSubmit.appleId,
  ascAppId: iosSubmit.ascAppId,
  appleTeamId: iosSubmit.appleTeamId,
})) {
  if (!value || hasPlaceholder(value)) external(`EAS iOS submit field ${key} is not configured`);
}

const androidSubmit = eas.submit?.production?.android ?? {};
if (!androidSubmit.serviceAccountKeyPath) {
  external('EAS Android submit serviceAccountKeyPath is not configured');
} else {
  ok('EAS Android submit path is declared (credential file remains external by design)');
}

const assetLinksPath = 'public/.well-known/assetlinks.json';
const aasaPath = 'public/.well-known/apple-app-site-association';

if (!exists(assetLinksPath)) {
  external('Android Digital Asset Links file is not present in the web app');
} else {
  try {
    const links = readJson(assetLinksPath);
    const serialised = JSON.stringify(links);
    if (!Array.isArray(links) || links.length === 0 || hasPlaceholder(serialised)) {
      external('Android Digital Asset Links file does not contain a real signing association');
    } else {
      ok('Android Digital Asset Links file contains at least one association');
    }
  } catch {
    fail('Android Digital Asset Links file is not valid JSON');
  }
}

if (!exists(aasaPath)) {
  external('Apple app-site-association file is not present in the web app');
} else {
  try {
    const aasa = readJson(aasaPath);
    const details = aasa?.applinks?.details;
    const serialised = JSON.stringify(aasa);
    if (!Array.isArray(details) || details.length === 0 || hasPlaceholder(serialised)) {
      external('Apple app-site-association file does not contain a real app identifier');
    } else {
      ok('Apple app-site-association file contains at least one app association');
    }
  } catch {
    fail('Apple app-site-association file is not valid JSON');
  }
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
