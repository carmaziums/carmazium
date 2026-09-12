import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertTradeAuctionAccess } from './trade-access';

@Injectable()
export class TradeAuctionAccessGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const auctionId = request.params?.id;
        if (!auctionId) return true;

        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            select: {
                deletedAt: true,
                listing: { select: { sellerId: true } },
            },
        });

        // Let the controller/service produce the canonical 404 for missing rows.
        if (!auction || auction.deletedAt) return true;

        await assertTradeAuctionAccess(this.prisma, request.user?.id, auction.listing?.sellerId);
        return true;
    }
}

@Injectable()
export class TradeListingAccessGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const value = request.params?.listingId ?? request.params?.slug;
        if (!value) return true;

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
        const listing = await this.prisma.listing.findFirst({
            where: {
                ...(isUuid ? { id: value } : { slug: value }),
                deletedAt: null,
            },
            select: { type: true, sellerId: true },
        });

        // Retail/classified listings stay public. Only AUCTION stock is gated.
        if (!listing || listing.type !== 'AUCTION') return true;

        await assertTradeAuctionAccess(this.prisma, request.user?.id, listing.sellerId);
        return true;
    }
}
