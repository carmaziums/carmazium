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
  assert.equal(makes.length, 158);
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
  assert.ok(dto.includes('variant?: string;'), 'DTO must accept a variant');
  assert.ok(service.includes("where.variant = { contains: variant, mode: 'insensitive' }"), 'backend must actually filter recorded variants');
  for (const file of ['src/lib/listingApi.ts', 'carmazium app/carmazium app/src/lib/listingsApi.ts']) {
    assert.ok(read(file).includes('variant'), `${file} must serialize variant`);
  }
  for (const file of ['src/app/search/page.tsx', 'carmazium app/carmazium app/src/screens/main/SearchScreen.tsx']) {
    assert.ok(read(file).includes('getVariantsForModel'), `${file} must display variant selection`);
  }
});

test('automatic 1–5 exterior grades match between seller uploads and web/native search', () => {
  const web = read('src/lib/exteriorGrade.ts');
  const native = read('carmazium app/carmazium app/src/lib/exteriorGrade.ts');
  const re = /export const EXTERIOR_GRADE_OPTIONS = \[[\s\S]+?\] as const/;
  const webOptions = web.match(re)?.[0];
  const nativeOptions = native.match(re)?.[0];
  assert.ok(webOptions && nativeOptions, 'both platforms must expose the five automatic grades');
  assert.equal(webOptions, nativeOptions, 'seller and buyer grade labels must be identical');
  for (let g = 1; g <= 5; g++) {
    assert.match(webOptions, new RegExp(`value: ${g}, label:`));
  }
  for (const file of [
    'src/app/search/page.tsx',
    'carmazium app/carmazium app/src/screens/main/SearchScreen.tsx',
  ]) {
    const content = read(file);
    assert.match(content, /EXTERIOR_GRADE_OPTIONS/);
    assert.match(content, /exteriorGrades/);
    assert.match(content, /writeOffCategories/);
  }
  assert.match(read('carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx'), /EXTERIOR_GRADE_OPTIONS/);
  for (const file of [
    'backend/src/listings/dto/listing-filter.dto.ts',
    'backend/src/listings/listings.service.ts',
    'src/lib/listingApi.ts',
    'carmazium app/carmazium app/src/lib/listingsApi.ts',
  ]) {
    assert.match(read(file), /exteriorGrades/);
    assert.match(read(file), /writeOffCategories/);
  }
  const service = read('backend/src/listings/listings.service.ts');
  assert.match(service, /where\.exteriorGrade = gradeSearch\.exteriorGrade/);
  assert.match(read('backend/src/damage/damage.service.ts'), /data: \{ exteriorGrade: computeExteriorGrade\(detections\) \}/);
});

