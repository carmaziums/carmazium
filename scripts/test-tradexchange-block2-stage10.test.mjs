import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { assessCustomerAppRelease } from './check-customer-app-release-acceptance.mjs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const present = file => existsSync(new URL('../' + file, import.meta.url));
const originalApp = 'carmazium app/carmazium app/';

test('one original Android application and native TradeXchange detail flows remain authoritative', () => {
  const app = JSON.parse(read(originalApp + 'app.json')).expo;
  assert.equal(app.android.package, 'uk.carmazium.app');
  const native = read(originalApp + 'src/navigation/MainStackNavigator.tsx');
  const links = read(originalApp + 'src/navigation/linking.ts');
  const required = [
    'PartnerDashboard', 'ProviderJobs', 'ProviderJobDetail', 'ProviderMessages',
    'CustomerServiceJobs', 'CustomerServiceJobDetail', 'CreateServiceJob',
  ];
  for (const screen of required) {
    assert.ok(native.includes('name="' + screen + '"'), screen);
    assert.ok(present(originalApp + 'src/screens/main/' + screen + 'Screen.tsx') ||
      screen === 'CreateServiceJob', screen);
  }
  assert.match(links, /ProviderJobDetail:[\s\S]*?dashboard\/service\/jobs\/:jobId/);
  assert.match(links, /CustomerServiceJobDetail:[\s\S]*?services\/jobs\/:jobId/);
  const web = [
    'src/app/dashboard/partner/page.tsx',
    'src/app/dashboard/service/jobs/page.tsx',
    'src/app/dashboard/service/jobs/[id]/page.tsx',
    'src/app/services/jobs/page.tsx',
    'src/app/services/jobs/[id]/page.tsx',
  ];
  for (const p of web) assert.ok(present(p), p);
  assert.doesNotMatch(read(originalApp+'src/screens/main/ProviderJobsScreen.tsx'), /label="Job messages"/);
  assert.match(read(originalApp+'src/screens/main/ProviderOverviewScreen.tsx'), /navigation\.navigate\('ProviderMessages'\)/);
});

test('iPhone and Android share one native TradeXchange app and preserve separate signed-release gates', () => {
  const app = JSON.parse(read(originalApp + 'app.json')).expo;
  const eas = JSON.parse(read(originalApp + 'eas.json'));
  assert.equal(app.ios.bundleIdentifier, 'uk.carmazium.app');
  assert.equal(app.ios.bundleIdentifier, app.android.package);
  assert.ok(app.ios.associatedDomains.includes('applinks:carmazium.com'));
  assert.ok(app.ios.associatedDomains.includes('applinks:www.carmazium.com'));
  assert.equal(eas.build.production.channel, 'production');
  assert.equal(eas.build.production.env.APP_ENV, 'production');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
  assert.ok(eas.build.production.ios);
  assert.ok(app.extra?.eas?.projectId);
  const login = read(originalApp + 'src/screens/auth/LoginScreen.tsx');
  const signup = read(originalApp + 'src/screens/auth/SignupScreen.tsx');
  assert.match(login, /'google' \| 'apple'/);
  assert.match(login, /supabase\.auth\.signInWithOAuth/);
  assert.match(login, /carmazium:\/\/auth\/callback/);
  assert.match(signup, /provider: 'apple'/);
  const linking = read(originalApp + 'src/navigation/linking.ts');
  assert.match(linking, /CustomerServiceJobDetail/);
  assert.match(linking, /ProviderJobDetail/);
  const iosWorkflow = read('.github/workflows/carmazium-ios-release-candidate.yml');
  assert.match(iosWorkflow, /refs\/heads\/main/);
  assert.match(iosWorkflow, /secrets\.EXPO_TOKEN \|\| secrets\.EAS_TOKEN/);
  assert.match(iosWorkflow, /eas-cli@16\.18\.0 build --platform ios --profile production/);
  const report = assessCustomerAppRelease({});
  assert.equal(report.ios.status, 'NO_GO');
  assert.equal(report.public_download_approved, false);
  const iosReasons = new Set(report.ios.blockers.map(item => item.id));
  assert.ok(iosReasons.has('IOS_TESTFLIGHT'));
  assert.ok(iosReasons.has('OWNER_IOS_SIGNOFF'));
});

