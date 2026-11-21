import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const source = readFileSync(new URL('../src/screens/main/CompareScreen.tsx', import.meta.url), 'utf8');
const car = (id, extra = {}) => ({ id, title: 'Vehicle ' + id, make: 'Test', model: id, price: 9000, mileage: 12345, year: 2020, images: [], status: 'ACTIVE', ...extra });
async function mount(search, initialListing) {
 const navigation = [], timers = new Map(); let id = 0;
 const modules = {
  react: React, 'react-native': Object.fromEntries(['ActivityIndicator','Modal','ScrollView','Text','TextInput','TouchableOpacity','View'].map(x=>[x,x])),
  'expo-image': { Image: 'Image' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
  '@react-navigation/native': { useNavigation: () => ({ navigate: (...a) => navigation.push(a) }), useRoute: () => ({ params: { initialListing } }) },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  '@/components/BrandIcon': { Ionicons: 'Icon' }, '../../components/PublicInfoPage': { PublicInfoPage: 'Page', infoStyles: {} },
  '../../components/Button': { Button: 'Button' }, '../../constants/colors': { Colors: {} },
  '../../lib/vehicleLabels': { FUEL_TYPE_LABELS: {}, TRANSMISSION_LABELS: {} }, '../../lib/listingsApi': { searchListings: search }
 };
 modules['react-native'].StyleSheet = { create: x => x, absoluteFillObject: {} };
 const exports = {};
 runInNewContext(ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports, require: n => { if (!(n in modules)) throw Error(n); return modules[n]; },
  setTimeout: fn => { timers.set(++id, fn); return id; }, clearTimeout: id => timers.delete(id)
 });
 let tree; await act(async () => { tree = create(React.createElement(exports.CompareScreen)); });
 const tap = async label => act(async () => tree.root.findAllByType('TouchableOpacity').find(n=>n.props.accessibilityLabel===label).props.onPress());
 const flush = async () => { const queued = [...timers.values()]; timers.clear(); await act(async () => { await Promise.all(queued.map(fn=>fn())); }); };
 const visible = () => tree.root.findAllByType('Text').map(n=>n.children.filter(c=>typeof c==='string'||typeof c==='number').join('')).join(' ');
 const kick = async () => { const queued = [...timers.values()]; timers.clear(); await act(async () => { queued.forEach(fn => { void fn(); }); }); };
 return { tree, tap, flush, kick, visible, navigation, exports };
}
test('three comparison slots retain their positions, prevent duplicate selections and open native details', async () => {
 const a = car('A'), b = car('B', { price: 8000 }), h = await mount(async () => ({ listings: [a,b] }));
 assert.ok(h.visible().includes('Compare Vehicles Head-to-Head'));
 await h.tap('Add vehicle to slot 3'); await h.flush(); await h.tap('Select Vehicle A');
 assert.ok(h.visible().includes('1 of 3 selected')); assert.ok(h.visible().includes('12,345 mi'));
 assert.equal(h.tree.root.findAllByType('TouchableOpacity').filter(n=>n.props.accessibilityLabel?.startsWith('Add vehicle to slot')).length,2);
 await h.tap('Add vehicle to slot 1'); await h.flush();
 assert.equal(h.tree.root.findAllByType('TouchableOpacity').find(n=>n.props.accessibilityLabel==='Select Vehicle A').props.disabled,true);
 await h.tap('Select Vehicle B'); await h.tap('Remove Vehicle B from comparison');
 assert.ok(h.tree.root.findAllByType('TouchableOpacity').some(n=>n.props.accessibilityLabel==='Add vehicle to slot 1'));
 assert.equal(h.tree.root.findAllByType('TouchableOpacity').some(n=>n.props.accessibilityLabel==='Add vehicle to slot 3'),false);
 await act(async()=>h.tree.root.findAllByType('Button').find(n=>n.props.label==='View details').props.onPress());
 assert.equal(h.navigation.at(-1)[0],'VehicleDetail'); assert.equal(h.navigation.at(-1)[1].listing.id,'A');
 assert.ok(h.visible().includes('Engine & Performance')); assert.ok(h.visible().includes('Dimensions & Style'));
 await act(async()=>h.tree.unmount());
});
test('failed search shows retry and excludes sold stock after recovery', async () => {
 let fail = true; const h = await mount(async()=>{if(fail)throw Error('offline');return { listings:[car('A'),car('sold',{status:'SOLD'})] };});
 await h.tap('Add vehicle to slot 1'); await h.flush(); assert.ok(h.visible().includes('Unable to load listings'));
 fail=false; await act(async()=>h.tree.root.findAllByType('Button').find(n=>n.props.label==='Retry').props.onPress()); await h.flush();
 assert.equal(h.tree.root.findAllByType('TouchableOpacity').some(n=>n.props.accessibilityLabel==='Select Vehicle sold'),false);
 await h.tap('Select Vehicle A'); assert.ok(h.visible().includes('1 of 3 selected')); await act(async()=>h.tree.unmount());
});
test('late search cannot replace results for the current query', async()=>{
 let resolveOld; const h=await mount(p=>p.search ? Promise.resolve({listings:[car('new')]}) : new Promise(resolve=>{resolveOld=resolve;}));
 await h.tap('Add vehicle to slot 1');
 // Start the original request without resolving it, then change the query.
 await h.kick();
 await act(async()=>h.tree.root.findByType('TextInput').props.onChangeText('new')); await h.flush();
 await act(async()=>resolveOld({listings:[car('old')]}));
 assert.equal(h.tree.root.findAllByType('TouchableOpacity').some(n=>n.props.accessibilityLabel==='Select Vehicle old'),false);
 assert.ok(h.tree.root.findAllByType('TouchableOpacity').some(n=>n.props.accessibilityLabel==='Select Vehicle new'));
 await act(async()=>h.tree.unmount());
});
