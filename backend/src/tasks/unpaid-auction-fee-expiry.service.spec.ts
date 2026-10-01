import { UnpaidAuctionFeeExpiryService } from './unpaid-auction-fee-expiry.service';

const wonAt = new Date('2026-10-01T10:00:00.000Z');
const due = new Date('2026-10-04T10:00:00.000Z');
const auction = (patch: Record<string, any> = {}) => ({
    id: 'auction-1', listing: { title: 'Test vehicle' }, winnerId: 'winner-1',
    wonAt, status: 'ENDED', deletedAt: null, buyerFeePaid: false,
    buyerFeeReminder24SentAt: null, buyerFeeReminder6SentAt: null, ...patch,
});
function harness(sample: any = auction()) {
    const prisma: any = {
        auction: {
            findMany: jest.fn().mockResolvedValue([sample]),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUnique: jest.fn().mockResolvedValue({
                status: 'ENDED', deletedAt: null, winnerId: sample.winnerId,
                wonAt: sample.wonAt, buyerFeePaid: false,
            }),
        },
        user: { findUnique: jest.fn().mockResolvedValue({ email: 'winner@example.com' }) },
    };
    const notifications: any = {
        create: jest.fn().mockResolvedValue({ id: 'notification' }),
        shouldSendEmail: jest.fn().mockResolvedValue(true),
    };
    const email: any = { sendAuctionBuyerFeeReminderEmail: jest.fn().mockResolvedValue(undefined) };
    const auctions: any = { revertUnpaidWins: jest.fn().mockResolvedValue({ reverted: 0 }) };
    const service = new UnpaidAuctionFeeExpiryService(auctions, prisma, notifications, email);
    return { service, prisma, notifications, email, auctions };
}

describe('72h auction buyer-fee reminder cron', () => {
    it('claims 24h reminder for an unpaid win and uses the exact wonAt deadline', async () => {
        const h = harness();
        await h.service.remindUnpaidWinners(new Date('2026-10-03T11:00:00.000Z'));
        expect(h.prisma.auction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                id: 'auction-1', winnerId: 'winner-1', wonAt,
                buyerFeePaid: false, buyerFeeReminder24SentAt: null,
            }),
        }));
        expect(h.notifications.create).toHaveBeenCalledWith(expect.objectContaining({
            type: 'AUCTION_FEE_REMINDER', userId: 'winner-1',
            data: { buyerFeeDeadlineAt: due.toISOString(), hoursStage: 24 },
        }));
        expect(h.email.sendAuctionBuyerFeeReminderEmail).toHaveBeenCalledWith(
            expect.objectContaining({ deadline: due, hoursStage: 24 }),
        );
    });
    it('claims the six-hour stage independently of the 24-hour stage', async () => {
        const h = harness(auction({ buyerFeeReminder24SentAt: new Date() }));
        await h.service.remindUnpaidWinners(new Date('2026-10-04T06:00:00.000Z'));
        expect(h.prisma.auction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ buyerFeeReminder6SentAt: null }),
        }));
        expect(h.notifications.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: { buyerFeeDeadlineAt: due.toISOString(), hoursStage: 6 } }),
        );
    });
    it('does not replay a reminder when its claim already exists', async () => {
        const h = harness(auction({ buyerFeeReminder24SentAt: new Date() }));
        await h.service.remindUnpaidWinners(new Date('2026-10-03T11:00:00.000Z'));
        expect(h.prisma.auction.updateMany).not.toHaveBeenCalled();
        expect(h.notifications.create).not.toHaveBeenCalled();
    });
    it('does not send when another instance already claimed the stage', async () => {
        const h = harness();
        h.prisma.auction.updateMany.mockResolvedValue({ count: 0 });
        await h.service.remindUnpaidWinners(new Date('2026-10-03T11:00:00.000Z'));
        expect(h.notifications.create).not.toHaveBeenCalled();
        expect(h.email.sendAuctionBuyerFeeReminderEmail).not.toHaveBeenCalled();
    });
    it('suppresses a reminder if the fee is paid or winner replaced after claim', async () => {
        const h = harness();
        h.prisma.auction.findUnique.mockResolvedValue({ buyerFeePaid: true, wonAt, winnerId: 'winner-1', status: 'ENDED' });
        await h.service.remindUnpaidWinners(new Date('2026-10-03T11:00:00.000Z'));
        expect(h.notifications.create).not.toHaveBeenCalled();
        h.prisma.auction.findUnique.mockResolvedValue({ buyerFeePaid: false, wonAt, winnerId: 'new-winner', status: 'ENDED' });
        await h.service.remindUnpaidWinners(new Date('2026-10-03T11:00:00.000Z'));
        expect(h.notifications.create).not.toHaveBeenCalled();
    });
    it('does not remind an expired win, or send emails against notification preferences', async () => {
        const h = harness();
        await h.service.remindUnpaidWinners(new Date('2026-10-05T12:00:00.000Z'));
        expect(h.notifications.create).not.toHaveBeenCalled();
        h.notifications.shouldSendEmail.mockResolvedValue(false);
        await h.service.remindUnpaidWinners(new Date('2026-10-03T11:00:00.000Z'));
        expect(h.notifications.create).toHaveBeenCalledTimes(1);
        expect(h.email.sendAuctionBuyerFeeReminderEmail).not.toHaveBeenCalled();
    });
    it('preserves the existing separate hourly expiry call', async () => {
        const h = harness();
        await h.service.handleUnpaidAuctionFeeExpiry();
        expect(h.auctions.revertUnpaidWins).toHaveBeenCalledTimes(1);
    });
});
