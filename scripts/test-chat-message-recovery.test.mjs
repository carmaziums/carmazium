import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/chatMessageRecovery.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { reconcileChatMessages: reconcile } = exports;
const message = (id, extra = {}) => ({ id, chatRoomId: 'support', senderId: 'customer', content: id,
  isRead: false, createdAt: '2026-11-18T20:00:00Z', updatedAt: '2026-11-18T20:00:00Z', ...extra });

test('recovers a missed reply without discarding earlier pages or duplicating socket messages', () => {
  const history = message('old', { createdAt: '2026-11-18T19:00:00Z' });
  const sent = message('sent');
  const answer = message('answer', { senderId: 'bot', createdAt: '2026-11-18T20:01:00Z' });
  const recovered = reconcile([history, sent], [sent, answer], 'support');
  assert.deepEqual(Array.from(recovered, m => m.id), ['old', 'sent', 'answer']);
  assert.equal(reconcile(recovered, [sent, answer], 'support'), recovered);
});

test('confirms the exact optimistic send while preserving a different pending send', () => {
  const pending = message('temp-1', { senderId: 'optimistic', clientMessageId: 'key-1', deliveryStatus: 'failed' });
  const other = message('temp-2', { clientMessageId: 'key-2', deliveryStatus: 'sending' });
  const result = reconcile([pending, other], [message('server-1', { clientMessageId: 'key-1' })], 'support');
  assert.equal(result.length, 2);
  assert.equal(result.find(m => m.id === 'server-1').deliveryStatus, undefined);
  assert.equal(result.find(m => m.id === 'temp-2'), other);
});

test('rejects other-room records and does not match another sender by client key', () => {
  const mine = message('pending', { clientMessageId: 'same', deliveryStatus: 'sending' });
  const result = reconcile([mine, message('old-room', { chatRoomId: 'elsewhere' })], [
    message('private', { chatRoomId: 'elsewhere' }), message('other-user', { senderId: 'other', clientMessageId: 'same' }),
  ], 'support');
  assert.deepEqual(Array.from(result, m => m.id).sort(), ['other-user', 'pending']);
});

test('a stale REST page cannot undo a read receipt or a newer edited message', () => {
  const read = message('read', { isRead: true });
  const edited = message('edited', { content: 'new content', updatedAt: '2026-11-18T20:02:00Z' });
  const result = reconcile([read, edited], [message('read'), message('edited')], 'support');
  assert.equal(result.find(m => m.id === 'read').isRead, true);
  assert.equal(result.find(m => m.id === 'edited').content, 'new content');
});
