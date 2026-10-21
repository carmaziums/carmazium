import { ProvisionalAuctionReminderService } from './provisional-auction-reminder.service';

describe('ProvisionalAuctionReminderService', () => {
    const clock = new Date('2026-10-21T12:00:00.000Z');
    const day = 24 * 60 * 60 * 1000;
    const auction = (age: number) => ({
        id: 'auction-1', listingId: 'listing-1', reservePrice: 9000,
        provisionalOfferBidId: 'bid-1',
        provisionalOfferedAt: new Date(clock.getTime() - age * day),
        listing: {
            title: '2018 Ford Kuga', sellerId: 'seller-1',
            status: 'ACTIVE', type: 'CLASSIFIED', linkedListingId: null,
        },
    });
    let prisma: any;
    let notifications: any;
    let email: any;
    let service: ProvisionalAuctionReminderService;

    beforeEach(() => {
        prisma = {
            auction: {
                findMany: jest.fn().mockResolvedValue([]),
                findFirst: jest.fn().mockResolvedValue({ id: 'auction-1' }),
            },
            notification: {
                findFirst: jest.fn().mockResolvedValue(null),
                findUnique: jest.fn().mockResolvedValue({ data: { emailAttempts: 1, emailStatus: 'retryable' } }),
            },
            $queryRaw: jest.fn().mockResolvedValue([{ id: 'notice-1' }]),
            bid: { findUnique: jest.fn().mockResolvedValue({
                amount: 6165, deletedAt: null, cancelledAt: null, archivedAt: null,
            }) },
            user: { findUnique: jest.fn().mockResolvedValue({
                email: 'seller@example.com', firstName: 'Seller',
            }), findMany: jest.fn().mockResolvedValue([]) },
        };
        notifications = {
            create: jest.fn().mockResolvedValue({ id: 'notice-1' }),
            shouldSendEmail: jest.fn().mockResolvedValue(true),
        };
        email = { sendAuctionProvisionalOfferEmail: jest.fn().mockResolvedValue({ id: 'provider-1' }) };
        service = new ProvisionalAuctionReminderService(prisma, notifications, email);
    });

    it('sends a 24h reminder for a pending offer on ACTIVE Retail listing', async () => {
        prisma.auction.findMany.mockResolvedValue([auction(1.5)]);
        await service.remindSellers(clock);
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'seller-1', type: 'AUCTION_PROVISIONAL_REMINDER',
            actionType: expect.stringMatching(/^PROVISIONAL_REMINDER_24H_/),
        }));
        expect(email.sendAuctionProvisionalOfferEmail).toHaveBeenCalledWith(expect.objectContaining({
            amount: 6165, ended: true, retailAlreadyLive: true,
        }));
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(2); // claim then mark sent
    });

    it('does not duplicate an existing notification and still sends its unattempted email', async () => {
        prisma.auction.findMany.mockResolvedValue([auction(4)]);
        prisma.notification.findFirst.mockResolvedValue({ id: 'notice-1' });
        await service.remindSellers(clock);
        expect(notifications.create).not.toHaveBeenCalled();
        expect(email.sendAuctionProvisionalOfferEmail).toHaveBeenCalledTimes(1);
    });

    it('retries a previously failed provider dispatch but never sends if another machine holds the lease', async () => {
        prisma.auction.findMany.mockResolvedValue([auction(4)]);
        prisma.notification.findFirst.mockResolvedValue({ id: 'notice-1' });
        email.sendAuctionProvisionalOfferEmail
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'provider-2' });
        await service.remindSellers(clock);
        prisma.$queryRaw.mockResolvedValueOnce([]); // another machine currently holds lease
        await service.remindSellers(clock);
        expect(email.sendAuctionProvisionalOfferEmail).toHaveBeenCalledTimes(1);
        prisma.$queryRaw.mockResolvedValue([{ id: 'notice-1' }]); // retry lease expired
        await service.remindSellers(clock);
        expect(email.sendAuctionProvisionalOfferEmail).toHaveBeenCalledTimes(2);
    });

    it('escalates exhausted seller email retries to an administrator', async () => {
        prisma.auction.findMany.mockResolvedValue([auction(4)]);
        prisma.notification.findFirst.mockResolvedValue({ id: 'notice-1' });
        prisma.notification.findUnique.mockResolvedValue({
            data: { emailAttempts: 6, emailStatus: 'retryable' },
        });
        prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
        prisma.$queryRaw.mockResolvedValue([]);
        await service.remindSellers(clock);
        expect(email.sendAuctionProvisionalOfferEmail).not.toHaveBeenCalled();
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'admin-1', type: 'AUCTION_PROVISIONAL_EMAIL_FAILURE',
            actionType: expect.stringMatching(/^PROVISIONAL_REMINDER_EMAIL_FAILED_72H_/),
        }));
    });

    it('does not alert admins about resolved provisional bids', async () => {
        prisma.auction.findMany.mockResolvedValue([auction(4)]);
        prisma.notification.findFirst.mockResolvedValue({ id: 'notice-1' });
        prisma.notification.findUnique.mockResolvedValue({
            data: { emailAttempts: 6, emailStatus: 'retryable' },
        });
        prisma.auction.findFirst.mockResolvedValue(null);
        prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
        prisma.$queryRaw.mockResolvedValue([]);
        await service.remindSellers(clock);
        expect(notifications.create).not.toHaveBeenCalled();
    });

    it('does not send stale email if the provisional offer was resolved', async () => {
        prisma.auction.findMany.mockResolvedValue([auction(1.5)]);
        prisma.auction.findFirst.mockResolvedValue(null);
        await service.remindSellers(clock);
        expect(email.sendAuctionProvisionalOfferEmail).not.toHaveBeenCalled();
    });

    it('does nothing when there are no pending auctions', async () => {
        await service.remindSellers(clock);
        expect(notifications.create).not.toHaveBeenCalled();
    });
});
