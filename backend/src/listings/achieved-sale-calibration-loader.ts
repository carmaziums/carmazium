import { createHash } from 'crypto';
import type { PrismaService } from '../prisma/prisma.service';
import { canonicalValuationCacheParts, canonicalValuationIdentity } from './vehicle-valuation-identity';
import {
    evaluateAchievedAuctionCalibration,
    type AuctionCalibrationEvaluation,
    type CalibrationMode,
    type HistoricSalePrediction,
} from './achieved-sale-calibration';

const clean = (value?: string | null) =>
    (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const cacheKey = (parts: string[]) => 'valuation-base:' + hash(parts.join('|'));

/**
 * In an ON rollout, every eligible outcome must have been reviewed
 * individually; a global "data is verified" flag alone cannot upgrade the
 * seller's funds attestation into independent evidence.
 *
 * SHADOW can evaluate qualifying seller-attested handovers without making any
 * customer price change. ON selects ONLY the explicitly audited listing IDs.
 */
export function auditedAuctionIds(raw: string | undefined): Set<string> {
    return new Set((raw ?? '').split(',').map((id) => id.trim().toLowerCase())
        .filter((id) => /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id))
        .slice(0, 300));
}

export interface CalibrationVehicleInput {
    registration?: string | null;
    make: string;
    model: string;
    variant?: string | null;
    year: number;
    mileage: number;
}

/**
 * Read-only. Bounded database queries, no new tables/DB migrations, no raw
 * prices/VRMs/listing IDs leave this function. Failure simply returns a
 * nonqualifying evaluation; live valuations are never blocked by analytics.
 */
