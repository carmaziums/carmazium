#!/usr/bin/env node

/**
 * Strict signed release-candidate evidence gate.
 *
 * This script validates evidence that cannot be inferred from source code:
 * signed store builds, toolchain provenance, real-device QA and successful
 * pre-release store uploads. It is intentionally environment-driven so secrets
 * and store credentials never need to be committed.
 */

let failures = 0;

function fail(message) {
  failures += 1;
  console.error(`RELEASE EVIDENCE ERROR: ${message}`);
}

function ok(message) {
  console.log(`RELEASE EVIDENCE OK: ${message}`);
}

const env = (name) => (process.env[name] ?? '').trim();
const requireTrue = (name, label) => {
  if (env(name) !== 'true') fail(`${label} has not been confirmed`);
  else ok(label);
};
const requireNonPlaceholder = (name, label) => {
  const value = env(name);
  if (!value || /FILL_IN|REPLACE_WITH|CHANGE_ME|YOUR_/i.test(value)) {
    fail(`${label} is missing or placeholder`);
    return '';
  }
  ok(`${label} supplied`);
  return value;
};
const requireSha256 = (name, label) => {
  const value = env(name);
  if (!/^[0-9a-f]{64}$/i.test(value)) fail(`${label} must be a 64-character SHA-256 digest`);
  else ok(`${label} format is valid`);
  return value;
};

const releaseSha = env('CARMAZIUM_RELEASE_SHA');
if (!/^[0-9a-f]{40}$/i.test(releaseSha)) {
  fail('Release source SHA must be a full 40-character Git commit SHA');
} else {
  ok(`Release source SHA format is valid (${releaseSha})`);
}

const githubSha = env('GITHUB_SHA');
if (githubSha) {
  if (releaseSha.toLowerCase() !== githubSha.toLowerCase()) {
    fail(`Release source SHA ${releaseSha} does not match workflow SHA ${githubSha}`);
  } else {
    ok('Signed release-candidate evidence is bound to the exact workflow commit');
  }
}

requireNonPlaceholder('CARMAZIUM_IOS_BUILD_ID', 'iOS EAS/App Store build identifier');
requireNonPlaceholder('CARMAZIUM_ANDROID_BUILD_ID', 'Android EAS/Play build identifier');
requireSha256('CARMAZIUM_IOS_ARTIFACT_SHA256', 'iOS .ipa archive digest');
requireSha256('CARMAZIUM_ANDROID_ARTIFACT_SHA256', 'Android .aab digest');

const xcodeVersion = requireNonPlaceholder('CARMAZIUM_IOS_XCODE_VERSION', 'iOS Xcode version');
const iosSdkVersion = requireNonPlaceholder('CARMAZIUM_IOS_SDK_VERSION', 'iOS SDK version');

const xcodeMajor = Number.parseInt(xcodeVersion.match(/\d+/)?.[0] ?? '', 10);
if (!Number.isFinite(xcodeMajor) || xcodeMajor < 26) {
  fail(`iOS release archive must be built with Xcode 26 or later; got "${xcodeVersion}"`);
} else {
  ok(`iOS toolchain meets Xcode 26+ requirement (${xcodeVersion})`);
}

const iosSdkMajor = Number.parseInt(iosSdkVersion.match(/\d+/)?.[0] ?? '', 10);
if (!Number.isFinite(iosSdkMajor) || iosSdkMajor < 26) {
  fail(`iOS release archive must use iOS SDK 26 or later; got "${iosSdkVersion}"`);
} else {
  ok(`iOS SDK meets 26+ requirement (${iosSdkVersion})`);
}

for (const [name, label] of [
  ['CARMAZIUM_ANDROID_SIGNED_AAB_CONFIRMED', 'Signed Android AAB verified'],
  ['CARMAZIUM_IOS_SIGNED_ARCHIVE_CONFIRMED', 'Signed iOS archive verified'],
  ['CARMAZIUM_DEVICE_QA_CONFIRMED', 'Representative real-device QA completed'],
  ['CARMAZIUM_ACCESSIBILITY_QA_CONFIRMED', 'VoiceOver/TalkBack and large-text QA completed'],
  ['CARMAZIUM_PUSH_QA_CONFIRMED', 'Foreground/background/killed-state push QA completed'],
  ['CARMAZIUM_PAYMENT_QA_CONFIRMED', 'Native payment presentation and test transaction QA completed'],
  ['CARMAZIUM_DEEP_LINK_QA_CONFIRMED', 'Installed Universal Link/App Link QA completed'],
  ['CARMAZIUM_TESTFLIGHT_UPLOAD_CONFIRMED', 'iOS release candidate uploaded to TestFlight'],
  ['CARMAZIUM_PLAY_INTERNAL_UPLOAD_CONFIRMED', 'Android release candidate uploaded to Play internal testing'],
]) {
  requireTrue(name, label);
}

if (failures > 0) {
  console.error(`\nSigned release-candidate evidence failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log('\nSigned release-candidate evidence passed.');
