import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount() {
  const calls = [];
  let onAppState, timeout, setAudioStatus, tokenReads = 0, released = false;
  const player = {
    isLoaded: false,
    get released() { return released; },
    replace(source) {
      assert.ok(source !== null, 'Expo Audio rejects replace(null) on Android');
      assert.equal(released, false, 'replacing released player');
      this.isLoaded = false; // Loading a remote source takes time.
      calls.push(['source', source]);
      setAudioStatus?.({ isLoaded: false, playing: false });
    },
    play() {
      assert.equal(released, false, 'playing released player');
      assert.equal(this.isLoaded, true, 'must wait for audio to load before play()');
      calls.push(['play']);
    },
    pause() {
      assert.equal(released, false, 'pausing released player');
      assert.equal(this.isLoaded, true, 'must not pause an unloaded player');
      calls.push(['pause']);
    },
    seekTo() { return Promise.resolve(); },
  };
  const modules = {
    react: React,
    'react-native': {
      View: 'View', Text: 'Text', Switch: 'Switch', TouchableOpacity: 'Button',
      AppState: { addEventListener(event, fn) { onAppState = fn; return { remove() {} }; } },
    },
    'expo-audio': {
      useAudioPlayer: () => { React.useEffect(() => () => { released = true; }, []); return player; },
      useAudioPlayerStatus: () => {
        const [status, setStatus] = React.useState({ isLoaded: false, playing: false });
        setAudioStatus = setStatus;
        return status;
      },
    },
    'expo-crypto': {
      CryptoDigestAlgorithm: { SHA256: 'sha256' },
      digestStringAsync: async (algorithm, text) => text === 'First' ? 'first-approved-hash' : 'second-approved-hash',
    },
    '../lib/supabase': { getAccessToken: async () => { tokenReads++; return 'synthetic-test-token'; } },
    '../constants/colors': { Colors: {} },
  };
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/NativeTourVoice.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, {
    exports, process: { env: {} },
    setTimeout(fn) { timeout = fn; return 1; },
    clearTimeout() {},
    require(name) { assert.ok(name in modules, name); return modules[name]; },
  });
  let tree;
  await act(async () => { tree = create(React.createElement(exports.NativeTourVoice, { text: 'First' })); });
  return {
    tree, calls, player, get tokenReads() { return tokenReads; },
    enable: () => act(async () => tree.root.findByType('Switch').props.onValueChange(true)),
    disable: () => act(async () => tree.root.findByType('Switch').props.onValueChange(false)),
    changeStep: () => act(async () => tree.update(React.createElement(exports.NativeTourVoice, { text: 'Second' }))),
    loaded: () => act(async () => { player.isLoaded = true; setAudioStatus({ isLoaded: true, playing: false }); }),
    background: () => act(async () => onAppState('background')),
    expire: () => act(async () => timeout()),
    retry: () => act(async () => tree.root.findByType('Button').props.onPress()),
  };
}

test('opt-in requests authenticated narration but never plays before loading', async () => {
  const h = await mount();
  assert.equal(h.tokenReads, 0);
  await h.enable();
  const source = h.calls.find(call => call[0] === 'source')[1];
  assert.ok(source.uri.endsWith('/ai/tour-narration/first-approved-hash'));
  assert.equal(source.headers.Authorization, 'Bearer synthetic-test-token');
  assert.equal(h.calls.some(call => call[0] === 'play'), false);
  await h.loaded();
  assert.equal(h.calls.filter(call => call[0] === 'play').length, 1);
  await act(async () => h.tree.unmount());
  assert.equal(h.player.released, true);
  assert.ok(h.calls.every(call => call[1] !== null), 'never unload the native player with replace(null)');
});

test('Next, Back, and backgrounding never play an unloaded or released native handle', async () => {
  const h = await mount();
  await h.enable();
  await h.loaded();
  h.calls.length = 0;
  await h.changeStep();
  assert.equal(h.calls[0][0], 'pause');
  assert.ok(h.calls.find(call => call[1]?.uri?.endsWith('second-approved-hash')));
  assert.equal(h.calls.some(call => call[0] === 'play'), false);
  await h.loaded();
  assert.equal(h.calls.filter(call => call[0] === 'play').length, 1);
  await h.background();
  assert.equal(h.calls.at(-1)[0], 'pause');
  await act(async () => h.tree.unmount());
  assert.equal(h.player.released, true);
});

test('switching off stops only a loaded player and does not prevent replay', async () => {
  const h = await mount();
  await h.enable();
  await h.loaded();
  h.calls.length = 0;
  await h.disable();
  assert.deepEqual(h.calls.map(call => call[0]), ['pause']);
  await h.enable();
  assert.equal(h.calls.some(call => call[0] === 'play'), false);
  await h.loaded();
  assert.equal(h.calls.filter(call => call[0] === 'play').length, 1);
  await act(async () => h.tree.unmount());
});

test('a timed out audio load does not touch an unloaded handle and offers retry', async () => {
  const h = await mount();
  await h.enable();
  h.calls.length = 0;
  await h.expire();
  assert.equal(h.calls.length, 0);
  assert.ok(h.tree.root.findAllByType('Text').some(node => node.children.join('').includes('Try voice again')));
  await h.retry();
  assert.ok(h.calls.some(call => call[0] === 'source'));
  await act(async () => h.tree.unmount());
});
