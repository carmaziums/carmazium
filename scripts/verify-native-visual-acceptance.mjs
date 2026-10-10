#!/usr/bin/env node
/**
 * Issue #477 visual acceptance gate. This is deliberately separate from the
 * source TypeScript/test suite. No private screenshots or tokens enter GitHub.
 * If an actual iOS/Android/web comparison is missing, acceptance FAILS CLOSED.
 *
 * Use on a controlled workstation:
 * node scripts/verify-native-visual-acceptance.mjs --manifest /private/qa/issue477.json --sha <git-sha>
 */
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VIEWPORTS = Object.freeze(['360x800', '390x844']);
export const REQUIRED_SCENARIOS = Object.freeze([
  { id: 'D01', role: 'dealer_owner', screen: 'dashboard' },
  { id: 'D02', role: 'dealer_owner', screen: 'stock' },
  { id: 'D03', role: 'dealer_owner', screen: 'customers' },
  { id: 'D04', role: 'dealer_owner', screen: 'buy-and-bid' },
  { id: 'D05', role: 'dealer_owner', screen: 'account-settings' },
  { id: 'D06', role: 'dealer_staff_restricted', screen: 'permission-denied' },
  { id: 'B01', role: 'buyer', screen: 'home' },
  { id: 'B02', role: 'buyer', screen: 'retail-browse' },
  { id: 'B03', role: 'buyer', screen: 'vehicle-detail' },
  { id: 'B04', role: 'buyer', screen: 'saved-cars' },
  { id: 'S01', role: 'seller', screen: 'sell-and-valuation' },
  { id: 'S02', role: 'seller', screen: 'listing-wizard' },
  { id: 'X01', role: 'contractor', screen: 'jobs-dashboard' },
  { id: 'X02', role: 'finance_partner', screen: 'partner-dashboard' },
  { id: 'X03', role: 'dealer_owner', screen: 'messages-and-notifications' },
  { id: 'X04', role: 'dealer_owner', screen: 'mazium-assistant-and-consent' },
]);
export const MANUAL_CHECKS = Object.freeze([
  'androidInstall', 'iosInstall', 'buyerCannotBid', 'dealerKycAndStaffPermissions',
  'auctionRetailPricing', 'valuationAndListing', 'wonAuctionHandover',
  'savedAndChatCrossClient', 'notifications', 'talkBack', 'voiceOver',
  'largeText200Percent', 'keyboardAndSafeAreas', 'nativeLightTheme',
  'maziumDisclosureAndConsent', 'noDeadControls',
]);

const HEX_SHA = /^[a-f0-9]{40}$/i;
const HEX_256 = /^[a-f0-9]{64}$/i;
const LIVE_HOSTS = new Set([
  'carmazium-hjoh9w.fly.dev', 'carmazium.com', 'www.carmazium.com',
]);
const isText = s => typeof s === 'string' && s.trim().length > 0;
const isSha = s => isText(s) && HEX_SHA.test(s);
const imageNames = ['web', 'android', 'ios'];

const inPrivateFolder = (base, candidate) => {
  if (!isText(candidate) || isAbsolute(candidate)) return false;
  const absolute = resolve(base, candidate);
  const rel = relative(base, absolute);
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
};

