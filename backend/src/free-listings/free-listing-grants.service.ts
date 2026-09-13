import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

interface StoredFreeListingGrant {
    id: string;
    grantedAt: string;
    grantedById: string;
    expiresAt: string | null;
    usedAt: string | null;
    usedListingId: string | null;
    revokedAt: string | null;
}

const GRANT_KEY = 'adminFreeListingGrant';

@Injectable()
export class FreeListingGrantsService {
    constructor(private readonly prisma: PrismaService) {}

    private preferencesObject(value: unknown): Record<string, any> {
        return value && typeof value === 'object' && !Array.isArray(value)
            ? { ...(value as Record<string, any>) }
            : {};
    }

    private storedGrant(value: unknown): StoredFreeListingGrant | null {
        const preferences = this.preferencesObject(value);
        const grant = preferences[GRANT_KEY];
        if (!grant || typeof grant !== 'object' || Array.isArray(grant)) return null;
        if (typeof grant.id !== 'string' || typeof grant.grantedAt !== 'string') return null;
        return grant as StoredFreeListingGrant;
    }

    private grantStatus(grant: StoredFreeListingGrant): FreeListingGrantView['status'] {
        if (grant.revokedAt) return 'REVOKED';
        if (grant.usedAt) return 'USED';
        if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now()) return 'EXPIRED';
        return 'ACTIVE';
    }

    private toView(grant: StoredFreeListingGrant | null): FreeListingGrantView | null {
        if (!grant) return null;
        return { ...grant, status: this.grantStatus(grant) };
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
                    preferences: true,
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            data: users.map(({ preferences, ...user }) => ({
                ...user,
                freeListingGrant: this.toView(this.storedGrant(preferences)),
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
        const expiresAt = this.calculateExpiry(durationUnit, durationValue);
        const now = new Date();

        const grant: StoredFreeListingGrant = {
            id: randomUUID(),
            grantedAt: now.toISOString(),
            grantedById: adminId,
            expiresAt: expiresAt?.toISOString() ?? null,
            usedAt: null,
            usedListingId: null,
            revokedAt: null,
        };

        for (let attempt = 0; attempt < 2; attempt += 1) {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, deletedAt: true, preferences: true, updatedAt: true },
            });
            if (!user) throw new NotFoundException('User not found');
            if (user.deletedAt) throw new BadRequestException('A banned user cannot be granted a free listing');

            const preferences = this.preferencesObject(user.preferences);
            preferences[GRANT_KEY] = grant;

            const updated = await this.prisma.user.updateMany({
                where: { id: userId, updatedAt: user.updatedAt },
                data: { preferences },
            });
            if (updated.count === 1) return this.toView(grant)!;
        }

        throw new BadRequestException('The user account changed while the grant was being saved. Please try again.');
    }

    async revoke(userId: string): Promise<FreeListingGrantView | null> {
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, preferences: true, updatedAt: true },
            });
            if (!user) throw new NotFoundException('User not found');

            const preferences = this.preferencesObject(user.preferences);
            const grant = this.storedGrant(preferences);
            if (!grant) return null;

            const revokedGrant: StoredFreeListingGrant = {
                ...grant,
                revokedAt: grant.revokedAt ?? new Date().toISOString(),
            };
            preferences[GRANT_KEY] = revokedGrant;

            const updated = await this.prisma.user.updateMany({
                where: { id: userId, updatedAt: user.updatedAt },
                data: { preferences },
            });
            if (updated.count === 1) return this.toView(revokedGrant);
        }

        throw new BadRequestException('The user account changed while the grant was being revoked. Please try again.');
    }

    /**
     * Convert one active admin grant into a normal completed £0 LISTING_FEE
     * transaction. ListingsService.publishListing already trusts completed
     * LISTING_FEE transactions, so this keeps the existing payment/review flow
     * untouched and makes rejected listings resubmittable without consuming a
     * second grant.
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

        // A completed fee transaction already exists — do not consume another grant.
        const existingFee = await this.prisma.transaction.findFirst({
            where: { listingId, type: 'LISTING_FEE', status: 'COMPLETED' },
            select: { id: true },
        });
        if (existingFee) return false;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { preferences: true, updatedAt: true },
        });
        if (!user) return false;

        const grant = this.storedGrant(user.preferences);
        if (!grant || this.grantStatus(grant) !== 'ACTIVE') return false;

        const usedAt = new Date().toISOString();
        const preferences = this.preferencesObject(user.preferences);
        preferences[GRANT_KEY] = {
            ...grant,
            usedAt,
            usedListingId: listingId,
        } satisfies StoredFreeListingGrant;

        return this.prisma.$transaction(async (tx) => {
            const claimed = await tx.user.updateMany({
                where: { id: userId, updatedAt: user.updatedAt },
                data: { preferences },
            });
            if (claimed.count !== 1) return false;

            await tx.transaction.create({
                data: {
                    userId,
                    listingId,
                    amount: 0,
                    type: 'LISTING_FEE',
                    status: 'COMPLETED',
                    description: 'Admin-granted free BASIC listing',
                },
            });
            return true;
        });
    }
}
