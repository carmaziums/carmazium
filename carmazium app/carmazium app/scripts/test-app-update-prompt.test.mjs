import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = read('../src/components/AppUpdatePrompt.tsx');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText;
const release = number => ({
  versionCode: number, versionName: '1.0.2',
  url: `https://www.carmazium.com/downloads/CarMazium-1.0.2-v${number}.apk`,
});
const initialClock = 2000000000000;

async function setup({ status, ota = false, stored = null, initialState = 'active' } = {}) {
  const calls = { check: 0, otaChecks: 0, otaFetches: 0, otaReloads: 0, installs: 0, writes: [] };
  const timers = new Set();
  const clock = { now: initialClock };
  const storage = { value: stored };
  const appState = { currentState: initialState, change: null };
  const nativeUpdate = { status: 'up-to-date', versionCode: 126 };
  let nextStatus = status ?? nativeUpdate;
  const modules = {
    react: React,
    'react-native': {
      AppState: { get currentState() { return appState.currentState; },
        addEventListener: (_type, callback) => { appState.change = callback; return { remove: () => { appState.change = null; } }; } },
      Modal: 'Modal', StyleSheet: { create: x => x }, Text: 'Text', View: 'View',
    },
    '@react-native-async-storage/async-storage': {
      getItem: async () => storage.value,
      setItem: async (key, value) => { calls.writes.push({ key, value }); storage.value = value; },
    },
    'expo-updates': {
      isEnabled: ota,
      checkForUpdateAsync: async () => { calls.otaChecks++; return { isAvailable: true, manifest: { id: 'synthetic-compatible-ota' } }; },
      fetchUpdateAsync: async () => { calls.otaFetches++; },
      reloadAsync: async () => { calls.otaReloads++; },
    },
    '@/components/BrandIcon': { Ionicons: 'Icon' },
    '../components/Button': { Button: 'Button' },
    './Button': { Button: 'Button' },
    '../lib/appUpdater': {
      checkForUpdateStatus: async () => {
        calls.check++;
        return typeof nextStatus === 'function' ? nextStatus() : nextStatus;
      },
      downloadAndInstall: async () => { calls.installs++; },
    },
    '../constants/colors': { Colors: { accent: 'accent' } },
    '../constants/spacing': { Elevation: { cardHi: {} }, Radius: { card: 12 } },
    '../constants/typography': { FontFamily: {}, FontSize: { xl: 20, base: 14, sm: 12, xs: 10 } },
  };
  const exports = {};
  runInNewContext(code, {
    exports,
    require: name => {
      assert.ok(Object.prototype.hasOwnProperty.call(modules, name), 'Unmocked module ' + name);
      return modules[name];
    },
    Date: class extends Date { static now() { return clock.now; } },
    setInterval: callback => { timers.add(callback); return callback; },
    clearInterval: callback => { timers.delete(callback); },
    Math, Number, JSON, Promise,
  });
  let tree;
  await act(async () => { tree = create(React.createElement(exports.AppUpdatePrompt)); });
  const modal = () => tree.root.findByType('Modal');
  const button = label => tree.root.findAllByType('Button').find(n => n.props.label === label);
  const tick = async milliseconds => {
    clock.now += milliseconds;
    await act(async () => { for (const callback of timers) callback(); });
  };
  const resume = async () => {
    appState.currentState = 'active';
    await act(async () => appState.change?.('active'));
  };
  const teardown = async () => { await act(async () => tree.unmount()); };
  return { calls, storage, appState, clock, modal, button, tick, resume, teardown, getCandidate: () => nextStatus, setStatus: next => { nextStatus = next; }, exports };
}

test('detects a newer signed APK on initial launch and offers a choice', async () => {
  const h = await setup({ status: { status: 'available', update: release(127) } });
  assert.equal(h.calls.check, 1);
  assert.equal(h.modal().props.visible, true);
  assert.ok(h.button('Update now'));
  assert.ok(h.button('Later'));
  assert.equal(h.calls.installs, 0, 'do not download/install until the user opts in');
  await h.teardown();
});

test('Later persists across restart for 24 hours; user can opt in afterward', async () => {
  const h = await setup({ status: { status: 'available', update: release(127) } });
  await act(async () => h.button('Later').props.onPress());
  assert.equal(h.modal().props.visible, false);
  assert.equal(h.calls.installs, 0);
  assert.equal(h.calls.writes.length, 1);
  const saved = h.storage.value;
  await h.teardown();
  const h2 = await setup({ status: { status: 'available', update: release(127) }, stored: saved });
  assert.equal(h2.modal().props.visible, false, 'reopening must respect Later');
  await h2.tick(24 * 60 * 60_000 + 1000);
  assert.equal(h2.modal().props.visible, true, 'eligible again after the opt-in reminder period');
  await act(async () => h2.button('Update now').props.onPress());
  assert.equal(h2.calls.installs, 1);
  await h2.teardown();
});

test('an already open app detects the next release every 15 minutes', async () => {
  const h = await setup();
  assert.equal(h.modal().props.visible, false);
  h.setStatus({ status: 'available', update: release(127) });
  await h.tick(14 * 60_000);
  assert.equal(h.calls.check, 1);
  await h.tick(60_000);
  assert.equal(h.calls.check, 2);
  assert.equal(h.modal().props.visible, true);
  await h.teardown();
});

test('network errors retry after one minute instead of hiding a release for six hours', async () => {
  const h = await setup({ status: { status: 'error', message: 'Offline' } });
  assert.equal(h.calls.check, 1);
  h.setStatus({ status: 'available', update: release(127) });
  await h.tick(60_000);
  assert.equal(h.calls.check, 2);
  assert.equal(h.modal().props.visible, true);
  await h.teardown();
});

test('resuming the foreground checks immediately when due; background does not', async () => {
  const h = await setup({ initialState: 'background' });
  assert.equal(h.calls.check, 0);
  h.setStatus({ status: 'available', update: release(127) });
  await h.tick(60_000);
  assert.equal(h.calls.check, 0);
  await h.resume();
  assert.equal(h.calls.check, 1);
  assert.equal(h.modal().props.visible, true);
  await h.teardown();
});

test('compatible iOS/Android OTA updates are never installed silently', async () => {
  const h = await setup({ ota: true });
  assert.equal(h.calls.otaChecks, 1);
  assert.equal(h.modal().props.visible, true);
  assert.equal(h.calls.otaFetches, 0);
  assert.equal(h.calls.otaReloads, 0);
  await act(async () => h.button('Later').props.onPress());
  assert.equal(h.calls.otaFetches, 0);
  await h.teardown();
  const h2 = await setup({ ota: true });
  await act(async () => h2.button('Update now').props.onPress());
  assert.equal(h2.calls.otaFetches, 1);
  assert.equal(h2.calls.otaReloads, 1);
  await h2.teardown();
});

test('source config never auto-applies OTA and retains original app identity', () => {
  const app = JSON.parse(read('../app.json')).expo;
  const entry = read('../App.tsx');
  assert.equal(app.updates.enabled, true);
  assert.equal(app.updates.checkAutomatically, 'NEVER');
  assert.equal(app.android.package, 'uk.carmazium.app');
  assert.equal(app.ios.bundleIdentifier, 'uk.carmazium.app');
  assert.ok(entry.includes('<AppUpdatePrompt />'));
  assert.ok(!entry.includes('Updates.fetchUpdateAsync()'), 'no silent fetch on app mount');
  assert.ok(!entry.includes('Updates.reloadAsync()'), 'no silent reload on app mount');
});
