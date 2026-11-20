import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Exercise screen event handlers with the native bridge, network and navigation
// replaced by local fixtures. No provider notifications or payments are sent.
function screen(file, bindings) {
  const source = readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    target: ts.ScriptTarget.ES2022,
  } });
  const modules = {
    react: React,
    'react-native': {
      View: 'View', Text: 'Text', TouchableOpacity: 'Button', TextInput: 'Input',
      ActivityIndicator: 'Spinner', ScrollView: 'ScrollView', Switch: 'Switch', StyleSheet: { create: styles => styles },
      Alert: { alert: () => {} },
    },
    '../../components/ScreenBackBar': { ScreenBackBar: 'Header' },
    '@react-native-community/datetimepicker': 'Picker',
    '../../constants/colors': { Colors: {} }, '../constants/colors': { Colors: {} },
    '../../constants/spacing': { Elevation: {} },
    ...bindings,
  };
  const exports = {};
  runInNewContext(outputText, { exports, URLSearchParams, require: name => {
    assert.ok(name in modules, 'Missing fixture for ' + name);
    return modules[name];
  } });
  return exports;
}

const vehicle = { id: 'listing-1', title: 'QA vehicle', vrm: 'AB12CDE', make: 'Ford', model: 'Focus', year: 2017, location: 'Leeds' };
const labels = node => node.findAllByType('Text').flatMap(t => t.children.filter(c => typeof c === 'string')).join(' ');
const press = async (tree, label) => act(async () => {
  const button = tree.root.findAllByType('Button').find(b => labels(b).includes(label));
  assert.ok(button, 'Button missing: ' + label);
  await button.props.onPress();
});

test('listing actions respect availability, finance eligibility and guest booking context', async () => {
  const routes = [], urls = [];
  let signedIn = true;
  const { VehicleServiceActions } = screen('components/VehicleServiceActions.tsx', {
    '@react-navigation/native': { useNavigation: () => ({ navigate: (...args) => routes.push(args) }) },
    'expo-web-browser': { openBrowserAsync: async url => urls.push(url) },
    '../store/authStore': { useAuthStore: select => select({ user: signedIn ? {} : null }) },
    '../lib/servicesApi': { getServiceSettings: async () => ({ availability: { DELIVERY: false } }) },
  });
  let tree;
  const render = async props => act(async () => {
    const element = React.createElement(VehicleServiceActions, { vehicle, ...props });
    if (tree) tree.update(element); else tree = create(element);
  });
  await render({});
  assert.deepEqual(tree.root.findAllByType('Button').map(labels), ['Request an inspection', 'Get a warranty quote']);
  await press(tree, 'Request an inspection');
  assert.equal(routes[0][0], 'CreateServiceJob');
  assert.equal(routes[0][1].serviceType, 'INSPECTION');
  assert.equal(routes[0][1].purchase.listingId, vehicle.id);
  await render({ finance: true });
  await press(tree, 'Explore finance');
  assert.equal(new URL(urls.at(-1)).searchParams.get('listingId'), vehicle.id);
  signedIn = false;
  await render({ auction: true });
  assert.deepEqual(tree.root.findAllByType('Button').map(labels), ['Request an inspection']);
  await press(tree, 'Request an inspection');
  const url = new URL(urls.at(-1));
  assert.equal(url.pathname, '/services/inspection/new');
  assert.equal(url.searchParams.get('registration'), vehicle.vrm);
  assert.equal(url.searchParams.get('pickup'), vehicle.location);
  await act(async () => tree.unmount());
});

for (const serviceType of ['DELIVERY', 'INSPECTION']) {
  test(serviceType + ' submits the selected service, vehicle details and batch to the job API', async () => {
    const requests = [];
    const { CreateServiceJobScreen } = screen('screens/main/CreateServiceJobScreen.tsx', {
      '../../lib/apiClient': { apiClient: async (_path, request) => { requests.push(JSON.parse(request.body)); } },
    });
    let tree;
    await act(async () => { tree = create(React.createElement(CreateServiceJobScreen, {
      navigation: {}, route: { params: { serviceType, purchase: {
        ...vehicle, listingId: vehicle.id, registration: vehicle.vrm,
      } } },
    })); });
    const set = (label, value, index = 0) => act(async () => {
      const inputs = tree.root.findAllByType('Input').filter(input => input.props.accessibilityLabel === label);
      inputs[index].props.onChangeText(value);
    });
    await press(tree, 'Post a Job');
    assert.equal(requests.length, 0);
    if (serviceType === 'DELIVERY') {
      await set('Collection postcode *', 'B1 1AA');
      await set('Delivery postcode *', 'B2 2BB');
      await press(tree, 'Add another vehicle');
      await press(tree, 'Post a Job');
      assert.equal(requests.length, 0);
      await set('Make', 'Ford', 1);
      await set('Model', 'Fiesta', 1);
    } else {
      await set('Inspection postcode *', 'B1 1AA');
      await press(tree, 'Cosmetic inspection');
      await set('Additional registrations (optional)', vehicle.vrm);
      await press(tree, 'Post a Job');
      assert.equal(requests.length, 0);
      await set('Additional registrations (optional)', 'XY67ABC');
    }
    await press(tree, 'Post a Job');
    assert.equal(requests.length, 1);
    const [body] = requests;
    assert.equal(body.serviceType, serviceType);
    assert.equal(body.vehicles.length, 2);
    assert.equal(body.vehicles[0].listingId, vehicle.id);
    assert.equal(body.vehicles[0].year, vehicle.year);
    if (serviceType === 'INSPECTION') {
      assert.equal(body.inspectionScope, 'COSMETIC');
      assert.equal(body.serviceAddress, vehicle.location);
    } else {
      assert.equal(body.pickupAddress, vehicle.location);
      assert.equal(body.vehicles[1].model, 'Fiesta');
    }
    await act(async () => tree.unmount());
  });
}
