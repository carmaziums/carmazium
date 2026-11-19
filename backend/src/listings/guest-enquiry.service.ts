import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { resolveDealerActor, assertDealerPermission } from '../dealers/dealer-access';
import { resolveFrontendUrl } from '../core/frontend-url';
import { GuestEnquiryDto, VerifyGuestEnquiryDto } from './guest-enquiry.dto';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const GUEST_ENQUIRY_CONSENT = 'retail-seller-contact-2026-11-19';

@Injectable()
export class GuestEnquiryService {
    constructor(private readonly prisma: PrismaService, private readonly email: EmailService) {}
    private hash(id: string, code: string) {
        const secret = process.env.SESSION_SECRET;
        if (!secret) throw new ServiceUnavailableException('Email enquiries are temporarily unavailable. Please call the seller or try again later.');
        return createHmac('sha256', secret).update(`guest-enquiry:${id}:${code}`).digest('hex');
    }
    private eligible(id: string) {
        return this.prisma.listing.findFirst({ where: { id, type: 'CLASSIFIED', status: 'ACTIVE', deletedAt: null, sellerId: { not: null }, seller: { deletedAt: null }, offers: { none: { status: 'ACCEPTED' } } },
            select: { id: true, sellerId: true, title: true, slug: true } });
    }
    async start(dto: GuestEnquiryDto) {
        if (dto.consent !== true || dto.website) throw new BadRequestException('Please confirm permission to share your enquiry with the seller.');
        const listing = await this.eligible(dto.listingId);
        if (!listing?.sellerId) throw new NotFoundException('This vehicle is no longer available for enquiries.');
        const email = dto.email.toLowerCase().trim();
        const id = randomUUID();
        const code = String(randomInt(100000, 1000000));
        const codeHash = this.hash(id, code);
        // Serialize per address across all server instances; an IP limit alone
        // does not prevent a distributed sender from repeatedly emailing someone.
        await this.prisma.$transaction(async tx => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`guest-enquiry:${email}`}))`;
            const count = await tx.guestListingEnquiry.count({ where: { email, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
            if (count >= 3) throw new BadRequestException('Too many email codes requested. Please use your latest code or try again in an hour.');
            await tx.guestListingEnquiry.create({ data: { id, listingId: listing.id, sellerId: listing.sellerId!, fullName: dto.fullName, email, phone: dto.phone || null,
                message: dto.message, codeHash, expiresAt: new Date(Date.now() + 15 * 60_000), consentVersion: GUEST_ENQUIRY_CONSENT } });
        });
        const sent = await this.email.sendEmail({ to: email, subject: 'Confirm your CarMazium vehicle enquiry',
            html: `<p>Enter this code on CarMazium to send your vehicle enquiry:</p><p style="font-size:28px;font-weight:bold">${code}</p><p>The code expires in 15 minutes. No account is created. If you did not request this, ignore this email; nothing will be sent to the seller.</p>` });
        if (!sent) throw new ServiceUnavailableException('We could not send your confirmation code. Please try again later or call the seller.');
        return { id, expiresInMinutes: 15 };
    }
    async verify(dto: VerifyGuestEnquiryDto) {
        const outcome = await this.prisma.$transaction(async tx => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`guest-enquiry-id:${dto.id}`}))`;
            const row = await tx.guestListingEnquiry.findUnique({ where: { id: dto.id } });
            if (!row || row.attempts >= 5 || row.expiresAt <= new Date()) return 'invalid';
            const match = timingSafeEqual(Buffer.from(row.codeHash, 'hex'), Buffer.from(this.hash(row.id, dto.code), 'hex'));
            if (!match) { await tx.guestListingEnquiry.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } }); return 'invalid'; }
            if (row.verifiedAt) return 'verified'; // Safe retry after a lost response.
            const listing = await tx.listing.findFirst({ where: { id: row.listingId, sellerId: row.sellerId, status: 'ACTIVE', type: 'CLASSIFIED', deletedAt: null, seller: { deletedAt: null }, offers: { none: { status: 'ACCEPTED' } } }, select: { id: true } });
            if (!listing) return 'unavailable';
            await tx.guestListingEnquiry.update({ where: { id: row.id }, data: { verifiedAt: new Date() } });
            // Persist the inbox notification atomically with verification. The
            // seller email is a retryable outbox task, never the only copy.
            await tx.notification.create({ data: { userId: row.sellerId, type: 'LISTING_ENQUIRY', title: 'New vehicle enquiry', message: 'A buyer confirmed their email and sent an enquiry about your vehicle.', entityType: 'LISTING', entityId: row.listingId, data: { listingId: row.listingId, link: "/dashboard/enquiries" } } });
            const dealer = await tx.dealerProfile.findUnique({ where: { userId: row.sellerId }, select: { id: true } });
            if (dealer) await tx.lead.create({ data: { dealerProfileId: dealer.id, listingId: row.listingId, buyerName: row.fullName, buyerEmail: row.email, buyerPhone: row.phone, source: 'guest_enquiry', notes: row.message } });
            return 'verified';
        });
        if (outcome === 'invalid') throw new BadRequestException('The code is incorrect, expired or has too many attempts. Check your latest email or request a new code.');
        if (outcome === 'unavailable') throw new NotFoundException('This vehicle is no longer available. Your enquiry has not been sent.');
        // The committed seller inbox is the delivery guarantee. An email outage
        // must not make the customer submit another copy of a delivered enquiry.
        await this.notifySeller(dto.id).catch(() => false);
        return { sent: true };
    }
    async notifySeller(id: string) {
        const claim = await this.prisma.guestListingEnquiry.updateMany({ where: { id, verifiedAt: { not: null }, notifiedAt: null, OR: [{ notificationClaimedAt: null }, { notificationClaimedAt: { lt: new Date(Date.now() - 300_000) } }] }, data: { notificationClaimedAt: new Date() } });
        if (!claim.count) return false;
        try {
            const row = await this.prisma.guestListingEnquiry.findUniqueOrThrow({ where: { id }, include: { seller: { select: { email: true, deletedAt: true } }, listing: { select: { title: true } } } });
            if (row.seller.deletedAt) return false;
            const url = `${resolveFrontendUrl(process.env.FRONTEND_URL)}/dashboard/enquiries`;
            const sent = await this.email.sendEmail({ to: row.seller.email, replyTo: row.email, subject: 'New CarMazium vehicle enquiry',
                html: `<h2>Enquiry about ${escape(row.listing.title)}</h2><p>From ${escape(row.fullName)} (email confirmed)</p><p>Email: ${escape(row.email)}${row.phone ? `<br>Phone: ${escape(row.phone)}` : ''}</p><p style="white-space:pre-wrap">${escape(row.message)}</p><p>Reply to this email to contact the buyer directly. They have not created a CarMazium account.</p><p><a href="${escape(url)}">View your enquiries</a></p>` });
            if (!sent) return false;
            await this.prisma.guestListingEnquiry.update({ where: { id }, data: { notifiedAt: new Date() } });
            return true;
        } finally { await this.prisma.guestListingEnquiry.updateMany({ where: { id }, data: { notificationClaimedAt: null } }); }
    }
    async mine(userId: string) {
        const actor = await resolveDealerActor(this.prisma, userId);
        if (actor) assertDealerPermission(actor, 'MANAGE_CRM');
        return this.prisma.guestListingEnquiry.findMany({ where: { sellerId: actor?.ownerUserId || userId, verifiedAt: { not: null } },
            orderBy: { verifiedAt: 'desc' }, take: 100,
            select: { id: true, fullName: true, email: true, phone: true, message: true, verifiedAt: true, listing: { select: { title: true, slug: true } } } });
    }
    @Cron('0 */5 * * * *')
    async retryNotifications() {
        const rows = await this.prisma.guestListingEnquiry.findMany({ where: { verifiedAt: { not: null }, notifiedAt: null, createdAt: { gt: new Date(Date.now() - 7 * 86400_000) } }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: 25 });
        for (const row of rows) await this.notifySeller(row.id).catch(() => false);
    }
    @Cron('0 30 3 * * *')
    async removeExpired() {
        await this.prisma.guestListingEnquiry.deleteMany({ where: { OR: [{ verifiedAt: null, createdAt: { lt: new Date(Date.now() - 86400_000) } }, { createdAt: { lt: new Date(Date.now() - 90 * 86400_000) } }] } });
    }
}
