#!/usr/bin/env node
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkReleaseCandidate} from './check-android-release-candidate.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=path=>readFileSync(resolve(root,path),'utf8');
const app=JSON.parse(read('carmazium app/carmazium app/app.json'));
const eas=JSON.parse(read('carmazium app/carmazium app/eas.json'));
const sha='a'.repeat(40);
const env=()=>({
  GITHUB_REF:'refs/heads/main',
  GITHUB_EVENT_NAME:'workflow_dispatch',
  CARMAZIUM_ANDROID_CANDIDATE_APPROVAL:'INTERNAL_REVIEW_ONLY',
  CARMAZIUM_ANDROID_CANDIDATE_VERSION_CODE:'127',
  APP_ENV:'production',
  CARMAZIUM_ANDROID_RELEASE_KEYSTORE_BASE64:'AQID'.repeat(32),
  CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS:'carmazium',
  CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD:'random-store-secret',
  CARMAZIUM_ANDROID_RELEASE_KEY_PASSWORD:'random-key-secret',
  CARMAZIUM_ANDROID_RELEASE_CERT_SHA256:'b'.repeat(64),
});
const check=(patch={},requestedSha=sha,appCfg=app,easCfg=eas)=>
  checkReleaseCandidate({app:appCfg,eas:easCfg,env:{...env(),...patch},commitSha:sha,requestedSha});

test('valid synthetic signing metadata allows INTERNAL candidate only, not public release',()=>{
  assert.deepEqual(check(),{ok:true,errors:[]});
  const source=read('.github/workflows/carmazium-android-release-candidate.yml');
  assert.ok(source.includes('workflow_dispatch:'));
  assert.ok(source.includes("if: github.ref == 'refs/heads/main' && github.event_name == 'workflow_dispatch'"));
  assert.ok(!source.includes('on: push'));
  assert.ok(!source.includes('deploy-to-production'));
  assert.ok(!source.includes('eas submit'));
  assert.ok(!source.includes('curl --upload-file'));
  assert.ok(source.includes('signingConfig signingConfigs.release'));
  assert.ok(source.includes('CARMAZIUM_ANDROID_RELEASE_CERT_SHA256'));
  assert.ok(source.includes('CARMAZIUM_ANDROID_RELEASE_KEYSTORE_BASE64'));
  assert.ok(source.includes('uk.carmazium.app'));
  assert.ok(source.includes('apksigner" verify'));
  assert.ok(source.includes('REVIEW-ONLY'));
  assert.ok(source.includes('stage-android-direct-download.mjs'));
  assert.ok(source.includes('CarMazium-Android-STAGED-NOT-APPROVED'));
  assert.ok(source.includes('private-staged-apk/*'));
  assert.ok(source.includes('retention-days: 3'));
  assert.ok(source.includes("app.expo.updates?.enabled!==true"));
  assert.ok(source.includes("app.expo.updates?.requestHeaders?.['expo-channel-name']!=='production'"));
  assert.ok(source.includes('app.expo.version!==\'1.0.2\''));
  assert.ok(source.includes('Number(process.env.CARMAZIUM_ANDROID_CANDIDATE_VERSION_CODE)<127'));
  assert.ok(source.includes('app.expo.android.versionCode=Number(process.env.CARMAZIUM_ANDROID_CANDIDATE_VERSION_CODE)'));
  assert.ok(source.includes("versionCode='${CARMAZIUM_ANDROID_CANDIDATE_VERSION_CODE}'"));
  assert.ok(source.includes('cert'));
});

test('must verify exact main SHA and explicit internal-only approval',()=>{
  assert.equal(check({GITHUB_REF:'refs/heads/feature-test'}).ok,false);
  assert.equal(check({GITHUB_REF:'refs/tags/v1.0.0'}).ok,false);
  assert.equal(check({GITHUB_REF:''}).ok,false);
  assert.equal(check({GITHUB_EVENT_NAME:'push'}).ok,false);
  assert.equal(check({CARMAZIUM_ANDROID_CANDIDATE_APPROVAL:'NOT_APPROVED'}).ok,false);
  assert.equal(check({},'c'.repeat(40)).ok,false);
  assert.equal(check({},'invalid').ok,false);
  assert.equal(check({CARMAZIUM_ANDROID_CANDIDATE_APPROVAL:'PUBLISH_NOW'}).ok,false);
});

