#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const native = readFileSync(resolve(root, 'carmazium app/carmazium app/src/screens/main/NotificationSettingsScreen.tsx'), 'utf8');
const backend = readFileSync(resolve(root, 'backend/src/users/users.service.ts'), 'utf8');
const pushService = readFileSync(resolve(root, 'backend/src/notifications/notifications.service.ts'), 'utf8');

test('native notification choices only render after a verified preferences read', () => {
  assert.match(native, /res\?\.success !== true \|\| !res\?\.data/);
  assert.match(native, /setLoadError\('Could not load your saved notification settings/);
  assert.match(native, /loadError \? \(/);
  assert.match(native, /<ErrorBanner message=\{loadError\} onRetry=/);
  assert.match(native, /if \(loading \|\| loadError \|\| saving\) return;/);
});

test('saving notifications preserves all previously saved unknown keys', () => {
  assert.match(backend, /\.\.\.data\.preferences/); // the user preference top-level PATCH uses shallow merge
  assert.match(native, /setSavedNotifications\(saved \?\? \{\}\)/);
  assert.match(native, /const nextNotifications = \{\s*\.\.\.savedNotifications,/);
  assert.match(native, /notifications: nextNotifications/);
  assert.doesNotMatch(native, /sms: false/);
});

test('do not offer digest timing without a scheduler in the backend', () => {
  assert.doesNotMatch(native, /setFreq\(/);
  assert.doesNotMatch(native, /setFreq\('daily'\)/);
  assert.doesNotMatch(native, /setFreq\('30min'\)/);
  assert.match(native, /30-minute and daily digests are not available yet/);
  assert.doesNotMatch(pushService, /notifPrefs\.freq/);
});

test('copy must be correct on both Android and iOS', () => {
  assert.match(native, /Android and iPhone notifications/);
  assert.doesNotMatch(native, />iPhone notifications<\/Text>/);
  assert.match(native, /<Text style=\{themed\.toggleSub\}>Coming soon<\/Text>/); // SMS disabled
});
