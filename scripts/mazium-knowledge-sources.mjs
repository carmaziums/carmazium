import { createRequire } from 'node:module';

// Backend CI installs only backend dependencies. Node can also resolve the
// website's root install through the normal ancestor node_modules lookup.
const ts = createRequire(new URL('../backend/package.json', import.meta.url))('typescript');

// Parse the catalogue instead of treating a ] inside a quoted Next route as
// the end of its sources array. Unsupported entries fail rather than vanish.
export function extractKnowledgeSources(catalogue) {
  const ast = ts.createSourceFile('mazium-platform-knowledge.ts', catalogue, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) throw new Error('Knowledge catalogue has invalid TypeScript syntax.');
  const sources = new Set();
  function visit(node) {
    if (ts.isPropertyAssignment(node)
      && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
      && node.name.text === 'sources') {
      if (!ts.isArrayLiteralExpression(node.initializer)) throw new Error('Knowledge sources must be literal arrays.');
      for (const entry of node.initializer.elements) {
        if (!ts.isStringLiteralLike(entry)) throw new Error('Knowledge sources must contain only literal paths.');
        sources.add(entry.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!sources.size) throw new Error('No knowledge sources found in the catalogue.');
  return [...sources].sort();
}
