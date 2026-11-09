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
const { faultDeclarationError, isNoKnownFaults } = load('sellerFaultDeclaration')
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

// Exercise the wizard's actual validation and navigation closures. Extracting
// them through the TypeScript AST keeps these tests on production behaviour.
function wizardFunction(file, name, context) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let initializer
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) initializer = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(tree)
  assert.ok(initializer, `${name} must exist`)
  const js = ts.transpileModule(`const result = ${initializer.getText(tree)}; result`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  return vm.runInNewContext(js, { ...context })
}
const wizardFile = '../src/components/listing/ListingWizard.tsx'
const completeForm = {
  ...valid, make: 'BMW', model: 'X5', fuelType: 'PETROL', transmission: 'AUTOMATIC',
  bodyType: 'SUV', vehicleType: 'CAR', location: 'Birmingham', owners: '1', description: 'Seller description',
  condition: 'GOOD', serviceHistory: 'Partial', numberOfKeys: '2', writeOffCategory: 'NONE',
  mechanicalIssues: 'No known faults', electricalIssues: 'No known faults',
  stolenRecovered: false, hasOutstandingFinance: false, isLegalRegisteredKeeper: true,
  isDepartedSale: false, declarationAcknowledged: true,
}
function wizardContext(formData) {
  return {
    formData, currentStep: 1, listingDetailsInputIssue, faultDeclarationError, missingSellerDeclarations: [], bodyTypeKeys: ['SUV'],
    normalizeSellerTransmission: value => value, normalizeSellerBodyType: value => value,
  }
}
test('auction and retail cannot advance or submit a restored draft with missing seller history/keys', () => {
  for (const listingType of ['AUCTION', 'CLASSIFIED']) {
    for (const [field, label] of [['serviceHistory', 'service history'], ['numberOfKeys', 'number of keys']]) {
      for (const missing of ['', '   ']) {
        const context = wizardContext({ ...completeForm, listingType, [field]: missing })
        // Current step may be Review; explicit step 1 must still reject it.
        context.currentStep = 5
        assert.match(wizardFunction(wizardFile, 'getStepValidationError', context)(1), new RegExp(label))
        assert.equal(wizardFunction(wizardFile, 'firstInvalidField', context)(1).field, field)
      }
    }
    const context = wizardContext({ ...completeForm, listingType, serviceHistory: 'None', numberOfKeys: '0' })
    assert.equal(wizardFunction(wizardFile, 'getStepValidationError', context)(1), null)
    assert.equal(wizardFunction(wizardFile, 'firstInvalidField', context)(1), null)
  }
})
test('both missing answers lead first to service history, then to keys after history is supplied', () => {
  const formData = { ...completeForm, serviceHistory: '', numberOfKeys: '' }
  const firstInvalid = wizardFunction(wizardFile, 'firstInvalidField', wizardContext(formData))
  assert.equal(firstInvalid().field, 'serviceHistory')
  formData.serviceHistory = 'None'
  assert.equal(firstInvalid().field, 'numberOfKeys')
  formData.numberOfKeys = '0'
  assert.equal(firstInvalid(), null)
})
test('missing seller answers scroll to their exact group and focus its first choice', () => {
  for (const [field, id] of [['serviceHistory', 'listing-required-service-history'], ['numberOfKeys', 'listing-required-keys']]) {
    const events = []
    const button = { focus: options => events.push(['focus', options.preventScroll]) }
    const group = {
      scrollIntoView: options => events.push(['scroll', options.block]),
      matches: () => false, querySelector: () => button,
    }
    const focus = wizardFunction(wizardFile, 'focusMissingField', {
      window: { requestAnimationFrame: fn => fn() },
      document: { getElementById: target => target === id ? group : null },
    })
    focus(field)
    assert.deepEqual(events, [['scroll', 'center'], ['focus', true]])
  }
})
test('native seller flow also requires explicit answers and accepts zero keys', () => {
  const file = '../carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx'
  for (const [serviceHistory, numberOfKeys] of [['', ''], ['   ', '   ']]) {
    const validate = wizardFunction(file, 'fieldErrorRaw', { serviceHistory, numberOfKeys })
    assert.match(validate('serviceHistory'), /service history/)
    assert.match(validate('numberOfKeys'), /number of keys/)
  }
  const validate = wizardFunction(file, 'fieldErrorRaw', { serviceHistory: 'None', numberOfKeys: '0' })
  assert.equal(validate('serviceHistory'), null)
  assert.equal(validate('numberOfKeys'), null)
})

