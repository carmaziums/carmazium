/**
 * Offline SimpleDMS synthetic staging contract. Never imports production AppModule,
 * connects to any database, or loads provider credentials.
 * Every key is generated inside the disposable CI process and NEVER printed.
 */
const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { setTimeout: sleep } = require('node:timers/promises');
const path = require('node:path');

const binary = path.join(__dirname, '../../dist/partner-api/staging.main.js');
const host = 'partner-api-synthetic-production.up.railway.app'; // fixture only; no network request
const STAGING_AUCTION_ID = '11111111-1111-4111-8111-111111111111';
const ephemeralKey = randomBytes(36).toString('hex');
const digest = createHash('sha256').update(ephemeralKey).digest('hex');
let checks = 0;

function expect(ok, label) {
  assert.ok(ok, label);
  checks++;
}

async function request(port, endpoint, key) {
  const headers = key ? { 'X-Partner-Key': key } : {};
  const reply = await fetch('http://127.0.0.1:' + port + endpoint, { headers, redirect: 'manual' });
  const contentType = reply.headers.get('content-type') || '';
  return { status: reply.status, headers: reply.headers, data: contentType.includes('json') ? await reply.json() : await reply.text() };
}

async function start(port, additional = {}) {
  // Explicit allowlist: never inherit CI or developer credentials.
  const env = {
    PATH: process.env.PATH || '',
    HOME: process.env.HOME || '/tmp',
    NODE_ENV: 'test',
    PORT: String(port),
    STAGING_SYNTHETIC_ONLY: 'true',
    STAGING_PUBLIC_HOST: host,
    PARTNER_API_ENABLED: 'true',
    PARTNER_API_SIMPLEDMS_ENABLED: 'true',
    PARTNER_API_SIMPLEDMS_KEY_SHA256: digest,
    PARTNER_API_SIMPLEDMS_SHARE_IMAGES: 'false',
    PARTNER_API_SIMPLEDMS_SHARE_REGISTRATION: 'false',
    PARTNER_API_SIMPLEDMS_SHARE_REGION: 'false',
    PARTNER_API_SIMPLEDMS_SHARE_CURRENT_BID: 'false',
    PARTNER_API_SIMPLEDMS_REFERRALS_ENABLED: 'false',
    ...additional,
  };
  const child = spawn(process.execPath, [binary], { cwd: path.join(__dirname, '../..'), env, stdio: 'ignore' });
  const origin = 'http://127.0.0.1:' + port;
  for (let n = 0; n < 90; n++) {
    if (child.exitCode !== null) throw new Error('Synthetic staging exited before ready');
    try {
      const health = await fetch(origin + '/health/live');
      if (health.ok) return child;
    } catch (_) { /* Only localhost, not an external request. */ }
    await sleep(200);
  }
  child.kill('SIGTERM');
  throw new Error('Synthetic staging readiness timeout');
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  for (let n = 0; n < 50 && child.exitCode === null; n++) await sleep(100);
  if (child.exitCode === null) child.kill('SIGKILL');
}
async function forbiddenCredentialStartup() {
  const child = spawn(process.execPath, [binary], {
    cwd: path.join(__dirname, '../..'),
    env: {
      PATH: process.env.PATH || '', HOME: process.env.HOME || '/tmp',
      PORT: '41489', STAGING_SYNTHETIC_ONLY: 'true',
      DATABASE_URL: 'postgresql://synthetic-only-invalid.invalid/fake',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let combined = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    // Only local synthetic process messages; never print captured logs.
    combined += chunk.toString().slice(0, 4000);
  });
  const code = await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    sleep(12000).then(() => { child.kill('SIGKILL'); return 'timeout'; }),
  ]);
  expect(code !== 0 && code !== 'timeout' &&
    combined.includes('Synthetic staging must not receive production database, Stripe or Supabase credentials'),
    'synthetic staging refuses any database credential');
}

