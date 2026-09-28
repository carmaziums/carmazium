import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_FREE_PURCHASE_TRANSACTION_PREFIX } from './free-purchase-grant.constants';

export type FreeListingDurationUnit = 'HOURS' | 'DAYS' | 'MONTHS' | 'FOREVER';

export interface FreeListingGrantView {
    id: string;
    grantedAt: string;
    grantedById: string;
    expiresAt: string | null;
    usedAt: string | null;
    usedListingId: string | null;
    revokedAt: string | null;
    status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';
}

export interface FreePurchaseGrantView {
    id: string;
    grantedAt: string;
    grantedById: string;
    expiresAt: string | null;
    revokedAt: string | null;
    lastUsedAt: string | null;
    useCount: number;
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}

interface FreeListingGrantRow {
    id: string;
    userId: string;
    grantedById: string;
    expiresAt: Date | null;
    usedAt: Date | null;
    usedListingId: string | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

interface FreePurchaseGrantRow {
    id: string;
    userId: string;
    grantedById: string;
    expiresAt: Date | null;
    revokedAt: Date | null;
    lastUsedAt: Date | null;
    useCount: number;
    createdAt: Date;
    updatedAt: Date;
}

@Injectable()
export class FreeListingGrantsService {
    constructor(private readonly prisma: PrismaService) {}

    private status(grant: FreeListingGrantRow): FreeListingGrantView['status'] {
        if (grant.revokedAt) return 'REVOKED';

        // A FOREVER grant is an ongoing entitlement, not a one-use voucher.
        // Older forever grants may already have usedAt populated from the
        // previous one-listing behaviour; keep those grants active as well.
        if (grant.expiresAt === null) return 'ACTIVE';

        if (grant.usedAt) return 'USED';
        if (grant.expiresAt.getTime() <= Date.now()) return 'EXPIRED';
        return 'ACTIVE';
    }

    private purchaseStatus(grant: FreePurchaseGrantRow): FreePurchaseGrantView['status'] {
        if (grant.revokedAt) return 'REVOKED';
        if (grant.expiresAt && grant.expiresAt.getTime() <= Date.now()) return 'EXPIRED';
        return 'ACTIVE';
    }

    private toView(grant: FreeListingGrantRow | null): FreeListingGrantView | null {
        if (!grant) return null;
        return {
            id: grant.id,
            grantedAt: grant.createdAt.toISOString(),
            grantedById: grant.grantedById,
            expiresAt: grant.expiresAt?.toISOString() ?? null,
            usedAt: grant.usedAt?.toISOString() ?? null,
            usedListingId: grant.usedListingId,
            revokedAt: grant.revokedAt?.toISOString() ?? null,
            status: this.status(grant),
        };
    }

    private toPurchaseView(grant: FreePurchaseGrantRow | null): FreePurchaseGrantView | null {
        if (!grant) return null;
        return {
            id: grant.id,
            grantedAt: grant.createdAt.toISOString(),
            grantedById: grant.grantedById,
            expiresAt: grant.expiresAt?.toISOString() ?? null,
            revokedAt: grant.revokedAt?.toISOString() ?? null,
            lastUsedAt: grant.lastUsedAt?.toISOString() ?? null,
            useCount: Number(grant.useCount || 0),
            status: this.purchaseStatus(grant),
        };
    }

    private calculateExpiry(unit: FreeListingDurationUnit, rawValue?: number): Date | null {
        if (unit === 'FOREVER') return null;
        if (!['HOURS', 'DAYS', 'MONTHS'].includes(unit)) {
            throw new BadRequestException('Duration unit must be HOURS, DAYS, MONTHS, or FOREVER');
        }

        const value = Number(rawValue);
        if (!Number.isInteger(value) || value < 1) {
            throw new BadRequestException('Duration value must be a whole number greater than zero');
        }

        const expiresAt = new Date();
        if (unit === 'HOURS') expiresAt.setHours(expiresAt.getHours() + value);
        if (unit === 'DAYS') expiresAt.setDate(expiresAt.getDate() + value);
        if (unit === 'MONTHS') expiresAt.setMonth(expiresAt.getMonth() + value);
        return expiresAt;
    }

