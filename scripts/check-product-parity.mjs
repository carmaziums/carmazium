#!/usr/bin/env node

/**
 * CarMazium one-product parity guard.
 *
 * This intentionally checks the highest-risk cross-client business constants
 * and verifies that every feature marked "required" in product-parity.json
 * still has both a web and mobile implementation file.
 *
 * It is not a substitute for end-to-end tests; it is the fast CI tripwire that
 * prevents silent web/mobile drift.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const fail = (message) => {
  console.error(`PARITY ERROR: ${message}`);
  process.exitCode = 1;
};
const ok = (message) => console.log(`PARITY OK: ${message}`);
const warn = (message) => console.warn(`PARITY GAP: ${message}`);

function objectBlock(source, key) {
  const keyPattern = new RegExp(`\\b${key}\\s*(?::|=)`);
  const match = keyPattern.exec(source);
  const keyIndex = match?.index ?? -1;
  if (keyIndex < 0) throw new Error(`Could not find object key "${key}"`);
  const open = source.indexOf('{', keyIndex);
  if (open < 0) throw new Error(`Could not find opening brace for "${key}"`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`Could not find closing brace for "${key}"`);
}

function numberProp(source, key) {
  const m = source.match(new RegExp(`\\b${key}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`));
  if (!m) throw new Error(`Could not find numeric property "${key}"`);
  return Number(m[1]);
}

function boolProp(source, key) {
  const m = source.match(new RegExp(`\\b${key}\\s*:\\s*(true|false)`));
  if (!m) throw new Error(`Could not find boolean property "${key}"`);
  return m[1] === 'true';
}

function numberConst(source, key) {
  const m = source.match(new RegExp(`\\b${key}\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)`));
  if (!m) throw new Error(`Could not find numeric constant "${key}"`);
  return Number(m[1]);
}

function same(label, values) {
  const entries = Object.entries(values);
  const first = entries[0]?.[1];
  const mismatch = entries.find(([, value]) => value !== first);
  if (mismatch) {
    fail(`${label} differs: ${entries.map(([name, value]) => `${name}=${value}`).join(', ')}`);
  } else {
    ok(`${label} = ${first}`);
  }
}

const manifest = JSON.parse(read('product-parity.json'));
for (const feature of manifest.features) {
  const webMissing = (feature.web || []).filter((p) => !exists(p));
  const mobileMissing = (feature.mobile || []).filter((p) => !exists(p));

  if (feature.status === 'required') {
    if (!feature.web?.length || !feature.mobile?.length) {
      fail(`${feature.id} is required but does not declare both web and mobile surfaces`);
      continue;
    }
    if (webMissing.length || mobileMissing.length) {
      fail(`${feature.id} missing files: ${[...webMissing, ...mobileMissing].join(', ')}`);
    } else {
      ok(`${feature.id} has web + mobile surfaces`);
    }
  } else if (feature.status === 'gap') {
    warn(`${feature.id} is still missing parity`);
  }
}

// Authentication / account-role contract. The backend enum contains privileged
// roles, but only the four self-service roles may ever be selected by a public
// registration, Supabase metadata, or the self-elevation endpoint.
const accountRoles = read('backend/src/core/account-roles.ts');
const registerDto = read('backend/src/auth/dto/register.dto.ts');
const authService = read('backend/src/auth/auth.service.ts');
const mobileAuthStore = read('carmazium app/carmazium app/src/store/authStore.ts');
const mobileSignup = read('carmazium app/carmazium app/src/screens/auth/SignupScreen.tsx');
const mobileApp = read('carmazium app/carmazium app/App.tsx');

const selfServiceMatch = accountRoles.match(/SELF_SERVICE_USER_ROLES[^=]*=\s*\[([\s\S]*?)\];/);
if (!selfServiceMatch) {
  fail('Could not read canonical SELF_SERVICE_USER_ROLES');
} else {
  const roleBody = selfServiceMatch[1];
  for (const role of ['BUYER', 'SELLER', 'DEALER', 'CONTRACTOR']) {
    if (!roleBody.includes(`UserRole.${role}`)) {
      fail(`Self-service role contract is missing ${role}`);
    }
  }
  for (const role of ['ADMIN', 'FINANCE_PARTNER', 'INSURANCE_PARTNER']) {
    if (roleBody.includes(`UserRole.${role}`)) {
      fail(`Privileged role ${role} must never be self-service`);
    }
  }
  ok('Self-service account roles exclude all privileged roles');
}

if (!registerDto.includes('IsIn([...SELF_SERVICE_USER_ROLES])')) {
  fail('Direct registration is not constrained by SELF_SERVICE_USER_ROLES');
} else {
  ok('Direct registration uses the canonical self-service role allowlist');
}

if (!authService.includes('isSelfServiceUserRole(meta.role)')) {
  fail('Supabase role metadata is not constrained by the self-service role allowlist');
} else {
  ok('Supabase role metadata cannot self-grant privileged roles');
}

const mobileAccountRoleMatch = mobileAuthStore.match(/export type AccountRole\s*=([\s\S]*?);/);
if (!mobileAccountRoleMatch) {
  fail('Could not read the mobile AccountRole union');
} else {
  const mobileRoles = mobileAccountRoleMatch[1];
  for (const role of [
    'buyer',
    'seller',
    'dealer',
    'contractor',
    'finance_partner',
    'insurance_partner',
    'admin',
  ]) {
    if (!mobileRoles.includes(`'${role}'`)) {
      fail(`Mobile AccountRole is missing backend role mapping for ${role}`);
    }
  }
  ok('Mobile recognizes every backend account role without buyer fallback');
}

if (mobileAuthStore.includes('PENDING_SIGNUP_ROLE_KEY')) {
  fail('Mobile OAuth signup role must not be persisted on-device');
} else if (
  !mobileSignup.includes('auth/callback?role=${encodeURIComponent(role)}') ||
  !mobileApp.includes('reinitializeAuth(callbackRole)')
) {
  fail('Mobile OAuth signup account type is not bound to the callback URL');
} else {
  ok('Mobile OAuth signup account type is callback-scoped and non-persistent');
}

const webPricing = read('src/lib/pricingConfig.ts');
const mobilePricing = read('carmazium app/carmazium app/src/constants/pricing.ts');
const payments = read('backend/src/payments/payments.service.ts');
const boostService = read('backend/src/featured-boost/featured-boost.service.ts');
const services = read('backend/src/services/services.service.ts');

const webMarketplace = objectBlock(webPricing, 'marketplace');
const mobileMarketplace = objectBlock(mobilePricing, 'marketplace');
const webAuction = objectBlock(webMarketplace, 'auction');
const mobileAuction = objectBlock(mobileMarketplace, 'auction');
const webRetail = objectBlock(webMarketplace, 'retail');
const mobileRetail = objectBlock(mobileMarketplace, 'retail');

same('Auction seller listing fee', {
  web: numberProp(webAuction, 'sellerListingFee'),
  mobile: numberProp(mobileAuction, 'sellerListingFee'),
});
same('Auction buyer fee', {
  web: numberProp(webAuction, 'buyerFee'),
  mobile: numberProp(mobileAuction, 'buyerFee'),
  backend: numberConst(payments, 'AUCTION_BUYER_FEE'),
});
same('Auction seller reward', {
  web: numberProp(webAuction, 'sellerReward'),
  mobile: numberProp(mobileAuction, 'sellerReward'),
  backend: numberConst(payments, 'AUCTION_SELLER_BONUS'),
});
same('Auction duration hours', {
  web: numberProp(webAuction, 'durationHours'),
  mobile: numberProp(mobileAuction, 'durationHours'),
});
same('Retail seller listing fee', {
  web: numberProp(webRetail, 'sellerListingFee'),
  mobile: numberProp(mobileRetail, 'sellerListingFee'),
});
same('Retail buyer fee', {
  web: numberProp(webRetail, 'buyerFee'),
  mobile: numberProp(mobileRetail, 'buyerFee'),
});

const webListing = objectBlock(webPricing, 'listing');
const mobileListing = objectBlock(mobilePricing, 'listing');
for (const tier of ['basic', 'standard', 'premium']) {
  const webTier = objectBlock(webListing, tier);
  const mobileTier = objectBlock(mobileListing, tier);
  const backendFees = objectBlock(payments, 'LISTING_FEES');
  same(`Listing tier ${tier} price`, {
    web: numberProp(webTier, 'price'),
    mobile: numberProp(mobileTier, 'price'),
    backend: numberProp(backendFees, tier.toUpperCase()),
  });
  same(`Listing tier ${tier} HPI inclusion`, {
    web: boolProp(webTier, 'includesHpi'),
    mobile: boolProp(mobileTier, 'includesHpi'),
  });
}

const webHpi = objectBlock(webPricing, 'hpiReport');
const mobileHpi = objectBlock(mobilePricing, 'hpiReport');
same('HPI report price', {
  web: numberProp(webHpi, 'price'),
  mobile: numberProp(mobileHpi, 'price'),
  backend: numberConst(payments, 'HPI_REPORT_PRICE'),
});

const webBoost = objectBlock(webPricing, 'featuredBoost');
const mobileBoost = objectBlock(mobilePricing, 'featuredBoost');
same('Featured Boost price', {
  web: numberProp(webBoost, 'price'),
  mobile: numberProp(mobileBoost, 'price'),
  backendPayments: numberConst(payments, 'BOOST_PRICE'),
  backendBoost: numberConst(boostService, 'BOOST_AMOUNT'),
});
same('Featured Boost duration', {
  web: numberProp(webBoost, 'durationDays'),
  mobile: numberProp(mobileBoost, 'durationDays'),
  backend: numberConst(boostService, 'BOOST_DURATION_DAYS'),
});

const feeRateMatch = services.match(/feeRate\(\): number\s*\{\s*return\s+([0-9.]+)/);
if (!feeRateMatch) {
  fail('Could not read TradeXchange service fee rate from backend');
} else if (Number(feeRateMatch[1]) !== 0.09) {
  fail(`TradeXchange service fee rate changed to ${feeRateMatch[1]}; update the product contract and both clients together`);
} else {
  ok('TradeXchange service fee rate = 9% / provider share = 91%');
}

const webAuctionPricing = read('src/lib/auctionPricing.ts');
const mobileAuctionPricing = read('carmazium app/carmazium app/src/lib/auctionPricing.ts');
for (const constant of [
  'AUCTION_OPENING_BID_RATIO',
  'AUCTION_RESERVE_GUIDE_LOW_RATIO',
  'AUCTION_RESERVE_GUIDE_HIGH_RATIO',
]) {
  same(constant, {
    web: numberConst(webAuctionPricing, constant),
    mobile: numberConst(mobileAuctionPricing, constant),
  });
}

const webApi = read('src/lib/apiClient.ts');
const mobileApi = read('carmazium app/carmazium app/src/lib/apiClient.ts');
const apiUrl = /https:\/\/carmazium-[a-z0-9-]+\.fly\.dev/;
const webUrl = webApi.match(apiUrl)?.[0];
const mobileUrl = mobileApi.match(apiUrl)?.[0];
if (!webUrl || !mobileUrl) {
  fail('Could not identify fallback backend API URLs in both clients');
} else {
  same('Fallback backend API URL', { web: webUrl, mobile: mobileUrl });
}

if (process.exitCode) {
  console.error('\nOne-product parity guard failed.');
  process.exit(process.exitCode);
}

console.log('\nOne-product parity guard passed. Known gaps are listed above and tracked in product-parity.json.');
