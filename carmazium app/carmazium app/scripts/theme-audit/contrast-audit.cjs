#!/usr/bin/env node
/**
 * Rendered-colour contrast audit (static) for the CarMazium mobile app.
 *
 *   node scripts/theme-audit/contrast-audit.cjs [--json out.json] [--ts <typescript path>] [files...]
 *
 * For every screen/component it:
 *  1. evaluates each `StyleSheet.create({...})` with the real colour/typography
 *     tokens,
 *  2. rebuilds the light-mode style map exactly as the screen does
 *     (adaptLegacyLightStyles / mergeAppearanceStyles, using the real
 *     implementations from src/theme/appearancePalette.ts),
 *  3. walks the JSX tree tracking the resolved background of every ancestor,
 *     for both appearances, and
 *  4. checks every <Text> colour and icon `color` against the background it is
 *     drawn on (alpha fills composited), using WCAG thresholds: 4.5:1 text,
 *     3:1 large text and icons.
 *
 * Limits — read before trusting a clean result:
 *  - Styles built at runtime, colours from API data, images and gradients
 *    behind text are treated as UNKNOWN backgrounds and skipped, not passed.
 *  - JSX returned from helper functions is checked against the page/card
 *    background, since its real parent is not statically known.
 *  - Only the default state and the "every conditional style applied" state
 *    are evaluated, not every combination.
 *  It finds code-level defects; it is not a substitute for rendering a screen.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const argv = process.argv.slice(2);
const tsIdx = argv.indexOf('--ts');
const ts = require(tsIdx > -1 ? argv[tsIdx + 1] : 'typescript');
const jsonIdx = argv.indexOf('--json');
const jsonOut = jsonIdx > -1 ? argv[jsonIdx + 1] : null;
const explicitFiles = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--ts' && argv[i - 1] !== '--json');

const APP = path.resolve(__dirname, '../..');
const SRC = path.join(APP, 'src');

// ─── Minimal TS module loader (no node_modules needed) ──────────────────────
const cache = new Map();
function loadTs(file) {
  if (cache.has(file)) return cache.get(file);
  const src = fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  cache.set(file, mod.exports);
  const req = spec => {
    if (spec === 'react-native') return { PixelRatio: { getFontScale: () => 1 }, Platform: { OS: 'android', select: o => o.android ?? o.default } };
    if (spec.startsWith('.')) {
      const base = path.resolve(path.dirname(file), spec);
      for (const cand of [base + '.ts', base + '.tsx', path.join(base, 'index.ts')]) {
        if (fs.existsSync(cand)) return loadTs(cand);
      }
    }
    return {}; // type-only or irrelevant runtime import
  };
  vm.runInNewContext(js, { module: mod, exports: mod.exports, require: req, console }, { filename: file });
  cache.set(file, mod.exports);
  return mod.exports;
}

const { Colors } = loadTs(path.join(SRC, 'constants/colors.ts'));
const typo = loadTs(path.join(SRC, 'constants/typography.ts'));
const spacing = loadTs(path.join(SRC, 'constants/spacing.ts'));
const pal = loadTs(path.join(SRC, 'theme/appearancePalette.ts'));
const PAL = { light: pal.appearancePalette('light'), dark: pal.appearancePalette('dark') };

// ─── Colour maths ───────────────────────────────────────────────────────────
const NAMED = { white: '#FFFFFF', black: '#000000', transparent: 'rgba(0,0,0,0)' };
function parseColor(c) {
  if (typeof c !== 'string') return null;
  c = NAMED[c.trim().toLowerCase()] || c.trim();
  let m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map(x => x + x).join('');
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
  }
  m = c.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(',').map(s => parseFloat(s));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
}
const over = (fg, bg) => [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const lum = c => {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

// ─── Sandboxed evaluation of style / colour expressions ─────────────────────
const UNKNOWN = Symbol('unknown');
function deepUnknown() {
  const fn = function () { return deepUnknown(); };
  return new Proxy(fn, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => NaN : k === Symbol.iterator ? undefined : k === '__unknown' ? true : deepUnknown()),
    ownKeys: () => ['prototype'],
    getOwnPropertyDescriptor: (t, k) => Object.getOwnPropertyDescriptor(t, k),
    apply: () => deepUnknown(),
  });
}
const isUnknown = v => typeof v === 'function' && v.__unknown === true;

function makeScope(mode, extra = {}) {
  const palette = PAL[mode];
  const known = {
    Colors, ...typo, ...spacing,
    StyleSheet: { create: o => o, absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, hairlineWidth: 1 },
    Platform: { OS: 'android', select: o => o.android ?? o.default },
    lightReadableText: pal.lightReadableText,
    appearancePalette: pal.appearancePalette,
    mergeAppearanceStyles: pal.mergeAppearanceStyles,
    adaptLegacyLightStyles: pal.adaptLegacyLightStyles,
    palette, tp: palette, LIGHT: PAL.light, DARK: PAL.dark, LIGHT_PALETTE: PAL.light,
    tc: c => pal.themedColor(mode, c), themedColorNow: c => pal.themedColor(mode, c),
    themedColor: pal.themedColor, toLightForeground: pal.toLightForeground,
    tbg: (c, k) => pal.themedSurface(mode, c, k), tfill: c => pal.themedFill(mode, c),
    lightStrongText: pal.lightStrongText, lightSolidFill: pal.lightSolidFill,
    isLight: mode === 'light', isDark: mode === 'dark', light: mode === 'light', dark: mode === 'dark',
    appearanceMode: mode, mode, undefined, Math, Number, String, Boolean, Object, Array, JSON,
    ...extra,
  };
  return new Proxy(known, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : k in t ? t[k] : deepUnknown()),
  });
}
function evalExpr(text, scope) {
  try {
    const js = ts.transpileModule('(' + text + ')', { compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
    const body = js.replace(/^\s*["']use strict["'];?\s*/, '').trim().replace(/;$/, '');
    const fn = new Function('__s', 'with (__s) { return ' + body + ' }');
    return fn(scope);
  } catch {
    return UNKNOWN;
  }
}