export async function assessHistoricalAuctionOutcomes(
    prisma: PrismaService,
    vehicle: CalibrationVehicleInput,
    mode: Exclude<CalibrationMode, 'off'>,
    auditedIds: Set<string>,
    now = Date.now(),
): Promise<AuctionCalibrationEvaluation> {
    const empty = evaluateAchievedAuctionCalibration([]);
    const normalized = canonicalValuationIdentity({
        registration: vehicle.registration,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        mileage: vehicle.mileage,
    });
    if (!normalized.registration || !normalized.model || !Number.isSafeInteger(vehicle.year)
        || !Number.isSafeInteger(vehicle.mileage) || vehicle.mileage < 0
        || (mode === 'on' && auditedIds.size < 30)) return empty;

    const raw = await prisma.listing.findMany({
        where: {
            deletedAt: null,
            vehicleType: 'CAR',
            type: 'AUCTION',
            status: 'SOLD',
            make: { equals: vehicle.make, mode: 'insensitive' },
            // Deliberately fail closed rather than blending distinct variants.
            model: { equals: vehicle.model, mode: 'insensitive' },
            year: { gte: vehicle.year - 1, lte: vehicle.year + 1 },
            mileage: { gte: Math.max(0, vehicle.mileage - 20_000),
                lte: vehicle.mileage + 20_000 },
            vrm: { not: null },
            auction: {
                is: {
                    status: 'ENDED',
                    sellerBonusReleased: true,
                    buyerFeePaid: true,
                    buyerRefusedAt: null,
                },
            },
            ...(mode === 'on' ? { id: { in: [...auditedIds] } } : {}),
        },
        select: {
            id: true, vrm: true, make: true, model: true,
            year: true, mileage: true, variant: true,
            auction: {
                select: {
                    status: true, startTime: true, sellerBonusReleased: true,
                    sellerBonusReleasedAt: true,
                    buyerFeePaid: true, winnerId: true,
                    winningBidAmount: true, buyerRefusedAt: true,
                    sellerFundsConfirmedAt: true,
                    sellerFundsConfirmationRequired: true,
                },
            },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
    });

    const variant = clean(vehicle.variant);
    const eligible = raw.filter((row) => {
        const auction = row.auction;
        const matching = canonicalValuationIdentity({
            registration: row.vrm,
            make: row.make ?? '',
            model: row.model ?? '',
            year: row.year ?? 0,
            mileage: row.mileage ?? -1,
        });
        return !!row.vrm
            && clean(row.vrm) !== normalized.registration // No self-fitting
            && matching.make === normalized.make
            && matching.model === normalized.model
            && clean(row.variant) === variant
            && !!auction && auction.status === 'ENDED'
            && auction.sellerBonusReleased === true && !!auction.sellerBonusReleasedAt
            && auction.buyerFeePaid === true && !!auction.winnerId
            && !auction.buyerRefusedAt
            && (!!auction.sellerFundsConfirmedAt
                || auction.sellerFundsConfirmationRequired === false)
            && Number(auction.winningBidAmount) >= 500
            && auction.sellerBonusReleasedAt.getTime() <= now;
    });
    if (eligible.length < 30) return empty;

    const parts = eligible.map((row) => ({
        row,
        key: cacheKey(canonicalValuationCacheParts({
            registration: row.vrm,
            make: row.make ?? '',
            model: row.model ?? '',
            variant: row.variant,
            year: row.year ?? 0,
            mileage: row.mileage ?? 0,
        })),
        genericKey: cacheKey(canonicalValuationCacheParts({
            registration: row.vrm,
            make: row.make ?? '',
            model: row.model ?? '',
            year: row.year ?? 0,
            mileage: row.mileage ?? 0,
        })),
    }));
    const sessionIds = [...new Set(parts.flatMap((entry) =>
        [entry.key, entry.genericKey]))];
    const events = await prisma.analyticsEvent.findMany({
        where: {
            type: 'valuation_base_snapshot',
            sessionId: { in: sessionIds },
            createdAt: {
                gte: new Date(now - 365 * 24 * 60 * 60_000),
                lte: new Date(now),
            },
        },
        select: { sessionId: true, createdAt: true, payload: true },
        orderBy: { createdAt: 'desc' },
        take: 600,
    });

    const byKey = new Map<string, typeof events>();
    for (const event of events) {
        if (!event.sessionId) continue;
        const existing = byKey.get(event.sessionId) ?? [];
        existing.push(event);
        byKey.set(event.sessionId, existing);
    }

    const pairs: HistoricSalePrediction[] = [];
    for (const { row, key, genericKey } of parts) {
        const end = row.auction!.sellerBonusReleasedAt!.getTime();
        const auctionStart = row.auction!.startTime.getTime();
        // Merge two possible session hashes in time order. A snapshot
        // written after the auction started would risk outcome leakage.
        const snapshots = [...(byKey.get(key) ?? []), ...(byKey.get(genericKey) ?? [])]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const first = snapshots.find((event) => {
            const data = (event.payload ?? {}) as Record<string, any>;
            const identity = data.identity ?? {};
            const price = data.baseValuation?.auction?.marketValue;
            return data.baseValuation?.calibrationOrigin?.verifiedAtCreation === true
                && ['LIVE_UK_MARKET', 'BLENDED_MARKET'].includes(
                    data.baseValuation?.source ?? '',
                )
                && clean(identity.registration) === clean(row.vrm)
                && canonicalValuationIdentity({
                    registration: identity.registration,
                    make: identity.make ?? '',
                    model: identity.model ?? '',
                    year: Number(identity.year),
                    mileage: Number(identity.mileage),
                }).model === normalized.model
                && Number.isFinite(price) && price >= 500
                && event.createdAt.getTime() < auctionStart
                && auctionStart - event.createdAt.getTime() <= 120 * 24 * 60 * 60_000;
        });
        if (!first) continue;
        const data = first.payload as Record<string, any>;
        const original = data.baseValuation?.calibration?.originalAuction;
        // Never train the new method on a price it has already calibrated.
        const predicted = Number(original?.marketValue
            ?? data.baseValuation.auction.marketValue);
        const actual = Number(row.auction!.winningBidAmount);
        pairs.push({
            vehicleKey: hash(clean(row.vrm)),
            predictedAuction: predicted,
            achievedAuction: actual,
            predictedAt: first.createdAt.getTime(),
            handoverAt: end,
        });
    }

    return evaluateAchievedAuctionCalibration(pairs);
}
