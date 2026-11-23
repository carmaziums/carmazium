import assert from 'node:assert/strict';
import { test } from 'node:test';
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
