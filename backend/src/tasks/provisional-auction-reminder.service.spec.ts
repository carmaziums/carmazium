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
            auction: { findMany: jest.fn().mockResolvedValue([]) },
            bid: { findUnique: jest.fn().mockResolvedValue({ amount: 6165 }) },
            user: { findUnique: jest.fn().mockResolvedValue({ email: 'seller@example.com', firstName: 'Seller' }) },
        };
        notifications = {
            create: jest.fn().mockResolvedValue({ id: 'notice-1' }),
            shouldSendEmail: jest.fn().mockResolvedValue(true),
        };
        email = { sendAuctionProvisionalOfferEmail: jest.fn().mockResolvedValue(undefined) };
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
    });

    it('uses 72h reminder for aged offers and never sends twice after a duplicate claim', async () => {
        prisma.auction.findMany.mockResolvedValue([auction(4)]);
        notifications.create.mockRejectedValueOnce({ code: 'P2002' });
        await service.remindSellers(clock);
        expect(email.sendAuctionProvisionalOfferEmail).not.toHaveBeenCalled();
        notifications.create.mockResolvedValue({ id: 'notice-1' });
        await service.remindSellers(clock);
        expect(notifications.create).toHaveBeenLastCalledWith(expect.objectContaining({
            actionType: expect.stringMatching(/^PROVISIONAL_REMINDER_72H_/),
        }));
        expect(email.sendAuctionProvisionalOfferEmail).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no pending auctions exist', async () => {
        await service.remindSellers(clock);
        expect(notifications.create).not.toHaveBeenCalled();
    });
});