test('backend enforces authenticated customer, provider and staff-specific access on one job API', () => {
  const controller = read('backend/src/services/services.controller.ts');
  const team = read('backend/src/services/trade-team.service.ts');
  const service = read('backend/src/services/services.service.ts');
  assert.match(controller, /@UseGuards\(SessionAuthGuard, ThrottlerGuard\)/);
  assert.match(controller, /@Put\('jobs\/:id\/quote'\)/);
  assert.match(controller, /@Post\('jobs\/:id\/quotes\/:quoteId\/accept'\)/);
  assert.match(controller, /assertJobPermission\(req\.tradeActor, id, 'quote'\)/);
  assert.match(controller, /assertJobPermission\(actor, id, 'manage'\)/);
  assert.match(team, /canQuote/);
  assert.match(service, /async acceptQuote\(customerId: string, jobId: string, quoteId: string\)/);
  assert.match(service, /async getJob\(/);
  assert.match(service, /if \(!isCustomer && !isAdmin && !isAccepted && !hasQuoted && !isEligible\)/);
  assert.match(service, /job\.quotes\.filter\(\(q\) => q\.contractorId === viewer\.contractorProfileId\)/);
  assert.match(service, /this\.redact\(\{ \.\.\.job, quotes \}, canSeeCustomerContact\)/);
  assert.match(service, /pickupAddress: null/);
  assert.match(service, /if \(job\.customerId === userId\)/);
});

test('payment proof, claim tokens, fee split and dispute/48h safeguards cannot be bypassed in clients', () => {
  const service = read('backend/src/services/services.service.ts');
  const pay = service.slice(service.indexOf('private async freshCheckout('), service.indexOf('async markPaid('));
  const release = service.slice(service.indexOf('private async release('), service.indexOf('async reconcileSettlementEvent('));
  assert.match(pay, /stripe\.checkout\.sessions\.retrieve/);
  assert.match(pay, /idempotencyKey/);
  assert.match(release, /claim:release:/);
  assert.match(release, /service-job-release-/);
  assert.match(release, /source_transaction/);
  assert.match(release, /status !== ServicePaymentStatus\.PAID/);
  assert.match(service, /const AUTO_CONFIRM_HOURS = 48/);
  assert.match(service, /status: ServiceJobStatus\.COMPLETED/);
  assert.match(service, /job\.payment\.externalDisputeId/);
  assert.match(service, /private feeRate\(\): number \{\s*return 0\.09;/);
  for (const p of [
    'src/app/services/jobs/[id]/page.tsx',
    originalApp + 'src/screens/main/CustomerServiceJobDetailScreen.tsx',
  ]) {
    const source=read(p);
    assert.match(source, /serviceCompletionReview/);
    assert.match(source, /servicePaymentEvidence/);
    assert.match(source, /classifyServiceCheckoutTarget/);
  }
});

test('verified service opt-in, live customer data privacy and retained historic work are never replaced by UI checks', () => {
  const elig=read('backend/src/services/service-job-alert-eligibility.ts');
  const service=read('backend/src/services/services.service.ts');
  for(const term of ['verifiedCapabilityWhere', 'dealerServiceEligibilityWhere', 'stripeConnectOnboardingComplete',
    'jobNationwide', 'jobPostcodeAreas']) assert.ok(elig.includes(term),term);
  const assigned=service.slice(service.indexOf('async assignedPage('),service.indexOf('async upsertQuote('));
  const history=service.slice(service.indexOf('async myJobsPage('),service.indexOf('async cancelJob('));
  assert.match(assigned, /contractorId: contractorProfileId/);
  assert.match(history, /customerId/);
  assert.doesNotMatch(assigned, /status:\s*\{\s*in:/);
  assert.doesNotMatch(history, /status:\s*\{\s*in:/);
});

test('release acceptance fails closed without signed original APK, real devices and owner sign-off', () => {
  const report=assessCustomerAppRelease({});
  assert.equal(report.android.status,'NO_GO');
  assert.equal(report.public_download_approved,false);
  const ids=new Set(report.android.blockers.map(x=>x.id));
  for(const id of ['SOURCE_MAIN_MERGE','SIGNED_APK','SIGNER_PROVENANCE','HOSTED_APK',
    'ANDROID_DEVICE_QA','MAZIUM_ANDROID_VISUAL','OWNER_ANDROID_SIGNOFF']) assert.ok(ids.has(id),id);
  const release=read(originalApp + 'scripts/release-android.mjs');
  assert.match(release,/KEYSTORE_PROPERTIES/);
  assert.match(release,/BUILD_APK/);
  assert.match(release,/assembleRelease/);
  assert.match(release,/release\.keystore\.properties/);
  assert.ok(present('scripts/check-release-candidate-evidence.mjs'));
  assert.ok(present('scripts/check-customer-app-release-acceptance.mjs'));
});

test('canonical provider navigation remains flat; no cloned setup pages or route ambiguity', () => {
  const hub=read('src/app/dashboard/partner/page.tsx');
  const provider=read(originalApp+'src/screens/main/PartnerDashboardScreen.tsx');
  const webLegacy=read('src/app/dashboard/service/capabilities/page.tsx');
  const nativeLegacy=read(originalApp+'src/screens/main/LegacyProviderRouteRedirectScreen.tsx');
  assert.doesNotMatch(hub, /<Link\s+href="[^"]+"\s*>\s*<Button/);
  assert.match(hub, /My Services/);
  assert.match(provider, /My Services/);
  assert.match(webLegacy, /redirect\(/);
  assert.match(nativeLegacy, /PartnerDashboard/);
  const controller=read('backend/src/services/services.controller.ts');
  assert.ok(controller.indexOf("@Get('jobs/feed')")<controller.indexOf("@Get('jobs/:id')"));
  assert.ok(controller.indexOf("@Get('jobs/assigned')")<controller.indexOf("@Get('jobs/:id')"));
});
