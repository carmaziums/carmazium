import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type FreeListingGrantMode = 'ONE' | 'UNTIL' | 'FOREVER';

export interface FreeListingGrant {
    mode: FreeListingGrantMode;
    expiresAt?: string;
    grantedAt: string;
    grantedBy: string;
}

export interface GrantFreeListingInput {
    mode: 'ONE' | 'HOURS' | 'DAYS' | 'MONTH' | 'FOREVER';
    amount?: number;
}

const GRANT_KEY = 'freeListingGrant';

function asPreferences(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? { ...(value as Record<string, any>) }
        : {};
}

export function readFreeListingGrant(preferences: unknown): FreeListingGrant | null {
    const prefs = asPreferences(preferences);
    const grant = prefs[GRANT_KEY];
    if (!grant || typeof grant !== 'object') return null;
    if (!['ONE', 'UNTIL', 'FOREVER'].includes(grant.mode)) return null;
    if (grant.mode === 'UNTIL' && !grant.expiresAt) return null;
    return grant as FreeListingGrant;
}

export function isFreeListingGrantActive(grant: FreeListingGrant | null, now = new Date()): boolean {
    if (!grant) return false;
    if (grant.mode === 'ONE' || grant.mode === 'FOREVER') return true;
    const expiresAt = new Date(grant.expiresAt!);
    return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}

function addCalendarMonth(now: Date): Date {
    const result = new Date(now);
    const originalDay = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + 1);
    const endOfTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(originalDay, endOfTargetMonth));
    return result;
}

@Injectable()
export class FreeListingEntitlementService {
    constructor(private readonly prisma: PrismaService) { }

    async getUserGrant(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, firstName: true, lastName: true, role: true, preferences: true },
        });
        if (!user) throw new NotFoundException('User not found');
        const grant = readFreeListingGrant(user.preferences);
        return { ...user, freeListingGrant: grant, freeListingGrantActive: isFreeListingGrantActive(grant) };
    }

    async grant(userId: string, input: GrantFreeListingInput, adminId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, preferences: true },
        });
        if (!user) throw new NotFoundException('User not found');

        const now = new Date();
        let grant: FreeListingGrant;

        if (input.mode === 'ONE') {
            grant = { mode: 'ONE', grantedAt: now.toISOString(), grantedBy: adminId };
        } else if (input.mode === 'FOREVER') {
            grant = { mode: 'FOREVER', grantedAt: now.toISOString(), grantedBy: adminId };
        } else {
            let expiresAt: Date;
            if (input.mode === 'MONTH') {
                expiresAt = addCalendarMonth(now);
            } else {
                const amount = Number(input.amount);
                if (!Number.isInteger(amount) || amount < 1) {
                    throw new BadRequestException('amount must be a positive whole number');
                }
                if (input.mode === 'HOURS') {
                    if (amount > 24 * 31) throw new BadRequestException('Hours grant cannot exceed 744 hours');
                    expiresAt = new Date(now.getTime() + amount * 60 * 60 * 1000);
                } else if (input.mode === 'DAYS') {
                    if (amount > 365) throw new BadRequestException('Days grant cannot exceed 365 days');
                    expiresAt = new Date(now.getTime() + amount * 24 * 60 * 60 * 1000);
                } else {
                    throw new BadRequestException('Invalid free-listing grant mode');
                }
            }
            grant = {
                mode: 'UNTIL',
                expiresAt: expiresAt.toISOString(),
                grantedAt: now.toISOString(),
                grantedBy: adminId,
            };
        }

        const preferences = asPreferences(user.preferences);
        preferences[GRANT_KEY] = grant;
        await this.prisma.user.update({ where: { id: userId }, data: { preferences } });
        return this.getUserGrant(userId);
    }

    async revoke(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, preferences: true },
        });
        if (!user) throw new NotFoundException('User not found');
        const preferences = asPreferences(user.preferences);
        delete preferences[GRANT_KEY];
        await this.prisma.user.update({ where: { id: userId }, data: { preferences } });
        return this.getUserGrant(userId);
    }

    /**
     * If a valid admin grant applies to this retail listing, create the same
     * COMPLETED LISTING_FEE transaction the existing publish pipeline already
     * understands. The normal publish service then continues unchanged and
     * moves the listing to PENDING_REVIEW.
     *
     * ONE grants are consumed in the same DB transaction as the zero-value fee
     * row and the user row is locked, so concurrent publish attempts cannot use
     * a single grant twice.
     */
    async prepareFreePublish(listingId: string, userId: string): Promise<boolean> {
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

            const [user, listing] = await Promise.all([
                tx.user.findUnique({
                    where: { id: userId },
                    select: { id: true, role: true, preferences: true },
                }),
                tx.listing.findUnique({
                    where: { id: listingId },
                    select: { id: true, sellerId: true, type: true, badgeTier: true, status: true, images: true },
                }),
            ]);

            // Admin listings already have their own established no-fee path.
            if (!user || user.role === 'ADMIN' || !listing) return false;
            if (listing.sellerId !== userId) return false;
            if (listing.type !== 'CLASSIFIED' || listing.badgeTier === 'FREE') return false;
            if (!['DRAFT', 'REJECTED'].includes(listing.status)) return false;
            if (listing.images.length < 10) return false;

            const existingPayment = await tx.transaction.findFirst({
                where: { listingId, type: 'LISTING_FEE', status: 'COMPLETED', deletedAt: null },
                select: { id: true },
            });
            if (existingPayment) return false;

            const grant = readFreeListingGrant(user.preferences);
            if (!isFreeListingGrantActive(grant)) {
                // Lazily clear expired grants; no scheduler/background job is needed.
                if (grant?.mode === 'UNTIL') {
                    const preferences = asPreferences(user.preferences);
                    delete preferences[GRANT_KEY];
                    await tx.user.update({ where: { id: userId }, data: { preferences } });
                }
                return false;
            }

            if (grant!.mode === 'ONE') {
                const preferences = asPreferences(user.preferences);
                delete preferences[GRANT_KEY];
                await tx.user.update({ where: { id: userId }, data: { preferences } });
            }

            await tx.transaction.create({
                data: {
                    listingId,
                    userId,
                    amount: 0,
                    type: 'LISTING_FEE',
                    status: 'COMPLETED',
                    description: `Admin-granted free listing (${grant!.mode})`,
                },
            });

            return true;
        });
    }
}
