import { createHash } from 'crypto';
import type { LiveUkMarketSearchPhase, LiveUkMarketSearchResult } from './live-market-search';
import type { VehicleValuationInput } from './vehicle-valuation';
import { canonicalValuationMake, canonicalValuationModel } from './vehicle-valuation-identity';

export type MarketAttemptOrigin = 'NETWORK' | 'COALESCED' | 'SHORT_CACHE';

type PendingEntry = {
    state: 'PENDING';
    promise: Promise<LiveUkMarketSearchResult | null>;
};
type ReadyEntry = {
    state: 'READY';
    result: LiveUkMarketSearchResult;
    expiresAt: number;
};
type Entry = PendingEntry | ReadyEntry;

/**
 * Per-process request coalescing only by default. Retention of third-party
 * advert metadata is separately gated by confirmed contractual permission.
 * A 24-hour, vehicle-specific frozen valuation is handled by ListingsService.
 */
export class LiveMarketAttemptBroker {
    private readonly entries = new Map<string, Entry>();
    private readonly maxEntries = 256;
    private readonly positiveTtlMs = 60_000;
    private readonly counters = {
        network: 0,
        coalesced: 0,
        shortCache: 0,
    };

    constructor(private readonly now: () => number = Date.now) {}

    snapshotCounters(): Readonly<typeof this.counters> {
        return { ...this.counters };
    }

    private key(
        input: VehicleValuationInput,
        phase: LiveUkMarketSearchPhase,
        attempt: number,
    ): string {
        const make = canonicalValuationMake(input.make);
        // Preserve the exact model family, generation and derivative.
        const searchable = [
            make,
            canonicalValuationModel(input.model, input.make),
            input.year,
            input.mileage,
            (input.variant || '').trim().toUpperCase(),
            (input.fuelType || '').trim().toUpperCase(),
            (input.transmission || '').trim().toUpperCase(),
            (input.writeOffCategory || '').trim().toUpperCase(),
            phase,
            attempt,
        ];
        return createHash('sha256').update(JSON.stringify(searchable)).digest('hex');
    }

    async run(
        input: VehicleValuationInput,
        phase: LiveUkMarketSearchPhase,
        attempt: number,
        fetcher: () => Promise<LiveUkMarketSearchResult | null>,
        allowShortCache = false,
    ): Promise<{ result: LiveUkMarketSearchResult | null; origin: MarketAttemptOrigin }> {
        const key = this.key(input, phase, attempt);
        const old = this.entries.get(key);

        if (old?.state === 'PENDING') {
            this.counters.coalesced++;
            return { result: await old.promise, origin: 'COALESCED' };
        }
        if (old?.state === 'READY') {
            if (allowShortCache && old.expiresAt > this.now()) {
                this.counters.shortCache++;
                return { result: old.result, origin: 'SHORT_CACHE' };
            }
            this.entries.delete(key);
        }

        // Remove stale entries without evicting live shared promises. When all
        // capacity is occupied by pending requests, run directly instead of
        // evicting a request another caller is already awaiting.
        for (const [entryKey, entry] of this.entries) {
            if (entry.state === 'READY' && entry.expiresAt <= this.now()) {
                this.entries.delete(entryKey);
            }
        }
        if (this.entries.size >= this.maxEntries) {
            for (const [entryKey, entry] of this.entries) {
                if (entry.state === 'READY') {
                    this.entries.delete(entryKey);
                    break;
                }
            }
        }

        this.counters.network++;
        if (this.entries.size >= this.maxEntries) {
            return { result: await fetcher(), origin: 'NETWORK' };
        }

        // Schedule the fetch before inserting the entry, so concurrent callers
        // share its promise even when the fetcher settles synchronously.
        const promise = Promise.resolve().then(fetcher);
        const pending: PendingEntry = { state: 'PENDING', promise };
        this.entries.set(key, pending);

        try {
            const result = await promise;
            if (this.entries.get(key) === pending) {
                // Never retain outages, incomplete/empty evidence, or paid
                // provider records. This broker handles public-web adverts only.
                if (allowShortCache && result?.comparables?.length) {
                    this.entries.set(key, {
                        state: 'READY',
                        result,
                        expiresAt: this.now() + this.positiveTtlMs,
                    });
                } else {
                    this.entries.delete(key);
                }
            }
            return { result, origin: 'NETWORK' };
        } catch (error) {
            if (this.entries.get(key) === pending) this.entries.delete(key);
            throw error;
        }
    }
}

/**
 * Each planned search is one bounded attempt (the OpenAI client has retries
 * disabled). Reject impossible configuration instead of permitting hangs or
 * zero-length timeout loops.
 */
export function liveMarketTimeoutMs(raw?: string): number {
    const parsed = Number(raw);
    if (!raw || !Number.isFinite(parsed) || !Number.isInteger(parsed)) return 18_000;
    return Math.min(22_000, Math.max(10_000, parsed));
}
