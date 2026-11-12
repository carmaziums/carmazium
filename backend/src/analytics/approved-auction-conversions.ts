import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const HOUR = 3_600_000;
export const APPROVED_AUCTION_EVENT = 'auction_listing_approved';
export const approvedAuctionTrackingEnabled = () => process.env.GA4_APPROVED_AUCTIONS_ENABLED === 'true';

/** Called inside the SAME transaction that approves the canonical listing. */
export async function queueApprovedAuctionConversion(
    tx: Prisma.TransactionClient,
    listing: { id: string; type: string; sellerId: string | null },
) {
    if (!approvedAuctionTrackingEnabled() || listing.type !== 'AUCTION' || !listing.sellerId) return;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${listing.sellerId}))`;
    const seller = await tx.user.findUnique({ where: { id: listing.sellerId }, select: { role: true, deletedAt: true } });
    if (!seller || seller.role === 'ADMIN' || seller.deletedAt) return;
    // Only browser-linked, consented listings can be sent. No invented client ID
    // and no attribution backfill from an administrator's browser.
    await tx.approvedAuctionConversion.updateMany({
        where: { listingId: listing.id, userId: listing.sellerId, state: 'CAPTURED', approvedAt: null },
        data: { approvedAt: new Date(), state: 'PENDING' },
    });
}

type Capture = { listingId?: unknown; clientId?: unknown; sessionId?: unknown; consentAt?: unknown };

@Injectable()
export class ApprovedAuctionConversionsService {
    private readonly logger = new Logger(ApprovedAuctionConversionsService.name);
    constructor(private readonly prisma: PrismaService) {}

    async capture(userId: string, input: Capture) {
        if (!approvedAuctionTrackingEnabled()) return { captured: false };
        const { listingId, clientId, sessionId } = input;
        const consentAt = typeof input.consentAt === 'string' ? new Date(input.consentAt) : new Date(NaN);
        if (typeof listingId !== 'string' || !/^[A-Za-z0-9_-]{1,48}$/.test(listingId)
            || typeof clientId !== 'string' || !/^\d{1,32}\.\d{1,32}$/.test(clientId)
            || (sessionId !== undefined && (typeof sessionId !== 'string' || !/^\d{1,20}$/.test(sessionId)))
            || !Number.isFinite(consentAt.getTime()) || consentAt.getTime() > Date.now() + 60_000) {
            throw new BadRequestException('Invalid conversion attribution');
        }
        return this.prisma.$transaction(async tx => {
            // Serialize consent writes across tabs, revocation and capture.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
            const listing = await tx.listing.findFirst({
                where: { id: listingId, sellerId: userId, type: 'AUCTION', deletedAt: null,
                    status: { in: ['DRAFT', 'PENDING_REVIEW', 'REJECTED'] },
                    seller: { role: { not: 'ADMIN' }, deletedAt: null } },
                select: { id: true },
            });
            if (!listing) return { captured: false };
            const consent = await tx.sellerConversionConsent.findUnique({ where: { userId } });
            if (consent && (consent.decidedAt > consentAt || (!consent.allowed && consent.decidedAt >= consentAt))) return { captured: false };
            await tx.sellerConversionConsent.upsert({
                where: { userId }, create: { userId, allowed: true, decidedAt: consentAt },
                update: { allowed: true, decidedAt: consentAt },
            });
            const existing = await tx.approvedAuctionConversion.findUnique({ where: { listingId } });
            // Never reset an approval or dispatch because a seller resubmits.
            if (existing?.approvedAt || (existing && !['CAPTURED', 'REVOKED'].includes(existing.state))) {
                return { captured: false };
            }
            const data = { userId, clientId, sessionId: sessionId ?? null, capturedAt: new Date(), state: 'CAPTURED' };
            if (existing) {
                const saved = await tx.approvedAuctionConversion.updateMany({
                    where: { listingId, userId, approvedAt: null, state: { in: ['CAPTURED', 'REVOKED'] } }, data,
                });
                return { captured: saved.count === 1 };
            }
            await tx.approvedAuctionConversion.create({ data: { listingId, ...data } });
            return { captured: true };
        });
    }

    async revoke(userId: string) {
        if (!approvedAuctionTrackingEnabled()) return { ok: true };
        await this.prisma.$transaction(async tx => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
            const data = { allowed: false, decidedAt: new Date() };
            await tx.sellerConversionConsent.upsert({ where: { userId }, create: { userId, ...data }, update: data });
            await tx.approvedAuctionConversion.updateMany({
                where: { userId, state: { in: ['CAPTURED', 'PENDING'] } },
                data: { state: 'REVOKED', clientId: null, sessionId: null },
            });
        });
        return { ok: true };
    }

    @Cron('* * * * *')
    async dispatchPending() {
        const measurementId = process.env.GA4_MEASUREMENT_ID?.trim();
        const secret = process.env.GA4_MEASUREMENT_PROTOCOL_API_SECRET?.trim();
        if (!approvedAuctionTrackingEnabled() || !/^G-[A-Z0-9]+$/.test(measurementId ?? '') || !secret) return;
        const rows = await this.prisma.approvedAuctionConversion.findMany({
            where: { state: 'PENDING' }, orderBy: { approvedAt: 'asc' }, take: 25,
        });
        for (const row of rows) {
            const claimed = await this.prisma.$transaction(async tx => {
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${row.userId}))`;
                const current = await tx.approvedAuctionConversion.findUnique({ where: { listingId: row.listingId },
                    include: { user: { select: { role: true, deletedAt: true } }, listing: { select: { sellerId: true, deletedAt: true } } } });
                if (!current || current.state !== 'PENDING') return null;
                const consent = await tx.sellerConversionConsent.findUnique({ where: { userId: current.userId } });
                const permitted = consent?.allowed && current.clientId && current.approvedAt
                    && current.user.role !== 'ADMIN' && !current.user.deletedAt && !current.listing.deletedAt
                    && current.listing.sellerId === current.userId;
                // Google's attribution join has a 48h limit. Do not invent new
                // timestamps/client identities to make old approvals look fresh.
                const timely = current.approvedAt && current.approvedAt >= current.capturedAt
                    && Date.now() - current.capturedAt.getTime() < 48 * HOUR;
                if (!permitted || !timely) {
                    await tx.approvedAuctionConversion.update({ where: { listingId: row.listingId },
                        data: { state: permitted ? 'EXPIRED' : 'REVOKED', clientId: null, sessionId: null } });
                    return null;
                }
                const claim = await tx.approvedAuctionConversion.updateMany({
                    where: { listingId: row.listingId, state: 'PENDING' },
                    data: { state: 'DISPATCHING', dispatchedAt: new Date() },
                });
                return claim.count === 1 ? current : null;
            });
            if (!claimed) continue;
            const params: Record<string, unknown> = {
                listing_id: claimed.listingId, listing_type: 'auction', qualification: 'admin_approved',
                event_id: `approved_auction:${claimed.listingId}`,
            };
            const sessionStart = Number(claimed.sessionId) * 1000;
            if (claimed.sessionId && Number.isSafeInteger(sessionStart) && sessionStart > 0
                && claimed.approvedAt!.getTime() >= sessionStart
                && Date.now() - sessionStart < 24 * HOUR) {
                params.session_id = claimed.sessionId;
            }
            const url = new URL('https://region1.google-analytics.com/mp/collect');
            url.searchParams.set('measurement_id', measurementId!);
            url.searchParams.set('api_secret', secret);
            let state = 'UNCERTAIN';
            let failureCode: string | null = 'network_or_timeout';
            try {
                const response = await fetch(url, { method: 'POST', redirect: 'error',
                    headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8_000),
                    body: JSON.stringify({ client_id: claimed.clientId,
                        timestamp_micros: claimed.approvedAt!.getTime() * 1000,
                        consent: { ad_user_data: 'GRANTED', ad_personalization: 'GRANTED' },
                        events: [{ name: APPROVED_AUCTION_EVENT, params }] }),
                });
                // 2xx acknowledges transport, NOT validation/reporting in GA4.
                state = response.ok ? 'ACKNOWLEDGED' : 'FAILED';
                failureCode = response.ok ? null : `http_${response.status}`;
            } catch { /* Never log the secret-bearing URL or client identifier. */ }
            await this.prisma.approvedAuctionConversion.update({ where: { listingId: claimed.listingId },
                data: { state, failureCode, clientId: null, sessionId: null } });
            if (state !== 'ACKNOWLEDGED') this.logger.warn(`Approved auction delivery: ${state}; ${failureCode}`);
            // No automatic retry: GA4 custom event_id is not an exactly-once
            // guarantee. Ambiguous responses require reconciliation, not replay.
        }
    }

    @Cron('15 * * * *')
    async scrubExpiredIdentifiers() {
        if (!approvedAuctionTrackingEnabled()) return;
        await this.prisma.approvedAuctionConversion.updateMany({
            where: { clientId: { not: null }, capturedAt: { lt: new Date(Date.now() - 48 * HOUR) } },
            data: { clientId: null, sessionId: null, state: 'EXPIRED' },
        });
    }
}
