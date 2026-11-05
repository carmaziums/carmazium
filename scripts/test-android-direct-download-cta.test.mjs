import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/app/download-app/page.tsx', import.meta.url), 'utf8');
const links = readFileSync(new URL('../src/lib/mobileAppDownloads.ts', import.meta.url), 'utf8');

test('approved first-party APK is preferred to optional app-store destination', () => {
  assert.match(page, /const androidHref = links\.androidApk\.href \?\? links\.android\.href/);
  assert.match(page, /<FaAndroid className="h-7 w-7 shrink-0/);
});

test('Android APK download remains gated by owner approval, release checksum and first-party HTTPS URL', () => {
  assert.match(links, /NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED/);
  assert.match(links, /NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256/);
  assert.match(links, /NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL/);
  assert.match(links, /\["carmazium\.com", "www\.carmazium\.com"\]/);
  // The button only renders once the gated link resolves (approval + checksum + URL).
  assert.match(page, /links\.androidApk\.href \? \(/);
  assert.match(page, /href=\{links\.androidApk\.href\}/);
});
