/**
 * Synthetic-only, one-shot externally routed authentication proof.
 *
 * The disposable key stays in this staging Node process's RAM, is never put
 * in GitHub, sent to the model, printed or written to persistent storage.
 * This module is imported ONLY by staging.main.ts, not the real AppModule.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { SimpleDmsGuard } from './simpledms.guard';

const AUCTION_ID = '11111111-1111-4111-8111-111111111111';
const key = randomBytes(48).toString('base64url');
const digest = createHash('sha256').update(key, 'utf8').digest('hex');
const instance = randomBytes(12).toString('hex');
const maxKeyAgeMs = 5 * 60_000;
const born = Date.now();
let allowed = process.env.STAGING_HOSTED_AUTH_PROBE_ENABLED === 'true';
let state: 'disabled' | 'pending' | 'passed' | 'failed' = allowed ? 'pending' : 'disabled';
let testsPassed = 0;

/** The standard guard is reused, without replacing or even reading the raw
 * existing stage key. The extra digest exists only until the one-shot proof
 * succeeds or expires. The separate synthetic stage has no DB or live data.
 */
export function stagingGuard(config: ConfigService): SimpleDmsGuard {
  const original = config.get<string>('PARTNER_API_SIMPLEDMS_KEY_SHA256') || '';
  const originalValid = original.split(',').some((hash) => /^[a-fA-F0-9]{64}$/.test(hash.trim()));
  const wrapped = {
    get: (name: string) => {
      const ordinary = config.get<string>(name);
      if (name === 'PARTNER_API_SIMPLEDMS_KEY_SHA256' && originalValid &&
          allowed && state === 'pending' && Date.now() - born < maxKeyAgeMs) {
        return original + ',' + digest;
      }
      return ordinary;
    },
  } as unknown as ConfigService;
  return new SimpleDmsGuard(wrapped);
}

export function proofInstance(): string {
  return instance;
}

export function proofHealth() {
  return {
    state,
    checksPassed: testsPassed,
    disposableCredentialAccepted: allowed && state === 'pending',
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
        testsPassed = 6; // self-instance, anonymous, incorrect, list, pagination/detail, asset
        state = 'passed';
        allowed = false; // key is invalid for all later requests
        return;
      } catch {
        // Never print the key, HTTP request, partner response or endpoint.
        // Transient failures can occur while the public deployment cuts over.
      }
    }
  } finally {
    if (state !== 'passed') state = 'failed';
    allowed = false; // fail closed after the bounded attempt window
  }
}
