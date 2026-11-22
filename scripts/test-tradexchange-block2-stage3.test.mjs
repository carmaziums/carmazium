import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const server = read('backend/src/services/services.service.ts');
const controller = read('backend/src/services/services.controller.ts');
const web = read('src/app/dashboard/service/jobs/page.tsx');
const native = read('carmazium app/carmazium app/src/screens/main/ProviderJobsScreen.tsx');
const webApi = read('src/lib/servicesApi.ts');
const nativeApi = read('carmazium app/carmazium app/src/lib/servicesApi.ts');
const loadWeb = read('src/lib/tradeXchangeProviderJobLoad.ts');
const loadNative = read('carmazium app/carmazium app/src/lib/tradeXchangeProviderJobLoad.ts');

test('available-job matching remains server enforced by approved capability and postcode', () => {
  const method = server.slice(server.indexOf('async feedPage('), server.indexOf('async assignedPage('));
  assert.match(method, /verifiedCapabilityWhere\(new Date\(\)\)/);
  assert.match(method, /dealerServiceEligibilityWhere\(\)/);
  assert.match(method, /jobPostcodeAreas/);
  assert.match(method, /serviceType: \{ in: types \}/);
  assert.match(method, /expiresAt: \{ gt: new Date\(\) \}/);
});

test('assigned work is scoped by business and authorised service, not new-quote verification', () => {
  assert.match(controller, /async assigned\(@Req\(\) req: any, @Query\(\) page: ServiceJobFeedQueryDto\)/);
  const assigned = server.slice(server.indexOf('async assignedPage('), server.indexOf('async upsertQuote('));
  assert.match(assigned, /options: \{ limit\?: number; cursor\?: string; serviceType\?: ServiceType \}/);
  assert.match(assigned, /approved\.filter\(type => type === options\.serviceType\)/);
  assert.match(assigned, /if \(!types\.length\) return \{ items: \[\], nextCursor: null \}/);
  assert.match(assigned, /contractorId: contractorProfileId/);
  assert.match(assigned, /serviceType: \{ in: types \}/);
  assert.doesNotMatch(assigned, /verifiedCapabilityWhere|currentNewWorkCapability/);
});

test('website and native filter BOTH endpoints before cursor pagination', () => {
  assert.match(web, /getJobFeedPage\(serviceType, cursor\)/);
  assert.match(web, /getAssignedJobsPage\(cursor, 20, serviceType\)/);
  assert.match(native, /getJobFeedPage\(requestedService, nextCursor\)/);
  assert.match(native, /getAssignedJobsPage\(nextCursor, 20, requestedService\)/);
  assert.match(native, /}, \[serviceType\]\)/);
  for (const api of [webApi, nativeApi]) {
    assert.match(api, /getJobFeedPage\(/);
    assert.match(api, /getAssignedJobsPage\(/);
    assert.match(api, /serviceType\?: ServiceType/);
    assert.match(api, /serviceType/);
  }
});

test('My Work and Available load independently even when new-work eligibility fails', () => {
  for (const loader of [loadWeb, loadNative]) {
    assert.match(loader, /Promise\.allSettled\(\[getAvailable\(\), getAssigned\(\)\]\)/);
    assert.match(loader, /availableError: approvalRequired \? null : openFailure/);
    assert.match(loader, /assigned: mine\.status === "fulfilled" \? mine\.value : null/);
  }
  assert.match(web, /setMine\(result\.assigned\?\.items \?\? \[\]\)/);
  assert.match(native, /tab === 'open' && lists\?\.approvalRequired/);
});

test('one provider screen uses service tabs and one existing verification hub', () => {
  assert.match(web, /"DELIVERY", "Delivery & recovery"/);
  assert.match(web, /"INSPECTION", "Inspections"/);
  assert.match(web, /\/dashboard\/partner/);
  assert.match(native, /accessibilityLabel=\{\`Filter \$\{item/);
  assert.match(native, /navigation\.navigate\('PartnerDashboard'\)/);
  assert.doesNotMatch(web, /\/dashboard\/service\/capabilities\//);
});
