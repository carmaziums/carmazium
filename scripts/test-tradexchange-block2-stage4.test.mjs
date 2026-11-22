import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const websiteApi = read('src/lib/servicesApi.ts');
const nativeApi = read('carmazium app/carmazium app/src/lib/servicesApi.ts');
const server = read('backend/src/services/services.service.ts');
const controller = read('backend/src/services/services.controller.ts');
const webJob = read('src/app/dashboard/service/jobs/[id]/page.tsx');
const nativeJob = read('carmazium app/carmazium app/src/screens/main/ProviderJobDetailScreen.tsx');
const dto = read('backend/src/services/dto/index.ts');

function loadPriceParser(source) {
  const m = source.match(/export function parseServiceQuotePence\(input: string\): number \| null \{[\s\S]*?\n\}/);
  assert.ok(m, 'exact money parser must exist');
  const js = ts.transpileModule(m[0], {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const scope = { exports: {} };
  runInNewContext(js, scope);
  return scope.exports.parseServiceQuotePence;
}

test('web and original Android parse valid GBP prices into exactly the same integer pence', () => {
  const parsers = [loadPriceParser(websiteApi), loadPriceParser(nativeApi)];
  const cases = [
    ['1', 100], ['1.00', 100], ['1.5', 150], ['0.99', null],
    ['50000', 5000000], ['50000.00', 5000000], ['50000.01', null],
    ['1.001', null], ['1e3', null], ['-1', null], ['+12', null],
    ['12,00', null], ['12.', null], ['.50', null], ['', null],
    ['Infinity', null], ['100000', null], [' 23.40 ', 2340],
    ['12.34', 1234], ['12.3', 1230],
  ];
  for (const parser of parsers) for (const [input, expected] of cases) {
    assert.equal(parser(input), expected, input);
  }
});

test('quote writes remain unique per provider and protected by server-side status, expiry and area gates', () => {
  const quote = server.slice(server.indexOf('async upsertQuote('), server.indexOf('async withdrawQuote('));
  assert.match(quote, /Number\.isSafeInteger\(dto\.amountPence\)/);
  assert.match(quote, /dto\.amountPence < 100 \|\| dto\.amountPence > 5_000_000/);
  assert.match(quote, /capabilityAllowsJob\(/);
  assert.match(quote, /assertProviderPayoutReadyForNewWork\(/);
  assert.match(quote, /job\.customerId === userId/);
  assert.match(quote, /where: \{ jobId_contractorId:/);
  assert.match(quote, /tx\.serviceJob\.updateMany\(/);
  assert.match(quote, /status: ServiceJobStatus\.OPEN, expiresAt: \{ gt: new Date\(\) \}/);
  assert.match(quote, /return tx\.serviceQuote\.upsert\(/);
  assert.match(quote, /const isNew = existing\?\.status !== ServiceQuoteStatus\.ACTIVE/);
  assert.match(dto, /@IsInt\(\) @Min\(100\) @Max\(50_000_00\)/);
});

test('withdrawal is a confirmed explicit action and backend refuses accepted/closed jobs', () => {
  const withdraw = server.slice(server.indexOf('async withdrawQuote('), server.indexOf('async startJob('));
  assert.match(withdraw, /status !== ServiceQuoteStatus\.ACTIVE/);
  assert.match(withdraw, /status: ServiceJobStatus\.OPEN/);
  assert.match(withdraw, /updateMany\(/);
  assert.match(withdraw, /status: ServiceQuoteStatus\.WITHDRAWN/);
  assert.match(webJob, /window\.confirm\("Withdraw this quote\?/);
  assert.match(nativeJob, /Alert\.alert\(\s*'Withdraw quote\?'/);
  assert.match(controller, /this\.tradeTeam\.assertJobPermission\(req\.tradeActor, id, 'quote'\)/);
});

test('quote actions use the server permission flag rather than open status alone', () => {
  assert.match(server, /viewer\.quoteAllowedByActor !== false/);
  assert.match(server, /const canWithdrawQuote =/);
  assert.match(server, /q\.status === ServiceQuoteStatus\.ACTIVE/);
  assert.match(server, /viewer\.quoteAllowedByActor !== false/);
  assert.match(server, /job\.customerId !== viewer\.businessOwnerUserId/);
  assert.match(controller, /quoteAllowedByActor: actor \? \(!actor\.isStaff \|\| actor\.canQuote\) : false/);
  assert.match(webJob, /const canQuote = job\?\.status === "OPEN" && job\.canQuote === true/);
  assert.match(nativeJob, /const canQuote = job\?\.status === 'OPEN' && job\.canQuote === true/);
  assert.match(webJob, /quotePence === null/);
  assert.match(webJob, /job\.canWithdrawQuote === true/);
  assert.match(nativeJob, /job\.canWithdrawQuote === true/);
  assert.match(nativeJob, /quotePence === null/);
  assert.match(webJob, /New quotations are unavailable for this account/);
  assert.match(nativeJob, /New quotes unavailable/);
  assert.match(webJob, /CarMazium fee \{formatPence\(platformFeePence\)\}/);
  assert.match(nativeJob, /CarMazium fee \{formatPence\(platformFeePence\)\}/);
  assert.match(nativeJob, /quotePence === null/);
});

test('bidder privacy is enforced on server before clients receive the job', () => {
  const getJob = server.slice(server.indexOf('async getJob('), server.indexOf('async createServiceReview('));
  assert.match(getJob, /const canSeeCustomerContact = isCustomer \|\| isAdmin \|\| \(isAccepted && contactsUnlocked\)/);
  assert.match(getJob, /job\.quotes\.filter\(\(q\) => q\.contractorId === viewer\.contractorProfileId\)/);
  assert.match(getJob, /this\.redact\(\{ \.\.\.job, quotes \}, canSeeCustomerContact\)/);
  assert.match(webJob, /isMine && job\.customer/);
  assert.match(nativeJob, /isMine && job\.customer && ACTIVE_JOB_STATUSES\.includes\(job\.status\)/);
});

test('both apps submit and withdraw quotes through the same authenticated TradeXchange endpoints', () => {
  for (const api of [websiteApi, nativeApi]) {
    assert.match(api, /\/services\/jobs\/\$\{jobId\}\/quote/);
    assert.match(api, /method: 'PUT'/);
    assert.match(api, /method: 'DELETE'/);
    assert.match(api, /canQuote\?: boolean/);
    assert.match(api, /canWithdrawQuote\?: boolean/);
  }
  assert.match(webJob, /upsertQuote\(job\.id/);
  assert.match(nativeJob, /upsertProviderQuote\(job\.id/);
  assert.match(webJob, /withdrawQuote\(job\.id\)/);
  assert.match(nativeJob, /withdrawProviderQuote\(job\.id\)/);
});
