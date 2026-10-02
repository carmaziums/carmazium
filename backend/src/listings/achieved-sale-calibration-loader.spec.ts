import { createHash } from 'crypto';
import { assessHistoricalAuctionOutcomes, auditedAuctionIds } from './achieved-sale-calibration-loader';
import { canonicalValuationCacheParts } from './vehicle-valuation-identity';

const now = Date.parse('2026-10-03T16:00:00Z');
const day = 86_400_000;
const idFor = (index: number) =>
    `3ce3af8d-8103-4a26-a2ad-${index.toString(16).padStart(12, '0')}`;
const saleRows = Array.from({ length: 32 }, (_, index) => {
    const predicted = 6600 + index * 48;
    const registration = `AA${index.toString().padStart(2, '0')}BCD`;
    const beforeAuction = Date.parse('2026-01-01T00:00:00Z') + index * 5 * day;
    return {
        id: idFor(index), vrm: registration,
        make: 'AUDI', model: 'A1', variant: 'SPORT',
        year: 2018, mileage: 78000,
        predicted,
        baseAt: new Date(beforeAuction),
        auction: {
            status: 'ENDED', winnerId: 'a-winner',
            startTime: new Date(beforeAuction + day),
            sellerBonusReleasedAt: new Date(beforeAuction + 3 * day),
            sellerBonusReleased: true,
            buyerFeePaid: true,
            sellerFundsConfirmedAt: new Date(beforeAuction + 2 * day),
            sellerFundsConfirmationRequired: true,
            buyerRefusedAt: null,
            winningBidAmount: predicted * 1.08,
        },
    };
});
const keyFor = (row: typeof saleRows[number]) =>
    'valuation-base:' + createHash('sha256').update(canonicalValuationCacheParts({
        registration: row.vrm, make: row.make, model: row.model,
        variant: row.variant, year: row.year, mileage: row.mileage,
    }).join('|')).digest('hex');
const eventsFor = (rows = saleRows) => rows.map((row) => ({
    sessionId: keyFor(row),
    createdAt: row.baseAt,
    payload: {
        identity: {
            registration: row.vrm, make: row.make,
            model: row.model, year: row.year, mileage: row.mileage,
        },
        baseValuation: {
            calibrationOrigin: { verifiedAtCreation: true },
            source: 'LIVE_UK_MARKET',
            auction: { marketValue: row.predicted },
        },
    },
}));
const vehicle = {
    registration: 'ZZ00ZZZ', make: 'AUDI', model: 'A1',
    variant: 'SPORT', year: 2018, mileage: 78000,
};
const prisma = (rows = saleRows, events = eventsFor()) => ({
    listing: { findMany: jest.fn().mockResolvedValue(rows) },
    analyticsEvent: { findMany: jest.fn().mockResolvedValue(events) },
});

describe('Block 9 read-only, provenance-bound achieved outcome retrieval', () => {
    it('evaluates 32 separate completed seller-attested auctions with preceding verified valuations', async () => {
        const db = prisma();
        const result = await assessHistoricalAuctionOutcomes(
            db as any, vehicle, 'shadow', new Set(), now,
        );
        expect(result.state).toBe('VALIDATED');
        expect(result.samples).toBe(32);
        expect(result.multiplier).toBe(1.08);
        expect(db.listing.findMany).toHaveBeenCalledTimes(1);
        expect(db.analyticsEvent.findMany).toHaveBeenCalledTimes(1);
        expect(db.analyticsEvent.findMany.mock.calls[0][0].where.type)
            .toBe('valuation_base_snapshot');
        expect(db.listing.findMany.mock.calls[0][0].take).toBe(100);
        expect(db.analyticsEvent.findMany.mock.calls[0][0].take).toBe(600);
        // Returned diagnostics contain no registration, personal identity,
        // listing ID, advert URL or individual transaction amount.
        const serialized = JSON.stringify(result);
        expect(serialized).not.toContain('AA00BCD');
        expect(serialized).not.toContain(idFor(0));
        expect(serialized).not.toContain('6600');
    });

    it('ON accepts only individually audited listing IDs in both query and local filter', async () => {
        const db = prisma();
        const ids = auditedAuctionIds(saleRows.map((row) => row.id).join(','));
        const result = await assessHistoricalAuctionOutcomes(
            db as any, vehicle, 'on', ids, now,
        );
        expect(result.state).toBe('VALIDATED');
        expect(db.listing.findMany.mock.calls[0][0].where.id.in).toHaveLength(32);

        const withInsufficientAudit = auditedAuctionIds(
            saleRows.slice(0, 29).map((row) => row.id).join(','));
        const blocked = await assessHistoricalAuctionOutcomes(
            db as any, vehicle, 'on', withInsufficientAudit, now,
        );
        expect(blocked.state).toBe('INSUFFICIENT');
        expect(db.listing.findMany).toHaveBeenCalledTimes(1);
    });

    it('never treats post-auction or retroactively marked legacy quotes as training data', async () => {
        const afterStart = eventsFor().map((event, index) => index === 0
            ? {
                ...event,
                createdAt: new Date(saleRows[index].auction.startTime.getTime() + 1000),
            }
            : event);
        const noMarker = afterStart.map((event, index) => index === 1
            ? { ...event, payload: {
                ...event.payload,
                baseValuation: { ...event.payload.baseValuation,
                    calibrationOrigin: undefined },
            } }
            : event);
        const db = prisma(saleRows, noMarker);
        const result = await assessHistoricalAuctionOutcomes(
            db as any, vehicle, 'shadow', new Set(), now,
        );
        expect(result.samples).toBe(30);
        expect(result.trainingSamples).toBe(20);
        expect(result.holdoutSamples).toBe(10);
        expect(db.analyticsEvent.findMany).toHaveBeenCalledTimes(1);
    });

    it('cannot use pending/refused/unconfirmed handovers and cannot train on its own vehicle', async () => {
        const broken = saleRows.map((row, index) => index === 0 ? {
            ...row, auction: { ...row.auction,
                sellerFundsConfirmedAt: null,
                sellerFundsConfirmationRequired: true,
            },
        } : index === 1 ? {
            ...row, auction: { ...row.auction, buyerRefusedAt: new Date() },
        } : index === 2 ? { ...row, vrm: vehicle.registration } : row);
        const db = prisma(broken, eventsFor(broken as typeof saleRows));
        const result = await assessHistoricalAuctionOutcomes(
            db as any, vehicle, 'shadow', new Set(), now,
        );
        expect(result.state).toBe('INSUFFICIENT');
        expect(result.samples).toBe(0); // <30 eligible; no snapshots accessed
        expect(db.analyticsEvent.findMany).not.toHaveBeenCalled();
    });

    it('rejects different variants and never uses unreviewed retail sale rows', async () => {
        const wrongVariants = saleRows.map((row, index) => index === 0 ? {
            ...row, variant: 'S LINE',
        } : row);
        const db = prisma(wrongVariants, eventsFor(wrongVariants));
        const result = await assessHistoricalAuctionOutcomes(
            db as any, vehicle, 'shadow', new Set(), now,
        );
        expect(result.state).toBe('INSUFFICIENT');
        expect(db.analyticsEvent.findMany).not.toHaveBeenCalled();
        const filter = db.listing.findMany.mock.calls[0][0].where;
        expect(filter.type).toBe('AUCTION');
        expect(filter.auction.is.sellerBonusReleased).toBe(true);
        expect(filter.auction.is.buyerFeePaid).toBe(true);
    });
});
