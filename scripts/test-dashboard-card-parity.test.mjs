import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
test('website and native share the complete card catalog and preference rules', () => {
  execFileSync(process.execPath, ['scripts/sync-dashboard-cards.mjs', '--check'], { cwd: root });
  const catalog = JSON.parse(read('src/data/dashboardCards.json'));
  for (const items of Object.values(catalog)) {
    assert.equal(new Set(items.map(item => item.id)).size, items.length);
    for (const item of items) assert.ok(item.href.startsWith('/') && (item.stackScreen || item.tabName), item.id);
  }
});
test('every dashboard web address resolves to its native destination', () => {
  const catalog = JSON.parse(read('src/data/dashboardCards.json'));
  const code = ts.transpileModule(read('carmazium app/carmazium app/src/lib/nativeContentLinks.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; runInNewContext(code, { exports, URL, Date, require: name => { assert.equal(name, '../data/dashboardCards.json'); return catalog; } });
  for (const item of [...catalog.personal, ...catalog.dealer]) {
    const target = exports.nativeContentTarget(item.href);
    assert.ok(target, item.href);
    assert.equal(target.name, item.tabName ? 'Tabs' : item.stackScreen, item.href);
  }
  assert.equal(exports.nativeContentTarget('https://other.example/dashboard'), null);
});
