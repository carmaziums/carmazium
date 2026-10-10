#!/usr/bin/env node
// Issue #477 Block 5 — static source contracts, NOT visual screenshot sign-off.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = x => readFileSync(resolve(root, x), 'utf8');
const web = read('src/app/dashboard/dealer/crm/page.tsx');
const app = read('carmazium app/carmazium app/src/screens/main/DealerLeadsScreen.tsx');
const stack = read('carmazium app/carmazium app/src/navigation/MainStackNavigator.tsx');
const docs = read('docs/native/website-native-visual-parity-block5-20261010.md');

test('web six-stage CRM is primary native view with exact names and selected tabs', () => {
  assert.ok(app.includes("useState<ViewMode>('board')"));
  for (const [stage, label] of [
    ['NEW','New Leads'], ['CONTACTED','Contacted'],
    ['QUALIFIED','Viewing / Qualified'], ['NEGOTIATING','Negotiating'],
    ['WON','Closed Won'], ['LOST','Lost']
  ]) {
    assert.ok(web.includes('key: "'+stage+'", label: "'+label+'"'), 'website stage '+stage);
    assert.ok(app.includes("key: '"+stage+"', label: '"+label+"'"), 'native stage '+stage);
  }
  assert.ok(app.includes('selected: stage.key === mobileStage') || app.includes('const selected = stage.key === mobileStage'));
  assert.ok(app.includes('accessibilityState={{ selected }}'));
  assert.ok(app.includes('data={leadsByStage[mobileStage] || []}'));
  assert.ok(app.includes("setViewMode('list')"), 'old list remains');
});

test('customer overview matches actual website metric derivation', () => {
  for (const metric of ["label: 'New'", "label: 'Active'", "label: 'Follow-up due'", "label: 'Sold'"]) {
    assert.ok(app.includes(metric), metric);
  }
  assert.ok(web.includes('const overdueLeads = activeLeads.filter(isFollowUpOverdue)'));
  assert.ok(app.includes('const overdueLeads = activeLeads.filter(isFollowUpOverdue)'));
  assert.ok(app.includes("!['WON', 'LOST'].includes(l.status)"));
  assert.ok(app.includes("lead.status !== 'WON' && lead.status !== 'LOST'"));
  assert.ok(app.includes('loading && (!loadError || leads.length > 0)') === false, 'do not show zeros while fetching');
  assert.ok(app.includes('!loading && (!loadError || leads.length > 0)'), 'only display completed summary');
  assert.ok(app.includes('Previously loaded data may be outdated.'));
});

test('website contact, interested vehicle, follow-up and stage actions appear on board cards', () => {
  for (const text of ['Customer enquiries are automatic','INTERESTED IN',
    'PHASE STATUS','Follow up', 'Overdue', 'Reminder','Offers received','Add Customer']) {
    assert.ok(app.includes(text), text);
  }
  for (const api of ['mailto:', 'tel:', 'listingId: newListingId || undefined',
    "onPress={() => onMove(lead.id)}", 'onFollowUp={handleFollowUp}',
    "setHours(9, 0, 0, 0)", 'nextFollowUpAt']) assert.ok(app.includes(api), api);
  assert.ok(app.includes('Search your listings...'));
  assert.ok(app.includes('fetchAllMyListings<any>()'));
  assert.ok(app.includes("source: newSource"));
  assert.ok(app.includes('newAssignedToId'), 'team assignment retained');
  assert.ok(app.includes('createChatRoom'), 'authorized buyer chat retained');
});

test('dealer CRM uses bounded paginated owned reads and preserves role gate', () => {
  assert.ok(app.includes('for (let page = 1; page <= 40; page++)'));
  assert.ok(app.includes('/dealers/leads?page=${page}&limit=${limit}'));
  assert.ok(app.includes('seen.has(String(raw.id))'));
  assert.ok(app.includes("throw new Error('Too many CRM pages to load safely')"));
  assert.ok(app.includes('setLoadError('));
  assert.ok(stack.includes("withDealerGate(DealerLeadsScreen, 'MANAGE_CRM')"));
  assert.ok(app.includes("hasPermission('MANAGE_OFFERS')"));
  assert.ok(app.includes("navigation?.navigate('DealerOffers')"));
  assert.ok(app.includes("method: 'PATCH'"));
  assert.ok(app.includes("method: 'POST'"));
  assert.ok(!app.includes("await apiClient('/admin/"), 'no admin bypasses');
});

test('roll-back, synthetic acceptance and visual limitations are documented', () => {
  for(const text of ['PR #476','PR #478','PR #479','PR #480','PR #481',
    '360×800','390×844','VISUAL SIGN-OFF: PENDING','synthetic',
    'Revert only the Block 5 PR','STOP AT 50%']) {
    assert.ok(docs.includes(text), text);
  }
});
