import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/components/listing/BuyerVehicleInformation.tsx', import.meta.url), 'utf8');
const context = { exports: {}, require };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022,
}}).outputText, context);
const BuyerVehicleInformation = context.exports.BuyerVehicleInformation;
test('caravan buyer facts render manual details and omit stale motor-vehicle facts', () => {
  const html = renderToStaticMarkup(React.createElement(BuyerVehicleInformation, { listing: {
    bodyType: 'CARAVAN', make: 'Synthetic caravan', numberOfKeys: 0, location: 'Birmingham',
    motStatus: 'MOT SHOULD NOT APPEAR', vrm: 'OLDVRM', engineSize: 2000,
    officialVehicleData: { dvla: { rawFuelType: 'OLD DIESEL' } },
  } }));
  assert.match(html, /Synthetic caravan/);
  assert.match(html, /Keys/);
  assert.match(html, /Birmingham/);
  assert.doesNotMatch(html.replace(/<[^>]*>/g, ''), /MOT|DVLA|OLDVRM|DIESEL|2000|Engine/);
});
for (const bodyType of ['HATCHBACK', 'CAMPERVAN']) test(`${bodyType} motor vehicles retain MOT and technical facts`, () => {
  const html = renderToStaticMarkup(React.createElement(BuyerVehicleInformation, { listing: {
    bodyType, make: 'Synthetic car', motStatus: 'Valid', engineSize: 2000,
  } }));
  assert.match(html, /MOT test history/);
  assert.match(html, /2000 cc/);
});
