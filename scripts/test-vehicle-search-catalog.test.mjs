import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = new URL('../', import.meta.url);
const read = path => readFileSync(fileURLToPath(new URL(path, base)), 'utf8');

test('web and native share an identical A–Z make/model catalogue', () => {
  const web = read('src/lib/carData.ts');
  const native = read('carmazium app/carmazium app/src/data/carData.ts');
  const start = 'export const CAR_MAKES: string[]';
  assert.ok(web.includes(start) && native.includes(start));
  assert.equal(web.slice(web.indexOf(start)), native.slice(native.indexOf(start)));
  const makes = [...web.split('export const CAR_MAKES: string[] = [')[1].split(']')[0].matchAll(/'([^']+)'/g)].map(x => x[1]);
  assert.equal(makes.length, 126);
  assert.equal(new Set(makes).size, makes.length);
  assert.match(web, /CAR_MAKES\.sort/);
  assert.match(web, /EXTRA_MODELS_BY_MAKE/);
});

test('native and web search feature lists match the seller options', () => {
  const web = read('src/lib/vehicleFeatures.ts');
  const native = read('carmazium app/carmazium app/src/data/vehicleFeatures.ts');
  assert.equal(web, native);
  const marker = 'export const VEHICLE_FEATURE_GROUPS: Record<string, string[]> = ';
  const groups = JSON.parse(web.split(marker)[1].split('\n\nexport const VEHICLE_FEATURES')[0]);
  const options = Object.values(groups).flat();
  assert.ok(options.length >= 95);
  assert.equal(new Set(options).size, options.length);
  for (const file of [
    'src/app/search/page.tsx',
    'carmazium app/carmazium app/src/screens/main/SearchScreen.tsx',
    'carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx',
  ]) {
    assert.match(read(file), /VEHICLE_FEATURE_GROUPS/);
  }
  assert.match(read('src/components/listing/ListingWizard.tsx'), /VEHICLE_FEATURES/);
});

test('technical search filters are wired across backend, web and native', () => {
  const backend = read('backend/src/listings/listings.service.ts');
  assert.match(backend, /where\.engineSize = \{\}/);
  assert.doesNotMatch(backend, /where\.engineCapacity/);
  for (const filter of ['minCombinedMpg', 'maxZeroTo60Mph', 'driveType']) {
    for (const file of [
      'backend/src/listings/dto/listing-filter.dto.ts',
      'backend/src/listings/listings.service.ts',
      'src/lib/listingApi.ts',
      'src/app/search/page.tsx',
      'carmazium app/carmazium app/src/lib/listingsApi.ts',
      'carmazium app/carmazium app/src/screens/main/SearchScreen.tsx',
    ]) assert.ok(read(file).includes(filter === 'driveType' && file.endsWith('SearchScreen.tsx') ? 'driveTypeFilter' : filter), `${file} lacks ${filter}`);
  }
  assert.match(backend, /buildFeatureConditions\(features\)/);
});

test('model variant selections are queryable across backend, website and native app', () => {
  const dto = read('backend/src/listings/dto/listing-filter.dto.ts');
  const service = read('backend/src/listings/listings.service.ts');
  assert.match(dto, /variant\\?: string/);
  assert.match(service, /where\\.variant = \\{ contains: variant, mode: 'insensitive' \\}/);
  for (const file of ['src/lib/listingApi.ts', 'carmazium app/carmazium app/src/lib/listingsApi.ts']) {
    assert.match(read(file), /variant/);
    assert.match(read(file), /(?:params|filters)\\.variant/);
  }
  for (const file of ['src/app/search/page.tsx', 'carmazium app/carmazium app/src/screens/main/SearchScreen.tsx']) {
    assert.match(read(file), /getVariantsForModel/);
  }
});