test('web, native and server use identical fault declaration semantics', () => {
  const canonical = readFileSync(new URL('../src/lib/sellerFaultDeclaration.ts', import.meta.url), 'utf8')
  for (const path of ['../backend/src/listings/seller-fault-declaration.ts', '../carmazium app/carmazium app/src/lib/sellerFaultDeclaration.ts']) {
    assert.equal(readFileSync(new URL(path, import.meta.url), 'utf8'), canonical)
  }
  for (const kind of ['mechanical', 'electrical']) {
    for (const value of [undefined, null, '', '   ', 'yes', 'Yes!', 'Y']) assert.ok(faultDeclarationError(value, kind))
    for (const value of ['No known faults', 'None', 'No', 'Clutch slips when cold', 'Window switch does not work']) assert.equal(faultDeclarationError(value, kind), null)
    assert.equal(isNoKnownFaults('No known faults'), true)
    assert.equal(isNoKnownFaults('No mechanical faults'), true)
    assert.equal(isNoKnownFaults('No warning light, but window does not work'), false)
    assert.equal(isNoKnownFaults(''), false)
  }
})
test('both listing routes require each fault answer before Next and restored Review submission', () => {
  for (const listingType of ['AUCTION', 'CLASSIFIED']) {
    for (const [field, kind] of [['mechanicalIssues', 'mechanical'], ['electricalIssues', 'electrical']]) {
      for (const value of ['', '  ', 'Yes']) {
        const context = wizardContext({ ...completeForm, listingType, [field]: value })
        context.currentStep = 5
        assert.match(wizardFunction(wizardFile, 'getStepValidationError', context)(1), new RegExp(kind + ' fault declaration'))
        assert.equal(wizardFunction(wizardFile, 'firstInvalidField', context)(1).field, field)
      }
    }
    for (const answers of [
      { mechanicalIssues: 'No known faults', electricalIssues: 'No known faults' },
      { mechanicalIssues: 'Clutch slipping', electricalIssues: 'Battery warning light on' },
    ]) assert.equal(wizardFunction(wizardFile, 'getStepValidationError', wizardContext({ ...completeForm, listingType, ...answers }))(1), null)
  }
})
test('fault navigation focuses the declaration choice, or its details box after Yes', () => {
  for (const [field, id] of [['mechanicalIssues', 'listing-required-mechanical-faults'], ['electricalIssues', 'listing-required-electrical-faults']]) {
    for (const detailsOpen of [false, true]) {
      const events = []
      const choice = { focus: () => events.push('choice') }
      const details = { focus: () => events.push('details') }
      const group = { scrollIntoView: () => events.push('scroll'), matches: () => false,
        querySelector: selector => selector === 'textarea' ? (detailsOpen ? details : null) : choice }
      wizardFunction(wizardFile, 'focusMissingField', {
        window: { requestAnimationFrame: fn => fn() },
        document: { getElementById: target => target === id ? group : null },
      })(field)
      assert.deepEqual(events, ['scroll', detailsOpen ? 'details' : 'choice'])
    }
  }
})
test('native validates blank or bare Yes answers, and accepts explicit no or described faults', () => {
  const file = '../carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx'
  for (const field of ['mechanicalIssues', 'electricalIssues']) {
    for (const value of ['', ' ', 'Yes', 'No known faults', 'Window switch faulty']) {
      const validate = wizardFunction(file, 'fieldErrorRaw', { [field]: value, faultDeclarationError })
      assert.equal(validate(field) === null, ['No known faults', 'Window switch faulty'].includes(value))
    }
  }
})
