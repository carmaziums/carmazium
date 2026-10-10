#!/usr/bin/env node
// Public install CTA safety: test resolver output, not fake storefront availability.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=path=>readFileSync(resolve(root,path),'utf8');
const source=read('src/lib/mobileAppDownloads.ts');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
new Function('exports','process',js)(exports,{env:{}}); // no network or source side effects
const {resolveMobileAppLinks}=exports;
if(typeof resolveMobileAppLinks!=='function') throw Error('Resolver not exported');

const apple='https://apps.apple.com/gb/app/carmazium/id1234567890';
const play='https://play.google.com/store/apps/details?id=uk.carmazium.app';
const testflight='https://testflight.apple.com/join/A1b2C3d4';
const hash='a'.repeat(64);
const testEnv=()=>({
  NEXT_PUBLIC_CARMAZIUM_IOS_APP_URL:apple,
  NEXT_PUBLIC_CARMAZIUM_IOS_TESTFLIGHT_URL:testflight,
  NEXT_PUBLIC_CARMAZIUM_ANDROID_APP_URL:play,
  NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL:'https://www.carmazium.com/downloads/carmazium-release.apk',
  NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256:hash,
  NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED:'true',
});

test('never advertises an unverified or guessed install URL',()=>{
  const links=resolveMobileAppLinks({});
  assert.deepEqual(links,{
    ios:{href:null,available:false},
    iosTestFlight:{href:null,available:false},
    android:{href:null,available:false},
    androidApk:{href:null,available:false,sha256:null},
  });
});

test('verified official iOS and Google Play store URLs appear as direct destinations',()=>{
  const links=resolveMobileAppLinks(testEnv());
  assert.equal(links.ios.href,apple);
  assert.equal(links.ios.available,true);
  assert.equal(links.iosTestFlight.href,testflight);
  assert.equal(links.android.href,play);
  assert.equal(links.android.available,true);
});

test('do not allow search results, private TestFlight links, generic Apple pages or fake packages',()=>{
  for(const bad of [
    'https://apps.apple.com/gb/app/search',
    'https://apps.apple.com/gb/app/name',
    'https://testflight.apple.com/join/1234567',
    'http://apps.apple.com/gb/app/x/id1234567890',
    'https://apps.apple.com.evil.example/gb/app/x/id1234567890',
    'https://apps.apple.com/gb/app/x/idabc',
  ]){
    assert.equal(resolveMobileAppLinks({...testEnv(),NEXT_PUBLIC_CARMAZIUM_IOS_APP_URL:bad}).ios.href,null,bad);
  }
  for(const bad of [
    'https://play.google.com/store/apps',
    'https://play.google.com/store/search?q=carmazium',
    'https://play.google.com/store/apps/details?id=uk.other.app',
    'http://play.google.com/store/apps/details?id=uk.carmazium.app',
    'https://fake-play.google.com/store/apps/details?id=uk.carmazium.app',
  ]){
    assert.equal(resolveMobileAppLinks({...testEnv(),NEXT_PUBLIC_CARMAZIUM_ANDROID_APP_URL:bad}).android.href,null,bad);
  }
});

test('approved TestFlight PUBLIC beta invitation works before App Store launch',()=>{
  const preStore={...testEnv(),NEXT_PUBLIC_CARMAZIUM_IOS_APP_URL:undefined,
    NEXT_PUBLIC_CARMAZIUM_ANDROID_APP_URL:undefined};
  const links=resolveMobileAppLinks(preStore);
  assert.equal(links.ios.available,false);
  assert.equal(links.iosTestFlight.href,testflight);
  assert.equal(links.iosTestFlight.available,true);
  assert.equal(links.android.available,false);
  assert.equal(links.androidApk.available,true);
});

test('TestFlight links must be from Apple, public join invitations, never private or fake',()=>{
  for(const bad of [
    'https://testflight.apple.com/',
    'https://testflight.apple.com/join/1234567',
    'https://testflight.apple.com/join/abcdefghijklmnopq',
    'https://testflight.apple.com/join/A1b2C3d4?token=tracking',
    'https://testflight.apple.com/join/A1b2C3d4#anchor',
    'https://testflight.apple.com/private/abc12345',
    'https://itunesconnect.apple.com/',
    'https://testflight.apple.com.evil.example/join/A1b2C3d4',
    'http://testflight.apple.com/join/A1b2C3d4',
    'https://testflight.apple.com/join/1234%2F1234'
  ]){
    const links=resolveMobileAppLinks({...testEnv(),NEXT_PUBLIC_CARMAZIUM_IOS_TESTFLIGHT_URL:bad});
    assert.equal(links.iosTestFlight.href,null,bad);
  }
});

