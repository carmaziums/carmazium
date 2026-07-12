// Single repeatable command for a signed Android release build, for client
// demo builds — separate from the `npm run android`/`android:dev` debug
// dev-client loop. See CONTEXT.md's "Dev workflow" section for how this
// differs from the fast dev-client loop, and keystores/release.keystore.properties
// (gitignored) + plugins/withAndroidReleaseSigning.js for how release signing
// is wired up to survive `expo prebuild --clean` every time this runs.
//
// Steps: verify the release keystore exists -> expo prebuild --clean
// -> guarded cleanup of stale Gradle build-output dirs (belt-and-suspenders
// against caching issues seen previously on this project, see CONTEXT.md)
// -> gradlew assembleRelease -> verify the signed APK landed where expected.

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const KEYSTORE_PROPERTIES = path.join(APP_ROOT, 'keystores', 'release.keystore.properties');
const ANDROID_DIR = path.join(APP_ROOT, 'android');
const APK_OUTPUT = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

function log(msg) {
  console.log(`\n[android:release] ${msg}`);
}

function fail(msg) {
  console.error(`\n[android:release] FAILED: ${msg}`);
  process.exit(1);
}

// Quote any token containing a space. This repo's own path ("carmazium app")
// has a space in it, so both `command` and `cwd`-adjacent paths need this —
// execFileSync's `shell: true` on Windows does NOT reliably auto-quote a
// spaced executable path itself, which silently truncates/tokenizes it at
// the first space (confirmed the hard way: it tried to run a program
// literally named "C:\ca\carmazium\carmazium"). Building one fully-quoted
// command string ourselves and using execSync sidesteps that entirely.
function quote(token) {
  return /\s/.test(token) ? `"${token}"` : token;
}

function run(command, args, cwd) {
  const fullCommand = [quote(command), ...args.map(quote)].join(' ');
  log(`> ${fullCommand}${cwd ? `  (cwd: ${path.relative(APP_ROOT, cwd) || '.'})` : ''}`);
  execSync(fullCommand, { cwd: cwd ?? APP_ROOT, stdio: 'inherit' });
}

// ── 1. Verify the release keystore exists before doing anything expensive ──
if (!existsSync(KEYSTORE_PROPERTIES)) {
  fail(
    `${path.relative(APP_ROOT, KEYSTORE_PROPERTIES)} not found.\n` +
    `Generate a release keystore first (see the release-build section of CONTEXT.md), or restore\n` +
    `keystores/release.jks + keystores/release.keystore.properties from your secure backup if this\n` +
    `is a machine that already has a release identity elsewhere.`
  );
}
const props = Object.fromEntries(
  readFileSync(KEYSTORE_PROPERTIES, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const keystoreFile = path.join(APP_ROOT, 'keystores', props.MYAPP_RELEASE_STORE_FILE ?? '');
if (!props.MYAPP_RELEASE_STORE_FILE || !existsSync(keystoreFile)) {
  fail(`Keystore file referenced by MYAPP_RELEASE_STORE_FILE not found at ${keystoreFile}.`);
}
log(`Using release keystore: keystores/${props.MYAPP_RELEASE_STORE_FILE} (alias: ${props.MYAPP_RELEASE_KEY_ALIAS})`);

// ── 2. Regenerate the native Android project (also re-applies release
//      signing via plugins/withAndroidReleaseSigning.js — see that file) ──
run('npx', ['expo', 'prebuild', '--clean', '--platform', 'android']);

// ── 3. Guarded cleanup of stale Gradle build-output dirs ──
for (const rel of ['app/build/generated', 'app/build/intermediates/assets', 'app/build/intermediates/merged_assets']) {
  const p = path.join(ANDROID_DIR, ...rel.split('/'));
  if (existsSync(p)) {
    log(`Removing stale ${rel}`);
    rmSync(p, { recursive: true, force: true });
  }
}

// ── 4. Build ──
// Use the absolute path rather than a bare `gradlew.bat` — with shell: true,
// cmd.exe's command resolution for a relative filename doesn't reliably fall
// back to the child process's cwd, and fails with "is not recognized" even
// though the file is right there. The original manual command sidestepped
// this with an explicit `.\gradlew.bat` prefix; an absolute path is equivalent
// and avoids any ambiguity about which directory cmd.exe is resolving against.
run(
  path.join(ANDROID_DIR, 'gradlew.bat'),
  ['assembleRelease', '-PreactNativeArchitectures=arm64-v8a', '--max-workers', '2', '--no-daemon'],
  ANDROID_DIR
);

// ── 5. Verify the signed APK actually landed where expected ──
if (!existsSync(APK_OUTPUT)) {
  fail(`Build reported success but no APK was found at ${APK_OUTPUT}.`);
}
log(`Signed APK ready: ${APK_OUTPUT}`);
