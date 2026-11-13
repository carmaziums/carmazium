import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/listingApi.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
function client() {
  const calls = [], exports = {};
  vm.runInNewContext(code, { exports, URLSearchParams, require: name => {
    if (name === './listingMotHistory') return {};
    if (name === './approvedAuctionAttribution') return { captureApprovedAuctionAttribution: () => { throw Error('Search must not capture seller attribution'); } };
    assert.equal(name, './apiClient');
    return { apiClient: async (url, options) => { calls.push({ url, options }); return { data: [], pagination: { total: 0 } }; } };
  } });
  return { ...exports, calls };
}

test('all supported filters survive serialization together, including engine, CO2, false and zero', async () => {
  const api = client();
  const filters = {
    minPrice: 0, maxPrice: 10000, make: 'Kia', model: 'Ceed', variant: 'GT Line',
    minYear: 2015, maxYear: 2026, minMileage: 0, maxMileage: 90000,
    fuelType: 'PETROL', transmission: 'AUTOMATIC', bodyType: 'HATCHBACK', color: 'Blue',
    minDoors: 4, minSeats: 5, minEngine: 1000, maxEngine: 1600, maxCo2: 0,
    minCombinedMpg: 40.5, maxZeroTo60Mph: 8.5, driveType: 'FWD',
    conditions: ['GOOD'], exteriorGrades: [1, 2], writeOffCategories: ['NONE'],
    ulezCompliant: false, euroStandard: 'EURO_6', isImported: false, markedForExport: false,
    vehicleType: 'CAR', minBhp: 90, maxBhp: 200, sellerType: 'DEALER', location: 'Birmingham',
    listingType: 'CLASSIFIED', sortBy: 'price_asc', search: 'Kia', page: 2, limit: 10,
    maxDistanceMi: 25, originLatitude: 52.4862, originLongitude: -1.8904,
    deliveryAvailable: false, motValid: true, taxedOnly: true,
    features: ['Heated Seats', 'Navigation'], serviceHistories: ['FULL_MAIN_DEALER'], maxOwners: 2,
  };
  await api.getListings(filters);
  const query = new URL(api.calls[0].url, 'https://example.test').searchParams;
  for (const [key, value] of Object.entries(filters)) assert.equal(query.get(key), String(value), key);
  assert.equal(api.calls[0].options.method, 'GET');
});

test('multiple makes, fuels and transmissions replace their singular counterparts; absence stays unfiltered', async () => {
  const api = client();
  await api.getListings({ make: 'Kia', makes: ['Kia','Toyota'], fuelType: 'PETROL',
    fuelTypes: ['PETROL','DIESEL'], transmission: 'AUTOMATIC', transmissions: ['AUTOMATIC','CVT'] });
  const query = new URL(api.calls[0].url, 'https://example.test').searchParams;
  assert.equal(query.get('makes'), 'Kia,Toyota');
  assert.equal(query.get('fuelTypes'), 'PETROL,DIESEL');
  assert.equal(query.get('transmissions'), 'AUTOMATIC,CVT');
  for (const key of ['make','fuelType','transmission','minEngine','maxEngine','maxCo2','isImported']) assert.equal(query.has(key), false);
  await api.getListings();
  assert.equal(api.calls[1].url, '/listings');
});