test('never offer internal APKs or unsigned direct downloads',()=>{
  const common=testEnv();
  for(const patch of [
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED:'false'},
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256:''},
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256:'checksum'},
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL:'https://github.com/carmaziums/carmazium/actions/runs/123'},
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL:'https://expo.dev/artifacts/eas/build.apk'},
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL:'https://www.carmazium.com/preview-build.apk'},
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL:'https://www.carmazium.com/downloads/qa-app.apk#hash'},
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL:'https://www.carmazium.com/downloads/carmazium-qa.apk'},
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL:'https://www.carmazium.com/downloads/carmazium-preview.apk'},
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL:'https://www.carmazium.com/downloads/CarMazium-REVIEW-ONLY.apk'},
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL:'https://www.carmazium.com:444/downloads/carmazium-v42.apk'},
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL:'https://www.carmazium.com/downloads/another/carmazium-v42.apk'},
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL:'https://www.carmazium.com/downloads/%2fcarmazium-v42.apk'},
    {NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL:'http://carmazium.com/downloads/app.apk'},
  ]){
    const links=resolveMobileAppLinks({...common,...patch});
    assert.equal(links.androidApk.href,null,JSON.stringify(patch));
  }
  assert.equal(resolveMobileAppLinks(common).androidApk.href,common.NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL);
  assert.equal(resolveMobileAppLinks(common).androidApk.sha256,hash);
});

test('website navigation, homepage, footer and sitemap all lead to download landing',()=>{
  const header=read('src/components/layout/Header.tsx');
  const footer=read('src/components/layout/Footer.tsx');
  const home=read('src/app/HomeClient.tsx');
  const sitemap=read('src/app/sitemap.ts');
  for(const source of [header,footer,home,sitemap]){
    assert.ok(source.includes('/download-app'),'missing app install discovery link');
  }
  assert.ok(header.includes('Get the App'));
  assert.ok(home.includes('Get the CarMazium App'));
  assert.ok(footer.includes('CarMazium for iPhone &amp; Android'));
});

test('download page only offers clickable buttons with genuine validated destinations',()=>{
  const page=read('src/app/download-app/page.tsx');
  assert.ok(page.includes('getMobileAppLinks()'));
  assert.ok(page.includes('href={links.ios.href}'));
  assert.ok(page.includes('href={links.iosTestFlight.href}'));
  assert.ok(page.includes('links.iosTestFlight.href ? ('));
  assert.ok(page.includes('Install iPhone Beta via TestFlight'));
  assert.ok(page.includes('href={links.android.href}'));
  assert.ok(page.includes('href={links.androidApk.href}'));
  assert.ok(page.includes('links.ios.href ? ('));
  assert.ok(page.includes('links.android.href ? ('));
  assert.ok(page.includes('links.androidApk.href && ('));
  assert.ok(page.includes('coming soon'));
  assert.ok(page.includes('Apple App Store'));
  assert.ok(page.includes('Google Play'));
  assert.ok(page.includes('SHA-256'));
  assert.ok(!page.includes('https://play.google.com/store/search'),'no fake install links');
  assert.ok(page.includes('href="/search"'),'browser fall-back remains');
});

test('source docs must not promise App Store availability, unsupported iOS web sideloading or live APK',()=>{
  const docs=read('docs/website/mobile-app-install-links-20261010.md');
  for(const term of ['NOT VERIFIED','NOT LIVE','NEXT_PUBLIC_CARMAZIUM_IOS_APP_URL',
    'NEXT_PUBLIC_CARMAZIUM_IOS_TESTFLIGHT_URL',
    'NEXT_PUBLIC_CARMAZIUM_ANDROID_APP_URL','NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL',
    'signed','UK','App Store','Google Play','source CI','release approval']){
    assert.ok(docs.toLowerCase().includes(term.toLowerCase()),term);
  }
});
