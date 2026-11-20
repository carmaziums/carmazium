import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(root, 'package.json'));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function evaluate(source) {
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  runInNewContext(code, { exports, require: name => {
    if (name === 'react/jsx-runtime') return require(name);
    if (name === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children), __esModule: true };
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
    throw Error('Unreviewed content dependency: ' + name);
  } });
  return exports;
}
const pages = { privacy: 'privacy-policy', partner: 'become-a-partner', warrantyTerms: 'services/warranty/terms' };
const documents = Object.fromEntries(Object.entries(pages).map(([key, page]) => {
  const source = readFileSync(resolve(root, 'src/app', page, 'page.tsx'), 'utf8');
  return [key, renderToStaticMarkup(React.createElement(evaluate(source).default))];
}));
const partners = evaluate(readFileSync(resolve(root, 'src/lib/businessSpotlights.ts'), 'utf8')).businessSpotlights;
const bodySource = readFileSync(resolve(root, 'src/app/used-car-types/page.tsx'), 'utf8');
const bodyStart = bodySource.indexOf('const BODY_TYPES =');
const bodyEnd = bodySource.indexOf('\n]', bodyStart) + 2;
const bodyTypes = evaluate(bodySource.slice(bodyStart, bodyEnd) + '; export { BODY_TYPES };').BODY_TYPES;
writeFileSync(resolve(import.meta.dirname, '../src/data/nativeDocuments.ts'), '// Generated from the website by scripts/sync-native-documents.mjs. Do not edit by hand.\nexport const nativeDocuments = ' + JSON.stringify(documents) + ';\nexport const nativePartners = ' + JSON.stringify(partners) + ';\nexport const nativeBodyTypes = ' + JSON.stringify(bodyTypes) + ';\n');
