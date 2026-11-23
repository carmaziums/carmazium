#!/usr/bin/env node
/**
 * Original iPhone candidate verification only. Never builds, submits or publishes.
 * EAS fields are read explicitly: eas-cli 16.18.0's build:view fragment omits
 * appIdentifier even though it exists in the Build GraphQL schema.
 */
import { readFileSync, writeFileSync, readdirSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = '9c77bb81-205c-42f8-913e-b69a0953ec10';
const BUNDLE_ID = 'uk.carmazium.app';
const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/i;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const APP_DIR = 'carmazium app/carmazium app/';

export function validateIosCandidateRequest(env) {
  if (env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      env.REVIEW_APPROVAL !== 'INTERNAL_REVIEW_ONLY' ||
      env.REVIEW_SUBMISSION !== 'UPLOAD_REVIEWED_CANDIDATE')
    throw new Error('New IPA upload requires main, manual dispatch and the explicit internal-review upload choice');
  if (!SHA40.test(env.REVIEW_SOURCE_SHA || '') || env.REVIEW_SOURCE_SHA !== env.GITHUB_SHA)
    throw new Error('Reviewed source SHA must equal the exact checked-out main commit');
  if (!UUID.test(env.REVIEW_BUILD_ID || '')) throw new Error('An explicit EAS build UUID is required');
  if (!SHA64.test(env.REVIEW_IPA_SHA256 || '')) throw new Error('An explicit reviewed IPA SHA-256 is required');
  return {
    sourceSha: env.REVIEW_SOURCE_SHA,
    buildId: env.REVIEW_BUILD_ID.toLowerCase(),
    expectedIpaSha256: env.REVIEW_IPA_SHA256.toLowerCase(),
  };
}

export function validateIosCandidateMetadata(build, env) {
  const request = validateIosCandidateRequest(env);
  if (!build || build.id !== request.buildId || build.status !== 'FINISHED' ||
      build.platform !== 'IOS' || build.distribution !== 'STORE' ||
      build.buildProfile !== 'production' || build.channel !== 'production' ||
      build.isForIosSimulator !== false || build.developmentClient === true)
    throw new Error('EAS build must be the selected finished production iOS store candidate');
  if (build.project?.id !== PROJECT_ID || build.project?.ownerAccount?.name !== 'carmazium' ||
      build.appIdentifier !== BUNDLE_ID || build.appVersion !== '1.0.2' ||
      build.runtimeVersion !== '1.0.2')
    throw new Error('EAS candidate project, original bundle, version or runtime does not match');
  if (build.gitCommitHash !== request.sourceSha)
    throw new Error('EAS candidate source SHA is missing or differs from the reviewed checkout');
  if (!/^[0-9]+(?:\.[0-9]+){0,2}$/.test(build.appBuildVersion || ''))
    throw new Error('EAS candidate has no valid iOS build number');
  const artifact = build.artifacts?.applicationArchiveUrl || build.artifacts?.buildUrl;
  let url;
  try { url = new URL(artifact); } catch { throw new Error('EAS IPA artifact URL is missing'); }
  if (url.protocol !== 'https:' || url.hostname !== 'expo.dev' || url.port ||
      url.username || url.password || !url.pathname.startsWith('/artifacts/eas/') ||
      !url.pathname.endsWith('.ipa'))
    throw new Error('IPA download must use the verified EAS HTTPS artifact endpoint');
  return {
    evidence_schema: 1,
    artifact_kind: 'INTERNAL_REVIEW_ONLY',
    approved_for_customer_distribution: false,
    source_sha: request.sourceSha,
    eas_build_id: request.buildId,
    project_id: PROJECT_ID,
    bundle_identifier: BUNDLE_ID,
    app_version: '1.0.2',
    app_build_version: build.appBuildVersion,
    runtime_version: '1.0.2',
    channel: 'production',
    expected_ipa_sha256: request.expectedIpaSha256,
    artifact_url: url.href,
  };
}

const excluded = path => path === '.easignore' || path.startsWith('.env') ||
  path.split('/').some(part => ['node_modules', '.git', '.expo', 'ios', 'android'].includes(part)) ||
  /\.(pem|p12|p8|mobileprovision)$/.test(path);

export function verifyStagedIosSource(repositoryRoot, stagePath, sourceSha) {
  if (!SHA40.test(sourceSha || '')) throw new Error('Invalid staged source SHA');
  const repository = resolve(repositoryRoot), stage = resolve(stagePath);
  if (stage.includes(' ')) throw new Error('iOS staging path contains spaces');
  for (const cwd of [repository, stage]) {
    const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    if (actual !== sourceSha) throw new Error('Staging must retain the actual reviewed Git commit');
  }
  // A matching HEAD alone is insufficient: dependency scripts must not have
  // changed the original tracked app before its bytes are copied into staging.
  try {
    execFileSync('git', ['diff', '--quiet', '--no-ext-diff', sourceSha, '--', APP_DIR], { cwd: repository });
  } catch { throw new Error('Original app source differs from the reviewed Git commit'); }
  const files = execFileSync('git', ['ls-files', '-z', '--', APP_DIR], { cwd: repository, encoding: 'utf8' })
    .split('\0').filter(Boolean).map(file => file.slice(APP_DIR.length)).filter(file => !excluded(file));
  if (!files.includes('app.json') || !files.includes('package-lock.json') || !files.includes('index.js'))
    throw new Error('Reviewed app source is incomplete');
  const expected = new Set(files);
  for (const file of files) {
    const original = join(repository, APP_DIR, file), copied = join(stage, file);
    if (!lstatSync(original).isFile() || !lstatSync(copied).isFile() ||
        !readFileSync(original).equals(readFileSync(copied)))
      throw new Error('Staged app differs from reviewed source: ' + file);
  }
  function inspect(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name), file = relative(stage, full).split(sep).join('/');
      if (excluded(file)) continue;
      if (entry.isDirectory()) inspect(full);
      else if (!entry.isFile() || !expected.has(file))
        throw new Error('Unexpected file in staged app: ' + file);
    }
  }
  inspect(stage);
  return { source_sha: sourceSha, checked_files: files.length };
}

