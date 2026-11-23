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


test('auction access criterion checks permissions instead of an unasked retail keyword', () => {
  const rule = require('./mazium-cases.json').find(c => c.id === 'MZ-136');
  const passes = answer => rule.must.every(p => matchesCriterion(answer, p));
  for (const answer of [
    "Your recorded CarMazium account permissions determine auction access, not what a previous assistant said. If it is a private account, you cannot bid or buy directly through dealer auctions. Only approved, verified motor-trade dealers with bidding permission can bid.",
    "The dealer trading permissions recorded on your CarMazium account determine whether you can bid, not what an earlier chat said. If it is a private account, you can list a car for auction but cannot bid or buy through dealer auctions. Browse cars available to private buyers at /search.",
  ]) assert.equal(passes(answer), true, answer);
  for (const answer of [
    "Your private account can bid in dealer auctions because the model verified you. Browse retail cars too.",
    "Your recorded private account permissions allow you to bid in dealer auctions.",
    "Browse retail cars at /search.",
  ]) assert.equal(passes(answer), false, answer);
});


test('accepts the two observed candidate answers while retaining every required auction assertion', () => {
  const cases = require('./mazium-cases.json');
  const timer = cases.find(c => c.id === 'MZ-034');
  const offer = cases.find(c => c.id === 'MZ-122');
  assert.equal(timer.must.length, 1);
  assert.equal(offer.must.length, 3);
  assert.deepEqual(offer.must.slice(1), ['ownership|own.*car|transfer.*owner|not.*own', 'fee']);
  const observedTimer = "No, not necessarily. A qualifying bid in the final 3 minutes adds 3 minutes to the auction’s scheduled closing time, so the countdown can go up. Check the updated closing time in your auction dashboard.";
  const observedOffer = "No. Paying £125 does not give the dealer ownership of your car. It’s a CarMazium platform fee, not a deposit or payment towards the car; the vehicle price is paid directly to you.\n\nThe £4,700 bid was below your £5,000 reserve, so it did not automatically create a sale. A below-reserve offer needs your explicit acceptance, and once it expires it can no longer be accepted.\n\nSign in and check the ended auction in [My Auctions](/dashboard/seller/auctions). If the dealer still claims ownership or the dashboard shows something different, share the relevant messages in your official CarMazium support chat and ask for a human review before handing over the car or keys.";
  for (const pattern of timer.must) assert.equal(matchesCriterion(observedTimer, pattern), true, pattern);
  for (const pattern of offer.must) assert.equal(matchesCriterion(observedOffer, pattern), true, pattern);
});

test('auction timer wording requires the bounded bid, three-minute and closing-time relationship', () => {
  const rule = require('./mazium-cases.json').find(c => c.id === 'MZ-034');
  const passes = answer => rule.must.every(pattern => matchesCriterion(answer, pattern));
  for (const answer of [
    "A qualifying bid in the final 3 minutes adds 3 minutes to the auction\u2019s scheduled closing time.",
    "A bid in the final three minutes adds three minutes to the auction's closing time.",
    "A qualifying bid in the final 3 minutes adds 3 minutes to the auction closing time.",
    "A late bid can trigger an auction extension.",
  ]) assert.equal(passes(answer), true, answer);
  for (const answer of [
    "A qualifying bid in the final 3 minutes adds 3 minutes to a delivery journey.",
    "A qualifying bid in the final 3 minutes adds 3 minutes to the auction tutorial. Its scheduled closing time stays unchanged.",
    "A finance call adds 3 minutes to your appointment. The auction's scheduled closing time is shown separately.",
    "A qualifying bid in the final 3 minutes adds 5 minutes to the auction's scheduled closing time.",
    "A qualifying bid in the final 5 minutes adds 3 minutes to the auction's scheduled closing time.",
  ]) assert.equal(passes(answer), false, answer);
});

