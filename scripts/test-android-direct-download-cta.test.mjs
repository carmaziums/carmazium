import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../src/app/download-app/page.tsx');
const source = read('../src/lib/mobileAppDownloads.ts');
const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const resolver = {};
runInNewContext(compile(source), { exports: resolver, URL });
const play = 'https://play.google.com/store/apps/details?id=uk.carmazium.app';
const apk = 'https://www.carmazium.com/downloads/CarMazium-1.0.2-v134.apk';
function render(env) {
  const exports = {};
  const icon = () => null;
  const modules = {
    'react/jsx-runtime': jsxRuntime,
    '@/components/seo/PageJsonLd': { PageJsonLd: () => null },
    'next/link': { default: props => React.createElement('a', props) },
    '@/components/ui/buttonVariants': { buttonVariants: () => '' },
    'lucide-react': { ArrowDownToLine: icon, ArrowRight: icon, CheckCircle2: icon, ExternalLink: icon, ShieldCheck: icon },
    'react-icons/fa': { FaAndroid: icon, FaApple: icon, FaGooglePlay: icon, FaWindows: icon },
    '@/components/features/AppPromoShowcase': { AppPromoShowcase: props => props.actions, appPromoButtonClass: '' },
    '@/lib/mobileAppDownloads': { getMobileAppLinks: () => resolver.resolveMobileAppLinks(env) },
    '@/components/pwa/InstallWebAppButton': { DeviceRecommendedBadge: () => null,
      InstallWebAppButton: props => React.createElement('button', null, 'Web install ' + props.platform) },
    '@/components/pwa/TrackedDownloadLink': { TrackedDownloadLink: props =>
      React.createElement('a', { href: props.href, 'aria-label': props.ariaLabel }, props.children) },
  };
  runInNewContext(compile(page), { exports, require: name => {
    assert.ok(name in modules, 'Unexpected module: ' + name); return modules[name];
  } });
  return renderToStaticMarkup(React.createElement(exports.default));
}
const approved = {
  NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL: apk,
  NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256: 'a'.repeat(64),
  NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED: 'true',
};

test('Google Play and signed APK remain separate visible choices when both are available', () => {
  const html = render({ ...approved, NEXT_PUBLIC_CARMAZIUM_ANDROID_APP_URL: play });
  assert.ok(html.includes('href="' + play + '"'));
  assert.ok(html.includes('href="' + apk + '"'));
  assert.match(html, /Get it on Google Play/);
  assert.match(html, /Download APK directly/);
  assert.match(html, /href="#android"/);
  assert.match(html, /id="android-apk"/);
});
test('APK remains downloadable while Google Play is unavailable', () => {
  const html = render(approved);
  assert.ok(html.includes('href="' + apk + '"'));
  assert.ok(!html.includes('href="' + play + '"'));
  assert.match(html, /Google Play download is coming soon/);
});
test('Google Play cannot expose an unapproved APK download', () => {
  const html = render({ ...approved, NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED: 'false',
    NEXT_PUBLIC_CARMAZIUM_ANDROID_APP_URL: play });
  assert.ok(html.includes('href="' + play + '"'));
  assert.ok(!html.includes('href="' + apk + '"'));
});
test('neither available retains browser installation without fake store links', () => {
  const html = render({});
  assert.match(html, /Web install android/);
  assert.ok(!html.includes('href="' + apk + '"'));
  assert.ok(!html.includes('href="' + play + '"'));
});
