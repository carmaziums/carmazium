import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';

function harness(fetch) {
  let state, cursor = 0, id = 0;
  const refs = [], timers = new Map(), storage = new Map();
  const react = { ...React, createContext: () => ({ Provider: 'provider' }),
    useState: initial => { state ??= initial; return [state, next => { state = next; }]; },
    useRef: value => { const i = cursor++; return refs[i] ??= { current: value }; },
    useEffect: () => {},
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL('../src/context/LocationContext.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, fetch, setTimeout: fn => { timers.set(++id, fn); return id; },
    clearTimeout: key => timers.delete(key), localStorage: {
      getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key),
    }, require: name => {
      if (name === 'react') return { __esModule: true, default: react, ...react };
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'next/navigation') return { usePathname: () => '/search' };
      throw new Error(name);
    } });
  return { render() { cursor = 0; return exports.LocationProvider({ children: null }).props.value; },
    flush() { const [key, fn] = [...timers][0]; timers.delete(key); return fn(); }, storage,
  };
}
const response = (latitude, longitude) => ({ ok: true, json: async () => ({ result: { latitude, longitude } }) });

test('changing or clearing a postcode immediately removes old coordinates; invalid codes never reuse them', async () => {
  let valid = true;
  const h = harness(async () => valid ? response(52.5, -1.9) : { ok: false });
  h.render().setPostcode('b19 1es'); await h.flush();
  assert.equal(h.render().location.lat, 52.5);
  assert.equal(h.storage.get('carmazium_user_postcode'), 'B19 1ES');
  valid = false;
  h.render().setPostcode('invalid');
  assert.equal(h.render().location.lat, null);
  assert.equal(h.storage.has('carmazium_user_postcode'), false);
  await h.flush();
  assert.equal(h.render().location.lng, null);
  h.render().setPostcode(''); await h.flush();
  assert.equal(h.render().location.postcode, '');
});

test('a slow response for the old postcode cannot overwrite the newly selected postcode', async () => {
  let finishOld;
  const h = harness(url => url.endsWith('B191ES') ? new Promise(resolve => { finishOld = resolve; })
    : Promise.resolve(response(53.48, -2.24)));
  h.render().setPostcode('B19 1ES'); const old = h.flush();
  h.render().setPostcode('M1 1AA'); await h.flush();
  finishOld(response(52.5, -1.9)); await old;
  assert.equal(h.render().location.lat, 53.48);
  assert.equal(h.render().location.postcode, 'M1 1AA');
  assert.equal(h.storage.get('carmazium_user_postcode'), 'M1 1AA');
});
