import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

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
        const grants = userIds.length
            ? await this.prisma.$queryRaw<FreeListingGrantRow[]>(Prisma.sql`
                  SELECT
                      "id", "userId", "grantedById", "expiresAt", "usedAt",
                      "usedListingId", "revokedAt", "createdAt", "updatedAt"
                  FROM "admin_free_listing_grants"
                  WHERE "userId" IN (${Prisma.join(userIds)})
              `)
            : [];
        const grantsByUser = new Map(grants.map((grant) => [grant.userId, grant]));

        return {
            data: users.map((user) => ({
                ...user,
                freeListingGrant: this.toView(grantsByUser.get(user.id) ?? null),
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
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, deletedAt: true },
        });
        if (!user) throw new NotFoundException('User not found');
        if (user.deletedAt) throw new BadRequestException('A banned user cannot be granted a free listing');

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
}
