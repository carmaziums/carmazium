import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const webApi = read('src/lib/servicesApi.ts');
const nativeApi = read('carmazium app/carmazium app/src/lib/servicesApi.ts');
const webCustomer = read('src/app/services/jobs/[id]/page.tsx');
const nativeCustomer = read('carmazium app/carmazium app/src/screens/main/CustomerServiceJobDetailScreen.tsx');
const webProvider = read('src/app/dashboard/service/jobs/[id]/page.tsx');
const nativeProvider = read('carmazium app/carmazium app/src/screens/main/ProviderJobDetailScreen.tsx');
const backend = read('backend/src/services/services.service.ts');
const lifecycle = read('backend/src/services/services-lifecycle.service.ts');
const paymentsSpec = read('backend/src/services/services.payment-hardening.spec.ts');

function paymentRules(source) {
  const start = source.indexOf('export function classifyServiceCheckoutTarget(');
  const end = source.indexOf('export const formatPence', start);
  assert.ok(start >= 0 && end > start, 'payment presentation helpers must exist');
  const js = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, URL, Math, Date, Number };
  runInNewContext(js, context);
  return context.exports;
}

test('web and app accept secure Stripe or the already-paid job return, rejecting malicious destinations', () => {
  const jobId = '00000000-0000-4000-8000-000000000001';
  const tests = [
    ['https://checkout.stripe.com/c/pay/cs_test_123', 'STRIPE_CHECKOUT'],
    ['https://www.carmazium.com/services/jobs/' + jobId + '?paid=1', 'JOB_RETURN'],
    ['https://carmazium.com/services/jobs/' + jobId + '?paid=1', 'JOB_RETURN'],
    ['https://carmazium.com/services/jobs/' + jobId + '?paid=0', null],
    ['https://carmazium.com/services/jobs/different?paid=1', null],
    ['https://carmazium.com.evil.test/services/jobs/' + jobId + '?paid=1', null],
    ['http://www.carmazium.com/services/jobs/' + jobId + '?paid=1', null],
    ['https://checkout.stripe.com.evil.test/c/pay/x', null],
    ['https://checkout.stripe.com@evil.test/c/pay/x', null],
    ['https://checkout.stripe.com:444/c/pay/x', null],
    ['not a url', null],
  ];
  for (const source of [webApi, nativeApi]) {
    const f = paymentRules(source).classifyServiceCheckoutTarget;
    for (const [url, expected] of tests) assert.equal(f(url, jobId), expected, url);
  }
});

test('payment wording depends on backend payment state, not redirect parameters', () => {
  for (const source of [webApi, nativeApi]) {
    const text = paymentRules(source).servicePaymentStatusText;
    assert.match(text('PENDING'), /not yet confirmed/i);
    assert.match(text('PAID'), /is confirmed/i);
    assert.match(text('RELEASED'), /recorded.*released/i);
    assert.match(text('REFUNDED'), /refunded/i);
    assert.match(text('FAILED'), /could not be confirmed/i);
    assert.match(text(null), /unavailable/i);
  }
});

test('only consistent saved 9%-91% payment allocation is displayed', () => {
  const good = { grossPence: 17000, platformFeePence: 1530, contractorPence: 15470 };
  const wrong = [
    [{ ...good, platformFeePence: 5000 }, 17000],
    [{ ...good, contractorPence: 16000 }, 17000],
    [{ ...good }, 18000],
    [{ ...good, grossPence: 17000.1 }, 17000.1],
    [{ ...good, grossPence: -17000 }, -17000],
    [null, 17000],
  ];
  for (const source of [webApi, nativeApi]) {
    const evidence = paymentRules(source).servicePaymentEvidence;
    assert.deepEqual({ ...evidence(good, 17000) }, { ...good, refundPence: 0, netServicePence: 17000 });
    for (const [payment, agreed] of wrong) assert.equal(evidence(payment, agreed), null);
  }
});

test('existing Stripe Checkout recovery has idempotency and fails closed on uncertainty', () => {
  const checkout = backend.slice(backend.indexOf('private async freshCheckout('), backend.indexOf('async markPaid('));
  const required = [
    "existing.status === 'open'", "existing.status === 'complete'",
    "existing.payment_status === 'paid'", "existing.status !== 'expired'",
    'stripe.checkout.sessions.create(', 'idempotencyKey:', 'stripeCheckoutSessionId: session.id',
  ];
  for (const token of required) assert.ok(checkout.includes(token), token);
  assert.match(lifecycle, /if \(session\.status === 'complete' && session\.payment_status === 'paid'\)/);
  assert.match(lifecycle, /if \(session\.status === 'complete'\) continue/);
  assert.match(lifecycle, /session\.status !== 'expired'/);
  assert.match(paymentsSpec, /reuses an existing open Checkout session/);
  assert.match(paymentsSpec, /only one concurrent release/);
});

test('all four original job screens use verified payment evidence and native stays native', () => {
  for (const screen of [webCustomer, nativeCustomer, webProvider, nativeProvider]) {
    assert.match(screen, /servicePaymentEvidence/);
    assert.match(screen, /servicePaymentStatusText/);
    assert.match(screen, /paymentEvidence/);
    assert.match(screen, /CarMazium .*fee \(9%\)/);
    assert.match(screen, /91%/);
  }
  assert.match(webCustomer, /target === "JOB_RETURN"/);
  assert.match(nativeCustomer, /target === 'JOB_RETURN'/);
  assert.match(nativeCustomer, /await load\(\)/);
});
