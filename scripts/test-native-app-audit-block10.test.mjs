#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const text = (p) => readFileSync(resolve(root, p), 'utf8');
const native = text('carmazium app/carmazium app/src/screens/onboarding/OnboardingScreen.tsx');
const home = text('src/app/HomeClient.tsx');

test('Welcome screen communicates the same pricing as the website', () => {
  assert.ok(home.includes('Auction <span className="text-primary">FREE</span>'));
  assert.ok(home.includes('Retail for <span className="text-primary">£1</span>'));
  assert.ok(home.includes('Successful auction'));
  assert.ok(native.includes('FREE dealer auction'));
  assert.ok(native.includes('£1 retail'));
  assert.ok(native.includes('approved handover'));
  assert.ok(native.includes('£100 seller reward'));
  assert.ok(native.includes("headlineLight: 'Sell your car'"));
  assert.ok(native.includes("headlineRed: 'your way.'"));
  assert.ok(!native.includes("Britain's most"));
  assert.ok(!native.includes('confidence the showroom forgot'));
});

test('Assistant onboarding never promises unsupported finance results or a non-existent Try It action', () => {
  assert.ok(native.includes('Ask MaziuM AI to help find listings'));
  assert.ok(native.includes("buttonLabel: 'NEXT'"));
  assert.ok(!native.includes('matching cars, finance, the lot'));
  assert.ok(!native.includes("buttonLabel: 'TRY IT'"));
});

test('Auction onboarding informs ordinary buyers of trader-only auction bidding and £125 winner fee', () => {
  assert.ok(native.includes('Only verified motor traders can bid in auctions.'));
  assert.ok(native.includes('Winning dealer fee: £125.'));
  assert.ok(native.includes('Retail buyers pay no platform fee.'));
  assert.ok(!native.includes('Sub-second updates'));
  assert.ok(!native.includes('proxy bidding'));
  assert.ok(native.includes("buttonLabel: 'SIGN IN'"));
});

test('Carousel, skip, and sign-in flow are preserved', () => {
  assert.ok(native.includes("image: require('../../../assets/images/onboarding_car1.png')"));
  assert.ok(native.includes("image: require('../../../assets/images/onboarding_car2.png')"));
  assert.ok(native.includes("image: require('../../../assets/images/onboarding_car3.png')"));
  assert.ok(native.includes("navigation.navigate('Login')"));
  assert.ok(native.includes("completeIntro();"));
  assert.ok(native.includes("onMomentumScrollEnd={handleMomentumScrollEnd}"));
});
