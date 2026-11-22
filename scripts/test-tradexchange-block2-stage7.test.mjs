import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const dateWeb = read('src/lib/ukServiceDateTime.ts');
const dateNative = read('carmazium app/carmazium app/src/lib/ukServiceDateTime.ts');
const formWeb = read('src/components/services/ServiceJobChanges.tsx');
const formNative = read('carmazium app/carmazium app/src/components/ServiceJobChanges.tsx');
const backend = read('backend/src/services/services.service.ts');
const controller = read('backend/src/services/services.controller.ts');
const integration = read('backend/src/services/services.audit.integration.spec.ts');

function schedule(source) {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const env = { exports: {}, Intl, Date, Number, Math };
  runInNewContext(js, env);
  return env.exports;
}

test('web and native resolve UK appointments identically across GMT/BST and DST boundaries', () => {
  const now = Date.parse('2025-01-01T00:00:00Z');
  const cases = [
    ['2026-07-15T14:30', '2026-07-15T13:30:00.000Z'],
    ['15/07/2026 14:30', '2026-07-15T13:30:00.000Z'],
    ['2026-12-15T14:30', '2026-12-15T14:30:00.000Z'],
    ['15/12/2026 14:30', '2026-12-15T14:30:00.000Z'],
    ['2026-03-29T01:30', null], // UK clocks skip this local hour
    ['2026-10-25T01:30', '2026-10-25T00:30:00.000Z'], // earlier occurrence
    ['2026-02-30T12:00', null],
    ['31/06/2026 12:00', null],
    ['2026-07-15T24:00', null],
    ['2026-07-15T14:60', null],
    ['15/07/2026 14:30 garbage', null],
  ];
  for (const source of [dateWeb, dateNative]) {
    const { parseUkServiceDateTime: parse, formatUkServiceDateTime: format } = schedule(source);
    for (const [input, expected] of cases) assert.equal(parse(input, now), expected, input);
    assert.equal(parse('2026-12-15T14:30', Date.parse('2026-12-15T14:31:00Z')), null);
    assert.match(format('2026-07-15T13:30:00.000Z'), /14:30 UK time/);
    assert.match(format('2026-12-15T14:30:00.000Z'), /14:30 UK time/);
    assert.equal(format(null), 'As soon as possible');
  }
});

test('reschedules are limited to unfinished paid work and the original active state is restored', () => {
  const request = backend.slice(backend.indexOf('async requestJobChange('), backend.indexOf('async acceptReschedule('));
  const accept = backend.slice(backend.indexOf('async acceptReschedule('), backend.indexOf('private async cancelUnpaidAcceptance('));
  assert.match(request, /ServiceJobStatus\.PAID, ServiceJobStatus\.IN_PROGRESS/);
  assert.match(request, /Only unfinished paid work can be rescheduled/);
  assert.match(accept, /request\.previousStatus/);
  assert.match(accept, /job\.completedAt \|\| job\.confirmedAt/);
  assert.match(accept, /job\.payment\?\.status !== ServicePaymentStatus\.PAID/);
  assert.match(accept, /job\.payment\.stripeTransferId \|\| job\.payment\.externalDisputeId/);
  assert.match(accept, /status: request\.previousStatus/);
  assert.match(integration, /never reopens finished %s work through a reschedule/);
});

test('both inline job-change panels show real work progress and one agreed UK date', () => {
  for (const source of [formWeb, formNative]) {
    for (const term of [
      'formatUkServiceDateTime(job.requestedFor)',
      'job.acceptedAt', 'job.payment?.paidAt', 'job.startedAt',
      'job.completedAt', 'job.payment?.releasedAt',
      'canReschedule', 'proposalPending', 'parseUkServiceDateTime(date)',
      'acceptServiceReschedule(job.id)', 'requestServiceJobChange(job.id',
      'ServiceJobChanges',
    ]) assert.ok(source.includes(term), term);
    assert.doesNotMatch(source, /new Date\(date\)\.toISOString\(\)/);
  }
  assert.match(formWeb, /window\.confirm/);
  assert.match(formNative, /Alert\.alert\('Agree to the new UK date\?'/);
  assert.match(formWeb, /if \(!canReschedule\)/);
  assert.match(formNative, /if \(!canReschedule\)/);
});

test('only paid accepted providers receive full customer contacts and street addresses', () => {
  const getJob = backend.slice(backend.indexOf('async getJob('), backend.indexOf('async createServiceReview('));
  const redact = backend.slice(backend.indexOf('private contactUnlocked('), backend.indexOf('private label('));
  assert.match(getJob, /const isAccepted = .*job\.contractorId === viewer\.contractorProfileId/);
  assert.match(getJob, /const canSeeCustomerContact = isCustomer \|\| isAdmin \|\| \(isAccepted && contactsUnlocked\)/);
  assert.match(getJob, /const canSeeContractorContact = isAdmin \|\| isAccepted \|\| \(isCustomer && contactsUnlocked\)/);
  assert.match(getJob, /this\.redact\(\{ \.\.\.job, quotes \}, canSeeCustomerContact\)/);
  assert.match(redact, /status === ServicePaymentStatus\.PAID/);
  assert.match(redact, /pickupAddress: null/);
  assert.match(redact, /deliveryAddress: null/);
  assert.match(redact, /serviceAddress: null/);
  assert.match(controller, /this\.tradeTeam\.assertJobPermission\(actor, id, 'manage'\)/);
});

test('both change request forms remain in existing customer and provider job-detail routes', () => {
  const webCustomer = read('src/app/services/jobs/[id]/page.tsx');
  const webProvider = read('src/app/dashboard/service/jobs/[id]/page.tsx');
  const nativeCustomer = read('carmazium app/carmazium app/src/screens/main/CustomerServiceJobDetailScreen.tsx');
  const nativeProvider = read('carmazium app/carmazium app/src/screens/main/ProviderJobDetailScreen.tsx');
  for (const screen of [webCustomer, webProvider, nativeCustomer, nativeProvider]) {
    assert.match(screen, /<ServiceJobChanges job=\{job\}/);
  }
});
