import { NotFoundException } from '@nestjs/common';
import { AuctionsService } from './auctions.service';

describe('winner detail authorization and contact gating', () => {
    function setup(paid: boolean) {
        const row = { id: 'old-win', winnerId: 'business', buyerFeePaid: paid, handoverProofPath: 'private/proof', listing: { seller: { email: 'seller@example.invalid', phone: '07700900000', dealerProfile: { businessAddress: 'Private address' } } } };
        const prisma: any = { auction: { findMany: jest.fn(async ({where}) => where.winnerId === row.winnerId && where.id === row.id ? [{ ...row, listing: { ...row.listing } }] : []), count: jest.fn().mockResolvedValue(1) } };
        const service = Object.create(AuctionsService.prototype) as AuctionsService;
        (service as any).prisma = prisma;
        (service as any).resolveBuyerBusinessId = jest.fn().mockResolvedValue('business');
        return { service, prisma };
    }
    it('uses the buyer business and exact auction ID, independent of history position', async () => {
        const { service, prisma } = setup(true);
        const result = await service.findWonAuction('staff', 'old-win');
        expect((service as any).resolveBuyerBusinessId).toHaveBeenCalledWith('staff', 'VIEW_PURCHASES');
        expect(prisma.auction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'old-win', winnerId: 'business', deletedAt: null }, take: 1, skip: 0 }));
        expect(result.listing.seller.email).toBe('seller@example.invalid');
        expect(result).not.toHaveProperty('handoverProofPath');
    });
    it('withholds all seller contact details until the fee is paid', async () => {
        const { service } = setup(false);
        const result = await service.findWonAuction('staff', 'old-win');
        expect(result.listing.seller.email).toBeNull();
        expect(result.listing.seller.phone).toBeNull();
        expect(result.listing.seller.dealerProfile.businessAddress).toBeNull();
    });
    it('does not disclose another buyer’s win or a missing record', async () => {
        const { service } = setup(true);
        await expect(service.findWonAuction('staff', 'missing')).rejects.toBeInstanceOf(NotFoundException);
        (service as any).resolveBuyerBusinessId.mockResolvedValue('other-business');
        await expect(service.findWonAuction('other-staff', 'old-win')).rejects.toBeInstanceOf(NotFoundException);
    });
});
