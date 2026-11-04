import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Private, minimal transaction evidence. This is deliberately separate from
 * publicly accessible listings and KYC identity documents.
 *
 * Enable only after the migration, seller notice, data-protection assessment,
 * retention rules and deletion/rectification handling have been approved.
 * No historical Sale is silently backfilled.
 */
export const purchaseSellerLegalSnapshotsEnabled = () =>
    process.env.PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED === 'true';

const logger = new Logger('PurchaseSellerLegalSnapshot');

export type SellerLegalEvidence = {
    sellerName: string;
    sellerCompany: string | null;
    sellerAccountReference: string;
    sellerEmail: string | null;
    sellerPhone: string | null;
    sellerAddress: string | null;
    sellerAddressSource: 'BUSINESS' | 'ACCOUNT_CONFIRMED_POSTAL' | null;
    sellerCompanyRegistrationNumber: string | null;
    sellerVatNumber: string | null;
    advertisedPriceAtCapture: number | null;
};

type BuyerScopedLegalSnapshot = SellerLegalEvidence & {
    capturedAt: string;
    capturedAtSource: string;
};

const trimmed = (v?: string | null) => v?.trim() || null;

export async function capturePurchaseSellerLegalSnapshot(
    prisma: PrismaService,
    input: { listingId: string; buyerId: string | null | undefined },
): Promise<void> {
    if (!purchaseSellerLegalSnapshotsEnabled() || !input.buyerId) return;
    try {
        const sale = await prisma.sale.findUnique({
            where: { listingId: input.listingId },
            select: {
                id: true, listingId: true, buyerId: true, sellerId: true,
                createdAt: true,
                listing: { select: { price: true } },
            },
        });
        if (!sale || sale.buyerId !== input.buyerId) return;
        const seller = await prisma.user.findUnique({
            where: { id: sale.sellerId },
            select: {
                id: true, firstName: true, lastName: true,
                email: true, phone: true, isAddressVerified: true,
                dealerProfile: { select: {
                    companyName: true, businessAddress: true, phone: true,
                    registrationNumber: true, vatNumber: true,
                } },
                addressVerifications: {
                    where: { consumedAt: { not: null } },
                    orderBy: { consumedAt: 'desc' },
                    take: 1,
                    select: { address: true },
                },
            },
        });
        if (!seller) return;
        const business = seller.dealerProfile;
        const businessAddress = trimmed(business?.businessAddress);
        // Email confirmation of a code is NOT independent residence verification.
        const accountConfirmedPostal = seller.isAddressVerified
            ? trimmed(seller.addressVerifications[0]?.address) : null;
        const postalAddress = businessAddress || accountConfirmedPostal;
        const sellerData: SellerLegalEvidence = {
            sellerName: [seller.firstName, seller.lastName].filter(Boolean).join(' ').trim()
                || business?.companyName || 'Not recorded',
            sellerCompany: trimmed(business?.companyName),
            sellerAccountReference: seller.id,
            sellerEmail: trimmed(seller.email),
            sellerPhone: trimmed(seller.phone) || trimmed(business?.phone),
            sellerAddress: postalAddress,
            sellerAddressSource: postalAddress
                ? businessAddress ? 'BUSINESS' : 'ACCOUNT_CONFIRMED_POSTAL' : null,
            sellerCompanyRegistrationNumber: trimmed(business?.registrationNumber),
            sellerVatNumber: trimmed(business?.vatNumber),
            advertisedPriceAtCapture: sale.listing.price != null ? Number(sale.listing.price) : null,
        };

        await prisma.purchaseSellerLegalSnapshot.upsert({
            where: { saleId: sale.id },
            create: {
                saleId: sale.id, listingId: sale.listingId, buyerId: sale.buyerId,
                sellerId: sale.sellerId, saleRecordedAt: sale.createdAt,
                data: sellerData,
            },
            update: {}, // first capture wins; subsequent profile changes never overwrite it
        });
    } catch (error) {
        // Capture must not undo a valid sale or collection confirmation.
        logger.warn('Seller legal snapshot failed for a recorded sale: '
            + ((error as Error)?.message || String(error)));
    }
}

/**
 * Reads are buyer-scoped even though PDFs already check VIEW_PURCHASES and
 * auction fee permissions. Do not return this data to public listing routes.
 */
export async function readPurchaseSellerLegalSnapshot(
    prisma: PrismaService,
    saleId: string,
    buyerId: string,
): Promise<BuyerScopedLegalSnapshot | null> {
    if (!purchaseSellerLegalSnapshotsEnabled()) return null;
    const row = await prisma.purchaseSellerLegalSnapshot.findFirst({
        where: { saleId, buyerId },
        select: { data: true, capturedAt: true, saleRecordedAt: true },
    });
    if (!row || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) return null;
    const raw = row.data as Record<string, unknown>;
    const read = (key: keyof SellerLegalEvidence): string | null =>
        typeof raw[key] === 'string' ? (raw[key] as string) : null;
    const source = read('sellerAddressSource');
    const advertised = raw.advertisedPriceAtCapture;
    return {
        sellerName: read('sellerName') || 'Not recorded',
        sellerCompany: read('sellerCompany'),
        sellerAccountReference: read('sellerAccountReference') || '',
        sellerEmail: read('sellerEmail'),
        sellerPhone: read('sellerPhone'),
        sellerAddress: read('sellerAddress'),
        sellerAddressSource: source === 'BUSINESS' || source === 'ACCOUNT_CONFIRMED_POSTAL' ? source : null,
        sellerCompanyRegistrationNumber: read('sellerCompanyRegistrationNumber'),
        sellerVatNumber: read('sellerVatNumber'),
        advertisedPriceAtCapture: typeof advertised === 'number' && Number.isFinite(advertised)
            && advertised >= 0 ? advertised : null,
        capturedAt: row.capturedAt.toISOString(),
        capturedAtSource: row.capturedAt.getTime() - row.saleRecordedAt.getTime() < 5 * 60 * 1000
            ? 'RECORDED_NEAR_SALE' : 'CAPTURED_AFTER_SALE',
    };
}
