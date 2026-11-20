import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/chatPresentation.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const helpers = {};
runInNewContext(compiled.outputText, { exports: helpers, URL });
const { chatAppearance, supportLinkUrl, supportTextParts, ChatFollowTracker } = helpers;
const message = (id, senderId = 'staff', extra = {}) => ({ id, senderId, ...extra });

test('new AI replies and sent messages remain visible even when the user was reading history', () => {
  const tracker = new ChatFollowTracker();
  assert.equal(tracker.update('support', message('1'), 'buyer', true, true), true);
  assert.equal(tracker.update('support', message('2', 'staff', { aiGenerated: true }), 'buyer', true, false), true);
  assert.equal(tracker.update('support', message('3', 'buyer'), 'buyer', true, false), true);
  assert.equal(tracker.update('support', message('4'), 'buyer', true, false), true);
});
test('history pagination and duplicate delivery do not jump; room changes reset the position', () => {
  const tracker = new ChatFollowTracker();
  tracker.update('a', message('1'), 'buyer', false, true);
  assert.equal(tracker.update('a', message('1'), 'buyer', false, true), false);
  assert.equal(tracker.update('a', message('2'), 'buyer', false, false), false);
  assert.equal(tracker.update('a', message('3'), 'buyer', false, true), true);
  assert.equal(tracker.update('b', undefined, 'buyer', false, false), false);
  assert.equal(tracker.update('b', message('1'), 'buyer', false, false), true);
});
test('optimistic message acknowledgement keeps one scroll identity', () => {
  const tracker = new ChatFollowTracker();
  assert.equal(tracker.update('a', message('local', 'buyer', { clientMessageId: 'client-1' }), 'buyer', false, false), true);
  assert.equal(tracker.update('a', message('server', 'buyer', { clientMessageId: 'client-1' }), 'buyer', false, false), false);
});
const luminance = (hex) => {
  const rgb = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
test('customer, AI, and staff colours are distinct and all text meets 4.5:1 contrast in both themes', () => {
  for (const dark of [false, true]) {
    const appearances = [chatAppearance({sender:{role:'BUYER'}},dark), chatAppearance({aiGenerated:true,sender:{role:'ADMIN'}},dark), chatAppearance({sender:{role:'ADMIN'}},dark)];
    assert.equal(appearances.map(x => x.kind).join(','), 'customer,ai,admin');
    assert.equal(new Set(appearances.map(x => x.background)).size, 3);
    for (const a of appearances) for (const text of [a.foreground, a.secondary]) {
      const [hi,lo] = [luminance(a.background),luminance(text)].sort((a,b) => b-a);
      assert.ok((hi+.05)/(lo+.05) >= 4.5, `${a.kind} contrast in ${dark ? 'dark' : 'light'} theme`);
    }
  }
  assert.equal(chatAppearance({sender:{}},false,'admin').kind,'admin');
});
test('support links preserve paths and queries but reject external hosts and executable schemes', () => {
  assert.equal(supportLinkUrl('/dashboard/user?tab=cars'), 'https://www.carmazium.com/dashboard/user?tab=cars');
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd','intent://test','https://carmazium.com.evil.test','//evil.test','/\\evil.test','https://user:secret@carmazium.com','https://example.com']) assert.equal(supportLinkUrl(bad), null, bad);
  const parts = supportTextParts('Open [My Cars](/dashboard/user?tab=cars) to edit.');
  assert.equal(parts.map(x=>x.text).join(''),'Open My Cars to edit.');
  assert.equal(parts[1].url,'https://www.carmazium.com/dashboard/user?tab=cars');
  assert.equal(supportTextParts('[bad](javascript:doBad)')[0].url, undefined);
});

// Regression from the real Android reply: raw **Edit** was visible to customers.
test('AI emphasis renders without losing links, unmatched stars or ordinary text', () => {
  const parts = supportTextParts('Open [My Cars](/dashboard/user?tab=cars), select **Edit**, then save.');
  assert.equal(parts.map(p => p.text).join(''), 'Open My Cars, select Edit, then save.');
  assert.equal(parts.find(p => p.text === 'Edit').bold, true);
  assert.equal(parts.find(p => p.text === 'My Cars').url, 'https://www.carmazium.com/dashboard/user?tab=cars');
  assert.equal(supportTextParts('2 * 3, **unfinished').map(p => p.text).join(''), '2 * 3, **unfinished');
});
