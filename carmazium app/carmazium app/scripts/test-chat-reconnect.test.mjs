import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/chatTimeline.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const helpers = {};
runInNewContext(compiled.outputText, { exports: helpers });
const { mergeChatUpdates, readChatUpdates } = helpers;
const row = (i, extra = {}) => ({ id: 'm' + i, createdAt: new Date(i * 1000).toISOString(), senderId: 'buyer', chatRoomId: 'room', updatedAt: new Date(i * 1000).toISOString(), ...extra });

test('a missed reply is recovered alongside history, socket events and an acknowledged local send', () => {
  const optimistic = row(3, { id: 'local', deliveryStatus: 'sending', clientMessageId: 'request' });
  const confirmed = row(3, { clientMessageId: 'request' });
  const current = [row(1), row(2, { isRead: true }), optimistic, row(5)];
  const missed = row(4, { senderId: 'support', aiGenerated: true });
  const rows = mergeChatUpdates(current, [row(2, { isRead: false }), confirmed, missed], 'room');
  assert.deepEqual(Array.from(rows, r => r.id), ['m1', 'm2', 'm3', 'm4', 'm5']);
  assert.equal(rows[1].isRead, true);
  assert.equal(rows[2].deliveryStatus, undefined);
  assert.deepEqual(Array.from(mergeChatUpdates(rows, [confirmed, missed], 'room'), r => r.id), Array.from(rows, r => r.id));
});

test('catch-up crosses missed pages and stops at the previous snapshot', async () => {
  const pages = [[5, 6], [3, 4], [1, 2]];
  const cursors = [];
  const load = async before => {
    cursors.push(before?.id);
    const numbers = pages.shift();
    return { data: numbers.map(i => row(i)), pagination: { hasMore: true, nextCursor: row(numbers[0]) } };
  };
  const response = await readChatUpdates(load, row(3), () => true);
  assert.deepEqual(cursors, [undefined, 'm5']);
  assert.deepEqual(Array.from(response.rows, r => r.id), ['m3', 'm4', 'm5', 'm6']);
});

test('first open and abandoned catch-up never request older pages', async () => {
  let count = 0;
  const load = async () => {
    count++;
    return { data: [row(5)], pagination: { hasMore: true, nextCursor: row(5) } };
  };
  await readChatUpdates(load, null, () => true);
  await readChatUpdates(load, row(1), () => false);
  assert.equal(count, 2);
});

test('stale REST records cannot replace later updates or mix rooms', () => {
  const current = [row(1, { content: 'new', updatedAt: row(5).updatedAt })];
  assert.equal(mergeChatUpdates(current, [row(1), row(9, { chatRoomId: 'other' })], 'room'), current);
});
