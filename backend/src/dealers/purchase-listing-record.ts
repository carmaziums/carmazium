import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The advert a buyer committed to: photos, description, specification,
 * history, seller declarations and declared damage.
 *
 * Listing evidence only. Seller contact, address and payout details are never
 * part of this record; they stay behind the fee-gated /purchases/:id/seller
 * endpoint.
 */

/** Prisma select for every field the record needs. */
export const LISTING_RECORD_SELECT = {
    title: true, images: true, year: true, make: true, model: true,
    mileage: true, vrm: true,
    description: true, variant: true, fuelType: true,
    transmission: true, color: true, doors: true, seats: true,
    engineSize: true, bhp: true, bodyType: true, driveType: true,
    features: true, vin: true, condition: true,
    monthOfFirstRegistration: true, motStatus: true,
    motExpiryDate: true, motHistory: true, serviceHistory: true,
    numberOfKeys: true, owners: true, exteriorGrade: true,
    writeOffCategory: true, mechanicalIssues: true,
    electricalIssues: true, hasOutstandingFinance: true,
    stolenRecovered: true, isLegalRegisteredKeeper: true,
    updatedAt: true, deletedAt: true,
    damageRecords: {
        select: { id: true, part: true, type: true, size: true, coords: true, imageUrl: true, createdAt: true },
        orderBy: { createdAt: 'asc' as const },
    },
} as const;

type Dateish = Date | string | null | undefined;
const iso = (v: Dateish): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

/** Turn a listing (selected with LISTING_RECORD_SELECT) into plain JSON. */
export function buildListingRecordData(listing: any) {
    return {
        title: listing.title ?? null,
        year: listing.year ?? null, make: listing.make ?? null, model: listing.model ?? null,
        mileage: listing.mileage ?? null, registration: listing.vrm ?? null,
        images: Array.isArray(listing.images) ? [...listing.images] : [],
        description: listing.description ?? null,
        variant: listing.variant ?? null, fuelType: listing.fuelType ?? null,
        transmission: listing.transmission ?? null, color: listing.color ?? null,
        doors: listing.doors ?? null, seats: listing.seats ?? null, engineSize: listing.engineSize ?? null,
        bhp: listing.bhp ?? null, bodyType: listing.bodyType ?? null, driveType: listing.driveType ?? null,
        features: listing.features ?? null, vin: listing.vin ?? null, condition: listing.condition ?? null,
        firstRegistered: listing.monthOfFirstRegistration ?? null,
        motStatus: listing.motStatus ?? null, motExpiryDate: iso(listing.motExpiryDate),
        motHistory: listing.motHistory ?? null, serviceHistory: listing.serviceHistory ?? null,
        numberOfKeys: listing.numberOfKeys ?? null, owners: listing.owners ?? null,
        exteriorGrade: listing.exteriorGrade ?? null, writeOffCategory: listing.writeOffCategory ?? null,
        sellerDeclarations: {
            mechanicalIssues: listing.mechanicalIssues ?? null,
            electricalIssues: listing.electricalIssues ?? null,
            hasOutstandingFinance: listing.hasOutstandingFinance ?? null,
            stolenRecovered: listing.stolenRecovered ?? null,
            isLegalRegisteredKeeper: listing.isLegalRegisteredKeeper ?? null,
        },
        damage: (listing.damageRecords ?? []).map((d: any) => ({
            id: d.id, part: d.part, type: d.type, size: d.size,
            coords: d.coords ?? null, imageUrl: d.imageUrl ?? null,
        })),
    };
}

export type ListingRecordData = ReturnType<typeof buildListingRecordData>;

/**
 * Off until the owner has applied the migration and set the flag, so this
 * code can ship before the tables exist.
 */
export function purchaseSnapshotsEnabled(): boolean {
    return process.env.PURCHASE_SNAPSHOTS_ENABLED === 'true';
}

/**
 * When snapshots were switched on (PURCHASE_SNAPSHOTS_ENABLED_AT, ISO time).
 * The sweep only recovers sales recorded after this, so switching the
 * feature on never turns the current state of an older purchase's advert
 * into a "purchase-time" snapshot. Unset or invalid: the sweep does nothing.
 */
