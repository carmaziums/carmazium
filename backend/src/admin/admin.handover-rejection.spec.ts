import { AdminService } from './admin.service';

describe('AdminService handover evidence rejection', () => {
    const submitted = () => ({
        id: 'auction-1',
        listingId: 'listing-1',
        deletedAt: null,
        status: 'ENDED',
        winnerId: 'winner-1',
        buyerFeePaid: true,
        buyerFeeTransactionId: 'fee-125',
        sellerBonusReleased: false,
        sellerBonusReleasedAt: null,
        stripePayoutTransferId: null,
        manualPayoutConfirmedAt: null,
        buyerRefusedAt: null,
        handoverProofPath: 'auction-1/proof-1.jpg',
        handoverProofUrl: null,
        handoverSubmittedAt: new Date('2026-10-01T12:00:00Z'),
        handoverRejectedAt: null,
        handoverRejectionReason: null,
        listing: { sellerId: 'seller-1', title: 'Test car' },
    });

    const setup = (initial: any = submitted()) => {
        const prisma: any = {
            auction: {
                findUnique: jest.fn().mockResolvedValue(initial),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            user: {
                findUnique: jest.fn().mockResolvedValue({ email: 'seller@example.com', firstName: 'Jane' }),
            },
        };
        const payments: any = { issueRefundForAuction: jest.fn(), issueFullRefundForAuctionInspection: jest.fn() };
        const email: any = { sendHandoverDeniedEmail: jest.fn().mockResolvedValue(undefined) };
        const notifications: any = { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) };
        const handoverDocuments: any = { deleteProof: jest.fn().mockResolvedValue(undefined) };
        const auctions: any = { assertHandoverBusinessRules: jest.fn().mockResolvedValue(initial) };
        const service = new AdminService(
            prisma, payments, email, {} as any, notifications,
            {} as any, auctions, handoverDocuments,
        );
        return { service, prisma, payments, email, notifications, handoverDocuments, auctions };
    };

    it('rejects evidence with a specific reason, preserves the fee and sale, and prompts the seller to resubmit', async () => {
        const ctx = setup();
        await ctx.service.denyHandover('auction-1', 'The signatures are not visible.');
        expect(ctx.prisma.auction.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                id: 'auction-1',
                status: 'ENDED',
                buyerRefusedAt: null,
                handoverSubmittedAt: submitted().handoverSubmittedAt,
                handoverProofPath: 'auction-1/proof-1.jpg',
                handoverProofUrl: null,
                sellerBonusReleased: false,
                stripePayoutTransferId: null,
            }),
            data: {
                handoverProofUrl: null,
                handoverProofPath: null,
                handoverSubmittedAt: null,
                handoverRejectedAt: expect.any(Date),
                handoverRejectionReason: 'The signatures are not visible.',
            },
        });
        expect(ctx.payments.issueRefundForAuction).not.toHaveBeenCalled();
        expect(ctx.payments.issueFullRefundForAuctionInspection).not.toHaveBeenCalled();
        expect(ctx.handoverDocuments.deleteProof).toHaveBeenCalledWith('auction-1/proof-1.jpg', null);
        expect(ctx.notifications.create).toHaveBeenCalledWith(expect.objectContaining({
            type: 'HANDOVER_DENIED',
            userId: 'seller-1',
            message: expect.stringContaining('The signatures are not visible.'),
        }));
        expect(ctx.email.sendHandoverDeniedEmail).toHaveBeenCalledWith(
            'seller@example.com', 'Jane', 'Test car', 'The signatures are not visible.',
        );
        const updateData = ctx.prisma.auction.updateMany.mock.calls[0][0].data;
        expect(updateData).not.toHaveProperty('buyerFeePaid');
        expect(updateData).not.toHaveProperty('buyerFeeTransactionId');
        expect(updateData).not.toHaveProperty('status');
        expect(updateData).not.toHaveProperty('buyerRefusedAt');
    });

    it('handles repeated rejection requests without sending another email or refund', async () => {
        const ctx = setup({
            ...submitted(),
            handoverProofPath: null,
            handoverSubmittedAt: null,
            handoverRejectedAt: new Date(),
        });
        await ctx.service.denyHandover('auction-1', 'Already rejected proof');
        expect(ctx.prisma.auction.updateMany).not.toHaveBeenCalled();
        expect(ctx.handoverDocuments.deleteProof).not.toHaveBeenCalled();
        expect(ctx.email.sendHandoverDeniedEmail).not.toHaveBeenCalled();
        expect(ctx.payments.issueRefundForAuction).not.toHaveBeenCalled();
    });

    it('refuses to reject a handover already approved or in payout', async () => {
        const ctx = setup({ ...submitted(), sellerBonusReleased: true });
        await expect(ctx.service.denyHandover('auction-1', 'Proof is unclear and unusable'))
            .rejects.toThrow(/approved or entered payout/);
        expect(ctx.prisma.auction.updateMany).not.toHaveBeenCalled();
    });

    it('does not delete proof or notify when a concurrent approval wins the atomic claim', async () => {
        const ctx = setup();
        ctx.prisma.auction.updateMany.mockResolvedValue({ count: 0 });
        await expect(ctx.service.denyHandover('auction-1', 'Proof is unclear and unusable'))
            .rejects.toThrow(/state changed during review/);
        expect(ctx.handoverDocuments.deleteProof).not.toHaveBeenCalled();
        expect(ctx.notifications.create).not.toHaveBeenCalled();
        expect(ctx.payments.issueRefundForAuction).not.toHaveBeenCalled();
    });

    it('will not approve a different proof uploaded after this admin viewed the original', async () => {
        const ctx = setup();
        ctx.prisma.auction.updateMany.mockResolvedValue({ count: 0 });
        await expect(ctx.service.approveHandover('auction-1'))
            .rejects.toThrow(/eligibility changed/i);
        expect(ctx.prisma.auction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                handoverSubmittedAt: submitted().handoverSubmittedAt,
                handoverProofPath: 'auction-1/proof-1.jpg',
                handoverProofUrl: null,
            }),
        }));
        expect(ctx.payments.issueRefundForAuction).not.toHaveBeenCalled();
        expect(ctx.email.sendHandoverDeniedEmail).not.toHaveBeenCalled();
    });

    it('rejects missing or vague reasons and records nothing', async () => {
        const ctx = setup();
        await expect(ctx.service.denyHandover('auction-1', 'blur'))
            .rejects.toThrow(/10–500/);
        await expect(ctx.service.denyHandover('auction-1', ' '.repeat(15)))
            .rejects.toThrow(/10–500/);
        expect(ctx.prisma.auction.findUnique).not.toHaveBeenCalled();
        expect(ctx.prisma.auction.updateMany).not.toHaveBeenCalled();
    });

    it('rejects both legacy public URL proofs and secure private proof keys without refunding', async () => {
        const ctx = setup({
            ...submitted(),
            handoverProofPath: null,
            handoverProofUrl: 'https://storage.example/storage/v1/object/public/listings/handover/proof.jpg',
        });
        await ctx.service.denyHandover('auction-1', 'Please show the correct signed handover.');
        expect(ctx.handoverDocuments.deleteProof).toHaveBeenCalledWith(
            null, 'https://storage.example/storage/v1/object/public/listings/handover/proof.jpg',
        );
        expect(ctx.payments.issueRefundForAuction).not.toHaveBeenCalled();
    });
});
