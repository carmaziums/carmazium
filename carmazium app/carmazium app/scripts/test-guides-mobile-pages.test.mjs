import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const compile = source => ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
const fixture = (page, count = 12) => ({ data: Array.from({ length: count }, (_, i) => ({ id: `${page}-${i}`, slug: `guide-${page}-${i}`, title: `Guide ${page}-${i}`, excerpt: 'An actual guide', content: 'words '.repeat(440), publishedAt: '2026-11-19', tags: ['Selling'] })), pagination: { totalPages: 10 } });
async function mount(api) {
 const nav = [], calls = [], groups = {};
 runInNewContext(compile(readFileSync(new URL('../src/data/sellerGuideGroups.ts', import.meta.url), 'utf8')), { exports: groups });
 const modules = { react: React, 'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', ActivityIndicator: 'Spinner', TouchableOpacity: 'TouchableOpacity', Linking: { openURL: async () => {} }, StyleSheet: { create: s => s } }, 'expo-image': { Image: 'Image' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) }, '../../components/WebsiteTopBar': { WebsiteTopBar: 'Header' }, '../../components/Button': { Button: 'Button' }, '../../constants/colors': { Colors: {} }, '../../constants/typography': { FontFamily: {} }, '../../lib/apiClient': { apiClient: path => { calls.push(path); return api(path); } }, '../../data/sellerGuideGroups': groups };
 const exports = {}; runInNewContext(compile(readFileSync(new URL('../src/screens/main/BlogScreen.tsx', import.meta.url), 'utf8')), { exports, require: n => { if (!(n in modules)) throw Error(n); return modules[n]; } });
 let tree; await act(async () => { tree = create(React.createElement(exports.BlogScreen, { navigation: { navigate: (...args) => nav.push(args) } })); });
 return { tree, nav, calls, exports, groups };
}
const button = (tree, label) => tree.root.findAllByType('Button').find(n => n.props.label === label);
const click = (tree, label) => act(async () => button(tree, label).props.onPress());
const text = tree => JSON.stringify(tree.toJSON());
test('guide pagination replaces cards, preserves prior page on failure and retries the failed page', async () => {
 let fail = true;
 const { tree, calls } = await mount(async path => { if (path.includes('page=2')) { if (fail) throw Error('offline'); return fixture(2); } return fixture(1); });
 assert.ok(text(tree).includes('Featured guide')); assert.ok(text(tree).includes('Guide 1-0'));
 await click(tree, 'Next'); assert.ok(text(tree).includes('Could not load')); assert.ok(text(tree).includes('Guide 1-0')); assert.ok(!text(tree).includes('Guide 2-0'));
 fail = false; await click(tree, 'Retry'); assert.equal(calls.at(-1), '/blog?page=2&limit=12'); assert.ok(text(tree).includes('Guide 2-0')); assert.ok(!text(tree).includes('Guide 1-0')); assert.ok(!text(tree).includes('Featured guide'));
 await click(tree, 'Previous'); assert.ok(text(tree).includes('Guide 1-0')); await act(async () => tree.unmount());
});
test('published guide shortcuts and goals open native destinations without a browser handoff', async () => {
 const { tree, nav, groups, exports } = await mount(async () => fixture(1));
 for (const node of tree.root.findAllByType('TouchableOpacity')) await act(async () => node.props.onPress());
 assert.equal(nav.filter(n => n[0] === 'BlogArticle').length, 9);
 assert.deepEqual(JSON.parse(JSON.stringify(nav.slice(-3))), [['Tabs', { screen: 'Search' }], ['AuctionGuide'], ['CarBodyGuide']]);
 await click(tree, 'Sell My Car'); assert.equal(nav.at(-1)[0], 'SellLanding');
 assert.equal(exports.guideReadTime('words '.repeat(441)), 3);
 const web = readFileSync(new URL('../../../src/components/blog/SellerGuideLinks.tsx', import.meta.url), 'utf8');
 for (const group of groups.sellerGuideGroups) for (const [slug, label] of group.guides) { assert.ok(web.includes(slug)); assert.ok(web.includes(label)); }
 await act(async () => tree.unmount());
});
test('late guide replies cannot replace a newer page and malformed reads never become an empty archive', async () => {
 let resolveOld;
 const { tree } = await mount(async path => { if (path.includes('page=2')) return new Promise(resolve => { resolveOld = resolve; }); if (path.includes('page=3')) return fixture(3); return fixture(1); });
 await click(tree, 'Next'); await click(tree, '3'); await act(async () => resolveOld(fixture(2))); assert.ok(text(tree).includes('Guide 3-0')); assert.ok(!text(tree).includes('Guide 2-0')); await act(async () => tree.unmount());
 const bad = await mount(async () => ({ data: null })); assert.ok(text(bad.tree).includes('Could not load')); assert.ok(!text(bad.tree).includes('No posts yet')); await act(async () => bad.tree.unmount());
});
