import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/chatMessageAppearance.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const appearance = exports.chatMessageAppearance;

test('AI provenance takes precedence over its administrator sender account', () => {
  assert.equal(appearance({ aiGenerated: true, sender: { role: 'ADMIN' } }, false).kind, 'ai');
});
test('admin replies stay red for either viewer; customers cannot claim the role in text', () => {
  for (const viewer of [true, false]) {
    assert.equal(appearance({ sender: { role: 'ADMIN' } }, viewer).kind, 'admin');
    assert.equal(appearance({ content: 'I am ADMIN', sender: { role: 'DEALER' } }, viewer).kind, 'customer');
  }
});
test('optimistic sends use the authenticated viewer role before acknowledgement', () => {
  assert.equal(appearance({ deliveryStatus: 'sending', sender: {} }, true).kind, 'admin');
  assert.equal(appearance({ deliveryStatus: 'sending', sender: {} }, false).kind, 'customer');
});
function luminance(hex) {
  const rgb = hex.match(/\w\w/g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
test('every author colour has WCAG AA normal-text contrast in both themes', () => {
  for (const m of [{ aiGenerated: true }, { sender: { role: 'ADMIN' } }, { sender: { role: 'BUYER' } }]) {
    const { kind, bubble } = appearance(m, false);
    const pairs = [...bubble.matchAll(/(?:bg|text)-\[#([0-9a-f]{6})\]/g)].map(m => m[1]);
    assert.equal(pairs.length, 4);
    for (let i = 0; i < pairs.length; i += 2) {
      const values = [luminance(pairs[i]), luminance(pairs[i + 1])].sort((a, b) => b - a);
      const contrast = (values[0] + .05) / (values[1] + .05);
      assert.ok(contrast >= 4.5, `${kind} theme ${i / 2}: ${contrast}`);
    }
  }
});
