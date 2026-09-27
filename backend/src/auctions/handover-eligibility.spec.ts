import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuctionsService } from './auctions.service';

function makeAuction(overrides: Record<string, any> = {}) {
    return {
        id: 'auction-1',
        listingId: 'listing-1',
        status: 'ENDED',
        deletedAt: null,
        winnerId: 'buyer-1',
        buyerFeePaid: true,
        buyerFeeTransactionId: 'txn-125',
        buyerRefusedAt: null,
        handoverProofPath: 'auction-1/proof.jpg',
        handoverProofUrl: null,
        handoverSubmittedAt: new Date('2026-09-27T12:00:00.000Z'),
        sellerBonusReleased: false,
        sellerBonusReleasedAt: null,
        stripePayoutTransferId: null,
        manualPayoutConfirmedAt: null,
        listing: {
            id: 'listing-1',
            sellerId: 'seller-1',
            title: 'BMW M3',
            deletedAt: null,
            seller: { id: 'seller-1', deletedAt: null },
        },
        winner: { id: 'buyer-1', deletedAt: null },
        ...overrides,
    };
}

function makeFee(overrides: Record<string, any> = {}) {
    return {
        id: 'txn-125',
        listingId: 'listing-1',
        userId: 'buyer-1',
        amount: 125,
        type: 'COMMISSION',
        status: 'COMPLETED',
        deletedAt: null,
        ...overrides,
    };
}

function makeHarness() {
    const prisma: any = {
        auction: {
            findUnique: jest.fn().mockResolvedValue(makeAuction()),
            update: jest.fn().mockResolvedValue(makeAuction()),
        },
        transaction: {
            findUnique: jest.fn().mockResolvedValue(makeFee()),
        },
        saleCancellationRequest: {
            findFirst: jest.fn().mockResolvedValue(null),
        },
        dealerProfile: {
            findUnique: jest.fn().mockResolvedValue(null),
        },
        dealerStaff: {
            findFirst: jest.fn().mockResolvedValue(null),
        },
    };

    const notificationsService = {
        create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    };

    const service = new AuctionsService(
        prisma,
        notificationsService as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
    );

    return { service, prisma, notificationsService };
}

