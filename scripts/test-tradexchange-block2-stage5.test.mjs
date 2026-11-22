import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const webApi = read('src/lib/servicesApi.ts');
const nativeApi = read('carmazium app/carmazium app/src/lib/servicesApi.ts');
const web = read('src/app/services/jobs/[id]/page.tsx');
const native = read('carmazium app/carmazium app/src/screens/main/CustomerServiceJobDetailScreen.tsx');
const backend = read('backend/src/services/services.service.ts');
const backendSpec = read('backend/src/services/services.service.spec.ts');

function comparison(source) {
  const start = source.indexOf('export function isServiceQuoteSelectable(');
  const end = source.indexOf('export function parseServiceQuotePence(', start);
  assert.ok(start >= 0 && end > start);
  const js = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, Date, Number };
  runInNewContext(js, context);
  return context.exports;
}

test('website and app compare only ACTIVE unexpired quotes, cheapest first, without mutation', () => {
  const now = Date.parse('2026-11-22T12:00:00Z');
  const quotes = [
    { id: 'old', amountPence: 1000, status: 'ACTIVE', validUntil: '2026-11-21T12:00:00Z' },
    { id: 'high', amountPence: 23000, status: 'ACTIVE', validUntil: null },
    { id: 'revoked', amountPence: 1500, status: 'WITHDRAWN', validUntil: null },
    { id: 'low', amountPence: 12000, status: 'ACTIVE', validUntil: '2026-11-23T12:00:00Z' },
    { id: 'bad-date', amountPence: 500, status: 'ACTIVE', validUntil: 'invalid-date' },
  ];
  for (const source of [webApi, nativeApi]) {
    const f = comparison(source);
    assert.deepEqual(Array.from(f.comparableServiceQuotes(quotes, now), q => q.id), ['low', 'high']);
    assert.equal(quotes[0].id, 'old');
    assert.equal(f.isServiceQuoteSelectable(quotes[0], now), false);
    assert.equal(f.isServiceQuoteSelectable(quotes[3], now), true);
    assert.equal(f.isServiceQuoteSelectable(quotes[4], now), false);
  }
});

test('backend atomically claims one unchanged quote, refuses changed service area and declines competitors', () => {
  const s = backend.slice(backend.indexOf('async acceptQuote('), backend.indexOf('private async freshCheckout('));
  for (const clause of [
    'job.status === ServiceJobStatus.ACCEPTED && job.acceptedQuoteId === quoteId',
    'status: ServiceJobStatus.OPEN', 'expiresAt: { gt: now }',
    'amountPence: quote.amountPence', 'updatedAt: quote.updatedAt',
    'status: ServiceQuoteStatus.ACTIVE', 'tx.servicePayment.create',
    'id: { not: quote.id }', 'data: { status: ServiceQuoteStatus.DECLINED }',
    'capabilityAllowsJob(quote.contractorId, job.serviceType, this.jobArea(job))',
    'assertProviderPayoutReadyForNewWork(quote.contractorId)',
  ]) assert.ok(s.includes(clause), clause);
  assert.ok(backendSpec.includes('a competing quote cannot be accepted after the first quote wins'));
  assert.ok(backendSpec.includes('a provider moving outside the pickup area cannot have their quote accepted'));
});

test('website confirms provider choice and blocks simultaneous checkout requests', () => {
  for (const snippet of [
    'const checkoutPending = React.useRef(false)', 'checkoutPending.current || busy !== null',
    'window.confirm(', 'comparableServiceQuotes(job.quotes)', 'isServiceQuoteSelectable(quote)',
    'classifyServiceCheckoutTarget(url, job.id)', 'startCheckout(accepted, true)',
  ]) assert.ok(web.includes(snippet), snippet);
  assert.match(web, /catch \(e: unknown\) \{[\s\S]*?load\(\)[\s\S]*?\} finally/);
});

test('Android confirms provider choice and rechecks paid/accepted state after checkout failures', () => {
  for (const snippet of [
    'const checkoutPending = useRef(false)', 'const chooseProvider = (quote: ServiceQuote)',
    "'Choose this provider?'", 'comparableServiceQuotes(job?.quotes)',
    'isServiceQuoteSelectable(quote)', 'checkoutPending.current = true',
    "classifyServiceCheckoutTarget(checkoutUrl, jobId)",
    'await Linking.openURL(checkoutUrl)', 'openCheckout(accepted, true)',
  ]) assert.ok(native.includes(snippet), snippet);
  assert.match(native, /catch \(err: any\) \{[\s\S]*?await load\(\)[\s\S]*?\} finally/);
});

test('both interfaces resume payment only for the already accepted quote', () => {
  assert.ok(web.includes('job.acceptedQuoteId !== quote.id || job.payment?.status !== "PENDING"'));
  assert.ok(native.includes("job.acceptedQuoteId !== quote.id || job.payment?.status !== 'PENDING'"));
  for (const api of [webApi, nativeApi]) {
    assert.ok(api.includes('/services/jobs/' + '$' + '{jobId}/quotes/' + '$' + '{quoteId}/accept'));
  }
});
