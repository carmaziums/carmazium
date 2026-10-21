import { ProvisionalAuctionExpiryService } from './provisional-auction-expiry.service';

describe('ProvisionalAuctionExpiryService', () => {
    const now = new Date('2026-10-21T18:00:00.000Z');
    const offeredAt = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    let db: any;
    let notices: any;
    let email: any;
    let service: ProvisionalAuctionExpiryService;
    beforeEach(() => {
        db = {
            auction: {
                findMany: jest.fn().mockResolvedValue([]),
                findUnique: jest.fn().mockResolvedValue({
                    id: 'auction-1', listingId: 'listing-1', status: 'ENDED',
                    deletedAt: null, winnerId: null, wonAt: null,
                    provisionalOfferBidId: 'bid-1', provisionalOfferedAt: offeredAt,
                    listing: { sellerId: 'seller-1' },
                }),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            bid: { findUnique: jest.fn().mockResolvedValue({
                bidderId: 'buyer-1', amount: 6165,
            }) },
            notification: {
                updateMany: jest.fn().mockResolvedValue({ count: 2 }),
                findFirst: jest.fn().mockResolvedValue(null),
                findMany: jest.fn().mockResolvedValue([]),
            },
            $queryRaw: jest.fn().mockResolvedValue([]),
            $transaction: jest.fn(async (fn: any) => fn(db)),
        };
        notices = { create: jest.fn().mockResolvedValue({ id: 'notice-1' }) };
        email = { sendAuctionProvisionalExpiredEmail: jest.fn().mockResolvedValue({ id: 'provider-1' }) };
        service = new ProvisionalAuctionExpiryService(db, notices, email);
    });

    it('expires offer precisely at 72 hours, retires seller actions and notifies both parties', async () => {
        db.auction.findMany
            .mockResolvedValueOnce([{ id: 'auction-1', listingId: 'listing-1' }])
            .mockResolvedValueOnce([{
                id: 'auction-1', listingId: 'listing-1',
                provisionalExpiredBidId: 'bid-1', provisionalExpiredAt: now,
                provisionalExpiryDeadlineAt: now,
                provisionalExpiryNotifiedAt: null,
                listing: { title: 'Ford Kuga', sellerId: 'seller-1' },
            }]);
        await service.expireOffers(now);
        expect(db.$queryRaw).toHaveBeenCalledTimes(2);
        expect(db.auction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ provisionalOfferBidId: 'bid-1', status: 'ENDED', winnerId: null }),
            data: expect.objectContaining({
                provisionalOfferBidId: null, provisionalOfferedAt: null,
                provisionalExpiredBidId: 'bid-1', provisionalExpiredAt: now,
            }),
        }));
        expect(db.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ userId: 'seller-1', entityId: 'auction-1' }),
            data: { isRead: true },
        }));
        expect(notices.create).toHaveBeenCalledTimes(2);
        expect(notices.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'buyer-1', type: 'AUCTION_PROVISIONAL_EXPIRED',
        }));
        expect(notices.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'seller-1', type: 'AUCTION_PROVISIONAL_EXPIRED',
        }));
    });

    it('never expires a bid already accepted by a concurrently executing seller', async () => {
        db.auction.findMany.mockResolvedValueOnce([{ id: 'auction-1', listingId: 'listing-1' }])
            .mockResolvedValueOnce([]);
        db.auction.findUnique.mockResolvedValue({
            id: 'auction-1', status: 'ENDED', winnerId: 'buyer-1',
            wonAt: now, provisionalOfferBidId: null, provisionalOfferedAt: null,
        });
        await service.expireOffers(now);
        expect(db.auction.updateMany).not.toHaveBeenCalled();
        expect(notices.create).not.toHaveBeenCalled();
    });

    it('does not expire an offer before its 72-hour deadline', async () => {
        db.auction.findMany.mockResolvedValueOnce([{ id: 'auction-1', listingId: 'listing-1' }])
            .mockResolvedValueOnce([]);
        db.auction.findUnique.mockResolvedValue({
            id: 'auction-1', listingId: 'listing-1', status: 'ENDED',
            deletedAt: null, winnerId: null, wonAt: null,
            provisionalOfferBidId: 'bid-1',
            provisionalOfferedAt: new Date(offeredAt.getTime() + 1),
        });
        await service.expireOffers(now);
        expect(db.auction.updateMany).not.toHaveBeenCalled();
    });

    it('does not duplicate persisted seller or buyer expiry notices', async () => {
        db.auction.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{
            id: 'auction-1', listingId: 'listing-1',
            provisionalExpiredBidId: 'bid-1', provisionalExpiredAt: now,
            listing: { title: 'Ford Kuga', sellerId: 'seller-1' },
        }]);
        db.notification.findFirst.mockResolvedValue({ id: 'existing' });
        await service.expireOffers(now);
        expect(notices.create).not.toHaveBeenCalled();
    });
});