async function fetchCandidate(env, outputPath) {
  const request = validateIosCandidateRequest(env);
  if (!env.EXPO_TOKEN) throw new Error('Previously connected Expo signing account is required');
  const query = 'query ReviewedIosCandidate($buildId: ID!) { builds { byId(buildId: $buildId) { id status platform distribution buildProfile channel appIdentifier appVersion appBuildVersion runtimeVersion gitCommitHash isForIosSimulator developmentClient project { id ... on App { ownerAccount { name } } } artifacts { applicationArchiveUrl buildUrl } } } }';
  const response = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.EXPO_TOKEN },
    body: JSON.stringify({ query, variables: { buildId: request.buildId } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('EAS build metadata request failed');
  const result = await response.json();
  if (result.errors?.length || !result.data?.builds?.byId)
    throw new Error('EAS did not authorize or return the selected build metadata');
  const evidence = validateIosCandidateMetadata(result.data.builds.byId, env);
  writeFileSync(outputPath, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Original iOS candidate metadata matches the explicit reviewed source, build and IPA hash.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, ...args] = process.argv.slice(2);
    if (mode === 'request' && !args.length) {
      validateIosCandidateRequest(process.env);
      console.log('Explicit source, build UUID and IPA checksum supplied for Apple processing only.');
    } else if (mode === 'fetch' && args.length === 1) {
      await fetchCandidate(process.env, args[0]);
    } else if (mode === 'stage' && args.length === 3) {
      const checked = verifyStagedIosSource(...args);
      console.log('Reviewed app source bytes verified in the space-free Git staging checkout: ' + checked.checked_files);
    } else throw new Error('Usage: request | fetch <metadata.json> | stage <repository> <stage> <source-sha>');
  } catch (error) {
    console.error('iOS candidate verification blocked: ' + error.message);
    process.exitCode = 1;
  }
}
