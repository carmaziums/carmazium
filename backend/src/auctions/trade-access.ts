import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Single server-side rule for viewing Trade Exchange auction data. */
export async function assertTradeAuctionAccess(
    prisma: PrismaService,
    viewerId: string | undefined | null,
    sellerId?: string | null,
): Promise<void> {
    if (!viewerId) {
        throw new ForbiddenException('Please sign in to access the Trade Exchange.');
    }

    // Private/retail sellers must always be able to see their own auction.
    if (sellerId && viewerId === sellerId) return;

    const viewer = await prisma.user.findUnique({
        where: { id: viewerId },
        select: {
            role: true,
            dealerProfile: { select: { isVerified: true } },
        },
    });

    if (viewer?.role === UserRole.ADMIN) return;
    if (viewer?.role === UserRole.DEALER && viewer.dealerProfile?.isVerified) return;

    if (viewer?.role === UserRole.DEALER) {
        throw new ForbiddenException(
            'Your dealer account is awaiting verification. Complete your KYC to access the Trade Exchange.',
        );
    }

    throw new ForbiddenException(
        'The Trade Exchange is restricted to verified dealer accounts.',
    );
}
