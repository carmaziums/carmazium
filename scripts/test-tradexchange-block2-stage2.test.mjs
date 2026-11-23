import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const native = read('carmazium app/carmazium app/src/screens/main/CreateServiceJobScreen.tsx');
const menu = read('carmazium app/carmazium app/src/screens/main/ServicesScreen.tsx');
const delivery = read('src/app/services/delivery/new/page.tsx');
const inspection = read('src/app/services/inspection/new/page.tsx');
const validation = read('src/lib/serviceJobFormValidation.ts');

test('native job form offers ASAP or a date and time and checks past dates before submitting', () => {
  assert.match(native, /<DateTimePicker /);
  assert.match(native, /mode=\{Platform\.OS === 'ios' \? 'datetime' : pickerMode\}/);
  assert.match(native, /setPickerMode\('time'\)/);
  assert.match(native, /requestedFor: asap \? undefined : requestedFor!\.toISOString\(\)/);
  assert.match(native, /requestedFor\.getTime\(\) <= Date\.now\(\)/);
  assert.match(delivery, /parseUkServiceDateTime\(requestedFor\)/);
  assert.match(inspection, /jobDateIssue\(form\.requestedFor, false\)/);
});

test('delivery, collection and recovery use the native job form and limit vehicles to the backend maximum of 12', () => {
  assert.match(native, /const MAX_VEHICLES = 12/);
  assert.match(native, /current\.length < MAX_VEHICLES/);
  assert.match(native, /vehicles\.length < MAX_VEHICLES/);
  assert.match(native, /year: vehicle\.year \? Number\(vehicle\.year\) : undefined/);
  assert.match(native, /registration\.replace\(\/\\s\+\/g/);
  assert.match(native, /validYear\(v\.year\)/);
  assert.match(delivery, /updated\.slice\(0, 12\)/);
  assert.match(inspection, /jobYearValid\(form\.year\)/);
});

test('both website job forms validate UK postcode and vehicle year before post', () => {
  assert.match(validation, /export function jobPostcodeValid\(/);
  assert.match(validation, /export function jobYearValid\(/);
  assert.match(delivery, /jobPostcodeValid\(pickupPostcode\)/);
  assert.match(delivery, /jobPostcodeValid\(deliveryPostcode\)/);
  assert.match(delivery, /vehicles\.findIndex\(v => !jobYearValid\(v\.year\)\)/);
  assert.match(inspection, /jobPostcodeValid\(form\.postcode\)/);
  assert.match(inspection, /jobYearValid\(form\.year\)/);
});

test('app uses an account-scoped draft and clears it after a successful post', () => {
  assert.match(native, /tradexchange:job-draft:\$\{userId\}:\$\{serviceType\}/);
  assert.match(native, /draftOwner === draftKey/);
  assert.match(native, /AsyncStorage\.getItem\(draftKey\)/);
  assert.match(native, /AsyncStorage\.setItem\(draftKey, snapshot\)/);
  assert.match(native, /AsyncStorage\.removeItem\(draftKey\)/);
  assert.match(native, /posted\.current = true/);
  assert.doesNotMatch(native, /navigation\.navigate\('Web|Linking\.openURL/);
});

test('website delivery drafts reuse account-isolated session storage and are cleared only after successful creation', () => {
  assert.match(delivery, /useSessionDraft\(/);
  assert.match(delivery, /user\?\.id \?\? null, authLoading/);
  assert.match(delivery, /vehiclesJson: JSON\.stringify/);
  assert.match(delivery, /if \(!hydrated \|\| submitting\) return/);
  assert.match(delivery, /clearDraft\(\)\s*router\.push/);
  assert.match(inspection, /useSessionDraft\(/);
});

test('native service cards open the relevant existing form without a chooser or provider-only action', () => {
  assert.match(menu, /onPress=\{\(\) => openService\(service.path\)\}/);
  assert.doesNotMatch(menu, /Alert\.alert\('Post a job'|navigate\('ProviderJobs'/);
  assert.match(menu, /navigation\.navigate\('CreateServiceJob', \{ serviceType: 'DELIVERY' \}\)/);
  assert.match(menu, /navigation\.navigate\('CreateServiceJob', \{ serviceType: 'INSPECTION' \}\)/);
  assert.doesNotMatch(menu, /navigate\('NewJobChooser'/);
});