export function purchaseSnapshotsEnabledAt(): Date | null {
    const raw = process.env.PURCHASE_SNAPSHOTS_ENABLED_AT;
    if (!raw) return null;
    const at = new Date(raw);
    return Number.isFinite(at.getTime()) ? at : null;
}

/** A capture this long after the sale is shown as delayed, with its time. */
export const SNAPSHOT_DELAY_NOTICE_MS = 5 * 60 * 1000;

const logger = new Logger('PurchaseSnapshot');

/** Delays between attempts; the sweep (PurchaseSnapshotSweepService) is the backstop. */
const RETRY_DELAYS_MS = [1_000, 5_000];
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * One attempt. Returns true when a snapshot exists for this sale afterwards.
 * Keyed by Sale id, so a later re-purchase of the same car (after a
 * cancellation) gets its own snapshot and never reuses the old one.
 */
async function captureOnce(prisma: PrismaService, listingId: string, buyerId: string): Promise<boolean> {
    // Only for a Sale that really exists for this buyer, so calling this
    // after a transaction that ended without a sale is harmless.
    const sale = await prisma.sale.findUnique({ where: { listingId }, select: { id: true, buyerId: true } });
    if (!sale || sale.buyerId !== buyerId) return true; // nothing to capture
    const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: LISTING_RECORD_SELECT });
    if (!listing) return true;
    await prisma.purchaseListingSnapshot.upsert({
        where: { saleId: sale.id },
        create: { saleId: sale.id, listingId, buyerId, data: buildListingRecordData(listing) as any },
        // Immutable: never refresh an existing capture.
        update: {},
    });
    return true;
}

/**
 * Save the advert as it stands at the moment a Sale is recorded.
 *
 * Called after the sale transaction commits, and best-effort: a failure is
 * retried twice in-process, then left to the periodic sweep, and never
 * undoes or blocks the sale. The first capture for a sale wins.
 */
export async function capturePurchaseSnapshot(
    prisma: PrismaService,
    input: { listingId: string; buyerId: string | null | undefined },
    delays: readonly number[] = RETRY_DELAYS_MS,
): Promise<void> {
    if (!purchaseSnapshotsEnabled() || !input.buyerId) return;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
            if (await captureOnce(prisma, input.listingId, input.buyerId)) return;
        } catch (err) {
            const last = attempt === delays.length;
            logger.warn(`Snapshot attempt ${attempt + 1} failed for listing ${input.listingId}${last ? '; the sweep will retry' : ''}: ${(err as Error)?.message ?? err}`);
            if (last) return;
        }
        await wait(delays[attempt]);
    }
}

/**
 * Backstop for captures lost to a crash, deploy or repeated failure: find
 * recent sales with no snapshot and capture them. Idempotent, safe on several
 * instances. A late capture keeps its own capturedAt, which the UI shows.
 */
export async function sweepMissingPurchaseSnapshots(prisma: PrismaService, limit = 200): Promise<number> {
    if (!purchaseSnapshotsEnabled()) return 0;
    const enabledAt = purchaseSnapshotsEnabledAt();
    if (!enabledAt) {
        logger.warn('PURCHASE_SNAPSHOTS_ENABLED_AT is not set; snapshot sweep skipped');
        return 0;
    }
    const missing = await prisma.$queryRaw<Array<{ listingId: string; buyerId: string }>>`
        SELECT s."listingId", s."buyerId"
        FROM "sales" s
        LEFT JOIN "purchase_listing_snapshots" p ON p."saleId" = s.id
        WHERE p.id IS NULL
          AND s."buyerId" IS NOT NULL
          AND s."createdAt" > NOW() - INTERVAL '7 days'
          AND s."createdAt" >= ${enabledAt}
        ORDER BY s."createdAt" ASC
        LIMIT ${limit}
    `;
    let captured = 0;
    for (const row of missing) {
        try {
            await captureOnce(prisma, row.listingId, row.buyerId);
            captured++;
        } catch (err) {
            logger.warn(`Sweep could not snapshot listing ${row.listingId}: ${(err as Error)?.message ?? err}`);
        }
    }
    return captured;
}
