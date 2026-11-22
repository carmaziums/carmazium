import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const nativeRouting = read('carmazium app/carmazium app/src/lib/notificationRouting.ts');
const webRouting = read('src/lib/notificationNavigation.ts');
const nativeLinks = read('carmazium app/carmazium app/src/navigation/linking.ts');
const nativeCompatibility = read('carmazium app/carmazium app/src/lib/nativeTourRoutes.ts');
const alerts = read('backend/src/services/service-job-alerts.service.ts');
const eligibility = read('backend/src/services/service-job-alert-eligibility.ts');
const mailPolicy = read('backend/src/notifications/notification-email-policy.ts');
const dispatch = read('backend/src/notifications/notifications.service.ts');
const providerWeb = read('src/app/dashboard/service/jobs/page.tsx');
const providerNative = read('carmazium app/carmazium app/src/screens/main/ProviderJobsScreen.tsx');
const service = read('backend/src/services/services.service.ts');

const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function nativeResolver() {
  const start = nativeRouting.indexOf('export interface RoutableNotification');
  assert.ok(start >= 0);
  const ctx = { exports: {}, URL, URLSearchParams, decodeURIComponent };
  runInNewContext(transpile(nativeRouting.slice(start)), ctx);
  return ctx.exports.resolveMobileNotificationTarget;
}

function webResolver() {
  const ctx = { exports: {}, decodeURIComponent };
  runInNewContext(transpile(webRouting), ctx);
  return ctx.exports.resolveWebNotificationHref;
}

const plain = obj => JSON.parse(JSON.stringify(obj));

test('service notifications open existing original native job screens, never browser fallback', async () => {
  const resolve = nativeResolver();
  const cases = [
    [{ type: 'SERVICE_JOB_AVAILABLE', entityType: 'SERVICE_JOB', entityId: 'id123', data: {
      screen: 'ProviderJobDetail', params: { jobId: 'id123' }, link: '/dashboard/service/jobs/id123',
    } }, { screen: 'ProviderJobDetail', params: { jobId: 'id123' } }],
    [{ type: 'SERVICE_JOB_PAID', data: { link: '/dashboard/service/jobs/p123' } },
      { screen: 'ProviderJobDetail', params: { jobId: 'p123' } }],
    [{ type: 'SERVICE_JOB_PAID', data: { link: '/services/jobs/c123' } },
      { screen: 'CustomerServiceJobDetail', params: { jobId: 'c123' } }],
    [{ type: 'SERVICE_QUOTE_RECEIVED', link: '/services/jobs/q1' },
      { screen: 'CustomerServiceJobDetail', params: { jobId: 'q1' } }],
    [{ type: 'SERVICE_JOB_COMPLETED', entityType: 'SERVICE_JOB', entityId: 'done' },
      { screen: 'CustomerServiceJobDetail', params: { jobId: 'done' } }],
    [{ type: 'SERVICE_JOB_AVAILABLE', entityType: 'SERVICE_JOB', entityId: 'open' },
      { screen: 'ProviderJobDetail', params: { jobId: 'open' } }],
    [{ type: 'SERVICE_QUOTE_DECLINED', entityType: 'SERVICE_JOB', entityId: 'lost' },
      { screen: 'ProviderJobDetail', params: { jobId: 'lost' } }],
    [{ type: 'SERVICE_JOB_RESCHEDULED', data: { link: '/dashboard/service/jobs/r1' } },
      { screen: 'ProviderJobDetail', params: { jobId: 'r1' } }],
    [{ type: 'SERVICE_JOB_REFUNDED', data: { link: '/services/jobs/f1' } },
      { screen: 'CustomerServiceJobDetail', params: { jobId: 'f1' } }],
    [{ type: 'SERVICE_JOB_CHANGED', data: { link: '/services/jobs/j2' } },
      { screen: 'CustomerServiceJobDetail', params: { jobId: 'j2' } }],
    [{ type: 'SERVICE_CAPABILITY_REJECTED', data: { link: '/dashboard/service/capabilities' } },
      { screen: 'PartnerDashboard' }],
    [{ type: 'SERVICE_JOB_AVAILABLE', link: '/dashboard/service/jobs?tab=mine' },
      { screen: 'ProviderJobs', params: { initialTab: 'assigned' } }],
    [{ type: 'MESSAGE_RECEIVED', link: '/dashboard/service/messages?room=my-room' },
      { screen: 'ChatScreen', params: { threadId: 'my-room' } }],
    [{ type: 'SERVICE_JOB_AVAILABLE', link: 'https://evil.test/dashboard/service/jobs/id123' }, null],
  ];
  for (const [payload, expected] of cases) {
    const got = await resolve(payload, 'dealer');
    assert.deepEqual(got ? plain(got) : null, expected, JSON.stringify(payload));
  }
});

