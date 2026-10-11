#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = '../carmazium app/carmazium app/src/';
const read = path => readFileSync(new URL(root + path, import.meta.url), 'utf8');
const ai = read('components/GlobalAIChatBot.tsx');
const messages = read('screens/main/MessagesScreen.tsx');
const chat = read('screens/main/ChatScreen.tsx');
const settings = read('screens/main/SettingsScreen.tsx');
const preferences = read('screens/main/NotificationSettingsScreen.tsx');
const notifications = read('screens/main/NotificationsScreen.tsx');

function themeContract(source, hook, keys) {
  assert.ok(source.includes('function ' + hook + '()'), hook);
  assert.match(source, /useNativeAppearance\(\)/);
  for (const key of keys) {
    assert.ok(source.includes(key + ': [styles.' + key + ', { '), hook + '.' + key);
  }
  assert.doesNotMatch(source, /Object\.assign\(Colors|Colors\.[a-zA-Z]+\s*=/);
}

test('MaziuM assistant has theme-aware web-consistent panel, privacy and consent-gated sending', () => {
  themeContract(ai, 'useMaziumThemeStyles', ['chatBox','chatHeader','chatTitle','chatStatus','msgAI','msgTextAI',
    'aiConsentCard','aiConsentText','aiReportCard','aiReportDetailsInput','quickRepliesRail','chatInput','greetingBubble']);
  assert.match(ai, /colors=\{\[palette\.bgHeader, palette\.bgDropdown\]\}/);
  assert.match(ai, /sendAiChatMessage\(history\)/);
  assert.match(ai, /hasAiConsent === false/);
  assert.match(ai, /hasAiConsent === true/);
  assert.match(ai, /acceptAiConsent\(\)/);
  assert.match(ai, /withdrawAiConsent\(\)/);
  assert.match(ai, /reportAiResponse\(/);
  assert.match(ai, /disabled=\{isThinking \|\| hasAiConsent !== true \|\| !message\.trim\(\)\}/);
  assert.match(ai, /source=\{MAZIUM_MASCOT\}/);
  assert.match(ai, /accessibilityLabel="MaziuM AI privacy options"/);
});

test('memoised inbox thread cards update palettes without changing unread or threading', () => {
  themeContract(messages,'useMessagesThemeStyles',['container','header','searchInput','tabPill',
    'threadCard','dealerName','carModelText','lastMessageText','unreadTag','offerTagText']);
  assert.match(messages, /React\.memo\(\(\{ room, onPress, isOnline \}\) => \{/);
  assert.match(messages, /const themed = useMessagesThemeStyles\(\)/);
  assert.match(messages, /themed\.threadCard,\s*styles\.threadCardSpacing/);
  assert.match(messages, /room\.unreadCount > 0/);
  assert.match(messages, /handleThreadPress/);
  assert.match(messages, /<FlatList/);
  assert.match(messages, /barStyle=\{resolvedAppearance === 'dark'/);
});

test('chat offer and fee notices, safe reporting and own white-on-red bubble remain functional', () => {
  themeContract(chat,'useChatThemeStyles',['container','header','dealerName','bubbleDealer','bubbleText',
    'offerMessageBubble','counterMessageCard','blockingCard','blockingTitle','inputBar','textInput','reportModalCard']);
  assert.match(chat, /React\.memo\(\(\{/);
  assert.match(chat, /isOwn \? styles\.bubbleUser : themed\.bubbleDealer/);
  assert.match(chat, /isOwn && \{ color: Colors\.white \}/);
  assert.match(chat, /£125 Buyer Fee Due/);
  assert.match(chat, /sendChatMessage\(threadId, content, clientMessageId\)/);
  assert.match(chat, /reportChatMessage\(/);
  assert.match(chat, /blockChatRoom\(/);
  assert.match(chat, /unblockChatRoom\(/);
  assert.match(chat, /disabled=\{!inputVal\.trim\(\) \|\| uploadingPhoto\}/);
  assert.match(chat, /onPress=\{handleBlockToggle\}/);
});

test('central account settings themes each category but preserves bank, security and access gates', () => {
  themeContract(settings,'useSettingsThemeStyles',['container','settingsPageTitle','accountToolsPanel',
    'accountToolButton','card','categoryButton','fieldLabel','fieldInput','dangerCard','payoutDesc',
    'inputField','notificationShortcut','sectionLabel','verifyModalBody']);
  assert.match(settings, /const canManageBusiness = isDealerAccount && !isDealerStaff/);
  assert.match(settings, /onPress=\{handleSaveProfile\}/);
  assert.match(settings, /onPress=\{handleSaveDealerProfile\}/);
  assert.match(settings, /onPress=\{handleSaveBank\}/);
  assert.match(settings, /onPress=\{handleDeleteAccount\}/);
  assert.match(settings, /A live light\/dark switch is not yet supported by the native theme engine/);
  assert.doesNotMatch(settings, /setAppearancePreference\(/);
  assert.match(settings, /navigation\.navigate\('Messages'\)/);
});

test('notification settings quiet hours/toggles remain server-backed while matching native palettes', () => {
  themeContract(preferences,'useNotificationSettingsThemeStyles',['container','header','muteAllBox',
    'muteTitle','cardBlock','toggleTitle','deliveryBtn','timeInput','timeText','sectionTitle']);
  assert.match(preferences, /apiClient\('\/users\/me', \{/);
  assert.match(preferences, /preferences: \{ notifications: nextNotifications \}/);
  assert.match(preferences, /setQuietStart\(cycleTime\(quietStart\)\)/);
  assert.match(preferences, /setQuietEnd\(cycleTime\(quietEnd\)\)/);
  assert.match(preferences, /trackColor=\{\{ false: palette\.borderDefault, true: activeColor \}\}/);
  assert.match(preferences, /disabled=\{saving\}/);
});

test('notification list retains real read state and correct theme dependency', () => {
  themeContract(notifications,'useNotificationsThemeStyles',['container','groupCard','notifRow',
    'notifTitle','notifTime','notifMessage','retryButton','headerTitle']);
  assert.match(notifications, /markNotificationRead\(/);
  assert.match(notifications, /markAllRead\(/);
  assert.match(notifications, /const renderRow = useCallback/);
  assert.match(notifications, /\}, \[handleTap, themed\]\)/);
  assert.match(notifications, /colors=\{\[Colors\.accentAlpha04, 'rgba\(0,0,0,0\)', palette\.bgBody\]\}/);
  assert.match(notifications, /onPress=\{handleMarkAll\}/);
});
