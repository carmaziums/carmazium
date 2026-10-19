#!/usr/bin/env node
/**
 * Static light/dark-mode audit for the CarMazium mobile app.
 *
 * Usage: node scripts/theme-audit/audit.cjs [--json] [--ts <path to typescript>]
 *
 * Walks every .tsx file under src/screens and src/components with the
 * TypeScript AST and reports colour usages that are dark-mode-only and are NOT
 * guarded by an appearance check (isLight / mode === 'light' / palette.* /
 * light style maps). It cannot see a rendered pixel: a clean result means
 * "no known code pattern", not "visually verified".
 *
 * Categories
 *  statusBar      <StatusBar barStyle="light-content"> (static white glyphs)
 *  whiteIcon      color={Colors.white} on an icon/indicator — needs triage:
 *                 fine on a red/dark fill, invisible on a light card
 *  darkTextProp   color/placeholderTextColor/tintColor={Colors.textMuted|...}
 *  inlineDarkText style={{ color: Colors.textMuted|... }} in JSX
 *  darkGradient   LinearGradient colors using dark surfaces, unguarded
 *  switchTrack    Switch trackColor using dark-only tokens
 *  noAppearance   screen never reads the appearance store or palette
 */
const fs = require('fs');
const path = require('path');
const tsPathArg = process.argv.indexOf('--ts');
const ts = require(tsPathArg > -1 ? process.argv[tsPathArg + 1] : 'typescript');
const asJson = process.argv.includes('--json');
const root = path.resolve(__dirname, '../../src');

const DARK_TEXT = /Colors\.(textPrimary|textSecondary|textMuted|textFaint|textDisabled|iconMuted|inputPlaceholder|lightGrey|pale\w+|lightBlue_\w+)\b/;
const WHITE = /Colors\.white\b|['"]#(?:fff|FFF|ffffff|FFFFFF)['"]|['"]white['"]/;
const DARK_SURFACE = /Colors\.(bgPrimary|bgSecondary|bgTertiary|bgBody|bgCard\w*|bgElevated|bgSurface\w*|darkBlue_\w+|deepBlue_\w+)\b/;
const GUARD = /isLight|appearanceMode|\bmode\b|palette|\btp\.|lightReadable|LIGHT\b|light\./;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') walk(p, out); }
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function guarded(node, sf) {
  // Walk up a few levels: a ternary or logical expression mentioning the mode
  // means the author already chose per-appearance colours.
  let n = node;
  for (let i = 0; i < 6 && n; i++, n = n.parent) {
    if (ts.isConditionalExpression(n) || ts.isBinaryExpression(n)) {
      if (GUARD.test(n.getText(sf))) return true;
    }
    if (ts.isJsxAttribute(n)) break;
  }
  return false;
}

function auditFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits = [];
  const add = (kind, node, note = '') => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    hits.push({ kind, line: line + 1, text: node.getText(sf).replace(/\s+/g, ' ').slice(0, 110), note });
  };
  const insideStyleSheet = n => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) && /StyleSheet\.create$/.test(p.expression.getText(sf))) return true;
    }
    return false;
  };
  const visit = node => {
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      const init = node.initializer;
      const tag = node.parent.parent.tagName ? node.parent.parent.tagName.getText(sf) : '';
      const val = init.getText(sf);
      if (tag === 'StatusBar' && name === 'barStyle' && /light-content/.test(val) && !GUARD.test(val)) add('statusBar', node);
      if (ts.isJsxExpression(init) && init.expression) {
        const ex = init.expression;
        if (['color', 'placeholderTextColor', 'tintColor', 'thumbTintColor', 'selectionColor'].includes(name)) {
          if (DARK_TEXT.test(ex.getText(sf)) && !guarded(ex, sf) && !GUARD.test(ex.getText(sf))) add('darkTextProp', node, tag);
          else if (name === 'color' && WHITE.test(ex.getText(sf)) && !GUARD.test(ex.getText(sf))) add('whiteIcon', node, tag);
        }
        if (tag === 'LinearGradient' && name === 'colors' && DARK_SURFACE.test(ex.getText(sf)) && !GUARD.test(ex.getText(sf))) add('darkGradient', node);
        if (tag === 'Switch' && name === 'trackColor' && /Colors\.(borderMuted|whiteAlpha\d+|bgTertiary)/.test(ex.getText(sf)) && !GUARD.test(ex.getText(sf))) add('switchTrack', node);
      }
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(sf) === 'color' && !insideStyleSheet(node)) {
      const v = node.initializer.getText(sf);
      let inJsx = false;
      for (let p = node.parent; p; p = p.parent) { if (ts.isJsxAttribute(p)) { inJsx = p.name.getText(sf) === 'style'; break; } }
      if (inJsx && DARK_TEXT.test(v) && !GUARD.test(v) && !guarded(node.initializer, sf)) add('inlineDarkText', node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const isScreen = file.includes(`${path.sep}screens${path.sep}`);
  if (isScreen && !/useAppearanceStore|useAppearance\(|appearancePalette|adaptLegacyLightStyles/.test(src)) {
    hits.push({ kind: 'noAppearance', line: 1, text: '', note: '' });
  }
  return hits;
}

const files = walk(path.join(root, 'screens')).concat(walk(path.join(root, 'components')));
const report = files.map(f => ({ file: path.relative(path.resolve(root, '..'), f), hits: auditFile(f) }));
if (asJson) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }
const kinds = ['statusBar', 'whiteIcon', 'darkTextProp', 'inlineDarkText', 'darkGradient', 'switchTrack', 'noAppearance'];
const tot = Object.fromEntries(kinds.map(k => [k, 0]));
console.log(['file', ...kinds].join('\t'));
for (const r of report) {
  const c = Object.fromEntries(kinds.map(k => [k, r.hits.filter(h => h.kind === k).length]));
  kinds.forEach(k => (tot[k] += c[k]));
  if (Object.values(c).some(Boolean)) console.log([r.file, ...kinds.map(k => c[k])].join('\t'));
}
console.log(['TOTAL', ...kinds.map(k => tot[k])].join('\t'));