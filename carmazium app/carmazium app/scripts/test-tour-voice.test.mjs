import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
async function mount() {
  const calls = []; let onAppState, timeout, tokenReads = 0;
  let released = false;
  const player = { isLoaded: false, get released() { return released; },
    replace(source) { assert.ok(source !== null, 'Expo Audio rejects replace(null) on Android'); assert.equal(released, false, 'replacing released player'); this.isLoaded = true; calls.push(['source', source]); },
    play() { assert.equal(released, false, 'playing released player'); calls.push(['play']); },
    pause() { assert.equal(released, false, 'pausing released player'); calls.push(['pause']); }, seekTo() {} };
  const modules = { react: React, 'react-native': { View: 'View', Text: 'Text', Switch: 'Switch', TouchableOpacity: 'Button',
    AppState: { addEventListener(event, fn) { onAppState = fn; return { remove() {} }; } } },
    'expo-audio': { useAudioPlayer: () => { React.useEffect(() => () => { released = true; }, []); return player; }, useAudioPlayerStatus: () => ({ isLoaded: player.isLoaded, playing: false }) },
    'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (algorithm, text) => text === 'First' ? 'first-approved-hash' : 'second-approved-hash' },
    '../lib/supabase': { getAccessToken: async () => { tokenReads++; return 'synthetic-test-token'; } },
    '../constants/colors': { Colors: {} },
  };
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/NativeTourVoice.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, { exports, process: { env: {} }, setTimeout(fn) { timeout = fn; return 1; }, clearTimeout() {}, require(name) { assert.ok(name in modules, name); return modules[name]; } });
  let tree; await act(async () => { tree = create(React.createElement(exports.NativeTourVoice, { text: 'First' })); });
  return { tree, calls, player, get tokenReads() { return tokenReads; },
    enable: () => act(async () => tree.root.findByType('Switch').props.onValueChange(true)),
    disable: () => act(async () => tree.root.findByType('Switch').props.onValueChange(false)),
    changeStep: () => act(async () => tree.update(React.createElement(exports.NativeTourVoice, { text: 'Second' }))),
    background: () => act(async () => onAppState('background')),
    expire: () => act(async () => timeout()),
  };
}
test('voice is opt-in and uses authenticated approved narration, with no recording', async () => {
  const h = await mount(); assert.equal(h.tokenReads, 0); assert.equal(h.calls.length, 0);
  await h.enable(); const source = h.calls.find(call => call[0] === 'source')[1];
  assert.ok(source.uri.endsWith('/ai/tour-narration/first-approved-hash'));
  assert.equal(source.headers.Authorization, 'Bearer synthetic-test-token');
  assert.ok(h.calls.some(call => call[0] === 'play'));
  await act(async () => h.tree.unmount());
  assert.equal(h.player.released, true);
  assert.ok(h.calls.every(call => call[1] !== null), 'never unload with replace(null)');
});
test('changing topic and backgrounding stop the previous narration', async () => {
  const h = await mount(); await h.enable(); h.calls.length = 0;
  await h.changeStep(); assert.equal(h.calls[0][0], 'pause');
  assert.ok(h.calls.every(call => call[1] !== null), 'Next must not call replace(null)');
  assert.ok(h.calls.find(call => call[1]?.uri?.endsWith('second-approved-hash')));
  await h.background(); assert.equal(h.calls.at(-1)[0], 'pause');
  await act(async () => h.tree.unmount());
});
test('turning voice off stops narration without unloading the native player', async () => {
  const h = await mount(); await h.enable(); h.calls.length = 0;
  await h.disable();
  assert.deepEqual(h.calls.map(call => call[0]), ['pause']);
  assert.ok(h.calls.every(call => call[1] !== null));
  await h.enable();
  assert.ok(h.calls.some(call => call[1]?.uri?.endsWith('first-approved-hash')));
  await act(async () => h.tree.unmount());
  assert.equal(h.player.released, true);
});

test('an audio load timeout cancels playback and offers a retry', async () => {
  const h = await mount(); await h.enable(); h.player.isLoaded = false; await h.expire();
  assert.equal(h.calls.at(-1)[0], 'pause');
  assert.ok(h.calls.every(call => call[1] !== null));
  assert.ok(h.tree.root.findAllByType('Text').some(node => node.children.join('').includes('Try voice again')));
  await act(async () => h.tree.unmount());
});
