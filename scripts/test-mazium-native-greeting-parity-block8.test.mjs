#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const web = read('src/components/features/MaziumWidget.tsx');
const native = read('carmazium app/carmazium app/src/components/GlobalAIChatBot.tsx');

test('native greeting uses the real website mascot, copy, green status and speech arrow', () => {
  assert.match(web, /Hi, I&apos;m Mazium!/);
  assert.match(web, /How can I help you today\?/);
  assert.match(native, /Hi, I'm Mazium! 👋/);
  assert.match(native, /How can I help you today\?/);
  assert.match(native, /<Image source=\{MAZIUM_MASCOT\} style=\{styles\.greetingAvatarImage\}/);
  assert.match(native, /greetingOnlineDot:[\s\S]*?backgroundColor: Colors\.success/);
  assert.match(native, /greetingArrow:[\s\S]*?rotate: '45deg'/);
  assert.match(native, /width: Math\.min\(260, windowWidth - 32\)/);
  assert.match(native, /bottom: MAZIUM_TRIGGER_SIZE \+ 16/);
});

test('native 20-second cadence is fully suspended after per-account permanent dismissal', () => {
  assert.match(web, /setInterval\(\(\) => \{/);
  assert.match(web, /}, 20000\)/);
  assert.match(native, /MAZIUM_GREETING_INTERVAL_MS = 20_000/);
  assert.match(native, /setInterval\(\(\) => setShowGreeting\(\(visible\) => !visible\), MAZIUM_GREETING_INTERVAL_MS\)/);
  assert.match(native, /return \(\) => clearInterval\(timer\)/);
  assert.match(native, /MAZIUM_GREETING_STORAGE_PREFIX \+ authUserId/);
  assert.match(native, /AsyncStorage\.getItem\(greetingStorageKey\)/);
  assert.match(native, /AsyncStorage\.setItem\(greetingStorageKey, 'true'\)/);
  assert.match(native, /greetingState\.dismissed === false/);
  assert.match(native, /setGreetingState\(\{ userId: authUserId, dismissed: true \}\)/);
  assert.match(native, /let cancelled = false;/);
  assert.match(native, /if \(!cancelled\) setGreetingState/);
});

test('greeting does not appear while chatting, in sensitive auction view, while keyboard visible or in background', () => {
  assert.match(native, /AppState\.addEventListener\('change'/);
  assert.match(native, /setIsForeground\(state === 'active'\)/);
  assert.match(native, /isAuthenticated && Boolean\(authUserId\) && isForeground/);
  assert.match(native, /greetingState\?\.userId === authUserId && showGreeting/);
  assert.match(native, /!isOpen && \(/);
  assert.match(native, /isForeground && !isKeyboardVisible && activeRoute !== 'LiveAuctionDetailed'/);
  assert.match(native, /onPress=\{\(\) => \{ setIsOpen\(true\); setShowGreeting\(false\); \}\}/);
  assert.match(native, /accessibilityLabel="Permanently dismiss Mazium greeting"/);
});

test('reduced motion preference disables native greeting animation but keeps content accessible', () => {
  assert.match(native, /const reduceGreetingMotion = useReduceMotionPreference\(\)/);
  assert.match(native, /if \(reduceGreetingMotion\)/);
  assert.match(native, /Animated\.parallel\(\[/);
  assert.match(native, /useNativeDriver: true/);
  assert.match(native, /<Animated\.View[\s\S]*?accessibilityLabel="Mazium greeting/);
  assert.match(native, /return \(\) => entrance\.stop\(\)/);
});

test('greeting never sends an AI request or bypasses mandatory consent', () => {
  const pos = native.indexOf('  const dismissGreeting = () => {');
  const end = native.indexOf('  const [message, setMessage]', pos);
  assert.ok(pos > 0);
  // The greeting effect and dismissal are presentation-only and storage-only.
  assert.doesNotMatch(native.slice(pos, end > pos ? end : pos + 500), /sendAiChatMessage|aiConsentAcknowledged/);
  assert.match(native, /if \(!trimmed \|\| isThinking \|\| hasAiConsent !== true\) return;/);
  assert.match(native, /accessibilityLabel="Open MaziuM AI assistant"/);
});
