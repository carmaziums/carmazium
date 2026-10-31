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

const logger = new Logger('PurchaseSnapshot');

/**
 * Save the advert as it stands at the moment a Sale is recorded.
 *
 * Called after the sale transaction commits, and best-effort: a snapshot
 * failure is logged and never undoes or blocks the sale. The first capture
 * for a (listing, buyer) pair wins and is never overwritten, so a later
 * re-record of the same sale cannot replace the original evidence.
 */
export async function capturePurchaseSnapshot(
    prisma: PrismaService,
    input: { listingId: string; buyerId: string | null | undefined },
): Promise<void> {
    if (!purchaseSnapshotsEnabled() || !input.buyerId) return;
    try {
        // Only for a Sale that really exists for this buyer, so calling this
        // after a transaction that ended without a sale is harmless.
        const sale = await prisma.sale.findUnique({ where: { listingId: input.listingId }, select: { id: true, buyerId: true } });
        if (!sale || sale.buyerId !== input.buyerId) return;
        const saleId = sale.id;
        const listing = await prisma.listing.findUnique({
            where: { id: input.listingId },
            select: LISTING_RECORD_SELECT,
        });
        if (!listing) return;
        await prisma.purchaseListingSnapshot.upsert({
            where: { listingId_buyerId: { listingId: input.listingId, buyerId: input.buyerId } },
            create: {
                listingId: input.listingId,
                buyerId: input.buyerId,
                saleId,
                data: buildListingRecordData(listing) as any,
            },
            // Immutable: never refresh an existing capture.
            update: {},
        });
    } catch (err) {
        logger.warn(`Snapshot not saved for listing ${input.listingId}: ${(err as Error)?.message ?? err}`);
    }
}
