import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('guest enquiry waits for consent and a verified code, and allows retry after a rejected code', async () => {
  const requests = [];
  const modules = {
    react: React,
    'react-native': { View: 'View', Text: 'Text', TextInput: 'Input', Switch: 'Switch',
      ScrollView: 'ScrollView', StyleSheet: { create: value => value } },
    'expo-web-browser': {},
    '../../constants/colors': { Colors: {} },
    '../Button': { Button: 'Button' },
    '../BottomSheet': { BottomSheet: 'Sheet' },
    '../../lib/apiClient': { async apiClient(path, init) {
      assert.equal(init.method, 'POST');
      const data = JSON.parse(init.body);
      requests.push([path, data]);
      if (path === '/listing-enquiries') return { data: { id: 'challenge-id' } };
      assert.equal(path, '/listing-enquiries/verify');
      if (data.code !== '123456') throw new Error('The code was incorrect.');
    } },
  };
  const source = readFileSync(new URL('../src/components/listing/GuestEnquirySheet.tsx', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022,
  } });
  const exports = {};
  runInNewContext(outputText, { exports, Error, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  let tree;
  await act(async () => { tree = create(React.createElement(exports.GuestEnquirySheet, {
    listingId: 'retail-listing', vehicleTitle: 'QA vehicle', onClose() {},
  })); });
  const enter = (label, value) => act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onChangeText(value));
  const press = label => act(async () => tree.root.findByProps({ label }).props.onPress());
  await enter('Your name', 'QA Buyer');
  await enter('Email address', 'qa@example.test');
  await press('Send confirmation code');
  assert.equal(requests.length, 0);
  await act(async () => tree.root.findByType('Switch').props.onValueChange(true));
  await press('Send confirmation code');
  assert.deepEqual(requests[0], ['/listing-enquiries', { listingId: 'retail-listing', fullName: 'QA Buyer', email: 'qa@example.test',
    phone: '', message: 'Hello, I am interested in QA vehicle. Is it still available?', consent: true }]);
  await enter('Email confirmation code', '12');
  await press('Confirm email and send enquiry');
  assert.equal(requests.length, 1);
  await enter('Email confirmation code', '000000');
  await press('Confirm email and send enquiry');
  assert.equal(tree.root.findByProps({ accessibilityRole: 'alert' }).children[0], 'The code was incorrect.');
  await enter('Email confirmation code', '123456');
  await press('Confirm email and send enquiry');
  assert.deepEqual(requests[2], ['/listing-enquiries/verify', { id: 'challenge-id', code: '123456' }]);
  assert.equal(tree.root.findByType('Sheet').props.title, 'Enquiry sent');
  await act(async () => tree.unmount());
});
