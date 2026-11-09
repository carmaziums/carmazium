import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function load(name) {
  const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8')
  const context = { exports: {}, require: path => load(path.replace('./', '')) }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return context.exports
}
const { registrationLookupReset } = load('listingRegistrationChange')
const { listingDetailsInputIssue, isValidListingPrice } = load('listingInputValidation')
const valid = { vrm: 'JU55 MAG', year: '2016', mileage: '65350', title: 'BMW X5 2016' }
test('switching a BMW lookup to a Ford cannot retain BMW identity or official facts', () => {
  const original = { vrm: 'JU55MAG', make: 'BMW', model: 'X5', variant: 'M Sport', vin: 'old-vin', year: '2016', motHistory: [{ old: true }], motExpiryDate: '2027-05-22', officialVehicleData: { mot: { old: true } }, mileage: '65350', images: ['seller-photo'] }
  const changed = { ...original, ...registrationLookupReset(original.vrm, 'PX13RKF'), vrm: 'PX13RKF' }
  for (const key of ['make', 'model', 'variant', 'vin', 'year', 'motExpiryDate']) assert.equal(changed[key], '')
  assert.equal(changed.motHistory.length, 0)
  assert.equal(changed.officialVehicleData, undefined)
  assert.equal(changed.mileage, original.mileage)
  assert.equal(changed.images, original.images)
  assert.equal(original.model, 'X5')
})
test('spacing/case corrections preserve current vehicle facts', () => {
  assert.equal(Object.keys(registrationLookupReset('JU55 MAG', 'ju55mag')).length, 0)
})
test('whole mileage including zero is accepted; negative and fractional values cannot be silently truncated', () => {
  for (const mileage of ['0', '65350']) assert.equal(listingDetailsInputIssue({ ...valid, mileage }, 2026), null)
  for (const mileage of ['-1', '1.5', '1e3', '   ', 'Infinity', '2147483648']) assert.equal(listingDetailsInputIssue({ ...valid, mileage }, 2026)?.field, 'mileage')
})
test('year validation matches backend boundaries before media and payment', () => {
  for (const year of ['1900', '2027']) assert.equal(listingDetailsInputIssue({ ...valid, year }, 2026), null)
  for (const year of ['1899', '2028', '-1', '2016.5']) assert.equal(listingDetailsInputIssue({ ...valid, year }, 2026)?.field, 'year')
})
test('invalid registration and whitespace-only titles are rejected', () => {
  for (const vrm of ['?', 'A', 'AB123456', '      ']) assert.equal(listingDetailsInputIssue({ ...valid, vrm }, 2026)?.field, 'registration')
  for (const title of ['     ', 'A'.repeat(201)]) assert.equal(listingDetailsInputIssue({ ...valid, title }, 2026)?.field, 'title')
})
test('prices require finite positive currency amounts with at most two decimals', () => {
  for (const value of ['1', '2500.99', ' 50.00 ']) assert.equal(isValidListingPrice(value), true)
  for (const value of ['0', '-1', 'Infinity', '1e3', '1.001', '500abc', '']) assert.equal(isValidListingPrice(value), false)
})