/** Check the actual PNG bytes; never trust filenames or metadata alone. */
export const readPngEvidence = (base, attachment) => {
  if (!attachment || !inPrivateFolder(base, attachment.path) || !HEX_256.test(attachment.sha256 || '')) {
    throw new Error('Screenshot path/hash missing or outside the private evidence folder');
  }
  // Verify real paths too: a symlink inside the private folder must not
  // allow this release gate to read unrelated personal files elsewhere.
  const baseReal = realpathSync(base);
  const imageReal = realpathSync(resolve(base, attachment.path));
  const onDiskRelative = relative(baseReal, imageReal);
  if (!onDiskRelative || onDiskRelative === '..' || onDiskRelative.startsWith('..' + sep)
      || isAbsolute(onDiskRelative)) {
    throw new Error('Screenshot resolves outside the private evidence folder');
  }
  const bytes = readFileSync(imageReal);
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
      || bytes.subarray(12,16).toString() !== 'IHDR') {
    throw new Error('Evidence must be a valid PNG screenshot');
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash.toLowerCase() !== attachment.sha256.toLowerCase()) {
    throw new Error('Screenshot sha256 does not match the file');
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

/** Pure acceptance checker; evidenceReader can be substituted only in unit tests. */
export const evaluateVisualAcceptance = (manifest, opts = {}) => {
  const errors = [];
  const add = detail => errors.push(detail);
  const base = opts.base || process.cwd();
  const expectedSha = opts.expectedSha;
  const imageReader = opts.imageReader || (record => readPngEvidence(base, record));
  if (!manifest || manifest.version !== 1) return { approved: false, errors: ['Manifest must use version 1'] };

  if (!isSha(expectedSha)) add('Expected source commit must be a 40-character Git SHA');
  if (!isSha(manifest.sourceCommit) ||
      (isSha(expectedSha) && expectedSha.toLowerCase() !== manifest.sourceCommit.toLowerCase())) {
    add('Evidence sourceCommit does not match the exact tested app/web source SHA');
  }
  if (manifest.repository !== 'carmaziums/carmazium' || manifest.issue !== 477) {
    add('Evidence must be scoped to carmaziums/carmazium Issue #477');
  }
  const staging = manifest.staging || {};
  let origin;
  try { origin = new URL(staging.apiUrl); } catch { /* invalid URL handled below */ }
  if (!origin || origin.protocol !== 'https:' || LIVE_HOSTS.has(origin.hostname.toLowerCase()) ||
      !isText(staging.approvedBy) || staging.syntheticDataOnly !== true ||
      staging.separateFromProduction !== true) {
    add('Approved isolated HTTPS staging with synthetic-only data is required; live Fly/backend or website are forbidden');
  }
  if (manifest.privateStorage !== true || manifest.redactedOfPersonalData !== true ||
      manifest.userConsentForCapture !== true || !isText(manifest.tester) ||
      !isText(manifest.reviewer) || manifest.reviewer === manifest.tester) {
    add('Private/redacted screenshots, capture consent and independent tester/reviewer are required');
  }
  if (!isText(manifest.testedAt) || !Number.isFinite(Date.parse(manifest.testedAt))) {
    add('Test timestamp required');
  }
  const checks = manifest.manualChecks || {};
  for (const name of MANUAL_CHECKS) {
    if (checks[name]?.result !== 'pass' || !isText(checks[name]?.tester) ||
        !isText(checks[name]?.evidence)) add('Device/role acceptance check not signed off: ' + name);
  }

  const records = manifest.pairs;
  if (!Array.isArray(records)) {
    add('No web/native image pairs supplied');
    return { approved: false, errors };
  }
  const expectedPairs = new Set(REQUIRED_SCENARIOS.flatMap(s => VIEWPORTS.map(v => s.id + '@' + v)));
  const seen = new Set();
  for (const record of records) {
    const key = String(record?.id) + '@' + String(record?.viewport);
    if (seen.has(key)) { add('Duplicate screen pair: ' + key); continue; }
    seen.add(key);
    const scenario = REQUIRED_SCENARIOS.find(s => s.id === record?.id);
    if (!expectedPairs.has(key) || !scenario || scenario.role !== record.role || scenario.screen !== record.screen) {
      add('Unexpected or incorrectly attributed screen/role: ' + key);
      continue;
    }
    if (!isText(record.fixtureId) || !isText(record.theme) ||
        record.stateMatch !== true || record.humanReview?.result !== 'pass' ||
        record.humanReview?.reviewer !== manifest.reviewer ||
        !isText(record.humanReview?.notes)) {
      add('Same fixture/state/theme and reviewer visual comparison missing: ' + key);
    }
    const [width,height] = record.viewport.split('x').map(Number);
    for (const platform of imageNames) {
      const attachment = record.screenshots?.[platform];
      const pixelRatio = attachment?.pixelRatio;
      if (!Number.isFinite(pixelRatio) || pixelRatio < 1 || pixelRatio > 5) {
        add(platform + ' pixelRatio missing or impossible: ' + key); continue;
      }
      try {
        const dimensions = imageReader(attachment);
        if (dimensions.width !== Math.round(width * pixelRatio) ||
            dimensions.height !== Math.round(height * pixelRatio)) {
          add(platform + ' PNG resolution does not match captured viewport/density: ' + key);
        }
      } catch (e) {
        add(platform + ' screenshot invalid/missing: ' + key + ' — ' + e.message);
      }
    }
  }
  for (const key of expectedPairs) if (!seen.has(key)) add('Missing website/Android/iOS visual pair: ' + key);
  if (manifest.finalDecision !== 'APPROVED' ||
      manifest.finalReviewer !== manifest.reviewer ||
      !isText(manifest.finalNotes)) {
    add('Independent reviewer has not approved the complete release candidate');
  }
  return { approved: errors.length === 0, errors, requiredPairCount: expectedPairs.size };
};

const runningAsCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runningAsCli) {
  const args = process.argv.slice(2);
  const valueOf = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const manifestPath = valueOf('--manifest');
  const expectedSha = valueOf('--sha');
  let result;
  try {
    if (!manifestPath) throw new Error('Missing --manifest path (private on-device QA report)');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    result = evaluateVisualAcceptance(manifest, { base: dirname(resolve(manifestPath)), expectedSha });
  } catch (error) {
    result = { approved: false, errors: [String(error.message || error)] };
  }
  console.log('Issue #477 visual acceptance: ' + (result.approved ? 'APPROVED' : 'BLOCKED'));
  for (const err of result.errors) console.error(' - ' + err);
  if (!result.approved) process.exitCode = 1;
}
