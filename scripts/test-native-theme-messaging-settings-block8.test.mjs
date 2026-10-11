#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const get = path => readFileSync(new URL('../carmazium app/carmazium app/src/' + path, import.meta.url), 'utf8');
const source = {
  ai: get('components/GlobalAIChatBot.tsx'),
  messages: get('screens/main/MessagesScreen.tsx'),
  chat: get('screens/main/ChatScreen.tsx'),
  settings: get('screens/main/SettingsScreen.tsx'),
  preferences: get('screens/main/NotificationSettingsScreen.tsx'),
  notifications: get('screens/main/NotificationsScreen.tsx'),
};
const map = [
  ['ai', 'useMaziumThemeStyles', ['chatBox','chatHeader','chatTitle','msgAI','msgTextAI','aiConsentCard','aiConsentText','aiReportCard','aiReportDetailsInput','quickRepliesRail','chatInput','aiPrivacyFooter']],
  ['messages','useMessagesThemeStyles',['container','header','searchBar','searchInput','threadCard','dealerName','lastMessageText','offerTagRow']],
  ['chat','useChatThemeStyles',['container','header','dealerName','bubbleDealer','bubbleText','inputBar','textInput','blockingCard','blockingTitle','reportModalCard']],
  ['settings','useSettingsThemeStyles',['container','settingsPageTitle','accountToolsPanel','accountSectionCard','categoryButton','fieldInput','card','dangerCard','inputField']],
  ['preferences','useNotificationSettingsThemeStyles',['container','header','muteAllBox','cardBlock','toggleTitle','timeInput','timeText']],
  ['notifications','useNotificationsThemeStyles',['container','header','groupCard','notifRow','notifTitle','notifMessage','retryBanner']],
];

test('all Block 8 major conversations, MaziuM and Settings use semantic themes on original styles', () => {
  for (const [file, fn, keys] of map) {
    const src = source[file];
    assert.ok(src.includes('function ' + fn + '()'), file + ' theme factory');
    assert.ok(src.includes('const themed = ' + fn + '();'), file + ' uses semantic styles');
    assert.match(src, /useNativeAppearance\(\)/, file + ' subscribes to appearance');
    for (const key of keys) assert.ok(src.includes(key + ': [styles.' + key + ', { '), file + ' style.' + key);
  }
});

test('MaziuM native assistant keeps consent gate, ability to withdraw, safety report and website mascot/quick replies', () => {
  const s=source.ai;
  assert.match(s, /MAZIUM_MASCOT = require/);
  assert.match(s, /chatWidth = Math\.max\(0, Math\.min\(340, windowWidth - 24\)\)/);
  assert.match(s, /if \(!trimmed \|\| isThinking \|\| hasAiConsent !== true\) return/);
  assert.match(s, /sendAiChatMessage\(history\)/);
  assert.match(s, /onPress=\{\(\) => void acceptAiConsent\(\)\}/);
  assert.match(s, /withdrawAiConsent\(\)/);
  assert.match(s, /reportAiResponse\(\{/);
  assert.match(s, /disabled=\{isThinking \|\| hasAiConsent !== true \|\| !message\.trim\(\)\}/);
  assert.match(s, /accessibilityLabel="MaziuM AI privacy options"/);
  assert.match(s, /accessibilityLabel="Close MaziuM AI assistant"/);
  assert.match(s, /accessibilityLabel="Report AI response"/);
  assert.match(s, /accessibilityLabel=\{\`Ask MaziuM: \$\{q\.label\}\`\}/);
  assert.match(s, /palette\.bgDropdown/);
});

test('Messages inbox memoized ThreadRow changes theme while retaining room identity and unread badges', () => {
  const s=source.messages;
  assert.match(s, /React\.memo\(\(\{ room, onPress, isOnline \}\) => \{/);
  assert.match(s, /const themed = useMessagesThemeStyles\(\)/);
  assert.match(s, /themed\.threadCard/);
  assert.match(s, /themed\.lastMessageText/);
  assert.match(s, /const \{ rooms, unreadCount, markAsRead, refreshRooms, isLoading, onlineUserIds \} = useChat\(\)/);
  assert.match(s, /onPress=\{\(\) => onPress\(room\.id\)\}/);
  assert.match(s, /refreshRooms/);
});

test('chat bubble, photo upload, failed-send retry, blocking and fee are not weakened', () => {
  const s=source.chat;
  assert.match(s, /const MessageBubble: React\.FC<MessageBubbleProps> = React\.memo/);
  assert.match(s, /const themed = useChatThemeStyles\(\)/);
  assert.match(s, /isOwn && \{ color: Colors\.white \}/);
  assert.match(s, /sendChatMessage\(threadId, content, clientMessageId\)/);
  assert.match(s, /createChatAttachmentUpload\(threadId/);
  assert.match(s, /sendChatAttachment\(threadId/);
  assert.match(s, /markMessagesAsRead\(threadId\)/);
  assert.match(s, /blockChatRoom\(room\.id\)/);
  assert.match(s, /unblockChatRoom\(room\.id\)/);
  assert.match(s, /reportChatMessage\(/);
  assert.match(s, /const shouldBlockChat = isAuction && isWinner && !depositPaid/);
  assert.match(s, /£125 Buyer Fee Due/);
  assert.match(s, /!shouldBlockChat && !room\.chatBlocked && \(/);
  assert.match(s, /onPress=\{handlePayDeposit\}/);
});

test('one Settings page retains dealer staff ownership boundaries, appearance disclosure and secure account flows', () => {
  const s=source.settings;
  assert.match(s, /const canManageBusiness = isDealerAccount && !isDealerStaff/);
  assert.match(s, /if \(!canManageBusiness && activeCategory === 'business'\)/);
  assert.match(s, /activeCategory === 'appearance'/);
  assert.match(s, /A live light\/dark switch is not yet supported by the native theme engine/);
  assert.doesNotMatch(s, /setAppearancePreference\(/);
  assert.match(s, /onPress=\{handleSaveProfile\}/);
  assert.match(s, /onPress=\{handleSaveBank\}/);
  assert.match(s, /onPress=\{handleConnectStripe\}/);
  assert.match(s, /onPress=\{handleSendVerificationCode\}/);
  assert.match(s, /accountRole/);
});

test('notification settings retain server persistence and selectable real quiet hours', () => {
  const s=source.preferences;
  assert.match(s, /apiClient\('\/users\/me', \{/);
  assert.match(s, /preferences: \{ notifications: nextNotifications \}/);
  assert.match(s, /const cycleTime = \(current: string\)/);
  assert.match(s, /setQuietStart\(cycleTime\(quietStart\)\)/);
  assert.match(s, /setQuietEnd\(cycleTime\(quietEnd\)\)/);
  assert.match(s, /onPress=\{savePreferences\} disabled=\{saving\}/);
  assert.match(s, /trackColor=\{\{ false: palette\.borderDefault, true: activeColor \}\}/);
});

test('notifications still mark real IDs read and navigate through role-aware routing', () => {
  const s=source.notifications;
  assert.match(s, /markNotificationRead\(n\.id\)/);
  assert.match(s, /markAllRead\(\)/);
  assert.match(s, /resolveMobileNotificationTarget\(n, accountRole\)/);
  assert.match(s, /useNotificationsThemeStyles\(\)/);
  assert.match(s, /themed\.notifRow/);
});

test('no release, APK publication or active theme picker introduced in UI block', () => {
  for (const src of Object.values(source)) {
    assert.doesNotMatch(src, /NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED/);
  }
});
