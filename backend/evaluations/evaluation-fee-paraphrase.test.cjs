const { test } = require('node:test');
const assert = require('node:assert/strict');
const cases = require('./mazium-cases.json');
const { matchesCriterion } = require('./evaluation-text.cjs');

const basic = cases.find(c => c.id === 'MZ-024');
test('Basic Retail £1 one-off fee evaluator accepts equivalent paid-once wording', () => {
  assert.ok(basic && Array.isArray(basic.must));
  for (const response of [
    'Basic is £1 one-off until sold, with no monthly charges.',
    'The Basic advert costs £1 once and stays live until sold. There is no monthly subscription.',
    'You pay once: £1 for Basic until your vehicle sells, with no monthly fee.',
  ]) {
    assert.deepEqual(basic.must.filter(pattern => !matchesCriterion(response, pattern)), [], response);
  }
});

test('Basic Retail fee evaluator still rejects recurring-payment claims', () => {
  for (const response of [
    'Basic is £1 every month until sold.',
    '£1 monthly. One-off payments are not available until sold.',
    'The price is £1 once but there are also monthly charges until sold.',
  ]) {
    assert.ok(basic.must.some(pattern => !matchesCriterion(response, pattern)), response);
  }
});
