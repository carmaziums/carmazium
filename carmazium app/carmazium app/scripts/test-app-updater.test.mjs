import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/appUpdater.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

function loadUpdater({ nativeBuildVersion = '125', manifestVersion = 111, platform = 'android', response = null } = {}) {
  const calls = { downloads: [], installed: [] };
  const constants = {
    nativeBuildVersion,
    expoConfig: { android: { package: 'uk.carmazium.app', versionCode: manifestVersion } },
  };
  const modules = {
    'react-native': { Platform: { OS: platform } },
    'expo-constants': constants,
    'expo-file-system/legacy': {
      cacheDirectory: 'file:///tmp/',
      deleteAsync: async () => {},
      createDownloadResumable: (url, path) => {
        calls.downloads.push({ url, path });
        return { downloadAsync: async () => ({ status: 200, uri: path }) };
      },
      getContentUriAsync: async uri => uri,
    },
    'expo-intent-launcher': {
      startActivityAsync: async (action, details) => { calls.installed.push({ action, details }); },
    },
  };
  const exports = {};
  runInNewContext(code, {
    exports,
    require: name => {
      if (!(name in modules)) throw Error('Unmocked module: ' + name);
      return modules[name];
    },
    fetch: async () => ({ ok: true, json: async () => ({ android: response }) }),
    AbortController, setTimeout, clearTimeout,
  });
  return { api: exports, calls };
}

const version = (n, code = n, host = 'www.carmazium.com') => ({
  versionName: '1.0.1',
  versionCode: code,
  url: `https://${host}/downloads/CarMazium-1.0.1-v${n}.apk`,
});

test('installed Android build 125 outranks stale Expo 111 metadata', async () => {
  const previous = loadUpdater({ response: version(125) });
  assert.equal(previous.api.currentVersionCode(), 125);
  assert.equal(await previous.api.checkForUpdate(), null);

  const newer = loadUpdater({ response: version(126) });
  const available = await newer.api.checkForUpdate();
  assert.equal(available?.versionCode, 126);
  assert.equal(available?.versionName, '1.0.1');
});

test('a missing native version uses the bundled manifest without inventing a build', () => {
  assert.equal(loadUpdater({ nativeBuildVersion: null, manifestVersion: 111 }).api.currentVersionCode(), 111);
  assert.equal(loadUpdater({ nativeBuildVersion: '', manifestVersion: 0 }).api.currentVersionCode(), 0);
});

test('first-party update URL and declared version must agree exactly', async () => {
  const { api } = loadUpdater();
  for (const candidate of [
    version(126, 127),
    version(126, 126, 'other.example'),
    { ...version(126), versionCode: 125.5 },
    { ...version(126), versionName: '1.0.2' },
    { ...version(126), url: 'https://www.carmazium.com/downloads/../CarMazium-1.0.1-v126.apk' },
    { ...version(126), url: 'http://www.carmazium.com/downloads/CarMazium-1.0.1-v126.apk' },
    { ...version(126), url: 'https://www.carmazium.com/downloads/CarMazium-1.0.1-v126.apk?file=other' },
    { ...version(126), versionCode: 2147483648 },
  ]) {
    assert.equal(api.isTrustedAndroidUpdate(candidate), false, JSON.stringify(candidate));
  }
  assert.equal(api.isTrustedAndroidUpdate(version(126)), true);
});

test('the installer cannot be launched with a stale, mismatched, or non-Android update', async () => {
  const { api, calls } = loadUpdater();
  await assert.rejects(api.downloadAndInstall(version(125), () => {}));
  await assert.rejects(api.downloadAndInstall(version(126, 127), () => {}));
  assert.equal(calls.downloads.length, 0);
  assert.equal(calls.installed.length, 0);

  const ios = loadUpdater({ platform: 'ios', response: version(126) });
  assert.equal(await ios.api.checkForUpdate(), null);
  await assert.rejects(ios.api.downloadAndInstall(version(126), () => {}));
  assert.equal(ios.calls.downloads.length, 0);
});

test('approved later Android release opens only the Android package installer', async () => {
  const { api, calls } = loadUpdater();
  await api.downloadAndInstall(version(126), () => {});
  assert.equal(calls.downloads.length, 1);
  assert.equal(calls.downloads[0].url, version(126).url);
  assert.equal(calls.installed.length, 1);
  assert.equal(calls.installed[0].action, 'android.intent.action.VIEW');
  assert.equal(calls.installed[0].details.type, 'application/vnd.android.package-archive');
  assert.equal(calls.installed[0].details.flags, 1);
});