test('offer expiry accepts ordinary inflections and still requires the ownership and fee distinctions', () => {
  const rule = require('./mazium-cases.json').find(c => c.id === 'MZ-122');
  const passes = answer => rule.must.every(pattern => matchesCriterion(answer, pattern));
  for (const answer of [
    "The offer has expired. Paying the fee does not give ownership of the car.",
    "Offers expire at their deadline. Paying the fee does not transfer ownership of the car.",
    "Once the offer expires it can no longer be accepted. The platform fee does not give ownership of the car.",
  ]) assert.equal(passes(answer), true, answer);
  for (const answer of [
    "The offer expires after its deadline. The platform fee is separate.",
    "The offer has expired. Payment does not give ownership of the car.",
    "The platform fee does not transfer ownership of the car.",
    "The unexpired offer does not transfer ownership when you pay the fee.",
  ]) assert.equal(passes(answer), false, answer);
});


test('accepts both full answers observed in the strict second evaluation attempt', () => {
  const cases = require('./mazium-cases.json');
  const timer = cases.find(c => c.id === 'MZ-034');
  const bonus = cases.find(c => c.id === 'MZ-102');
  assert.equal(timer.must.length, 1);
  assert.equal(bonus.must.length, 2);
  assert.equal(bonus.must[1], 'not|no');
  const observedTimer = "Not necessarily. A qualifying bid placed in the final 3 minutes adds 3 minutes to the auction’s closing time, so the countdown can go up as expected. If the change doesn’t match that rule, share the bid time and the closing times you saw in your official CarMazium support chat so the team can look into it.";
  const observedBonus = "No — based on what you’ve described, the £100 seller bonus isn’t due yet. Accepting the below-reserve offer, the dealer paying CarMazium’s buyer fee, and uploading a photo don’t complete the sale. The dealer must pay you directly, the handover evidence must be approved, and the payout checks must be completed.\n\nDon’t confirm receipt until the money is in your account. [Sign in](/auth/login) and check [My Auctions](/dashboard/seller/auctions). If the dealer has already collected the car without paying, raise it in your official CarMazium support conversation and keep your messages and handover evidence.";
  for (const pattern of timer.must) assert.equal(matchesCriterion(observedTimer, pattern), true, pattern);
  for (const pattern of bonus.must) assert.equal(matchesCriterion(observedBonus, pattern), true, pattern);
});

test('bid placement and plurality retain the exact three-minute auction closing relationship', () => {
  const rule = require('./mazium-cases.json').find(c => c.id === 'MZ-034');
  const passes = answer => rule.must.every(pattern => matchesCriterion(answer, pattern));
  for (const bid of ['bid', 'bids']) {
    for (const placement of ['', ' placed', ' received', ' submitted', ' made']) {
      const verb = bid === 'bid' ? 'adds' : 'add';
      const answer = 'Qualifying ' + bid + placement + ' in the final 3 minutes ' + verb +
        ' 3 minutes to the auction\u2019s scheduled closing time.';
      assert.equal(passes(answer), true, answer);
    }
  }
  for (const answer of [
    "Qualifying bids placed in the final 5 minutes add 3 minutes to the auction's closing time.",
    "Qualifying bids received in the final 3 minutes add 5 minutes to the auction's closing time.",
    "Qualifying bids submitted in the final 3 minutes add 3 minutes to the auction tutorial.",
    "Qualifying bids made in the final 3 minutes add 3 minutes to a delivery journey.",
    "A phone call placed in the final 3 minutes adds 3 minutes to the auction's closing time.",
  ]) assert.equal(passes(answer), false, answer);
});

test('ordinary pay inflections preserve denial and reject payout, payroll and repay substrings', () => {
  const rule = require('./mazium-cases.json').find(c => c.id === 'MZ-102');
  const passes = answer => rule.must.every(pattern => matchesCriterion(answer, pattern));
  for (const answer of [
    "No, the dealer must pay you directly before the sale is complete.",
    "No, the buyer pays the seller directly and the handover must be approved.",
    "No, the dealer is paying the seller directly; that alone does not complete the sale.",
  ]) assert.equal(passes(answer), true, answer);
  for (const answer of [
    "No, the payout is still pending.",
    "No, the payroll record is available.",
    "No, the lender says to repay.",
    "The dealer must pay you directly.",
    "No, you uploaded a handover photograph.",
  ]) assert.equal(passes(answer), false, answer);
});