test('radius and multi-make filters survive every layer without per-page slicing', () => {
  const dto = read('backend/src/listings/dto/listing-filter.dto.ts');
  const service = read('backend/src/listings/listings.service.ts');
  for (const key of ['maxDistanceMi','originLatitude','originLongitude','makes']) {
    assert.ok(dto.includes(`${key}?`));
    assert.ok(service.includes(key));
    assert.ok(read('carmazium app/carmazium app/src/lib/listingsApi.ts').includes(key));
  }
  assert.ok(service.indexOf('const candidates = await') < service.indexOf('const skip = (page - 1) * limit'));
  assert.match(service, /haversineMiles\(/);
  const native = read('carmazium app/carmazium app/src/screens/main/SearchScreen.tsx');
  assert.match(native, /makes: selectedMakes\.length > 1 \? selectedMakes : undefined/);
  assert.doesNotMatch(native, /rawItems\.filter\(/);
  const web = read('src/app/search/page.tsx');
  assert.doesNotMatch(web, /filtered = filtered\.filter\(/);
  assert.match(web, /pushFiltersToUrl\(u\)/);
  for (const key of ['maxDistanceMi', 'originLatitude', 'originLongitude']) {
    assert.ok(read('src/lib/listingApi.ts').includes(key));
  }
});

test('retail searches hide unrelated featured vehicles, use honest placeholders and surface native fetch failures', () => {
  const web = read('src/app/search/page.tsx');
  assert.match(web, /activeFilterCount === 0 && !appliedFilters\.search\.trim\(\)/);
  assert.match(web, /return "\/assets\/images\/placeholder-car\.svg"/);
  assert.doesNotMatch(web, /return "\/assets\/images\/featured-sports\.png"/);
  const api = read('carmazium app/carmazium app/src/lib/listingsApi.ts');
  assert.match(api, /price:\s+Number\(l\.price\)/);
  assert.match(api, /if \(params\.strictErrors\) throw err/);
  const native = read('carmazium app/carmazium app/src/screens/main/SearchScreen.tsx');
  assert.match(native, /strictErrors: true/);
  assert.match(native, /Unable to load vehicles/);
  assert.match(native, /Connection error/);
});

test('rapid changes in retail search cannot display stale requests', () => {
  const web = read('src/app/search/page.tsx');
  assert.match(web, /const latestSearchRequest = React\.useRef\(0\)/);
  assert.match(web, /if \(requestId !== latestSearchRequest\.current\) return/);
  const native = read('carmazium app/carmazium app/src/screens/main/SearchScreen.tsx');
  assert.match(native, /const activeSearchRequest = useRef\(0\)/);
  assert.match(native, /if \(requestId !== activeSearchRequest\.current\) return/);
});

test('retail condition must not pretend independent pre-owned certification and unknown data stays unknown', () => {
  const adapter = read('carmazium app/carmazium app/src/lib/listingsApi.ts');
  const types = read('carmazium app/carmazium app/src/data/listings.ts');
  assert.doesNotMatch(adapter, /case 'GOOD':\s*return 'Certified Pre-Owned'/);
  assert.match(adapter, /case 'HATCHBACK':\s*return 'Hatchback'/);
  assert.match(adapter, /'Not specified'/);
  assert.match(types, /'Hatchback'/);
  assert.match(types, /'Not specified'/);
  const web = read('src/app/search/page.tsx');
  assert.match(web, /appliedFilters\.features\.length\) count\+\+/);
  assert.match(web, /appliedFilters\.sortBy === 'newest' && currentPage === 1/);
  const native = read('carmazium app/carmazium app/src/screens/main/SearchScreen.tsx');
  assert.match(native, /const queryEffectMounted = useRef\(false\)/);
});

test('native Retail search exposes the website filters in one readable scrolling page', () => {
  const web = read('src/app/search/page.tsx');
  const native = read('carmazium app/carmazium app/src/screens/main/SearchScreen.tsx');
  for (const term of ['exteriorGrades', 'writeOffCategories', 'minCombinedMpg', 'maxZeroTo60Mph',
    'maxDistanceMi', 'vehicleType', 'selectedFeatures', 'euroStandard', 'sellerType',
    'transmissions', 'makeQuery', 'variantFilter']) {
    assert.ok(web.includes(term === 'variantFilter' ? 'variant' : term === 'selectedFeatures' ? 'features' : term), 'web: ' + term);
    assert.ok(native.includes(term), 'native: ' + term);
  }
  assert.match(native, /ListHeaderComponent=\{searchHeader\}/);
  assert.match(native, /quickScroll: \{ height: 72, flexGrow: 0, flexShrink: 0/);
  assert.match(native, /keyboardShouldPersistTaps="handled"/);
  assert.match(native, /ListEmptyComponent=/);
  assert.match(native, /!loading && !searchError && listings\.length > 0 && hasMore/);
});

test('auction filter catalogue matches the retail criteria and applies to live and upcoming vehicles', () => {
  const model = read('carmazium app/carmazium app/src/components/filters/auctionFilters.ts');
  const sheet = read('carmazium app/carmazium app/src/components/filters/AuctionFilterSheet.tsx');
  const live = read('carmazium app/carmazium app/src/screens/main/LiveScreen.tsx');
  for (const key of ['variant', 'colour', 'minMileage', 'maxMileage', 'minDoors', 'minSeats',
    'minEngine', 'maxEngine', 'maxCo2', 'minCombinedMpg', 'maxZeroToSixty',
    'driveType', 'minBhp', 'maxBhp', 'conditions', 'exteriorGrades',
    'writeOffCategories', 'ulezCompliant', 'euroStandard', 'features', 'sellerType',
    'vehicleType', 'isImported', 'maxDistanceMi', 'deliveryAvailable']) {
    assert.ok(model.includes(key), 'auction model: ' + key);
    assert.ok(sheet.includes(key), 'auction UI: ' + key);
  }
  for (const catalog of ['CAR_MAKES', 'getModelsForMake', 'VEHICLE_FEATURE_GROUPS', 'EXTERIOR_GRADE_OPTIONS']) {
    assert.ok(sheet.includes(catalog), 'shared native catalogue: ' + catalog);
  }
  assert.ok(model.includes('if (!hasNumber(value)) return false'), 'missing measurements must not be zero');
  assert.ok(model.includes('if (!origin || !hasNumber(lat) || !hasNumber(lon)) return false'), 'distance without coordinates is not a match');
  assert.ok(live.includes('a.totalBids > 0 ? a.currentBid : a.startingBid'), 'live unbid lots filter by opening bid');
  assert.ok(live.includes('filters, Number(u.startingBid), origin'), 'scheduled lots honour bid filters');
  assert.ok(live.includes('compareAuctions(filters.sortBy)'), 'both auction lists support chosen sorting');
});
