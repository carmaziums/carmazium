import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractKnowledgeSources } from './mazium-knowledge-sources.mjs';

test('knowledge fingerprints retain bracketed Next routes and every following source', () => {
  const catalogue = [
    'interface Entry { sources: readonly string[] }',
    'const ignored = "sources: [not-a-real-path]";',
    'const entries = [',
    "  { sources: ['before.ts', 'src/app/jobs/[id]/page.tsx', 'after.ts'] },",
    '  { "sources": ["src/app/[...slug]/page.tsx", "after.ts", "last.ts"] },',
    '];',
  ].join('\n');
  assert.deepEqual(extractKnowledgeSources(catalogue), [
    'after.ts', 'before.ts', 'last.ts', 'src/app/[...slug]/page.tsx', 'src/app/jobs/[id]/page.tsx',
  ]);
});

test('knowledge source extraction fails instead of accepting an incomplete catalogue', () => {
  for (const catalogue of [
    'const entry = { sources: computedPaths };',
    "const entry = { sources: ['first.ts', ...otherPaths] };",
    "const entry = { sources: ['first.ts', getPath()] };",
    "const entry = { sources: ['first.ts' };",
    'const entries = [];',
  ]) assert.throws(() => extractKnowledgeSources(catalogue), /Knowledge|No knowledge/);
});

test('AST parsing works with backend-only dependencies and the normal root fallback', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'carmazium-knowledge-resolution-'));
  try {
    const scripts = join(fixture, 'scripts');
    const backend = join(fixture, 'backend');
    const compiler = join(backend, 'node_modules', 'typescript');
    mkdirSync(scripts, { recursive: true });
    mkdirSync(join(compiler, 'lib'), { recursive: true });
    writeFileSync(join(backend, 'package.json'), '{}\n');
    writeFileSync(join(compiler, 'package.json'), '{"name":"typescript","main":"lib/typescript.js"}\n');
    const backendRequire = createRequire(new URL('../backend/package.json', import.meta.url));
    copyFileSync(backendRequire.resolve('typescript'), join(compiler, 'lib', 'typescript.js'));
    copyFileSync(new URL('./mazium-knowledge-sources.mjs', import.meta.url), join(scripts, 'mazium-knowledge-sources.mjs'));
    const parserUrl = pathToFileURL(join(scripts, 'mazium-knowledge-sources.mjs')).href;
    const exercise = [
      "import assert from 'node:assert/strict';",
      `import { extractKnowledgeSources } from ${JSON.stringify(parserUrl)};`,
      "assert.deepEqual(extractKnowledgeSources(\"const x = { sources: ['jobs/[id]/page.tsx', 'after.ts'] };\"), ['after.ts', 'jobs/[id]/page.tsx']);",
      "assert.throws(() => extractKnowledgeSources('const x = { sources: dynamicPaths };'), /literal arrays/);",
      "console.log('AST extraction and fail-closed validation passed');",
    ].join('\n');
    const run = () => execFileSync(process.execPath, ['--input-type=module', '--eval', exercise], {
      cwd: fixture, encoding: 'utf8', env: { ...process.env, NODE_PATH: '' },
    });
    // Backend CI installs only backend/package.json; the repository root has no dependencies.
    assert.match(run(), /AST extraction and fail-closed validation passed/);
    // Website-only checks can instead resolve through the standard ancestor node_modules.
    renameSync(join(backend, 'node_modules'), join(fixture, 'node_modules'));
    assert.match(run(), /AST extraction and fail-closed validation passed/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
