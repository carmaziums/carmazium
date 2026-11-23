import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('carmazium app/carmazium app/src/screens/main/CreateServiceJobScreen.tsx');
const webDelivery = read('src/app/services/delivery/new/page.tsx');
const webInspection = read('src/app/services/inspection/new/page.tsx');

test('Post Job continues to use the existing protected service-job API, not a parallel jobs system', () => {
  assert.match(app, /apiClient<\{ data: \{ id: string \} \}>\('\/services\/jobs'/);
  assert.match(webDelivery, /createJob\(\{/);
  assert.match(webInspection, /createJob\(\{/);
  assert.doesNotMatch(app, /Linking\.openURL|WebView|\/tradexchange\/post/);
});

test('Android delivery form accepts and validates every vehicle before one job POST', () => {
  assert.match(app, /vehicles\.findIndex\(vehicle =>/);
  assert.match(app, /!vehicle\.registration\.trim\(\) && !\(vehicle\.make\.trim\(\) && vehicle\.model\.trim\(\)\)/);
  assert.match(app, /vehicles: vehicles\.map\(vehicle => \(\{/);
  assert.match(app, /vehicles\.length < MAX_VEHICLES && \(\s*<TouchableOpacity[^>]*onPress=\{addVehicle\}/);
  assert.match(app, /vehicles\.length > 1/);
  assert.match(webDelivery, /vehicles\.map\(v => \(\{/);
});

test('Android matches website delivery route and private address fields', () => {
  for (const field of ['pickupPostcode', 'pickupAddress', 'deliveryPostcode', 'deliveryAddress', 'isRecovery']) {
    assert.match(app, new RegExp(field + ':'));
    assert.match(webDelivery, new RegExp(field));
  }
  assert.match(app, /servicePostcode: destination\.trim\(\)\.toUpperCase\(\)/);
  assert.match(app, /serviceAddress: address\.trim\(\) \|\| undefined/);
});

test('successful Android posting opens native job details without a My Jobs detour', () => {
  assert.match(app, /navigation\.replace\('CustomerServiceJobDetail', \{ jobId: result\.data\.id \}\)/);
  assert.doesNotMatch(app, /Alert\.alert\('Job posted'/);
  assert.doesNotMatch(app, /navigation\.navigate\('Web|openURL/);
});
