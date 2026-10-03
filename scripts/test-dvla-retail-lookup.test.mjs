import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wizard = readFileSync(new URL('../src/components/listing/ListingWizard.tsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/lib/dvlaApi.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/app/sell/page.tsx', import.meta.url), 'utf8');
test('retail sellMode uses the same fixed seller listing wizard', () => {
  assert.match(page, /searchParams\.get\("sellMode"\) === "retail"/);
  assert.match(page, /<ListingWizard isDashboard=\{false\} \/>/);
});
test('core registration lookup is independent of optional AI consent', () => {
  assert.match(wizard, /const r = await dvlaLookup\(formData\.vrm, false\)/);
  assert.match(api, /return apiClient<DvlaLookupResult>\('\/dvla\/lookup'/);
  assert.match(api, /return apiClient<DvlaLookupResult>\('\/dvla\/enrich'/);
});
test('optional AI specs run after core success and do not override seller selections', () => {
  const start = wizard.indexOf('const r = await dvlaLookup(formData.vrm, false)');
  const success = wizard.indexOf('setDvlaSuccess(true)', start);
  const optional = wizard.indexOf('void dvlaEnrich(requestedVrm)', start);
  assert.ok(success > start && optional > success);
  assert.match(wizard, /if \(lookupId !== lookupRequestRef\.current\) return/);
  assert.match(wizard, /prev\.variant \|\| suggestion\.variant/);
  assert.match(wizard, /\.catch\(\(\) => \{\s*\/\/ Optional enrichment/);
});
test('old or abandoned lookup cannot display a stale failure or stop a newer spinner', () => {
  assert.match(wizard, /catch \(err: any\) \{\s*if \(lookupId !== lookupRequestRef\.current\) return\s*setDvlaError/);
  assert.match(wizard, /if \(lookupId === lookupRequestRef\.current\) setDvlaLoading\(false\)/);
  assert.doesNotMatch(wizard, /trackEvent\('valuation_failed', \{\s*listing_type: listingTypeLabel\(formData\.listingType\),\s*registration:/);
});