test('must reject unsafe release versionCode and wrong APP_ENV',()=>{
  for(const invalid of ['', '0','01','-1','1.1','abc','126','2147483648','99999999999']){
    assert.equal(check({CARMAZIUM_ANDROID_CANDIDATE_VERSION_CODE:invalid}).ok,false,invalid);
  }
  assert.equal(check({APP_ENV:'preview'}).ok,false);
  assert.equal(check({APP_ENV:''}).ok,false);
  assert.equal(check({CARMAZIUM_ANDROID_CANDIDATE_VERSION_CODE:'2147483647'}).ok,true);
});

test('must reject missing keys, malformed signature and any weak keystore',()=>{
  for(const [key,value] of [
    ['CARMAZIUM_ANDROID_RELEASE_KEYSTORE_BASE64',''],
    ['CARMAZIUM_ANDROID_RELEASE_KEYSTORE_BASE64','not-base64?'],
    ['CARMAZIUM_ANDROID_RELEASE_KEYSTORE_BASE64','YQ=='],
    ['CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS',''],
    ['CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS','androiddebugkey'],
    ['CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS','debug'],
    ['CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD',''],
    ['CARMAZIUM_ANDROID_RELEASE_KEY_PASSWORD',''],
    ['CARMAZIUM_ANDROID_RELEASE_KEY_PASSWORD','unsafe\nInjected=true'],
    ['CARMAZIUM_ANDROID_RELEASE_CERT_SHA256','a'.repeat(63)],
  ])assert.equal(check({[key]:value}).ok,false,'invalid '+key+' should fail');
});

test('must reject nonproduction package, missing signing plugin and modified EAS structure',()=>{
  const other=structuredClone(app);other.expo.android.package='uk.carmazium.qa';
  assert.equal(check({},sha,other).ok,false);
  const noPlugin=structuredClone(app);
  noPlugin.expo.plugins=noPlugin.expo.plugins.filter(p=>p!=='./plugins/withAndroidReleaseSigning');
  assert.equal(check({},sha,noPlugin).ok,false);
  const changed=structuredClone(eas);changed.build.production.android.buildType='apk';
  assert.equal(check({},sha,app,changed).ok,false);
});

test('original signed APK migration refuses former developer Expo account or wrong new OTA endpoint',()=>{
  const previousOwner=structuredClone(app);
  previousOwner.expo.owner='pizn-01s-team';
  assert.equal(check({},sha,previousOwner).ok,false);
  const previousId=structuredClone(app);
  previousId.expo.extra.eas.projectId='f0ab914b-3433-4816-80a2-0a94e6c6a066';
  assert.equal(check({},sha,previousId).ok,false);
  const previousUpdate=structuredClone(app);
  previousUpdate.expo.updates.url='https://u.expo.dev/f0ab914b-3433-4816-80a2-0a94e6c6a066';
  assert.equal(check({},sha,previousUpdate).ok,false);
  assert.equal(check().ok,true);
});

test('production customer APK must never inherit read-only QA marker',()=>{
  assert.equal(check({EXPO_PUBLIC_QA_READ_ONLY:'1'}).ok,false);
  const flow=read('.github/workflows/carmazium-android-release-candidate.yml');
  assert.ok(!flow.includes('EXPO_PUBLIC_QA_READ_ONLY:'));
  assert.ok(flow.includes('Remove signing material'));
  assert.ok(flow.includes('signer mismatch'));
});

test('download website must stay gated even when candidate build exists',()=>{
  const links=read('src/lib/mobileAppDownloads.ts');
  assert.ok(links.includes('NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED'));
  assert.ok(links.includes('NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256'));
  assert.ok(links.includes('testflight.apple.com'));
  const doc=read('docs/native/issue477-prestore-release-candidate-20261010.md');
  assert.ok(doc.includes('NOT DISTRIBUTABLE'));
  assert.ok(doc.includes('Apple Developer'));
  assert.ok(doc.includes('TestFlight'));
  assert.ok(doc.includes('signed'));
});


test('new company-owned OTA runtime rejects old version, unsafe channel and missing updates',()=>{
  const clone=()=>JSON.parse(JSON.stringify(app));
  const badChannel=clone();badChannel.expo.updates.requestHeaders['expo-channel-name']='preview';
  assert.equal(check({},sha,badChannel).ok,false);
  const disabled=clone();disabled.expo.updates.enabled=false;
  assert.equal(check({},sha,disabled).ok,false);
  const stale=clone();stale.expo.version='1.0.1';
  assert.equal(check({},sha,stale).ok,false);
  const unscoped=clone();unscoped.expo.runtimeVersion={policy:'sdkVersion'};
  assert.equal(check({},sha,unscoped).ok,false);
  assert.equal(check({CARMAZIUM_ANDROID_CANDIDATE_VERSION_CODE:'127'}).ok,true);
});
