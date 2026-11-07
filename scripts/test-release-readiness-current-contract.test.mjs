import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const guard = fs.readFileSync(new URL('./check-release-readiness.mjs', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '');
const drawerPath = 'carmazium app/carmazium app/src/components/GlobalDrawer.tsx';
const menuPath = 'carmazium app/carmazium app/src/components/SiteMenu.tsx';
const releasePath = 'carmazium app/carmazium app/scripts/release-android.mjs';
function check(changes = {}, strict = false) {
  const errors = [];
  let exit = 0;
  const mockedFs = { ...fs, readFileSync(file, encoding) {
    const relative = path.relative(root, file);
    const text = fs.readFileSync(file, encoding);
    return changes[relative] ? changes[relative](text) : text;
  } };
  vm.runInNewContext(guard, {
    fs: mockedFs, path, URL, Buffer,
    process: { cwd: () => root, argv: strict ? ['--strict'] : [], env: {}, exit: code => { exit = code; } },
    console: { log() {}, warn() {}, error: text => errors.push(text) },
  });
  return { errors, exit };
}

test('current menu and separate signed AAB/APK paths pass the code-controlled release gate', () => {
  assert.deepEqual(check(), { errors: [], exit: 0 });
});

test('privacy access still fails if the link, rendered menu or navigation wiring is removed', () => {
  for (const changes of [
    { [menuPath]: s => s.replace("screen: 'PrivacyPolicy'", "screen: 'Home'") },
    { [drawerPath]: s => s.replace('<SiteMenu', '<MissingMenu') },
    { [drawerPath]: s => s.replace('onNavigate={navigateSite}', 'onNavigate={noop}') },
  ]) assert.ok(check(changes).errors.some(e => e.includes('privacy or account-deletion')));
});

test('APK support cannot silently replace the default AAB or skip artifact checks', () => {
  for (const change of [
    s => s.replace("const BUILD_APK = process.argv.includes('--apk')", 'const BUILD_APK = true'),
    s => s.replace(": ['bundleRelease'", ": ['assembleRelease'"),
    s => s.replace('if (!existsSync(AAB_OUTPUT))', 'if (false)'),
    s => s.replace('if (!existsSync(APK_OUTPUT))', 'if (false)'),
  ]) assert.ok(check({ [releasePath]: change }).errors.some(e => e.includes('Guarded Android release')));
});

test('strict store release still requires real external evidence', () => {
  const result = check({}, true);
  assert.equal(result.exit, 1);
  assert.ok(result.errors.some(e => /physical-device QA|store consoles/.test(e)));
});
