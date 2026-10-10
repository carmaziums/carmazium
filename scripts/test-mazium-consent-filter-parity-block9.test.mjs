#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const native = read('carmazium app/carmazium app/src/components/GlobalAIChatBot.tsx');
const web = read('src/components/features/MaziumWidget.tsx');
const search = read('carmazium app/carmazium app/src/screens/main/SearchScreen.tsx');
const navigator = read('carmazium app/carmazium app/src/navigation/MainStackNavigator.tsx');
const tabs = read('carmazium app/carmazium app/src/navigation/TabNavigator.tsx');

test('native AI replies cannot commit after user revokes consent or changes account', () => {
  assert.match(native, /const aiConsentEpoch = useRef\(0\)/);
  assert.match(native, /aiConsentEpoch\.current \+= 1;\s*setHasAiConsent\(null\)/);
  assert.match(native, /const consentEpoch = aiConsentEpoch\.current/);
  assert.match(native, /const sameConsentSession = \(\) =>[\s\S]*?isAuthenticated &&[\s\S]*?user\?\.id === senderId &&[\s\S]*?aiConsentEpoch\.current === consentEpoch/);
  assert.match(native, /if \(sameConsentSession\(\)\) setChatHistory/);
  assert.match(native, /if \(sameConsentSession\(\)\) setIsThinking\(false\)/);
  assert.match(native, /const epoch = \+\+aiConsentEpoch\.current;\s*const withdrawingUser = authUserId;\s*setHasAiConsent\(false\);\s*setIsThinking\(false\)/);
  assert.match(native, /AsyncStorage\.removeItem\(aiConsentKey\)/);
  assert.match(native, /Privacy preference not saved/);
  assert.doesNotMatch(native, /sameSignedInUser/);
});

test('native consent reads and late accept calls are invalidated by account change or withdrawal', () => {
  assert.match(native, /const epoch = aiConsentEpoch\.current;\s*AsyncStorage\.getItem\(aiConsentKey\)/);
  assert.match(native, /if \(!cancelled && epoch === aiConsentEpoch\.current\)/);
  assert.match(native, /const epoch = \+\+aiConsentEpoch\.current;\s*const consentingUser = authUserId/);
  assert.match(native, /epoch === aiConsentEpoch\.current && useAuthStore\.getState\(\)\.user\?\.id === consentingUser/);
  assert.match(native, /aiConsentKey = authUserId \? \`mazium_ai_consent_v1:\$\{authUserId\}\`/);
});

test('website also suppresses old AI results after consent withdrawal', () => {
  assert.match(web, /const aiConsentEpochRef = React\.useRef\(0\)/);
  assert.match(web, /const sendEpoch = aiConsentEpochRef\.current/);
  assert.match(web, /const canShowReply = \(\) => aiConsentEpochRef\.current === sendEpoch &&/);
  assert.match(web, /localStorage\.getItem\("mazium_ai_consent_v1"\) === "accepted"/);
  assert.match(web, /if \(canShowReply\(\)\) setMessages/);
  assert.match(web, /aiConsentEpochRef\.current \+= 1\s*localStorage\.removeItem\("mazium_ai_consent_v1"\)/);
  assert.match(web, /if \(canShowReply\(\)\) setIsThinking\(false\)/);
  assert.doesNotMatch(web, /await aiChat\(\[\]\)/);
});

test('native Mazium filter card routes through real nested Search tab and preserves all supported AI fields', () => {
  assert.match(navigator, /Tabs: NavigatorScreenParams<TabParamList>/);
  assert.match(tabs, /<Tab\.Screen name="Search" component=\{SearchScreen\}/);
  assert.match(native, /const aiFilters = Object\.fromEntries\(/);
  assert.match(native, /Object\.entries\(params\)\.filter/);
  assert.match(native, /navigateFromChat\('Search', \{ aiFilters \}\)/);
  assert.match(native, /screen: 'Tabs',\s*params: \{ screen: 'Search', params: \{ \.\.\.navParams, _t: Date\.now\(\) \} \}/);
  assert.doesNotMatch(native, /CommonActions\.navigate\(\{ name: 'Search'/);
  for (const field of ['make', 'model', 'bodyType', 'fuelType', 'transmission',
    'color', 'maxPrice', 'minPrice', 'minYear', 'maxYear', 'minDoors', 'minSeats']) {
    assert.match(search, new RegExp('if \\(f\\.' + field + '\\)'), field);
  }
});

test('Search screen does not clear accepted AI model, price, year and transmission filters immediately', () => {
  assert.match(search, /if \(!p\.make && !p\.aiFilters\?\.make\) setSelectedMakes\(\[\]\)/);
  assert.match(search, /if \(!p\.aiFilters\?\.minPrice\) setMinPrice\(0\)/);
  assert.match(search, /if \(!p\.maxPrice && !p\.aiFilters\?\.maxPrice\) setMaxPrice\(150000\)/);
  assert.match(search, /if \(!p\.aiFilters\?\.minYear\) setMinYear\('Any'\)/);
  assert.match(search, /if \(!p\.aiFilters\?\.transmission\) setTransmissions\(\[\]\)/);
  assert.match(search, /if \(p\.aiFilters\) \{/);
});

test('screen reader navigation and privacy actions retain sensible target size', () => {
  assert.match(native, /<Text style=\{styles\.chatTitle\} accessibilityRole="header">Mazium AI/);
  assert.match(native, /accessibilityState=\{\{ disabled: isThinking \|\| hasAiConsent !== true \}\}/);
  assert.match(native, /keyboardShouldPersistTaps="handled"/);
  assert.match(native, /aiPrivacyFooterAction: \{ minHeight: 44/);
  assert.match(native, /accessibilityLabel="AI privacy"/);
  assert.match(native, /accessibilityLabel="Stop AI sharing"/);
});
