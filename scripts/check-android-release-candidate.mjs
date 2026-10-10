#!/usr/bin/env node
/**
 * Pre-store Android release-candidate readiness, fail closed.
 *
 * Does not build, sign, upload, publish, or contact external services.
 * In particular, the existing debug-signed uk.carmazium.qa build must
 * never be mistaken for a customer release of uk.carmazium.app.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha40=/^[0-9a-f]{40}$/i;
const certSha256=/^[0-9a-f]{64}$/i;

export function checkReleaseCandidate({app,eas,env,commitSha,requestedSha}){
  const errors=[];
  if(!sha40.test(commitSha||'') || !sha40.test(requestedSha||'') ||
      commitSha.toLowerCase()!==requestedSha.toLowerCase())
    errors.push('Candidate must use exact requested Git source SHA');
  if(env.GITHUB_REF!=='refs/heads/main')
    errors.push('Release candidate must originate from main branch');
  if(env.GITHUB_EVENT_NAME!=='workflow_dispatch')
    errors.push('Release candidate must be manually dispatched');
  if(env.CARMAZIUM_ANDROID_CANDIDATE_APPROVAL!=='INTERNAL_REVIEW_ONLY')
    errors.push('Explicit internal-review-only approval missing');
  if(env.APP_ENV!=='production')
    errors.push('Release candidate must use the production app environment');
  const rawVersion=env.CARMAZIUM_ANDROID_CANDIDATE_VERSION_CODE;
  const versionCode=Number(rawVersion);
  if(typeof rawVersion!=='string' || !/^[1-9][0-9]{0,9}$/.test(rawVersion) ||
      !Number.isSafeInteger(versionCode) || versionCode>2147483647)
    errors.push('Candidate Android versionCode must be a valid positive 32-bit integer');
  if(app?.expo?.android?.package!=='uk.carmazium.app')
    errors.push('Candidate must use real CarMazium Android package');
  if(app?.expo?.ios?.bundleIdentifier!=='uk.carmazium.app')
    errors.push('Original app identity changed: refusing to proceed');
  if(!app?.expo?.plugins?.includes('./plugins/withAndroidReleaseSigning'))
    errors.push('Release-signing config plugin is missing');
  if(eas?.build?.production?.android?.buildType!=='app-bundle' ||
      eas?.build?.preview?.android?.buildType!=='apk')
    errors.push('Existing production/preview build profiles changed');
  if(!String(eas?.build?.production?.env?.EXPO_PUBLIC_API_URL||'').startsWith('https://'))
    errors.push('Existing production API config missing');
  if(env.EXPO_PUBLIC_QA_READ_ONLY==='1')
    errors.push('QA-mode binary must not masquerade as production release');
  for(const key of [
    'CARMAZIUM_ANDROID_RELEASE_KEYSTORE_BASE64',
    'CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS',
    'CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD',
    'CARMAZIUM_ANDROID_RELEASE_KEY_PASSWORD',
  ]){
    if(typeof env[key]!=='string'||!env[key].trim())errors.push('Missing release signing secret: '+key);
    if(typeof env[key]==='string' && /[\r\n]/.test(env[key]))errors.push('Invalid newline in signing secret: '+key);
  }
  if(/^(androiddebugkey|debug)$/i.test(env.CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS||''))
    errors.push('Android debug signing key alias must not be used for customer release');
  if(!certSha256.test(env.CARMAZIUM_ANDROID_RELEASE_CERT_SHA256||''))
    errors.push('Expected signing certificate SHA-256 must be a 64-character digest');
  if(!/^[A-Za-z0-9+\/=]+$/.test(env.CARMAZIUM_ANDROID_RELEASE_KEYSTORE_BASE64||''))
    errors.push('Keystore input must be base64');
  if(env.CARMAZIUM_ANDROID_RELEASE_KEYSTORE_BASE64 &&
      env.CARMAZIUM_ANDROID_RELEASE_KEYSTORE_BASE64.length<64)
    errors.push('Release keystore input is too short to be a valid signing key');
  return {ok:errors.length===0,errors};
}

const direct=process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  let verdict;
  try{
    const app=JSON.parse(readFileSync(resolve(root,'carmazium app/carmazium app/app.json'),'utf8'));
    const eas=JSON.parse(readFileSync(resolve(root,'carmazium app/carmazium app/eas.json'),'utf8'));
    verdict=checkReleaseCandidate({app,eas,env:process.env,
      commitSha:process.env.GITHUB_SHA,requestedSha:process.env.CARMAZIUM_CANDIDATE_SOURCE_SHA});
  }catch(error){verdict={ok:false,errors:['App configuration unavailable or unreadable']};}
  console.log('CarMazium pre-store Android candidate: '+(verdict.ok?'READY FOR INTERNAL BUILD':'BLOCKED'));
  for(const error of verdict.errors)console.error(' - '+error);
  if(!verdict.ok)process.exitCode=1;
}