test('website notification links keep job details and resolve retired setup routes to the hub', () => {
  const resolve = webResolver();
  const make = link => ({ type: 'SERVICE_JOB_CHANGED', data: { link } });
  assert.equal(resolve(make('/dashboard/service/jobs/a')), '/dashboard/service/jobs/a');
  assert.equal(resolve(make('/services/jobs/b')), '/services/jobs/b');
  assert.equal(resolve(make('/dashboard/service/capabilities')), '/dashboard/partner#provider-services');
  assert.equal(resolve(make('/dashboard/service/capabilities/c/verification')), '/dashboard/partner#provider-business');
  assert.equal(resolve(make('/dashboard/service/capabilities/c/matching')), '/dashboard/partner#provider-preferences');
  assert.equal(resolve(make('/dashboard/service/settings')), '/dashboard/partner#provider-business');
});

test('email deep links and guide/navigation routes use existing typed native job pages', () => {
  assert.match(nativeLinks, /ProviderJobs: 'dashboard\/service\/jobs'/);
  assert.match(nativeLinks, /ProviderJobDetail:\s*\{\s*path: 'dashboard\/service\/jobs\/:jobId'/);
  assert.match(nativeLinks, /CustomerServiceJobDetail:\s*\{\s*path: 'services\/jobs\/:jobId'/);
  assert.match(nativeCompatibility, /screen: 'ProviderJobDetail', params: \{ jobId: providerJob\[1\] \}/);
  assert.match(nativeCompatibility, /screen: 'CustomerServiceJobDetail', params: \{ jobId: customerJob\[1\] \}/);
  assert.match(nativeCompatibility, /screen: 'PartnerDashboard'/);
  assert.doesNotMatch(nativeRouting, /Linking\.openURL/);
});

test('matching provider alerts use the existing opt-in, insurance, Stripe and postcode gates', () => {
  for (const term of [
    'eligibleJobProviderWhere(job)', 'notifications: { none:', 'service-job:',
    "status !== 'OPEN'", 'job.expiresAt <= new Date()', 'job.createdAt < SERVICE_JOB_ALERTS_FROM',
    "data: { jobId: job.id, serviceType: job.serviceType, screen: 'ProviderJobDetail'",
    'recoverPendingAlerts()',
  ]) assert.ok(alerts.includes(term), term);
  assert.match(eligibility, /verifiedCapabilityWhere\(now\)/);
  assert.match(eligibility, /dealerServiceEligibilityWhere\(\)/);
  assert.match(eligibility, /stripeConnectOnboardingComplete: true/);
  assert.match(eligibility, /jobPostcodeAreas: \{ has: job\.workPostcodeArea \}/);
  assert.match(eligibility, /id: \{ not: job\.customerId \}/);
  assert.match(dispatch, /if \(notification\.type === 'SERVICE_JOB_AVAILABLE'\)/);
  assert.match(dispatch, /eligibleJobProviderWhere\(job\)/);
  assert.match(dispatch, /notifPrefs\?\.email === false/);
  assert.match(dispatch, /notificationEmailsEnabled\(\)/);
});

test('TradeXchange transactional email is not duplicated, while quote updates remain eligible', () => {
  const ctx = { exports: {}, Set };
  runInNewContext(transpile(mailPolicy), ctx);
  const decide = ctx.exports.notificationEmailPolicy;
  const expected = [
    'SERVICE_CAPABILITY_APPROVED', 'SERVICE_CAPABILITY_REJECTED',
    'SERVICE_JOB_PAID', 'SERVICE_JOB_COMPLETED', 'SERVICE_PAYOUT_RELEASED',
  ];
  for (const type of expected) {
    assert.equal(decide({ type }).eligible, false, type);
  }
  assert.equal(decide({ type: 'SERVICE_QUOTE_RECEIVED', data: { dedicatedServiceEmail: true } }).eligible, false);
  assert.equal(decide({ type: 'SERVICE_QUOTE_RECEIVED' }).eligible, true);
  assert.equal(decide({ type: 'SERVICE_JOB_AVAILABLE' }).eligible, true);
  assert.match(service, /isNew \? \{ dedicatedServiceEmail: true \} : undefined/);
});

test('TradeXchange keeps a single hub and matching website/native jobs controls', () => {
  const webHub = read('src/app/dashboard/partner/page.tsx');
  assert.doesNotMatch(webHub, /<Link\s+href="[^"]+"\s*>\s*<Button/);
  assert.match(webHub, /buttonVariants\(\{ variant: "outline" \}\)/);
  assert.match(webHub, /buttonVariants\(\{ size: "sm", variant: "outline" \}\)/);
  assert.doesNotMatch(providerNative, /label="Job messages"/);
  assert.match(providerNative, /label="Provider overview"/);
  assert.match(providerNative, /label="Refresh jobs"/);
});

test('customer and provider job lists communicate opt-in and opt-out honestly', () => {
  for (const page of [providerWeb, providerNative]) {
    assert.match(page, /notification settings/i);
    assert.match(page, /postcode/i);
    assert.match(page, /verified/i);
  }
});