describe('AuctionsService handover and seller-bonus eligibility', () => {
    it('accepts a valid ended auction with a real winner and exact completed £125 buyer fee', async () => {
        const { service } = makeHarness();

        await expect(service.assertHandoverBusinessRules('auction-1', {
            expectedSellerId: 'seller-1',
            requireProof: true,
            requireUnapproved: true,
        })).resolves.toEqual(expect.objectContaining({ id: 'auction-1' }));
    });

    it.each([
        ['buyer fee flag is false', { buyerFeePaid: false }, makeFee()],
        ['buyer fee transaction is missing', { buyerFeeTransactionId: null }, null],
        ['fee belongs to another winner', {}, makeFee({ userId: 'buyer-2' })],
        ['fee belongs to another listing', {}, makeFee({ listingId: 'listing-2' })],
        ['fee is not completed', {}, makeFee({ status: 'PENDING' })],
        ['fee is not the auction commission', {}, makeFee({ type: 'LISTING_FEE' })],
        ['fee amount is not £125', {}, makeFee({ amount: 100 })],
        ['fee record was deleted', {}, makeFee({ deletedAt: new Date() })],
    ])('rejects invalid £125 fee state: %s', async (_label, auctionOverrides, fee) => {
        const { service, prisma } = makeHarness();
        prisma.auction.findUnique.mockResolvedValue(makeAuction(auctionOverrides));
        prisma.transaction.findUnique.mockResolvedValue(fee);

        await expect(service.assertHandoverBusinessRules('auction-1', {
            requireProof: true,
        })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a missing/deleted winner and prevents seller self-winning', async () => {
        const { service, prisma } = makeHarness();

        prisma.auction.findUnique.mockResolvedValueOnce(makeAuction({ winner: null }));
        await expect(service.assertHandoverBusinessRules('auction-1'))
            .rejects.toThrow(/valid winner/i);

        prisma.auction.findUnique.mockResolvedValueOnce(makeAuction({
            winnerId: 'seller-1',
            winner: { id: 'seller-1', deletedAt: null },
        }));
        prisma.transaction.findUnique.mockResolvedValueOnce(makeFee({ userId: 'seller-1' }));
        await expect(service.assertHandoverBusinessRules('auction-1'))
            .rejects.toThrow(/cannot be the same account/i);
    });

    it('rejects the wrong seller identity', async () => {
        const { service } = makeHarness();

        await expect(service.assertHandoverBusinessRules('auction-1', {
            expectedSellerId: 'someone-else',
        })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects buyer-refused and active/approved cancellation states', async () => {
        const { service, prisma } = makeHarness();

        prisma.auction.findUnique.mockResolvedValueOnce(makeAuction({
            buyerRefusedAt: new Date(),
        }));
        await expect(service.assertHandoverBusinessRules('auction-1'))
            .rejects.toThrow(/refused after inspection/i);

        prisma.auction.findUnique.mockResolvedValueOnce(makeAuction());
        prisma.saleCancellationRequest.findFirst.mockResolvedValueOnce({
            id: 'cancel-1',
            status: 'PENDING_ADMIN',
        });
        await expect(service.assertHandoverBusinessRules('auction-1'))
            .rejects.toThrow(/cancellation request in progress/i);

        prisma.auction.findUnique.mockResolvedValueOnce(makeAuction());
        prisma.saleCancellationRequest.findFirst.mockResolvedValueOnce({
            id: 'cancel-2',
            status: 'APPROVED',
        });
        await expect(service.assertHandoverBusinessRules('auction-1'))
            .rejects.toThrow(/has been cancelled/i);
    });

    it('requires a structurally valid submitted proof before approval or payout', async () => {
        const { service, prisma } = makeHarness();

        prisma.auction.findUnique.mockResolvedValueOnce(makeAuction({
            handoverProofPath: 'another-auction/proof.jpg',
            handoverProofUrl: null,
        }));
        await expect(service.assertHandoverBusinessRules('auction-1', {
            requireProof: true,
        })).rejects.toThrow(/valid handover proof/i);

        prisma.auction.findUnique.mockResolvedValueOnce(makeAuction({
            handoverSubmittedAt: null,
        }));
        await expect(service.assertHandoverBusinessRules('auction-1', {
            requireProof: true,
        })).rejects.toThrow(/valid handover proof/i);
    });

    it('blocks re-entry after approval/payout and requires a complete approval for payout paths', async () => {
        const { service, prisma } = makeHarness();

        prisma.auction.findUnique.mockResolvedValueOnce(makeAuction({
            sellerBonusReleased: true,
            sellerBonusReleasedAt: new Date(),
        }));
        await expect(service.assertHandoverBusinessRules('auction-1', {
            requireUnapproved: true,
        })).rejects.toThrow(/already been completed or entered payout/i);

        prisma.auction.findUnique.mockResolvedValueOnce(makeAuction({
            sellerBonusReleased: true,
            sellerBonusReleasedAt: null,
        }));
        await expect(service.assertHandoverBusinessRules('auction-1', {
            requireProof: true,
            requireApproved: true,
        })).rejects.toThrow(/not been validly approved/i);
    });

    it('revalidates submission and writes proof only after the complete fee/winner/seller gate passes', async () => {
        const { service, prisma, notificationsService } = makeHarness();
        const preSubmission = makeAuction({
            handoverProofPath: null,
            handoverProofUrl: null,
            handoverSubmittedAt: null,
        });
        prisma.auction.findUnique.mockResolvedValue(preSubmission);
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue(null);
        prisma.auction.update.mockResolvedValue({
            ...preSubmission,
            handoverProofPath: 'auction-1/new-proof.jpg',
            handoverSubmittedAt: new Date(),
        });

        await expect(service.submitHandoverProof(
            'auction-1',
            'seller-1',
            { proofPath: 'auction-1/new-proof.jpg' },
        )).resolves.toEqual(expect.objectContaining({
            handoverProofPath: 'auction-1/new-proof.jpg',
        }));

        expect(prisma.auction.update).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                id: 'auction-1',
                status: 'ENDED',
                winnerId: 'buyer-1',
                buyerFeePaid: true,
                buyerFeeTransactionId: 'txn-125',
                buyerRefusedAt: null,
                sellerBonusReleased: false,
                handoverSubmittedAt: null,
            }),
        }));
        expect(notificationsService.create).toHaveBeenCalledTimes(1);
    });
});
