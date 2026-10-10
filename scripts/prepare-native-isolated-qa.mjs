#!/usr/bin/env node
/**
 * Issue #477: prepare an *ephemeral* isolated, READ-ONLY visual QA EAS build.
 * Never modify source-controlled app.json/eas.json outside the ephemeral CI checkout.
 * No network calls or credentials are printed. This does not provision staging.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENV_KEYS = Object.freeze([
  'CARMAZIUM_QA_API_URL',
  'CARMAZIUM_QA_SUPABASE_URL',
  'CARMAZIUM_QA_SUPABASE_ANON_KEY',
  'CARMAZIUM_QA_STRIPE_PUBLISHABLE_KEY',
  'CARMAZIUM_QA_EAS_PROJECT_ID',
]);
const liveApiHosts = new Set(['carmazium-hjoh9w.fly.dev', 'carmazium.com', 'www.carmazium.com']);
const liveSupabaseProject = 'bwtnzmevjlowwronylxm';
const liveEasProject = 'f0ab914b-3433-4816-80a2-0a94e6c6a066';
const qaAndroidId = 'uk.carmazium.qa';
const qaIosId = 'uk.carmazium.qa';
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const own = (env, key) => typeof env?.[key] === 'string' ? env[key].trim() : '';
const parseHttps = raw => {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
        || url.pathname !== '/') return null;
    return url;
  } catch { return null; }
};

export function validateIsolatedQa(env, app, eas) {
  const errors = [];
  for (const key of ENV_KEYS) if (!own(env,key)) errors.push('Missing isolated QA config: ' + key);
  if (errors.length) return { ok:false, errors };
  const api = parseHttps(own(env,'CARMAZIUM_QA_API_URL'));
  const sb = parseHttps(own(env,'CARMAZIUM_QA_SUPABASE_URL'));
  if (!api || liveApiHosts.has(api.hostname.toLowerCase())
    || !/[-.]?(qa|staging|test)[-.]/i.test(api.hostname + '-')) {
    errors.push('QA API must use an explicit non-production HTTPS QA/staging/test host');
  }
  if (!sb || !sb.hostname.endsWith('.supabase.co')
    || sb.hostname === liveSupabaseProject + '.supabase.co'
    || !/^[a-z0-9]+\.supabase\.co$/.test(sb.hostname)) {
    errors.push('QA Supabase must have a separate HTTPS project URL, not production');
  }
  if (own(env,'CARMAZIUM_QA_STRIPE_PUBLISHABLE_KEY').startsWith('pk_live_')
      || !own(env,'CARMAZIUM_QA_STRIPE_PUBLISHABLE_KEY').startsWith('pk_test_')) {
    errors.push('QA Stripe publishable key must be TEST mode, never pk_live');
  }
  const projectId = own(env,'CARMAZIUM_QA_EAS_PROJECT_ID');
  if (!uuidRe.test(projectId) || projectId === liveEasProject
      || projectId === app?.expo?.extra?.eas?.projectId) {
    errors.push('QA EAS project ID must be separate from production Expo project');
  }
  if (app?.expo?.android?.package !== 'uk.carmazium.app'
      || app?.expo?.ios?.bundleIdentifier !== 'uk.carmazium.app'
      || eas?.build?.preview?.channel !== 'preview'
      || eas?.build?.production?.channel !== 'production') {
    errors.push('Source app/EAS config unexpectedly changed: stop rather than patch unknown setup');
  }
  if (!own(env,'CARMAZIUM_QA_SUPABASE_ANON_KEY')
      || own(env,'CARMAZIUM_QA_SUPABASE_ANON_KEY') === eas?.build?.preview?.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY
      || own(env,'CARMAZIUM_QA_SUPABASE_ANON_KEY') === eas?.build?.production?.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push('QA Supabase public key must differ from production');
  }
  if (api && sb && api.hostname === sb.hostname) errors.push('QA API and Supabase are separate services');
  if (own(env,'CARMAZIUM_QA_ISOLATED_CONFIRMED') !== 'YES_APPROVED_SYNTHETIC_ONLY') {
    errors.push('Isolated synthetic staging must be explicitly approved before a QA build');
  }
  return { ok:errors.length===0, errors };
}

export function createIsolatedQaConfig(env, app, eas) {
  const verdict = validateIsolatedQa(env,app,eas);
  if (!verdict.ok) throw new Error(verdict.errors.join('; '));
  const nextApp = structuredClone(app);
  const nextEas = structuredClone(eas);
  nextApp.expo.name = 'CarMazium QA';
  nextApp.expo.slug = 'carmazium-qa';
  nextApp.expo.scheme = 'carmazium-qa';
  nextApp.expo.extra = { ...(nextApp.expo.extra || {}), eas:{
    ...(nextApp.expo.extra?.eas||{}),projectId:own(env,'CARMAZIUM_QA_EAS_PROJECT_ID'),
  }};
  nextApp.expo.android.package = qaAndroidId;
  nextApp.expo.android.intentFilters = [];
  nextApp.expo.ios.bundleIdentifier = qaIosId;
  nextApp.expo.ios.associatedDomains = [];
  // Prevent cross-project production OTA updates and universal-link interception.
  nextApp.expo.updates = { ...(nextApp.expo.updates || {}),enabled:false };
  delete nextApp.expo.updates.url;
  nextApp.expo.userInterfaceStyle = 'dark'; // Honest current limitation; NO light-mode claim.
  nextEas.build['qa-isolated'] = {
    distribution:'internal',channel:'qa-isolated',
    ios:{simulator:true,resourceClass:'m-medium'},
    android:{buildType:'apk',resourceClass:'medium'},
    env:{
      APP_ENV:'qa-isolated',
      EXPO_PUBLIC_QA_ISOLATED:'1',
      EXPO_PUBLIC_QA_READ_ONLY:'1',
      EXPO_PUBLIC_API_URL:own(env,'CARMAZIUM_QA_API_URL'),
      EXPO_PUBLIC_SUPABASE_URL:own(env,'CARMAZIUM_QA_SUPABASE_URL'),
      EXPO_PUBLIC_SUPABASE_ANON_KEY:own(env,'CARMAZIUM_QA_SUPABASE_ANON_KEY'),
      EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY:own(env,'CARMAZIUM_QA_STRIPE_PUBLISHABLE_KEY'),
    },
  };
  return {app:nextApp,eas:nextEas};
}

const runningAsCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runningAsCli) {
  const args = process.argv.slice(2);
  const prepare = args.includes('--prepare');
  const inActions = process.env.CI === 'true' && process.env.GITHUB_ACTIONS === 'true';
  let verdict;
  try {
    if (prepare && !inActions) throw new Error('Ephemeral EAS config may only be generated on a CI checkout');
    const appPath = resolve(root,'carmazium app/carmazium app/app.json');
    const easPath = resolve(root,'carmazium app/carmazium app/eas.json');
    const app = JSON.parse(readFileSync(appPath,'utf8'));
    const eas = JSON.parse(readFileSync(easPath,'utf8'));
    verdict = validateIsolatedQa(process.env,app,eas);
    if (prepare && verdict.ok) {
      const next = createIsolatedQaConfig(process.env,app,eas);
      writeFileSync(appPath,JSON.stringify(next.app,null,2)+'\n',{mode:0o600});
      writeFileSync(easPath,JSON.stringify(next.eas,null,2)+'\n',{mode:0o600});
      console.log('Prepared isolated READ-ONLY QA config in ephemeral CI checkout.');
      console.log('No production app profile, signing, OTA or credentials were edited in GitHub.');
    }
  } catch (err) { verdict={ok:false,errors:[String(err?.message||err)]}; }
  console.log('CarMazium Issue #477 QA isolation preflight: '+(verdict.ok?'PASS':'BLOCKED'));
  for (const error of verdict.errors) console.error(' - '+error);
  if (!verdict.ok) process.exitCode=1;
}
