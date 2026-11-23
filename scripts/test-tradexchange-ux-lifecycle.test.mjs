import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const nativeRoot = 'carmazium app/carmazium app/src/';
const source = read('src/lib/serviceJobJourney.ts');
const env = { exports: {} };
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, env);
const { customerServiceNextStep: next, serviceJobChangeOptions: options, validServiceJobChangeKind: normalise } = env.exports;

test('customer next actions agree across web and native and distinguish unpaid, paid and post-payout work', () => {
  assert.equal(source, read(nativeRoot + 'lib/serviceJobJourney.ts'));
  const expected = [
    ['OPEN', null, 'Compare quotes'],
    ['ACCEPTED', 'PENDING', 'Continue to payment'],
    ['ACCEPTED', 'PAID', 'Check payment status'],
    ['PAID', null, 'Check payment status'],
    ['PAID', 'PAID', 'Arrange the service'],
    ['IN_PROGRESS', 'PAID', 'Work in progress'],
    ['COMPLETED', 'PAID', 'Review the completed work'],
    ['DISPUTED', 'PAID', 'Dispute under review'],
    ['RELEASED', 'RELEASED', 'Service complete'],
    ['CANCELLED', null, 'Request cancelled'],
    ['EXPIRED', null, 'Request expired'],
  ];
  for (const [status, payment, title] of expected) assert.equal(next({ status, payment: payment ? { status: payment } : null }).title, title);
  assert.match(next({ status: 'DISPUTED', payment: { status: 'RELEASED' } }).description, /does not automatically reverse/);
  assert.match(next({ status: 'DISPUTED', payment: { status: 'PAID' } }).description, /payout is paused/);
  assert.equal(next({ status: 'RELEASED', payment: { status: 'REFUNDED' } }).title, 'Refund recorded');
  assert.doesNotMatch(next({ status: 'ACCEPTED', payment: { status: 'PENDING' } }).description, /provider is reserved|payment is confirmed/i);
});

test('support choices cannot reschedule completed work or submit an invalid request after quote acceptance', () => {
  for (const role of ['customer', 'provider']) {
    for (const status of ['ACCEPTED', 'PAID', 'IN_PROGRESS', 'COMPLETED', 'RELEASED', 'DISPUTED']) {
      const kinds = Array.from(options(status, role), ([kind]) => kind);
      assert.equal(kinds.includes('RESCHEDULE'), ['PAID', 'IN_PROGRESS'].includes(status));
      assert.equal(kinds.includes('CANNOT_ATTEND'), role === 'provider');
      assert.equal(kinds.includes('OTHER'), status !== 'ACCEPTED');
      assert.ok(kinds.includes('CANCEL'));
      for (const value of ['OTHER', 'CANCEL', 'CANNOT_ATTEND', 'RESCHEDULE', 'NOT_COMPLETED']) assert.ok(kinds.includes(normalise(value, status, role)));
    }
  }
  assert.equal(normalise('OTHER', 'ACCEPTED', 'customer'), 'CANCEL');
  assert.equal(normalise('RESCHEDULE', 'COMPLETED', 'customer'), 'OTHER');
  assert.equal(normalise('CANNOT_ATTEND', 'ACCEPTED', 'customer'), 'CANCEL');
  assert.equal(normalise('CANNOT_ATTEND', 'ACCEPTED', 'provider'), 'CANNOT_ATTEND');
});

test('request detail puts current actions and quotes ahead of details and keeps support reachable', () => {
  const web = read('src/app/services/jobs/[id]/page.tsx');
  const native = read(nativeRoot + 'screens/main/CustomerServiceJobDetailScreen.tsx');
  assert.ok(web.indexOf('aria-label="Next step"') < web.indexOf('>Request details</h2>'));
  assert.ok(web.indexOf('startCheckout(accepted, true)') < web.indexOf('>Request details</h2>'));
  assert.ok(native.indexOf('openCheckout(accepted, true)') < native.indexOf('>Request details</Text>'));
  assert.ok(native.indexOf('onPress={confirmJob}') < native.indexOf('>Request details</Text>'));
  assert.match(native, /job\.vehicles\.map/);
  for (const file of ['src/components/services/ServiceJobChanges.tsx', nativeRoot + 'components/ServiceJobChanges.tsx']) {
    const form = read(file);
    assert.match(form, /Changes, support and progress/);
    assert.match(form, /job\.status === 'DISPUTED'\) setExpanded\(true\)/);
    assert.match(form, /validServiceJobChangeKind/);
    assert.match(form, /pending\.current = true/);
    assert.match(form, /uploadServiceCaseEvidence/);
    assert.match(form, /acceptServiceReschedule/);
  }
});

test('native completion includes the existing verified review endpoint and saved-review readback', () => {
  const native = read(nativeRoot + 'screens/main/CustomerServiceJobDetailScreen.tsx');
  assert.match(native, /createCustomerServiceReview\(job\.id/);
  assert.match(native, /!job\.canReview \|\| job\.status !== 'RELEASED'/);
  assert.match(native, /job\.review \? 'Your verified service review'/);
  assert.match(native, /job\.review\.comment/);
  assert.match(native, /maxLength=\{2000\}/);
  assert.match(native, /reviewRating < 1 \|\| reviewRating > 5/);
  assert.match(read(nativeRoot + 'lib/servicesApi.ts'), /`\/services\/jobs\/\$\{id\}\/review`/);
});

test('detail refreshes are account and job scoped and preserve checkout errors while rereading authoritative state', () => {
  const web = read('src/app/services/jobs/[id]/page.tsx');
  const native = read(nativeRoot + 'screens/main/CustomerServiceJobDetailScreen.tsx');
  assert.match(web, /key=\{`\$\{user\.id\}:\$\{id\}`\}/);
  assert.match(native, /key=\{`\$\{userId\}:\$\{props\.route\.params\.jobId\}`\}/);
  for (const page of [web, native]) {
    assert.match(page, /request !== generation\.current/);
    assert.match(page, /if \(!preserveError\) setError\(null\)/);
    assert.match(page, /await load\(\)/);
    assert.match(page, /onBusyChange=/);
  }
});

test('assistant navigation can open the existing provider dashboard without inventing a provider route', () => {
  const navigation = { exports: {}, URL };
  runInNewContext(ts.transpileModule(read('backend/src/ai/mazium-site-navigation.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, navigation);
  const invalid = navigation.exports.hasUnverifiedNavigationPath;
  assert.equal(invalid('Open /dashboard/service.'), false);
  assert.equal(invalid('Open /dashboard/partner.'), false);
  assert.equal(invalid('Open /dashboard/service/provider-account.'), true);
});


test('inspection refusal displays the actual server refund including waived fees', () => {
  const notice = env.exports.inspectionRefusalNotice;
  assert.match(notice(125), /£125\.00/);
  assert.match(notice(0), /£0\.00/);
  assert.doesNotMatch(notice(0), /£125/);
  assert.match(notice(NaN), /Check your auction purchase/);
  assert.match(notice(-1), /Check your auction purchase/);
  for (const file of ['src/app/services/jobs/[id]/page.tsx', nativeRoot + 'screens/main/CustomerServiceJobDetailScreen.tsx']) {
    assert.match(read(file), /inspectionRefusalNotice\(result\.refundedAmount\)/);
    assert.match(read(file), /if \(!result\.refused\) throw new Error/);
  }
});
