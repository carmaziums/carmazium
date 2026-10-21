/**
 * Synthetic-only, one-shot externally routed authentication proof.
 *
 * The disposable key stays in this staging Node process's RAM, is never put
 * in GitHub, sent to the model, printed or written to persistent storage.
 * This module is imported ONLY by staging.main.ts, not the real AppModule.
 */
import { createHash, randomBytes } from 'node:crypto';

const AUCTION_ID = '11111111-1111-4111-8111-111111111111';
const key = randomBytes(48).toString('base64url');
const digest = createHash('sha256').update(key, 'utf8').digest('hex');
const instance = randomBytes(12).toString('hex');
const maxKeyAgeMs = 5 * 60_000;
const born = Date.now();
let allowed = process.env.STAGING_HOSTED_AUTH_PROBE_ENABLED === 'true';
let state: 'disabled' | 'pending' | 'passed' | 'failed' = allowed ? 'pending' : 'disabled';
let testsPassed = 0;

/**
 * Staging bootstrap installs a ONE-TIME digest in this process ONLY, before
 * Nest ConfigModule and the unchanged real SimpleDmsGuard are instantiated.
 * Railway's original digest is never overwritten in its persisted settings.
 */
let originalDigest: string | null = null;
let installed = false;
export function installHostedProofDigest() {
  if (!allowed || process.env.STAGING_SYNTHETIC_ONLY !== 'true' ||
      process.env.DATABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.STRIPE_SECRET_KEY) return;
  const original = process.env.PARTNER_API_SIMPLEDMS_KEY_SHA256 || '';
  if (!original.split(',').some((h) => /^[a-fA-F0-9]{64}$/.test(h.trim()))) return;
  originalDigest = original;
  process.env.PARTNER_API_SIMPLEDMS_KEY_SHA256 = original + ',' + digest;
  installed = true;
}

function revokeHostedProofDigest() {
  allowed = false;
  if (originalDigest !== null) {
    process.env.PARTNER_API_SIMPLEDMS_KEY_SHA256 = originalDigest;
    installed = false;
  }
}

export function proofInstance(): string {
  return instance;
}

export function proofHealth() {
  return {
    state,
    checksPassed: testsPassed,
    disposableCredentialAccepted: installed && allowed && state === 'pending',
    // Never include the raw key, digest, request headers or customer data.
  };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function request(url: string, maybeKey?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (maybeKey) headers['X-Partner-Key'] = maybeKey;
  return fetch(url, { headers, signal: AbortSignal.timeout(7000), redirect: 'error' });
}

/**
 * Start ONLY after the isolated stage has started its HTTP listener.
 * It waits until Railway's public HTTPS endpoint routes back to *this*
 * deployment, then exercises the actual hosted guard, controller, fixture,
 * pagination and demo-vehicle image over the external Railway HTTPS origin.
 */
export async function runHostedProof(host: string) {
  if (!allowed) return;
  if (!installed) { state = 'failed'; allowed = false; return; }
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.up\.railway\.app$/.test(host) ||
      process.env.STAGING_SYNTHETIC_ONLY !== 'true' ||
      !process.env.PARTNER_API_SIMPLEDMS_KEY_SHA256?.split(',')
        .some((hash) => /^[a-fA-F0-9]{64}$/.test(hash.trim()))) {
    state = 'failed';
    allowed = false;
    return;
  }
  const origin = 'https://' + host;
  const list = origin + '/partners/v1/simpledms/auctions';
  try {
    for (let i = 0; i < 23 && Date.now() - born < maxKeyAgeMs; i++) {
      await sleep(i === 0 ? 9000 : 9000);
      try {
        const health = await request(origin + '/health/live');
        if (health.status !== 200 ||
            health.headers.get('x-carmazium-synthetic-instance') !== instance) {
          // A previous deployment may remain on the external address until
          // the new container has passed Railway's healthcheck and cutover.
          continue;
        }
        const body = await health.json() as Record<string, unknown>;
        if (body.syntheticOnly !== true) continue;

        const anonymous = await request(list);
        const incorrect = await request(list, 'wrong-synthetic-key-of-over-32-characters');
        if (anonymous.status !== 401 || incorrect.status !== 401) {
          throw Error('Anonymous or incorrect-key denial failed');
        }

        const authed = await request(list + '?page=1&limit=25', key);
        if (authed.status !== 200 || authed.headers.get('x-carmazium-synthetic-instance') !== instance) {
          throw Error('Hosted authenticated list rejected');
        }
        const data = await authed.json() as {
          pagination?: { total?: number; hasMore?: boolean };
          auctions?: Array<{ id?: string; title?: string; url?: string }>;
        };
        if (data.pagination?.total !== 1 || data.pagination?.hasMore ||
            data.auctions?.length !== 1 ||
            data.auctions[0]?.id !== AUCTION_ID ||
            !data.auctions[0]?.title?.startsWith('SYNTHETIC TEST:') ||
            !data.auctions[0]?.url?.startsWith(origin + '/staging-auctions/')) {
          throw Error('Hosted response does not match isolated synthetic contract');
        }

        const next = await request(list + '?page=2&limit=25', key);
        const nextData = next.status === 200 ? await next.json() as {
          pagination?: { total?: number }; auctions?: unknown[];
        } : null;
        if (next.status !== 200 || nextData?.pagination?.total !== 1 ||
            nextData.auctions?.length !== 0) {
          throw Error('Hosted pagination failed');
        }
        const detail = await request(list + '/' + AUCTION_ID, key);
        const detailData = detail.status === 200 ? await detail.json() as {
          auction?: { id?: string };
        } : null;
        if (detailData?.auction?.id !== AUCTION_ID) {
          throw Error('Hosted authenticated detail failed');
        }
        const asset = await request(origin + '/staging-assets/demo-vehicle.svg');
        if (asset.status !== 200 || !(await asset.text()).includes('SYNTHETIC TEST VEHICLE')) {
          throw Error('Hosted demo image failed');
        }
        // Revoke the disposable digest IN THE ACTUAL GUARD CONFIGURATION.
        // The original staging key digest is preserved. Independently prove
        // the previously accepted disposable key is now HTTP 401 over HTTPS.
        revokeHostedProofDigest();
        const revoked = await request(list, key);
        if (revoked.status !== 401) {
          state = 'failed';
          return;
        }
        testsPassed = 7; // public routing, denials, list, pagination/detail, asset, revocation
        state = 'passed';
        return;
      } catch {
        // Never print the key, HTTP request, partner response or endpoint.
        // Transient failures can occur while the public deployment cuts over.
      }
    }
  } finally {
    if (state !== 'passed') state = 'failed';
    revokeHostedProofDigest(); // fail closed after bounded attempt window
  }
}
