import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/appUpdater.play.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText;
test('Play updater never fetches or installs APKs, even when called directly', async () => {
  const exports = {};
  runInNewContext(code, { exports, require: name => {
    if (name === 'expo-constants') return { nativeBuildVersion: '135' };
    if (name === 'react-native') return { Platform: { OS: 'android' } };
    throw Error('Play updater must not import installation modules: ' + name);
  }, fetch: () => { throw Error('Play updater must not request direct-download metadata'); } });
  assert.equal(exports.currentVersionCode(), 135);
  assert.equal(exports.isGooglePlayDistribution(), true);
  assert.equal(exports.canSelfUpdate(), false);
  assert.equal((await exports.checkForUpdateStatus()).status, 'unsupported');
  assert.equal(await exports.checkForUpdate(), null);
  await assert.rejects(exports.downloadAndInstall({
    versionName: '1.0.2', versionCode: 136,
    url: 'https://www.carmazium.com/downloads/CarMazium-1.0.2-v136.apk',
  }, () => {}), /Google Play manages updates/);
});

test('Play settings open the original store listing and show a recoverable launch error', async () => {
  const React = (await import('react')).default;
  const { act, create } = await import('react-test-renderer');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const settings = readFileSync(new URL('../src/components/AndroidUpdateSettings.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(settings, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  const urls = [];
  const modules = {
    react: React,
    'react-native': { ActivityIndicator: 'Spinner', StyleSheet: { create: x => x },
      Text: 'Text', TouchableOpacity: 'Button', View: 'View',
      Linking: { openURL: async url => { urls.push(url); throw Error('No handler'); } } },
    '../constants/colors': { Colors: {} },
    '../constants/typography': { FontFamily: {}, FontSize: {} },
    '../lib/appUpdater': { canSelfUpdate: () => false, isGooglePlayDistribution: () => true,
      currentVersionCode: () => 135,
      checkForUpdateStatus: () => { throw Error('Must not check APKs'); },
      downloadAndInstall: () => { throw Error('Must not install APKs'); } },
  };
  const exports = {};
  runInNewContext(compiled, { exports, require: name => {
    assert.ok(name in modules, name); return modules[name];
  } });
  let tree;
  await act(async () => { tree = create(React.createElement(exports.AndroidUpdateSettings)); });
  const buttons = tree.root.findAllByType('Button');
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props.accessibilityLabel, 'Open Google Play');
  await act(async () => { buttons[0].props.onPress(); });
  assert.deepEqual(urls, ['https://play.google.com/store/apps/details?id=uk.carmazium.app']);
  assert.match(JSON.stringify(tree.toJSON()), /Could not open Google Play/);
  await act(async () => { tree.unmount(); });
});
