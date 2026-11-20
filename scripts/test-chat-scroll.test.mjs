import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/chatScroll.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { ChatScrollTracker } = exports;
const message = (id, more = {}) => ({ id, senderId: 'other', ...more });

test('a tall incoming message follows the position before DOM growth, not the new bottom gap', () => {
  const tracker = new ChatScrollTracker();
  tracker.update('room', message('old'), 'me', false);
  tracker.onScroll(600, 1000, 400); // at the old bottom
  // A 900px reply now makes scrollHeight 1900; do not remeasure the gap here.
  assert.equal(tracker.update('room', message('long-reply'), 'me', false), true);
});

test('new support AI replies and own sends reveal themselves even from older history', () => {
  const tracker = new ChatScrollTracker();
  tracker.update('room', message('old'), 'me', true);
  tracker.onScroll(0, 2000, 400);
  assert.equal(tracker.update('room', message('answer', { aiGenerated: true }), 'me', true), true);
  tracker.onScroll(0, 2000, 400);
  assert.equal(tracker.update('room', message('temp', { deliveryStatus: 'sending', clientMessageId: 'key' }), 'me', true), true);
});

test('history prepends, duplicate recovery, acknowledgements and read receipts do not jump', () => {
  const tracker = new ChatScrollTracker();
  tracker.update('room', message('temp', { clientMessageId: 'key', deliveryStatus: 'sending' }), 'me', true);
  tracker.onScroll(0, 2000, 400);
  assert.equal(tracker.update('room', message('confirmed', { clientMessageId: 'key', senderId: 'me' }), 'me', true), false);
  assert.equal(tracker.update('room', message('confirmed', { clientMessageId: 'key', senderId: 'me', isRead: true }), 'me', true), false);
  assert.equal(tracker.following, false);
});

test('ordinary incoming messages preserve reading history; returning to bottom resumes following', () => {
  const tracker = new ChatScrollTracker();
  tracker.update('room', message('old'), 'me', false);
  tracker.onScroll(0, 2000, 400);
  assert.equal(tracker.update('room', message('new'), 'me', false), false);
  tracker.onScroll(1600, 2000, 400);
  assert.equal(tracker.update('room', message('newer'), 'me', false), true);
});

test('switching rooms resets follow state even if both are empty', () => {
  const tracker = new ChatScrollTracker();
  tracker.update('room', undefined, 'me', true);
  tracker.following = false;
  assert.equal(tracker.update('next-room', undefined, 'me', true), true);
});
