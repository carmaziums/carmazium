import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { resolveDealerActor, assertDealerPermission } from '../dealers/dealer-access';
import { CreateFinanceReferralDto } from './finance-referral.dto';

export const JIGSAW_FINANCE_URL = 'https://applications.jigsawfinance.com/pulse-cars-limited-1787921597855/';
export const FINANCE_REFERRAL_NOTICE_VERSION = 'jigsaw-referral-2026-11-13';
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

@Injectable()
export class FinanceReferralService {
    constructor(private readonly prisma: PrismaService, private readonly email: EmailService) {}

    private async preferenceOwner(userId: string, write = false) {
        const actor = await resolveDealerActor(this.prisma, userId);
        if (actor) {
            if (write) assertDealerPermission(actor, 'MANAGE_INVENTORY');
            return actor.ownerUserId;
        }
        return userId;
    }

    async preference(userId: string) {
        const owner = await this.preferenceOwner(userId);
        const user = await this.prisma.user.findUnique({ where: { id: owner }, select: { preferences: true } });
        return { enabled: (user?.preferences as Record<string, unknown> | null)?.financeCalculatorEnabled === true };
    }

    async setPreference(userId: string, enabled: boolean) {
        const owner = await this.preferenceOwner(userId, true);
        // Merge in PostgreSQL so simultaneous unrelated preference updates cannot be lost here.
        await this.prisma.$executeRaw`UPDATE "users" SET "preferences" = COALESCE("preferences", '{}'::jsonb) || jsonb_build_object('financeCalculatorEnabled', ${enabled}), "updatedAt" = NOW() WHERE "id" = ${owner} AND "deletedAt" IS NULL`;
        return { enabled };
    }

    private async eligibleListing(listingId: string) {
        return this.prisma.listing.findFirst({
            where: { id: listingId, type: 'CLASSIFIED', status: 'ACTIVE', deletedAt: null, seller: { deletedAt: null } },
            select: { id: true, title: true, slug: true, sellerId: true, seller: { select: { preferences: true } } },
        });
    }

    async availability(listingId: string) {
        const listing = await this.eligibleListing(listingId);
        return {
            enabled: Boolean(listing && (listing.seller?.preferences as Record<string, unknown> | null)?.financeCalculatorEnabled === true),
            title: listing?.title ?? null,
        };
    }

    async create(dto: CreateFinanceReferralDto) {
        const listing = await this.eligibleListing(dto.listingId);
        if (!listing) throw new NotFoundException('This vehicle is no longer available.');
        if ((listing.seller?.preferences as Record<string, unknown> | null)?.financeCalculatorEnabled !== true) {
            throw new ForbiddenException('The seller has not enabled finance referrals for this listing.');
        }
        if (dto.phone.replace(/\D/g, '').length < 7 || dto.phone.replace(/\D/g, '').length > 15) {
            throw new BadRequestException('Enter a valid phone number.');
        }
        const data = {
            id: dto.requestId, listingId: listing.id, sellerId: listing.sellerId!,
            listingTitle: listing.title, listingSlug: listing.slug,
            fullName: dto.fullName, email: dto.email.toLowerCase(), phone: dto.phone,
            consentVersion: FINANCE_REFERRAL_NOTICE_VERSION,
        };
        // A stable random request id makes a retry after a lost response safe.
        let referral;
        try {
            referral = await this.prisma.financeReferral.create({ data });
        } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
            referral = await this.prisma.financeReferral.findUnique({ where: { id: dto.requestId } });
        }
        if (!referral || ['listingId', 'fullName', 'email', 'phone'].some(key => referral[key] !== data[key])) {
            throw new ConflictException('Please reopen the form and try again.');
        }
        if (!referral.adminNotifiedAt && !await this.notifyAdmin(referral.id)) {
            throw new ServiceUnavailableException('Your details have been saved, but the notification is still pending. Please try again shortly to continue to Jigsaw Finance.');
        }
        return { redirectUrl: JIGSAW_FINANCE_URL };
    }

    async notifyAdmin(id: string): Promise<boolean> {
        const claim = await this.prisma.financeReferral.updateMany({
            where: { id, adminNotifiedAt: null, OR: [{ notificationClaimedAt: null }, { notificationClaimedAt: { lt: new Date(Date.now() - 5 * 60_000) } }] },
            data: { notificationClaimedAt: new Date() },
        });
        if (!claim.count) return false;
        try {
            const referral = await this.prisma.financeReferral.findUniqueOrThrow({ where: { id } });
            const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', deletedAt: null }, select: { email: true } });
            const recipients = [...new Set(admins.map(admin => admin.email).filter(Boolean))];
            if (!recipients.length) return false;
            const sent = await this.email.sendEmail({
                to: recipients,
                subject: 'New Jigsaw Finance referral from CarMazium',
                replyTo: referral.email,
                html: `<h2>Finance application journey started</h2><p>A customer submitted their contact details before continuing to the Pulse Cars Limited Jigsaw Finance application.</p><p>Name: ${escapeHtml(referral.fullName)}<br>Email: ${escapeHtml(referral.email)}<br>Phone: ${escapeHtml(referral.phone)}</p><p>Vehicle: ${escapeHtml(referral.listingTitle)}<br><a href="https://www.carmazium.com/buy-cars/${encodeURIComponent(referral.listingSlug)}">View vehicle</a></p><p>Reference: ${escapeHtml(referral.id)}<br>Received: ${referral.createdAt.toISOString()}</p><p>This is a referral notification, not confirmation of a completed application, approval or successful finance agreement. Jigsaw handles the application externally.</p>`,
            });
            if (!sent) return false;
            await this.prisma.financeReferral.update({ where: { id }, data: { adminNotifiedAt: new Date() } });
            return true;
        } finally {
            await this.prisma.financeReferral.updateMany({ where: { id }, data: { notificationClaimedAt: null } });
        }
    }

    @Cron('0 */5 * * * *')
    async retryNotifications() {
        const pending = await this.prisma.financeReferral.findMany({
            where: { adminNotifiedAt: null, createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
            select: { id: true }, orderBy: { createdAt: 'asc' }, take: 25,
        });
        for (const referral of pending) await this.notifyAdmin(referral.id);
    }

    @Cron('0 20 3 * * *')
    async removeExpiredContactDetails() {
        await this.prisma.financeReferral.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86400_000) } } });
    }
}