    private async assertGrantableUser(userId: string, benefit: string): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, deletedAt: true },
        });
        if (!user) throw new NotFoundException('User not found');
        if (user.deletedAt) {
            throw new BadRequestException(`A banned user cannot be granted ${benefit}`);
        }
    }

    private async findGrantByUser(userId: string): Promise<FreeListingGrantRow | null> {
        const rows = await this.prisma.$queryRaw<FreeListingGrantRow[]>(Prisma.sql`
            SELECT
                "id", "userId", "grantedById", "expiresAt", "usedAt",
                "usedListingId", "revokedAt", "createdAt", "updatedAt"
            FROM "admin_free_listing_grants"
            WHERE "userId" = ${userId}
            LIMIT 1
        `);
        return rows[0] ?? null;
    }

    private async findPurchaseGrantByUser(userId: string): Promise<FreePurchaseGrantRow | null> {
        const rows = await this.prisma.$queryRaw<FreePurchaseGrantRow[]>(Prisma.sql`
            SELECT
                "id", "userId", "grantedById", "expiresAt", "revokedAt",
                "lastUsedAt", "useCount", "createdAt", "updatedAt"
            FROM "admin_free_purchase_grants"
            WHERE "userId" = ${userId}
            LIMIT 1
        `);
        return rows[0] ?? null;
    }

    async listUsers(page = 1, limit = 20, search?: string) {
        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
        const skip = (safePage - 1) * safeLimit;
        const where = search
            ? {
                  OR: [
                      { email: { contains: search, mode: 'insensitive' as const } },
                      { firstName: { contains: search, mode: 'insensitive' as const } },
                      { lastName: { contains: search, mode: 'insensitive' as const } },
                  ],
              }
            : undefined;

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: safeLimit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    createdAt: true,
                    deletedAt: true,
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        const userIds = users.map((user) => user.id);
        const [listingGrants, purchaseGrants] = userIds.length
            ? await Promise.all([
                  this.prisma.$queryRaw<FreeListingGrantRow[]>(Prisma.sql`
                      SELECT
                          "id", "userId", "grantedById", "expiresAt", "usedAt",
                          "usedListingId", "revokedAt", "createdAt", "updatedAt"
                      FROM "admin_free_listing_grants"
                      WHERE "userId" IN (${Prisma.join(userIds)})
                  `),
                  this.prisma.$queryRaw<FreePurchaseGrantRow[]>(Prisma.sql`
                      SELECT
                          "id", "userId", "grantedById", "expiresAt", "revokedAt",
                          "lastUsedAt", "useCount", "createdAt", "updatedAt"
                      FROM "admin_free_purchase_grants"
                      WHERE "userId" IN (${Prisma.join(userIds)})
                  `),
              ])
            : [[], []];
        const listingGrantsByUser = new Map(listingGrants.map((grant) => [grant.userId, grant]));
        const purchaseGrantsByUser = new Map(purchaseGrants.map((grant) => [grant.userId, grant]));

        return {
            data: users.map((user) => ({
                ...user,
                freeListingGrant: this.toView(listingGrantsByUser.get(user.id) ?? null),
                freePurchaseGrant: this.toPurchaseView(purchaseGrantsByUser.get(user.id) ?? null),
            })),
            total,
            page: safePage,
            limit: safeLimit,
        };
    }

    async grant(
        userId: string,
        adminId: string,
        durationUnit: FreeListingDurationUnit,
        durationValue?: number,
    ): Promise<FreeListingGrantView> {
        await this.assertGrantableUser(userId, 'a free listing');

        const expiresAt = this.calculateExpiry(durationUnit, durationValue);
        const id = randomUUID();

        await this.prisma.$executeRaw(Prisma.sql`
            INSERT INTO "admin_free_listing_grants" (
                "id", "userId", "grantedById", "expiresAt", "usedAt",
                "usedListingId", "revokedAt", "createdAt", "updatedAt"
            ) VALUES (
                ${id}, ${userId}, ${adminId}, ${expiresAt}, NULL,
                NULL, NULL, NOW(), NOW()
            )
            ON CONFLICT ("userId") DO UPDATE SET
                "id" = EXCLUDED."id",
                "grantedById" = EXCLUDED."grantedById",
                "expiresAt" = EXCLUDED."expiresAt",
                "usedAt" = NULL,
                "usedListingId" = NULL,
                "revokedAt" = NULL,
                "createdAt" = NOW(),
                "updatedAt" = NOW()
        `);

        const saved = await this.findGrantByUser(userId);
        if (!saved) throw new BadRequestException('Free listing grant could not be saved');
        return this.toView(saved)!;
    }

    async revoke(userId: string): Promise<FreeListingGrantView | null> {
        const existing = await this.findGrantByUser(userId);
        if (!existing) return null;
        if (this.status(existing) !== 'ACTIVE') return this.toView(existing);

        await this.prisma.$executeRaw(Prisma.sql`
            UPDATE "admin_free_listing_grants"
            SET "revokedAt" = NOW(), "updatedAt" = NOW()
            WHERE "userId" = ${userId}
              AND "revokedAt" IS NULL
              AND ("expiresAt" IS NULL OR "usedAt" IS NULL)
        `);

        return this.toView(await this.findGrantByUser(userId));
    }

    async grantFreePurchases(
        userId: string,
        adminId: string,
        durationUnit: FreeListingDurationUnit,
        durationValue?: number,
    ): Promise<FreePurchaseGrantView> {
        await this.assertGrantableUser(userId, 'fee-free auction purchases');

        const expiresAt = this.calculateExpiry(durationUnit, durationValue);
        const id = randomUUID();

        await this.prisma.$executeRaw(Prisma.sql`
            INSERT INTO "admin_free_purchase_grants" (
                "id", "userId", "grantedById", "expiresAt", "revokedAt",
                "lastUsedAt", "useCount", "createdAt", "updatedAt"
            ) VALUES (
                ${id}, ${userId}, ${adminId}, ${expiresAt}, NULL,
                NULL, 0, NOW(), NOW()
            )
            ON CONFLICT ("userId") DO UPDATE SET
                "id" = EXCLUDED."id",
                "grantedById" = EXCLUDED."grantedById",
                "expiresAt" = EXCLUDED."expiresAt",
                "revokedAt" = NULL,
                "lastUsedAt" = NULL,
                "useCount" = 0,
                "createdAt" = NOW(),
                "updatedAt" = NOW()
        `);

        const saved = await this.findPurchaseGrantByUser(userId);
        if (!saved) throw new BadRequestException('Free purchase grant could not be saved');
        return this.toPurchaseView(saved)!;
    }

    async revokeFreePurchases(userId: string): Promise<FreePurchaseGrantView | null> {
        const existing = await this.findPurchaseGrantByUser(userId);
        if (!existing) return null;
        if (this.purchaseStatus(existing) !== 'ACTIVE') return this.toPurchaseView(existing);

        await this.prisma.$executeRaw(Prisma.sql`
            UPDATE "admin_free_purchase_grants"
            SET "revokedAt" = NOW(), "updatedAt" = NOW()
            WHERE "userId" = ${userId}
              AND "revokedAt" IS NULL
        `);

        return this.toPurchaseView(await this.findPurchaseGrantByUser(userId));
    }

    /**
     * Convert an eligible admin grant into a normal completed £0 LISTING_FEE
     * transaction. ListingsService.publishListing already trusts completed
     * LISTING_FEE transactions, so this keeps the existing payment/review flow
     * untouched and makes rejected listings resubmittable without another fee.
     *
     * Timed grants remain one-use entitlements. A FOREVER grant (expiresAt is
     * null) is deliberately reusable and therefore waives the BASIC retail
     * listing fee for every eligible listing until an admin revokes the grant.
     *
     * Only BASIC CLASSIFIED listings are eligible. Auction listings are already
     * free, while STANDARD/PREMIUM remain paid upgrades.
     */
    async applyToListingIfEligible(listingId: string, userId: string): Promise<boolean> {
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
            select: {
                id: true,
                sellerId: true,
                type: true,
                badgeTier: true,
                status: true,
                images: true,
            },
        });

        if (!listing || listing.sellerId !== userId) return false;
        if (listing.type !== 'CLASSIFIED' || listing.badgeTier !== 'BASIC') return false;
        if (listing.status !== 'DRAFT') return false;
        if (listing.images.length < 10) return false;

        // A completed fee transaction already exists — do not create another one.
        const existingFee = await this.prisma.transaction.findFirst({
            where: { listingId, type: 'LISTING_FEE', status: 'COMPLETED' },
            select: { id: true },
        });
        if (existingFee) return false;

        return this.prisma.$transaction(async (tx) => {
            // Lock the entitlement row so revocation, expiry and one-use claims
            // are evaluated consistently under concurrent publish requests.
            const rows = await tx.$queryRaw<FreeListingGrantRow[]>(Prisma.sql`
                SELECT
                    "id", "userId", "grantedById", "expiresAt", "usedAt",
                    "usedListingId", "revokedAt", "createdAt", "updatedAt"
                FROM "admin_free_listing_grants"
                WHERE "userId" = ${userId}
                FOR UPDATE
            `);
            const grant = rows[0];
            if (!grant || this.status(grant) !== 'ACTIVE') return false;

            // Re-check after taking the grant lock. A permanent grant is reusable,
            // so the lock itself no longer marks it as consumed; this prevents two
            // concurrent publishes for the same listing creating duplicate £0 fees.
            const feeAfterLock = await tx.transaction.findFirst({
                where: { listingId, type: 'LISTING_FEE', status: 'COMPLETED' },
                select: { id: true },
            });
            if (feeAfterLock) return false;

            const isForeverGrant = grant.expiresAt === null;
            if (!isForeverGrant) {
                const now = new Date();
                const claimed = await tx.$executeRaw(Prisma.sql`
                    UPDATE "admin_free_listing_grants"
                    SET
                        "usedAt" = ${now},
                        "usedListingId" = ${listingId},
                        "updatedAt" = NOW()
                    WHERE "id" = ${grant.id}
                      AND "usedAt" IS NULL
                      AND "revokedAt" IS NULL
                      AND "expiresAt" > ${now}
                `);
                if (claimed !== 1) return false;
            }

            await tx.transaction.create({
                data: {
                    userId,
                    listingId,
                    amount: 0,
                    type: 'LISTING_FEE',
                    status: 'COMPLETED',
                    description: `Admin-granted free BASIC listing (${grant.id})`,
                },
            });
            return true;
        });
    }

    /**
     * Waive CarMazium's £125 auction buyer fee for a winner whose admin grant
     * was already active when the auction was won.
     *
     * Purchase grants are time-window entitlements, not vouchers: every auction
     * win inside the active window is covered. We still create a normal
     * COMPLETED COMMISSION transaction at £0 and attach it to the auction so
     * contact gating, handover validation, seller-bonus review and audit trails
     * keep using the existing buyerFeePaid/buyerFeeTransactionId lifecycle.
     */
    async applyPurchaseGrantToAuctionIfEligible(auctionId: string, userId: string): Promise<boolean> {
        return this.prisma.$transaction(async (tx) => {
            const rows = await tx.$queryRaw<FreePurchaseGrantRow[]>(Prisma.sql`
                SELECT
                    "id", "userId", "grantedById", "expiresAt", "revokedAt",
                    "lastUsedAt", "useCount", "createdAt", "updatedAt"
                FROM "admin_free_purchase_grants"
                WHERE "userId" = ${userId}
                FOR UPDATE
            `);
            const grant = rows[0];
            if (!grant || this.purchaseStatus(grant) !== 'ACTIVE') return false;

            // Serialize with any fee application against this same auction.
            await tx.$queryRaw(Prisma.sql`
                SELECT "id"
                FROM "auctions"
                WHERE "id" = ${auctionId}
                FOR UPDATE
            `);

            const auction = await tx.auction.findUnique({
                where: { id: auctionId },
                select: {
                    id: true,
                    listingId: true,
                    winnerId: true,
                    wonAt: true,
                    status: true,
                    deletedAt: true,
                    buyerFeePaid: true,
                    buyerFeeTransactionId: true,
                },
            });

            if (
                !auction
                || auction.deletedAt
                || auction.status !== 'ENDED'
                || auction.winnerId !== userId
                || auction.buyerFeePaid
            ) {
                return false;
            }

            // A grant is prospective. Creating/replacing one after a dealer has
            // already won an auction must not silently waive an existing £125 fee.
            if (!auction.wonAt || auction.wonAt.getTime() < grant.createdAt.getTime()) {
                return false;
            }
            if (grant.expiresAt && auction.wonAt.getTime() >= grant.expiresAt.getTime()) {
                return false;
            }

            const existingFee = await tx.transaction.findFirst({
                where: {
                    listingId: auction.listingId,
                    userId,
                    type: 'COMMISSION',
                    status: 'COMPLETED',
                },
                select: { id: true },
            });
            if (existingFee) return false;

            const transaction = await tx.transaction.create({
                data: {
                    userId,
                    listingId: auction.listingId,
                    amount: 0,
                    type: 'COMMISSION',
                    status: 'COMPLETED',
                    description: `${ADMIN_FREE_PURCHASE_TRANSACTION_PREFIX}${grant.id})`,
                },
                select: { id: true },
            });

            await tx.auction.update({
                where: { id: auction.id },
                data: {
                    buyerFeePaid: true,
                    buyerFeeTransactionId: transaction.id,
                },
            });

            await tx.$executeRaw(Prisma.sql`
                UPDATE "admin_free_purchase_grants"
                SET
                    "lastUsedAt" = NOW(),
                    "useCount" = "useCount" + 1,
                    "updatedAt" = NOW()
                WHERE "id" = ${grant.id}
                  AND "revokedAt" IS NULL
                  AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
            `);

            return true;
        });
    }
}