// ─── Per-file analysis ──────────────────────────────────────────────────────
const TEXT_TAGS = new Set(['Text', 'Animated.Text', 'TextInput']);
const ICON_TAGS = /^(Ionicons|MaterialCommunityIcons|MaterialIcons|Feather|FontAwesome\w*|AntDesign|Icon|ActivityIndicator)$/;
const OPAQUE_UNKNOWN_TAGS = /^(Image|ImageBackground|ExpoImage|LinearGradient|Video|MapView|BlurView|WebView|Camera\w*)$/;

function analyse(file) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lineOf = n => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  // 1. StyleSheets + light maps, evaluated in dependency order.
  const sheets = {}; // name -> object (mode independent)
  const pendingDecls = [];
  const visitTop = n => {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name)) pendingDecls.push(n);
    ts.forEachChild(n, visitTop);
  };
  visitTop(sf);
  const sheetDecls = pendingDecls.filter(d => /StyleSheet\.create\s*\(/.test(d.initializer.getText(sf).slice(0, 40)));
  for (let pass = 0; pass < 3; pass++) {
    for (const d of sheetDecls) {
      const name = d.name.text;
      if (sheets[name]) continue;
      const v = evalExpr(d.initializer.getText(sf), makeScope('dark', sheets));
      if (v && v !== UNKNOWN && typeof v === 'object') sheets[name] = v;
    }
  }
  // Module-level light map built once (e.g. `const lightStyles = merge(...)`).
  for (const d of pendingDecls) {
    const t = d.initializer.getText(sf);
    if (/^(mergeAppearanceStyles|adaptLegacyLightStyles)\(/.test(t)) {
      const v = evalExpr(t, makeScope('light', sheets));
      if (v && v !== UNKNOWN) sheets[d.name.text] = v;
    }
  }
  // 2. Style aliases: `const ts = <cond> ? LIGHT_EXPR : base`
  const aliases = {}; // alias -> { light, dark }
  for (const d of pendingDecls) {
    const init = d.initializer;
    const name = d.name.text;
    if (ts.isConditionalExpression(init) && /light|isLight|isDark|dark/.test(init.condition.getText(sf))) {
      const whenTrue = init.whenTrue.getText(sf), whenFalse = init.whenFalse.getText(sf);
      const darkFirst = /dark|isDark/.test(init.condition.getText(sf)) && !/light/.test(init.condition.getText(sf));
      const lightExpr = darkFirst ? whenFalse : whenTrue;
      const darkExpr = darkFirst ? whenTrue : whenFalse;
      const L = evalExpr(lightExpr, makeScope('light', sheets));
      const D = evalExpr(darkExpr, makeScope('dark', sheets));
      if (L && D && L !== UNKNOWN && D !== UNKNOWN && typeof L === 'object' && !isUnknown(L)) aliases[name] = { light: L, dark: D };
    }
  }
  for (const [name, obj] of Object.entries(sheets)) if (!aliases[name]) aliases[name] = { light: obj, dark: obj, raw: true };
  for (const d of pendingDecls) {
    if (ts.isIdentifier(d.initializer) && aliases[d.initializer.text] && !aliases[d.name.text]) aliases[d.name.text] = aliases[d.initializer.text];
  }

  // Resolve a single value expression (a colour) consistently with how style
  // arrays are resolved: an unknown condition takes the false branch in the
  // 'default' state and the true branch in the 'all' state, so a label's
  // colour and its container's background are evaluated for the SAME state.
  // Three-valued condition evaluation: true / false / UNKNOWN. Handles
  // `unknown || true` (true) and `unknown && false` (false) exactly.
  function evalCond(e, scope) {
    if (ts.isParenthesizedExpression(e)) return evalCond(e.expression, scope);
    if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.ExclamationToken) {
      const v = evalCond(e.operand, scope);
      return v === UNKNOWN ? UNKNOWN : !v;
    }
    if (ts.isBinaryExpression(e)) {
      const op = e.operatorToken.kind;
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.AmpersandAmpersandToken) {
        const l = evalCond(e.left, scope), r = evalCond(e.right, scope);
        if (op === ts.SyntaxKind.BarBarToken) return l === true || r === true ? true : l === false && r === false ? false : UNKNOWN;
        return l === false || r === false ? false : l === true && r === true ? true : UNKNOWN;
      }
    }
    const v = evalExpr(e.getText(sf), scope);
    if (v === UNKNOWN || isUnknown(v)) return UNKNOWN;
    return !!v;
  }

  function resolveValue(e, scope, all) {
    if (!e) return UNKNOWN;
    if (ts.isParenthesizedExpression(e)) return resolveValue(e.expression, scope, all);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    if (ts.isConditionalExpression(e)) {
      const cond = evalCond(e.condition, scope);
      if (cond === true) return resolveValue(e.whenTrue, scope, all);
      if (cond === false) return resolveValue(e.whenFalse, scope, all);
      return resolveValue(all ? e.whenTrue : e.whenFalse, scope, all);
    }
    if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && ['tc', 'themedColorNow'].includes(e.expression.text) && e.arguments.length === 1) {
      const inner = resolveValue(e.arguments[0], scope, all);
      return typeof inner === 'string' ? scope.tc(inner) : UNKNOWN;
    }
    const v = evalExpr(e.getText(sf), scope);
    return isUnknown(v) ? UNKNOWN : v;
  }

  // 3. Resolve a style attribute expression to a flat style for a mode/state.
  function resolveStyle(expr, mode, allConditionals) {
    const out = {};
    // Provenance of the final `color` / `backgroundColor`, so a fixer knows
    // whether to patch a StyleSheet key or an inline expression.
    const prov = {};
    let partial = false; // some part of the style could not be resolved
    const scope = makeScope(mode, Object.fromEntries(Object.entries(aliases).map(([k, v]) => [k, v[mode]])));
    const apply = e => {
      if (!e) return;
      if (ts.isParenthesizedExpression(e)) return apply(e.expression);
      if (ts.isArrayLiteralExpression(e)) return e.elements.forEach(apply);
      if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        const cond = evalCond(e.left, scope);
        if (cond === true) return apply(e.right);
        if (cond === UNKNOWN && allConditionals) apply(e.right);
        return;
      }
      if (ts.isConditionalExpression(e)) {
        const cond = evalCond(e.condition, scope);
        if (cond === true) return apply(e.whenTrue);
        if (cond === false) return apply(e.whenFalse);
        return apply(allConditionals ? e.whenTrue : e.whenFalse);
      }
      if (ts.isIdentifier(e) && (e.text === 'undefined' || e.text === 'null')) return;
      if (e.kind === ts.SyntaxKind.FalseKeyword || e.kind === ts.SyntaxKind.NullKeyword) return;
      let v;
      if (ts.isObjectLiteralExpression(e) && e.properties.every(pp => ts.isPropertyAssignment(pp))) {
        v = {};
        for (const pp of e.properties) v[pp.name.getText(sf)] = resolveValue(pp.initializer, scope, allConditionals);
      } else v = evalExpr(e.getText(sf), scope);
      if (v === UNKNOWN || isUnknown(v) || (v === undefined && (ts.isElementAccessExpression(e) || ts.isCallExpression(e)))) partial = true;
      if (v && v !== UNKNOWN && typeof v === 'object' && !isUnknown(v)) {
        let src;
        if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression)) src = { type: 'key', alias: e.expression.text, key: e.name.text };
        else if (ts.isObjectLiteralExpression(e)) src = { type: 'inline', node: e };
        else src = { type: 'expr', text: e.getText(sf) };
        if (Array.isArray(v)) v.forEach(x => x && typeof x === 'object' && Object.assign(out, x));
        else for (const [k, val] of Object.entries(v)) if (!isUnknown(val) && val !== UNKNOWN) out[k] = val; else out[k] = UNKNOWN;
        for (const prop of ['color', 'backgroundColor']) {
          if (prop in v) {
            if (src.type === 'inline') {
              const pa = e.properties.find(pp => ts.isPropertyAssignment(pp) && pp.name.getText(sf) === prop);
              prov[prop] = pa ? { type: 'inline', start: pa.initializer.getStart(sf), end: pa.initializer.getEnd(), text: pa.initializer.getText(sf) } : { type: 'expr', text: '(spread)' };
            } else prov[prop] = src;
          }
        }
      }
    };
    apply(expr);
    Object.defineProperty(out, '__prov', { value: prov, enumerable: false });
    Object.defineProperty(out, '__partial', { value: partial, enumerable: false });
    return out;
  }
  const attr = (el, name) => {
    const a = el.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(sf) === name);
    return a && a.initializer ? (ts.isJsxExpression(a.initializer) ? a.initializer.expression : a.initializer) : null;
  };
  const evalColor = (expr, mode, all = false) => {
    if (!expr) return null;
    const v = resolveValue(expr, makeScope(mode, Object.fromEntries(Object.entries(aliases).map(([k, x]) => [k, x[mode]]))), all);
    return typeof v === 'string' ? v : null;
  };

  const findings = [];
  const exprSrc = e => (e ? { type: 'inline', start: e.getStart(sf), end: e.getEnd(), text: e.getText(sf) } : null);
  const pageBg = mode => parseColor(PAL[mode].background);
  const sheetBg = mode => parseColor(mode === 'light' ? PAL.light.card : Colors.bgSecondary);

  const seenFg = new Map(); // `${pos}|${state}` -> { light, dark }
  const srcLines = src.split('\n');
  // `theme-audit-ignore` on the element's line or the line above suppresses a
  // reviewed false positive (e.g. an icon only rendered on a selected fill).
  const ignored = node => {
    const l = lineOf(node);
    return /theme-audit-ignore/.test(srcLines[l - 1] || '') || /theme-audit-ignore/.test(srcLines[l - 2] || '');
  };
  function check(kind, node, mode, state, fg, bg, large, tag, src, bgSrc) {
    if (!fg || !bg) return;
    if (ignored(node)) return;
    {
      const k = `${node.getStart(sf)}|${state}|${kind}`;
      const rec = seenFg.get(k) || { node, kind };
      rec[mode] = { fg, bg, src };
      seenFg.set(k, rec);
    }
    const f = parseColor(fg);
    if (!f) return;
    const fc = over(f, bg);
    const r = ratio(fc, bg);
    const need = kind === 'icon' ? 3 : large ? 3 : 4.5;
    if (r + 1e-9 < need) {
      findings.push({ line: lineOf(node), mode, state, kind, tag, fg: f[3] < 1 ? fg : hex(fc), bg: hex(bg), ratio: +r.toFixed(2), need,
        snippet: node.getText(sf).replace(/\s+/g, ' ').slice(0, 120), src: src || null, bgSrc: bgSrc || null });
    }
  }

  // 4. JSX walk per mode/state.
  function walkJsx(node, ctx) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const open = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = open.tagName.getText(sf);
      const styleExpr = attr(open, 'style');
      const style = styleExpr ? resolveStyle(styleExpr, ctx.mode, ctx.state === 'all') : {};
      let bg = ctx.bg;
      let bgSrc = ctx.bgSrc;
      let textColor = ctx.textColor;
      let textSrc = ctx.textSrc;
      if (OPAQUE_UNKNOWN_TAGS.test(tag)) {
        if (tag === 'LinearGradient') {
          const cols = evalExpr((attr(open, 'colors') || { getText: () => 'null' }).getText(sf), makeScope(ctx.mode));
          const first = Array.isArray(cols) ? cols.map(parseColor).filter(Boolean) : [];
          bg = first.length && first.every(c => c[3] === 1) ? first[Math.floor(first.length / 2)] : null;
          if (first.length && first.every(c => c[3] < 1) && ctx.bg) bg = over(first[0], ctx.bg);
        } else bg = null;
      }
      if (tag === 'BottomSheet' || tag === 'Modal') bg = tag === 'BottomSheet' ? sheetBg(ctx.mode) : bg;
      // A gradient paints over its own backgroundColor, so the gradient wins.
      if (tag === 'LinearGradient') { /* bg already set from colors */ }
      else if (style.backgroundColor && style.backgroundColor !== UNKNOWN) {
        const c = parseColor(style.backgroundColor);
        if (c && bg) bg = over(c, bg);
        else if (c && c[3] === 1) bg = c;
        bgSrc = style.__prov && style.__prov.backgroundColor ? { ...style.__prov.backgroundColor, tag, line: lineOf(open) } : bgSrc;
      } else if (style.backgroundColor === UNKNOWN) bg = null;
      if (OPAQUE_UNKNOWN_TAGS.test(tag)) bgSrc = { type: tag, line: lineOf(open) };
      const fontSize = typeof style.fontSize === 'number' ? style.fontSize : ctx.fontSize;
      const ff = typeof style.fontFamily === 'string' ? style.fontFamily : ctx.fontFamily;
      const bold = /Bold|Black|SemiBold|700|800|900/.test(ff || '') || ['bold', '600', '700', '800', '900'].includes(String(style.fontWeight));
      const large = fontSize >= 18 || (fontSize >= 14 && bold);
      if (TEXT_TAGS.has(tag)) {
        if (style.color !== undefined) {
          textColor = style.color === UNKNOWN ? null : style.color;
          textSrc = style.__prov && style.__prov.color ? style.__prov.color : { type: 'expr', text: '?' };
        } else if (style.__partial) { textColor = null; } // colour may come from the unresolved part
        else if (!ctx.inText) { textColor = '#000000'; textSrc = { type: 'default' }; } // RN Text default
        // Emoji-only labels (⚡, 🗓️) are colour glyphs: their foreground colour is irrelevant.
        const emojiOnly = ts.isJsxElement(node) && node.children.every(ch => !ts.isJsxText(ch) || /^[\s\p{Extended_Pictographic}\u200d\ufe0f]*$/u.test(ch.getText(sf)))
          && node.children.some(ch => ts.isJsxText(ch) && /\p{Extended_Pictographic}/u.test(ch.getText(sf)));
        const hasLiteralChild = !emojiOnly && ts.isJsxElement(node) && node.children.some(ch => (ts.isJsxText(ch) && ch.getText(sf).trim()) || ts.isJsxExpression(ch));
        if (tag === 'TextInput') {
          check('text', open, ctx.mode, ctx.state, textColor, bg, large, tag, textSrc, bgSrc);
          const phExpr = attr(open, 'placeholderTextColor');
          const ph = evalColor(phExpr, ctx.mode, ctx.state === 'all');
          if (ph) check('placeholder', open, ctx.mode, ctx.state, ph, bg, large, tag, exprSrc(phExpr), bgSrc);
        } else if (hasLiteralChild) check('text', open, ctx.mode, ctx.state, textColor, bg, large, tag, textSrc, bgSrc);
      }
      if (ICON_TAGS.test(tag)) {
        const cExpr = attr(open, 'color');
        const c = evalColor(cExpr, ctx.mode, ctx.state === 'all');
        if (c) check('icon', open, ctx.mode, ctx.state, c, bg, true, tag, exprSrc(cExpr), bgSrc);
      }
      // icons passed as props (icon={<Ionicons .../>}) are visited via forEachChild below
      const next = { ...ctx, bg, bgSrc, textColor, textSrc, fontSize, fontFamily: ff, inText: ctx.inText || TEXT_TAGS.has(tag) };
      // An absolutely-filled gradient/image CHILD paints behind its siblings
      // (the common "button with gradient fill" pattern); use it as the
      // effective background for everything else in this element.
      if (ts.isJsxElement(node)) {
        for (const ch of node.children) {
          if (!(ts.isJsxElement(ch) || ts.isJsxSelfClosingElement(ch))) continue;
          const o = ts.isJsxElement(ch) ? ch.openingElement : ch;
          const t = o.tagName.getText(sf);
          const st = attr(o, 'style');
          if (!st || !/absoluteFill|position:\s*'absolute'/.test(st.getText(sf))) continue;
          if (t === 'LinearGradient') {
            const cols = evalExpr((attr(o, 'colors') || { getText: () => 'null' }).getText(sf), makeScope(ctx.mode));
            const parsed = Array.isArray(cols) ? cols.map(parseColor).filter(Boolean) : [];
            if (parsed.length && parsed.every(c => c[3] === 1)) { next.bg = parsed[Math.floor(parsed.length / 2)]; next.bgSrc = { type: 'LinearGradient', line: lineOf(o) }; }
            else if (parsed.length && next.bg) { next.bg = over(parsed[Math.floor(parsed.length / 2)], next.bg); next.bgSrc = { type: 'LinearGradient', line: lineOf(o) }; }
            else { next.bg = null; }
          } else if (OPAQUE_UNKNOWN_TAGS.test(t)) { next.bg = null; next.bgSrc = { type: t, line: lineOf(o) }; }
        }
      }
      // Icons handed to a filled button component (PrimaryCTA icon={...}) draw
      // on that component's internal fill, which this walk cannot see.
      // `theme-audit-ignore` above a container marks its subtree's background
      // as unknown (photo overlays, map/camera views): reported as unverifiable
      // rather than as a pass or a fail.
      if (!TEXT_TAGS.has(tag) && !ICON_TAGS.test(tag) && ignored(open)) next.bg = null;
      const filledComponent = /(CTA|Button)$/.test(tag) && tag !== 'IconButton';
      ts.forEachChild(node, ch => {
        if (filledComponent && ts.isJsxAttributes(ch)) {
          ch.properties.forEach(p => walkJsx(p, ts.isJsxAttribute(p) && /icon/i.test(p.name.getText(sf)) ? { ...next, bg: null } : next));
        } else walkJsx(ch, next);
      });
      return;
    }
    // A JSX root not nested in JSX (helper render functions, renderItem): reset context.
    ts.forEachChild(node, ch => walkJsx(ch, ctx));
  }

  for (const mode of ['light', 'dark']) {
    for (const state of ['default', 'all']) {
      walkJsx(sf, { mode, state, bg: pageBg(mode), bgSrc: { type: 'page' }, textColor: null, textSrc: null, fontSize: 14, fontFamily: '', inText: false });
    }
  }

  // De-duplicate (same line/mode/kind) keeping the worst ratio.
  const best = new Map();
  for (const f of findings) {
    const k = `${f.line}|${f.mode}|${f.kind}`;
    if (!best.has(k) || best.get(k).ratio > f.ratio) best.set(k, f);
  }

  // 5. Code-pattern checks that the colour walk can't express.
  const patterns = [];
  // A label that is white in dark mode but dark in light mode while sitting on
  // a saturated fill (red CTA, green button) — passes WCAG "large text" maybe,
  // but it is a light-mode remap applied to a fill that did not change.
  for (const rec of seenFg.values()) {
    if (!rec.light || !rec.dark) continue;
    const dF = parseColor(rec.dark.fg), lF = parseColor(rec.light.fg), lB = parseColor(hex(rec.light.bg) ? hex(rec.light.bg) : null);
    if (!dF || !lF || !rec.light.bg) continue;
    const bgc = rec.light.bg;
    const sat = (Math.max(bgc[0], bgc[1], bgc[2]) - Math.min(bgc[0], bgc[1], bgc[2])) / 255;
    if (lum(dF) > 0.8 && lum(over(lF, bgc)) < 0.1 && sat > 0.45 && lum(bgc) < 0.4) {
      patterns.push({ line: lineOf(rec.node), kind: 'darkLabelOnFill', fg: rec.light.fg, bg: hex(bgc), src: rec.light.src || null,
        snippet: rec.node.getText(sf).replace(/\s+/g, ' ').slice(0, 110) });
    }
    void lB;
  }
  const lightAliases = Object.entries(aliases).filter(([, v]) => !v.raw);
  if (lightAliases.length && sheets.styles) {
    const lightMap = lightAliases[0][1].light;
    const seen = new Set();
    const visitBypass = n => {
      if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'styles') {
        let inJsx = false;
        for (let p = n.parent; p; p = p.parent) { if (ts.isJsxAttribute(p)) { inJsx = true; break; } }
        const key = n.name.text;
        if (inJsx && lightMap[key] && JSON.stringify(lightMap[key]) !== JSON.stringify(sheets.styles[key]) && !seen.has(n.getStart(sf))) {
          seen.add(n.getStart(sf));
          patterns.push({ line: lineOf(n), kind: 'bypassLightStyles', key, start: n.expression.getStart(sf), end: n.expression.getEnd(), alias: lightAliases[0][0],
            snippet: `styles.${key} bypasses the light override (should be ${lightAliases[0][0]}.${key})` });
        }
      }
      ts.forEachChild(n, visitBypass);
    };
    visitBypass(sf);
  }
  if (/barStyle=["']light-content["']/.test(src)) {
    src.split('\n').forEach((l, i) => { if (/barStyle=["']light-content["']/.test(l)) patterns.push({ line: i + 1, kind: 'staticStatusBar', snippet: l.trim().slice(0, 120) }); });
  }
  return { file: path.relative(APP, file), findings: [...best.values()].sort((a, b) => a.line - b.line), patterns };
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') walk(p, out); } else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const files = explicitFiles.length ? explicitFiles.map(f => path.resolve(f)) : walk(path.join(SRC, 'screens')).concat(walk(path.join(SRC, 'components')));
const results = files.map(f => {
  try { return analyse(f); } catch (e) { return { file: path.relative(APP, f), error: String(e.message || e), findings: [], patterns: [] }; }
});
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2));
let totL = 0, totD = 0, totP = 0;
for (const r of results) {
  const l = r.findings.filter(f => f.mode === 'light').length, d = r.findings.filter(f => f.mode === 'dark').length;
  totL += l; totD += d; totP += r.patterns.length;
  if (l || d || r.patterns.length || r.error) console.log(`${r.file}\tlight=${l}\tdark=${d}\tpatterns=${r.patterns.length}${r.error ? '\tERROR ' + r.error : ''}`);
}
console.log(`TOTAL files=${results.length} light=${totL} dark=${totD} patterns=${totP}`);
process.exitCode = 0;