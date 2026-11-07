import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { createHash } from 'node:crypto';

/**
 * "Online now" counter for admins: website vs app, by platform.
 *
 * Clients send a heartbeat about once a minute while the page/app is on
 * screen. A visitor counts as online for ONLINE_WINDOW_MS after their last
 * heartbeat. The visitor id is random, lives only in memory on the client
 * (nothing stored on the device) and is never written to the database.
 *
 * Uses Redis when REDIS_URL is set (accurate across machines); otherwise an
 * in-memory map, which is exact while one API machine serves traffic.
 */
export const ONLINE_WINDOW_MS = 2 * 60_000;
export const SURFACES = ['web', 'app'] as const;
export const PLATFORMS = ['desktop', 'mobile', 'installed', 'android', 'ios'] as const;
export type Surface = (typeof SURFACES)[number];
export type PresencePlatform = (typeof PLATFORMS)[number];

export interface HeartbeatInput { visitorId?: unknown; surface?: unknown; platform?: unknown }
export interface PresenceRecord { surface: Surface; platform: PresencePlatform; signedIn: boolean }

export function normaliseHeartbeat(input: HeartbeatInput, signedIn: boolean): ({ visitorId: string } & PresenceRecord) | null {
    const visitorId = typeof input?.visitorId === 'string' ? input.visitorId.trim() : '';
    if (!/^[A-Za-z0-9-]{8,64}$/.test(visitorId)) return null;
    const surface = (SURFACES as readonly string[]).includes(input?.surface as string) ? (input.surface as Surface) : null;
    if (!surface) return null;
    let platform = (PLATFORMS as readonly string[]).includes(input?.platform as string) ? (input.platform as PresencePlatform) : null;
    if (!platform) platform = surface === 'app' ? 'android' : 'desktop';
    if (surface === 'app' && platform !== 'android' && platform !== 'ios') platform = 'android';
    if (surface === 'web' && (platform === 'android' || platform === 'ios')) platform = 'mobile';
    return { visitorId, surface, platform, signedIn };
}

export function summariseOnline(records: PresenceRecord[]) {
    const web = { total: 0, signedIn: 0, desktop: 0, mobile: 0, installed: 0 };
    const app = { total: 0, signedIn: 0, android: 0, ios: 0 };
    for (const r of records) {
        if (r.surface === 'app') {
            app.total += 1;
            if (r.signedIn) app.signedIn += 1;
            if (r.platform === 'ios') app.ios += 1; else app.android += 1;
        } else {
            web.total += 1;
            if (r.signedIn) web.signedIn += 1;
            if (r.platform === 'mobile') web.mobile += 1;
            else if (r.platform === 'installed') web.installed += 1;
            else web.desktop += 1;
        }
    }
    return { total: web.total + app.total, web, app };
}

@Injectable()
export class OnlinePresenceService implements OnModuleDestroy {
    private readonly logger = new Logger(OnlinePresenceService.name);
    private readonly memory = new Map<string, { at: number; record: PresenceRecord }>();
    private readonly redis: Redis | null;
    private static readonly ZSET = 'cm:online:v1:seen';
    private static readonly HASH = 'cm:online:v1:meta';

    constructor() {
        const url = process.env.REDIS_URL;
        this.redis = url ? new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false }) : null;
        this.redis?.on('error', (e) => this.logger.warn(`Online presence Redis error: ${e.message}`));
    }

    onModuleDestroy() { this.redis?.disconnect(); }

    /** Only a server-verified user ID can count as signed in. Never trust body.signedIn. */
    async heartbeat(input: HeartbeatInput, verifiedUserId: string | null = null, now = Date.now()): Promise<boolean> {
        const hb = normaliseHeartbeat(input, Boolean(verifiedUserId));
        if (!hb) return false;
        // One authenticated account counts once per surface, even with several tabs.
        // Guests remain anonymous browser sessions, not provably unique people.
        const storageKey = verifiedUserId
            ? `verified-${createHash('sha256').update(verifiedUserId).digest('hex').slice(0, 40)}-${hb.surface}`
            : hb.visitorId;
        const record: PresenceRecord = { surface: hb.surface, platform: hb.platform, signedIn: hb.signedIn };
        if (this.redis) {
            try {
                const tx = this.redis.multi();
                if (verifiedUserId) {
                    // Remove the same tab's earlier anonymous heartbeat after login.
                    tx.zrem(OnlinePresenceService.ZSET, hb.visitorId)
                        .hdel(OnlinePresenceService.HASH, hb.visitorId);
                }
                await tx.zadd(OnlinePresenceService.ZSET, now, storageKey)
                    .hset(OnlinePresenceService.HASH, storageKey, JSON.stringify(record))
                    .exec();
                return true;
            } catch { /* fall through to memory */ }
        }
        if (verifiedUserId) this.memory.delete(hb.visitorId);
        this.memory.set(storageKey, { at: now, record });
        if (this.memory.size > 50_000) this.prune(now);
        return true;
    }

    private prune(now: number) {
        for (const [id, v] of this.memory) if (now - v.at > ONLINE_WINDOW_MS) this.memory.delete(id);
    }

    async online(now = Date.now()) {
        let records: PresenceRecord[] = [];
        let fromRedis = false;
        if (this.redis) {
            try {
                const cutoff = now - ONLINE_WINDOW_MS;
                const stale = await this.redis.zrangebyscore(OnlinePresenceService.ZSET, 0, cutoff);
                if (stale.length) {
                    await this.redis.multi()
                        .zremrangebyscore(OnlinePresenceService.ZSET, 0, cutoff)
                        .hdel(OnlinePresenceService.HASH, ...stale)
                        .exec();
                }
                const ids = await this.redis.zrangebyscore(OnlinePresenceService.ZSET, cutoff + 1, '+inf');
                const metas = ids.length ? await this.redis.hmget(OnlinePresenceService.HASH, ...ids) : [];
                records = metas.flatMap(m => { try { return m ? [JSON.parse(m) as PresenceRecord] : []; } catch { return []; } });
                fromRedis = true;
            } catch { /* fall back to memory */ }
        }
        if (!fromRedis) {
            this.prune(now);
            records = [...this.memory.values()].map(v => v.record);
        }
        return { ...summariseOnline(records), windowSeconds: ONLINE_WINDOW_MS / 1000, updatedAt: new Date(now).toISOString() };
    }
}
