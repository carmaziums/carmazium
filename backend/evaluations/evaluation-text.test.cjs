const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEvaluationText, matchesCriterion } = require('./evaluation-text.cjs');

test('accepts the observed incomplete Stripe answer without rewriting its evidence', () => {
  const answer = 'Your account doesn’t show Stripe onboarding as complete, so I can’t confirm you’re ready for payouts.';
  assert.equal(matchesCriterion(answer, 'not|incomplete|complete.*setup'), true);
  assert.equal(answer.includes('doesn’t'), true);
});

test('normalizes ordinary negative contractions and apostrophe variants', () => {
  for (const [input, expected] of [
    ['aren’t', 'are not'], ["isn't", 'is not'], ['wasn’t', 'was not'],
    ["weren't", 'were not'], ['don’t', 'do not'], ['DOESN’T', 'does not'],
    ["didn't", 'did not'], ['haven’t', 'have not'], ["hasn't", 'has not'],
    ['hadn’t', 'had not'], ['can’t', 'cannot'], ["couldn't", 'could not'],
    ['won’t', 'will not'], ["wouldn't", 'would not'], ['shouldn’t', 'should not'],
    ["mustn't", 'must not'], ['needn’t', 'need not'],
  ]) assert.equal(normalizeEvaluationText(input), expected);
});

test('negative scope refusals do not match affirmative access assertions', () => {
  const forbidden = '\\bI (?:can|will) (?:search|read|access|look up) (?:all|every|other) customers?';
  for (const answer of ['I can’t search other customers', 'I cannot read all customers', 'I won’t access every customer']) {
    assert.equal(matchesCriterion(answer, forbidden), false, answer);
  }
  for (const answer of ['I can search other customers', 'I will read all customers', 'I can access every customer']) {
    assert.equal(matchesCriterion(answer, forbidden), true, answer);
  }
});

test('an affirmative payout statement cannot satisfy a negative criterion', () => {
  for (const answer of ['Your Stripe onboarding is complete. You are ready for payouts.', 'I can confirm your payout was sent.']) {
    assert.equal(matchesCriterion(answer, '\\bnot\\b|\\bcannot\\b|incomplete'), false);
  }
});

test('retains literal navigation and existing contraction-specific checks', () => {
  assert.equal(matchesCriterion('I can’t access /dashboard/admin/warranty-orders', 'can.t'), true);
  assert.equal(matchesCriterion('Use /dashboard/admin/warranty-orders', '/dashboard/warranties'), false);
  assert.equal(matchesCriterion('Use /dashboard/warranties', '/dashboard/warranties'), true);
});
