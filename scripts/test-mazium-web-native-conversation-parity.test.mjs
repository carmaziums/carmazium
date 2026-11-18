#!/usr/bin/env node
/** Fail-closed source parity contract for the SAME Mazium conversation on web, iOS and Android. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const web = read('src/components/features/MaziumWidget.tsx');
const native = read('carmazium app/carmazium app/src/components/GlobalAIChatBot.tsx');

function replies(source) {
  const match = source.match(/const ALL_QUICK_REPLIES(?:: QuickReply\[\])?\s*=\s*\[([\s\S]*?)\]\s*;?/);
  assert.ok(match, 'quick-reply pool must exist');
  return [...match[1].matchAll(/\{\s*label:\s*['"]([^'"]+)['"]\s*,\s*action:\s*['"]([^'"]+)['"]\s*\}/g)]
    .map(([, label, action]) => ({ label, action }));
}

test('native and website offer identical rotating car-shopping prompts in the same order', () => {
  const expected = replies(web);
  assert.equal(expected.length, 12);
  assert.deepEqual(replies(native), expected);
  assert.ok(expected.some(r => r.label === 'ULEZ'));
  assert.match(web, /Math\.floor\(Date\.now\(\) \/ 86400000\)/);
  assert.match(native, /Math\.floor\(Date\.now\(\) \/ 86_400_000\)/);
  assert.match(web, /dayIndex \* 4/);
  assert.match(native, /dayIndex \* 4/);
});

test('same welcome, assistant title, subtitle and message placeholder', () => {
  const welcome = "Hi, I'm MaziuM. Ask me about buying, selling, auctions or using CarMazium.";
  assert.ok(web.includes(welcome));
  assert.ok(native.includes(welcome));
  assert.match(web, />MaziuM AI<\/h3>/);
  assert.match(native, />MaziuM AI<\/Text>/);
  assert.match(web, /CarMazium assistant/);
  assert.match(native, /CarMazium assistant/);
  assert.match(web, /placeholder="Ask MaziuM about CarMazium\.\.\."/);
  assert.match(native, /placeholder="Ask MaziuM about CarMazium\.\.\."/);
});

test('native follows website chat layout, status indicator and context-aware quick-reply rail', () => {
  assert.match(native, /<LinearGradient colors=\{\[Colors\.bgBody, Colors\.bgElevated\]\}/);
  assert.match(native, /botAccentDot:[\s\S]*?backgroundColor: Colors\.success/);
  assert.match(native, /Math\.min\(540, maxBoxHeight\)/);
  assert.match(native, /Math\.min\(340, windowWidth - 24\)/);
  assert.match(native, /<ScrollView horizontal\s+(?:style=\{Layout\.hScroll\}\s+)?showsHorizontalScrollIndicator=\{false\}/);
  assert.match(native, /quickReplies\.map\(\(q\) =>/);
  assert.match(native, /disabled=\{isThinking \|\| hasAiConsent !== true\}/);
  assert.ok(native.indexOf('Website-equivalent search suggestions only for car search') >
    native.indexOf('{chatHistory.map((msg) => ('));
  assert.match(web, /showSearchShortcuts && <div/);
  assert.match(native, /showSearchShortcuts && <View/);
  assert.match(web, /auctions\?\|bids\?\|bidding/);
  assert.match(native, /auctions\?\|bids\?\|bidding/);
  assert.doesNotMatch(native, /chatHistory\.length === 1 && !isThinking/);
  assert.match(web, /quickReplies\.map\(\(chip\) =>/);
});

test('both platforms require explicit AI consent and expose accessible withdrawal/privacy controls', () => {
  assert.match(web, /hasAiConsent !== true/);
  assert.match(native, /hasAiConsent !== true/);
  assert.match(web, /Stop AI sharing/);
  assert.match(native, /accessibilityLabel="Stop AI sharing"/);
  assert.match(native, /accessibilityLabel="AI privacy"/);
  assert.match(native, /AsyncStorage\.removeItem\(aiConsentKey\)/);
  assert.match(web, /localStorage\.removeItem\("mazium_ai_consent_v1"\)/);
  assert.match(native, /hasAiConsent === true && \(\s*<View style=\{styles\.aiPrivacyFooter\}>/);
});

test('both send exactly one user prompt per request with bounded 10-message history', () => {
  assert.match(web, /const history = currentMessages\.slice\(-10\)/);
  assert.doesNotMatch(web, /history = \[\.\.\.currentMessages, \{ role: "user"/);
  assert.match(native, /const updated = \[\.\.\.chatHistory, userItem\];/);
  assert.match(native, /const history: AiChatMessage\[\] = updated\.slice\(-10\)/);
  assert.match(web, /await aiChat\(history\)/);
  assert.match(native, /await sendAiChatMessage\(history\)/);
});

test('native isolates chat history and pending response on account changes without bypassing API auth', () => {
  assert.match(native, /setChatHistory\(\[\s*\{ id: '1'/);
  assert.match(native, /\}, \[authUserId\]\)/);
  assert.match(native, /let cancelled = false;/);
  assert.match(native, /return \(\) => \{ cancelled = true; \};/);
  assert.match(native, /const senderId = authUserId;/);
  assert.match(native, /if \(sameConsentSession\(\)\) setChatHistory/);
  assert.match(native, /if \(!isAuthenticated \|\| activeRoute === 'LiveAuctionDetailed'\) return null;/);
});
