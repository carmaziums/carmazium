import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url));
const webAsset = read('public/assets/images/mazium-bot-3d.png');
const nativeAsset = read('carmazium app/carmazium app/assets/images/mazium-bot-3d.png');
const native = read('carmazium app/carmazium app/src/components/GlobalAIChatBot.tsx').toString('utf8');
const web = read('src/components/features/MaziumWidget.tsx').toString('utf8');

test('Android and iOS bundle the precise website mascot bytes and 128px source image', () => {
  assert.deepEqual(nativeAsset, webAsset, 'native and website PNGs must be identical');
  assert.equal(webAsset.subarray(1, 4).toString(), 'PNG');
  assert.equal(nativeAsset.readUInt32BE(16), 128);
  assert.equal(nativeAsset.readUInt32BE(20), 128);
});

test('native trigger and chat header both use the same bundled mascot as the website', () => {
  assert.match(web, /src="\/assets\/images\/mazium-bot-3d\.png"/);
  assert.match(native, /const MAZIUM_MASCOT = require\('\.\.\/\.\.\/assets\/images\/mazium-bot-3d\.png'\)/);
  assert.match(native, /<Image source=\{MAZIUM_MASCOT\} style=\{styles\.chatAvatarImage\} contentFit="contain"/);
  assert.match(native, /source=\{MAZIUM_MASCOT\}[\s\S]*?style=\{styles\.botImage\}/);
  assert.doesNotMatch(native, /images\.unsplash\.com|mockFace|mockSmileRow|botButtonInactive/);
});

test('floating native avatar has full opacity, no artificial circular surround and accessible controls', () => {
  const botStyle = native.slice(native.indexOf('  botButton: {'), native.indexOf('  botImage: {'));
  assert.match(botStyle, /backgroundColor: 'transparent'/);
  assert.match(botStyle, /borderWidth: 0/);
  assert.doesNotMatch(botStyle, /opacity:|borderRadius:|backgroundColor: Colors\.black/);
  assert.match(native, /accessibilityLabel="Open MaziuM AI assistant"/);
  assert.match(native, /accessibilityLabel="Close MaziuM AI assistant"/);
});

test('native floating button clears tabs; chat sizes to viewport, safe area and keyboard', () => {
  // 16dp tab padding + scaled item height + actual safe-area inset, exactly once.
  assert.match(native, /floatingBottom = getBottomTabBarHeight\(fontScale, insets\.bottom\) \+ 12/);
  assert.doesNotMatch(native, /MAZIUM_TAB_CLEARANCE|Math\.max\(insets\.bottom, 16\) \+ tabClearance/);
  assert.match(native, /const assistantBlocked = isDrawerOpen/);
  assert.match(native, /MAZIUM_PROTECTED_ROUTES\.has\(activeRoute\)/);
  assert.match(native, /visible=\{isOpen && !assistantBlocked\}/);
  assert.match(native, /const launcherSuppressed = assistantBlocked \|\| isKeyboardVisible/);
  assert.match(native, /chatBottom = floatingBottom \+ MAZIUM_TRIGGER_SIZE \+ MAZIUM_CHAT_GAP/);
  assert.match(native, /chatWidth = Math\.max\(0, Math\.min\(340, windowWidth - 24\)\)/);
  assert.match(native, /dynamicBottom = isKeyboardVisible \? keyboardHeight \+ 8 : chatBottom/);
  assert.match(native, /activeRoute === 'LiveAuctionDetailed'/);
});
