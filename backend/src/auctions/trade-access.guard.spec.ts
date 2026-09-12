import { ForbiddenException } from '@nestjs/common';
import { TradeAuctionAccessGuard, TradeListingAccessGuard } from './trade-access.guard';

function httpContext(request: any): any {
    return { switchToHttp: () => ({ getRequest: () => request }) };
}

describe('Trade Exchange access guards', () => {
    let prisma: any;

    beforeEach(() => {
        prisma = {
            auction: { findUnique: jest.fn() },
            listing: { findFirst: jest.fn() },
            user: { findUnique: jest.fn() },
        };
    });

    describe('TradeAuctionAccessGuard', () => {
        it('rejects a guest from a real auction', async () => {
            prisma.auction.findUnique.mockResolvedValue({ deletedAt: null, listing: { sellerId: 'seller-1' } });
            const guard = new TradeAuctionAccessGuard(prisma);
            await expect(guard.canActivate(httpContext({ params: { id: 'auction-1' }, user: undefined })))
                .rejects.toBeInstanceOf(ForbiddenException);
        });

        it('allows the seller of their own auction', async () => {
            prisma.auction.findUnique.mockResolvedValue({ deletedAt: null, listing: { sellerId: 'seller-1' } });
            const guard = new TradeAuctionAccessGuard(prisma);
            await expect(guard.canActivate(httpContext({ params: { id: 'auction-1' }, user: { id: 'seller-1' } })))
                .resolves.toBe(true);
            expect(prisma.user.findUnique).not.toHaveBeenCalled();
        });

        it('allows admin and KYC-verified dealers but rejects an unverified dealer', async () => {
            prisma.auction.findUnique.mockResolvedValue({ deletedAt: null, listing: { sellerId: 'seller-1' } });
            const guard = new TradeAuctionAccessGuard(prisma);

            prisma.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN', dealerProfile: null });
            await expect(guard.canActivate(httpContext({ params: { id: 'auction-1' }, user: { id: 'admin-1' } })))
                .resolves.toBe(true);

            prisma.user.findUnique.mockResolvedValueOnce({ role: 'DEALER', dealerProfile: { isVerified: true } });
            await expect(guard.canActivate(httpContext({ params: { id: 'auction-1' }, user: { id: 'dealer-ok' } })))
                .resolves.toBe(true);

            prisma.user.findUnique.mockResolvedValueOnce({ role: 'DEALER', dealerProfile: { isVerified: false } });
            await expect(guard.canActivate(httpContext({ params: { id: 'auction-1' }, user: { id: 'dealer-pending' } })))
                .rejects.toMatchObject({ message: expect.stringMatching(/verification|KYC/i) });
        });
    });

    describe('TradeListingAccessGuard', () => {
        it('leaves CLASSIFIED listings public', async () => {
            prisma.listing.findFirst.mockResolvedValue({ type: 'CLASSIFIED', sellerId: 'seller-1' });
            const guard = new TradeListingAccessGuard(prisma);
            await expect(guard.canActivate(httpContext({ params: { slug: 'retail-car' }, user: undefined })))
                .resolves.toBe(true);
        });

        it('rejects a retail user from direct AUCTION listing detail', async () => {
            prisma.listing.findFirst.mockResolvedValue({ type: 'AUCTION', sellerId: 'seller-1' });
            prisma.user.findUnique.mockResolvedValue({ role: 'BUYER', dealerProfile: null });
            const guard = new TradeListingAccessGuard(prisma);
            await expect(guard.canActivate(httpContext({ params: { slug: 'trade-car' }, user: { id: 'buyer-1' } })))
                .rejects.toBeInstanceOf(ForbiddenException);
        });
    });
});
