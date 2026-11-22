import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const webApi = read('src/lib/servicesApi.ts');
const nativeApi = read('carmazium app/carmazium app/src/lib/servicesApi.ts');
const webCustomer = read('src/app/services/jobs/[id]/page.tsx');
const nativeCustomer = read('carmazium app/carmazium app/src/screens/main/CustomerServiceJobDetailScreen.tsx');
const webProvider = read('src/app/dashboard/service/jobs/[id]/page.tsx');
const nativeProvider = read('carmazium app/carmazium app/src/screens/main/ProviderJobDetailScreen.tsx');
const server = read('backend/src/services/services.service.ts');
const lifecycle = read('backend/src/services/services-lifecycle.service.ts');
const paymentSpec = read('backend/src/services/services.payment-hardening.spec.ts');
const journeySpec = read('backend/src/services/services.service.spec.ts');

function sourceHelpers(src) {
  const start = src.indexOf('export function classifyServiceCheckoutTarget(');
  const end = src.indexOf('export const formatPence', start);
  assert.ok(start >= 0 && end > start);
  const js = ts.transpileModule(src.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const ctx = { exports: {}, Math, Date, Number, URL };
  runInNewContext(js, ctx);
  return ctx.exports;
}

test('customer and provider ledger reconciles original gross with partial/full refunds on remaining service value', () => {
  const original = { grossPence: 17000, refundAmountPence: 0, platformFeePence: 1530, contractorPence: 15470 };
  const partial = { grossPence: 17000, refundAmountPence: 5000, platformFeePence: 1080, contractorPence: 10920 };
  const full = { grossPence: 17000, refundAmountPence: 17000, platformFeePence: 0, contractorPence: 0 };
  const inconsistent = [
    [{ ...partial, contractorPence: 15470 }, 17000],
    [{ ...partial, platformFeePence: 1530 }, 17000],
    [{ ...partial, refundAmountPence: 18000 }, 17000],
    [{ ...partial, refundAmountPence: -1 }, 17000],
    [{ ...full, contractorPence: 1 }, 17000],
    [original, 20000], [null, 17000],
  ];
  for (const src of [webApi, nativeApi]) {
    const evidence = sourceHelpers(src).servicePaymentEvidence;
    const result = evidence(original, 17000);
    assert.equal(result.refundPence, 0);
    assert.equal(result.netServicePence, 17000);
    assert.deepEqual({ ...evidence(partial, 17000) }, {
      grossPence: 17000, refundPence: 5000, netServicePence: 12000,
      platformFeePence: 1080, contractorPence: 10920,
    });
    assert.deepEqual({ ...evidence(full, 17000) }, {
      grossPence: 17000, refundPence: 17000, netServicePence: 0,
      platformFeePence: 0, contractorPence: 0,
    });
    for (const [payment, agreed] of inconsistent) assert.equal(evidence(payment, agreed), null);
  }
});

test('48-hour review is eligible only for valid unpaid-out completed jobs, never disputed or released', () => {
  const complete = {
    status: 'COMPLETED', startedAt: '2026-11-21T09:00:00.000Z',
    completedAt: '2026-11-21T10:00:00.000Z', confirmedAt: null,
    payment: { status: 'PAID' },
  };
  for (const src of [webApi, nativeApi]) {
    const review = sourceHelpers(src).serviceCompletionReview;
    assert.deepEqual({ ...review(complete, Date.parse('2026-11-22T10:00:00.000Z')) }, {
      dueAt: '2026-11-23T10:00:00.000Z', elapsed: false,
    });
    assert.equal(review(complete, Date.parse('2026-11-23T10:00:00.000Z')).elapsed, true);
    for (const other of [
      { ...complete, status: 'DISPUTED' }, { ...complete, status: 'RELEASED' },
      { ...complete, payment: { status: 'PENDING' } },
      { ...complete, confirmedAt: '2026-11-21T11:00:00.000Z' },
      { ...complete, completedAt: null },
      { ...complete, startedAt: null },
      { ...complete, startedAt: '2026-11-22T11:00:00.000Z' },
    ]) assert.equal(review(other), null);
  }
});

test('manual confirmation on both surfaces requires explicit consent, single in-flight write and status readback', () => {
  assert.match(webCustomer, /window\.confirm\(/);
  assert.match(webCustomer, /Confirm this.*is complete and release the recorded provider payment/);
  assert.match(nativeCustomer, /'Confirm service completion\?'/);
  assert.match(webCustomer, /actionPending\.current = true/);
  assert.match(nativeCustomer, /actionPending\.current = true/);
  assert.match(webCustomer, /disabled=\{busy !== null\}/);
  assert.match(nativeCustomer, /disabled=\{busy !== null\}/);
  for (const page of [webCustomer, nativeCustomer]) {
    assert.match(page, /serviceCompletionReview\(job\)/);
    assert.match(page, /formatUkServiceDateTime\(completionReview\.dueAt\)/);
  }
});

test('48h auto-release rechecks completed status and stops for disputed jobs/settlement conflict', () => {
  const auto = server.slice(server.indexOf('async autoConfirmCompleted('), server.indexOf('private async release('));
  const release = server.slice(server.indexOf('private async release('), server.indexOf('async reconcileSettlementEvent('));
  assert.match(auto, /AUTO_CONFIRM_HOURS \* 3_600_000/);
  assert.match(auto, /status: ServiceJobStatus\.COMPLETED/);
  assert.match(auto, /completedAt: \{ lt: cutoff \}/);
  assert.match(auto, /confirmedAt: null/);
  assert.match(release, /job\.status !== \(adminResolution \? ServiceJobStatus\.DISPUTED : ServiceJobStatus\.COMPLETED\)/);
  assert.match(release, /status !== ServicePaymentStatus\.PAID/);
  assert.match(release, /idempotencyKey: /);
  assert.match(lifecycle, /@Cron\('7 \* \* \* \*'\)/);
  assert.match(paymentSpec, /only one concurrent release/);
  assert.match(journeySpec, /never auto-releases a disputed completion even after the 48-hour review window/);
});

test('four existing customer/provider screens show recorded refunds without creating a new ledger', () => {
  for (const page of [webCustomer, nativeCustomer, webProvider, nativeProvider]) {
    assert.match(page, /paymentEvidence\.refundPence > 0/);
    assert.match(page, /Recorded customer refund/);
    assert.match(page, /Remaining service amount/);
    assert.match(page, /paymentEvidence\.netServicePence/);
  }
  const mine = server.slice(server.indexOf('async myJobsPage('), server.indexOf('async cancelJob('));
  const assigned = server.slice(server.indexOf('async assignedPage('), server.indexOf('async upsertQuote('));
  assert.match(mine, /customerId/);
  assert.doesNotMatch(mine, /status:\s*\{\s*in:/);
  assert.match(assigned, /contractorId: contractorProfileId/);
  assert.doesNotMatch(assigned, /status:\s*\{\s*in:/);
});

test('admin refund paths use claimed settlement and Stripe idempotency rather than direct UI writes', () => {
  const decision = server.slice(server.indexOf('async adminResolveDispute('), server.indexOf('private assertSettlementRetryWindow('));
  assert.match(decision, /status !== ServiceJobStatus\.DISPUTED/);
  assert.match(decision, /stripeTransferId\?\.startsWith\('claim:'\)/);
  assert.match(decision, /idempotencyKey: /);
  assert.match(decision, /refund\.status !== 'succeeded'/);
  assert.match(decision, /refundedAt: new Date\(\)/);
  assert.match(decision, /remaining > 0 \? ServicePaymentStatus\.RELEASED : ServicePaymentStatus\.REFUNDED/);
});