(async () => {
  let child;
  try {
    await forbiddenCredentialStartup();
    child = await start(41481, { PARTNER_API_ENABLED: 'false' });
    const health = await request(41481, '/health/live');
    expect(health.status === 200 && health.data.syntheticOnly === true, 'health identifies synthetic-only process');
    const disabled = await request(41481, '/partners/v1/simpledms/auctions', ephemeralKey);
    expect(disabled.status === 404, 'global kill-switch denies even a correct key');
    await stop(child);

    child = await start(41482);
    const missing = await request(41482, '/partners/v1/simpledms/auctions');
    expect(missing.status === 401, 'missing key denied');
    const wrong = await request(41482, '/partners/v1/simpledms/auctions', 'synthetic-incorrect-token-' + 'x'.repeat(40));
    expect(wrong.status === 401, 'incorrect key denied');
    const success = await request(41482, '/partners/v1/simpledms/auctions?page=1&limit=25', ephemeralKey);
    expect(success.status === 200 && success.data.pagination.total === 1 &&
      success.data.auctions?.length === 1, 'authenticated paginated synthetic feed');
    const a = success.data.auctions[0];
    expect(a.title.includes('SYNTHETIC TEST') && a.url.startsWith('https://' + host + '/staging-auctions/'),
      'only synthetic listing and non-production auction URL');
    expect(a.images.length === 0 && !('registration' in a.vehicle) &&
      !('currentBidGbp' in a.auction) && a.region === null,
      'optional private fields remain disabled by default');
    expect(!JSON.stringify(success.data).match(/sellerId|reservePrice|bidderId|privateKey|service_role/i),
      'no sensitive extra payload fields');
    expect((success.headers.get('cache-control') || '').includes('private'),
      'partner cache explicitly private');
    const page2 = await request(41482, '/partners/v1/simpledms/auctions?page=2&limit=25', ephemeralKey);
    expect(page2.status === 200 && page2.data.auctions.length === 0 &&
      page2.data.pagination.total === 1, 'empty second page retains correct total');
    const badLimit = await request(41482, '/partners/v1/simpledms/auctions?limit=51', ephemeralKey);
    expect(badLimit.status === 400, 'reject pagination above documented limit');
    const detail = await request(41482, '/partners/v1/simpledms/auctions/' + a.id, ephemeralKey);
    expect(detail.status === 200 && detail.data.auction.id === a.id, 'authenticated detail matches list');
    const unknown = await request(41482, '/partners/v1/simpledms/auctions/33333333-3333-4333-8333-333333333333', ephemeralKey);
    expect(unknown.status === 404, 'unknown fixture UUID rejected');
    const malformed = await request(41482, '/partners/v1/simpledms/auctions/not-a-uuid', ephemeralKey);
    expect(malformed.status === 400, 'malformed auction ID rejected');
    await stop(child);

    child = await start(41483, {
      PARTNER_API_SIMPLEDMS_SHARE_IMAGES: 'true',
      PARTNER_API_PUBLIC_IMAGE_HOSTS: host,
      PARTNER_API_SIMPLEDMS_SHARE_REGISTRATION: 'true',
      PARTNER_API_SIMPLEDMS_SHARE_REGION: 'true',
      PARTNER_API_SIMPLEDMS_ALLOWED_REGIONS: 'Birmingham',
      PARTNER_API_SIMPLEDMS_SHARE_CURRENT_BID: 'true',
    });
    const expanded = await request(41483, '/partners/v1/simpledms/auctions', ephemeralKey);
    const b = expanded.data.auctions[0];
    expect(expanded.status === 200 && b.images.length === 1 &&
      b.images[0] === 'https://' + host + '/staging-assets/demo-vehicle.svg',
      'explicitly approved synthetic image only');
    expect(b.vehicle.registration === 'STAGING-NOT-A-REAL-VRM',
      'registration released only when independently enabled');
    expect(b.auction.currentBidGbp === 5200,
      'current valid synthetic bid released only when enabled');
    expect(b.region === 'Birmingham', 'approved exact town only');
    expect(!b.referralUrl, 'no partner referral links without separate approval');
    await stop(child);

    child = await start(41484, { STAGING_SYNTHETIC_SCENARIO: 'pagination' });
    const p1 = await request(41484, '/partners/v1/simpledms/auctions?page=1&limit=25', ephemeralKey);
    const p2 = await request(41484, '/partners/v1/simpledms/auctions?page=2&limit=25', ephemeralKey);
    const p3 = await request(41484, '/partners/v1/simpledms/auctions?page=3&limit=25', ephemeralKey);
    expect(p1.status === 200 && p1.data.pagination.total === 51 &&
      p1.data.auctions.length === 25 && p1.data.pagination.hasMore === true,
      'pagination scenario page 1 returns first 25 of 51');
    expect(p2.status === 200 && p2.data.auctions.length === 25 &&
      p2.data.pagination.hasMore === true,
      'pagination scenario page 2 returns next 25');
    expect(p3.status === 200 && p3.data.auctions.length === 1 &&
      p3.data.pagination.hasMore === false,
      'pagination scenario page 3 returns final record');
    const ids = [...p1.data.auctions, ...p2.data.auctions, ...p3.data.auctions].map(v => v.id);
    expect(new Set(ids).size === 51, 'pagination scenario contains no duplicate auction IDs');
    await stop(child);

    child = await start(41485, { STAGING_SYNTHETIC_SCENARIO: 'withdrawn' });
    const withdrawn = await request(41485, '/partners/v1/simpledms/auctions?page=1&limit=25', ephemeralKey);
    const withdrawnDetail = await request(41485, '/partners/v1/simpledms/auctions/' + STAGING_AUCTION_ID, ephemeralKey);
    expect(withdrawn.status === 200 && withdrawn.data.pagination.total === 0 &&
      withdrawn.data.auctions.length === 0,
      'withdrawn lifecycle is represented by disappearance from full live feed');
    expect(withdrawnDetail.status === 404, 'withdrawn lifecycle detail is no longer live');
    await stop(child);

    child = await start(41486, { STAGING_SYNTHETIC_SCENARIO: 'ended' });
    const ended = await request(41486, '/partners/v1/simpledms/auctions?page=1&limit=25', ephemeralKey);
    const endedDetail = await request(41486, '/partners/v1/simpledms/auctions/' + STAGING_AUCTION_ID, ephemeralKey);
    expect(ended.status === 200 && ended.data.pagination.total === 0 &&
      ended.data.auctions.length === 0,
      'ended lifecycle is represented by disappearance from full live feed');
    expect(endedDetail.status === 404, 'ended lifecycle detail is no longer live');

    console.log('PASS: ' + checks + ' isolated synthetic partner-staging assertions; no credentials or customer data used.');
  } catch (error) {
    console.error('FAIL: synthetic staging contract check (' + (error && error.message || 'unspecified error') + ')');
    process.exitCode = 1;
  } finally {
    await stop(child);
  }
})();
