import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SellersController } from './sellers.controller';

describe('SellersController legacy review verification', () => {
    const build = () => {
        const sellersService = {
            submitReview: jest.fn(),
        };
        const prisma = {
            sellerProfile: { findUnique: jest.fn() },
            sale: { findFirst: jest.fn() },
            auction: { findFirst: jest.fn() },
        };
        return {
            sellersService,
            prisma,
            controller: new SellersController(sellersService as any, prisma as any),
        };
    };

    it('rejects the legacy route when no listing is supplied', async () => {
        const { controller, prisma, sellersService } = build();
        prisma.sellerProfile.findUnique.mockResolvedValue({ userId: 'seller-user' });

        await expect(controller.submitReview(
            { sellerId: 'seller-profile', rating: 5 } as any,
            { id: 'buyer-user' },
        )).rejects.toBeInstanceOf(BadRequestException);

        expect(sellersService.submitReview).not.toHaveBeenCalled();
    });

    it('rejects a seller review when the exact listing has no completed CarMazium transaction', async () => {
        const { controller, prisma, sellersService } = build();
        prisma.sellerProfile.findUnique.mockResolvedValue({ userId: 'seller-user' });
        prisma.sale.findFirst.mockResolvedValue(null);
        prisma.auction.findFirst.mockResolvedValue(null);

        await expect(controller.submitReview(
            { sellerId: 'seller-profile', listingId: 'listing-1', rating: 5 } as any,
            { id: 'buyer-user' },
        )).rejects.toBeInstanceOf(ForbiddenException);

        expect(sellersService.submitReview).not.toHaveBeenCalled();
    });

    it('keeps the legacy endpoint compatible for a verified completed sale', async () => {
        const { controller, prisma, sellersService } = build();
        const dto = { sellerId: 'seller-profile', listingId: 'listing-1', rating: 5, comment: 'Great seller' };
        prisma.sellerProfile.findUnique.mockResolvedValue({ userId: 'seller-user' });
        prisma.sale.findFirst.mockResolvedValue({ id: 'sale-1' });
        prisma.auction.findFirst.mockResolvedValue(null);
        sellersService.submitReview.mockResolvedValue({ id: 'review-1' });

        const result = await controller.submitReview(dto as any, { id: 'buyer-user' });

        expect(prisma.sale.findFirst).toHaveBeenCalledWith({
            where: {
                listingId: 'listing-1',
                sellerId: 'seller-user',
                buyerId: 'buyer-user',
            },
            select: { id: true },
        });
        expect(sellersService.submitReview).toHaveBeenCalledWith('buyer-user', dto);
        expect((result as any).data).toEqual({ id: 'review-1' });
    });
});
