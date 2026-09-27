import { BadGatewayException, BadRequestException, ConflictException } from '@nestjs/common';
import { AdminService } from './admin.service';

function makeAuction(overrides: Record<string, any> = {}) {
    return {
        id: 'auction-1',
        sellerBonusReleased: false,
        sellerBonusReleasedAt: null,
        stripePayoutTransferId: null,
        stripePayoutError: null,
        manualPayoutConfirmedAt: null,
        listing: {
            sellerId: 'seller-1',
            title: 'BMW M3',
        },
        ...overrides,
    };
}

function makeHarness() {
    const prisma: any = {
        auction: {
            findUnique: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            findMany: jest.fn(),
        },
        user: {
            findUnique: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
        },
    };

    const paymentsService = {
        isStripeInTestMode: jest.fn().mockReturnValue(false),
        issueSellerPayout: jest.fn(),
    };
    const emailService = {
        sendHandoverApprovedEmail: jest.fn().mockResolvedValue(undefined),
        sendStripePayoutSetupReminderEmail: jest.fn().mockResolvedValue(undefined),
    };
    const notificationsGateway = {
        sendNotification: jest.fn(),
    };
    const notificationsService = {
        create: jest.fn().mockResolvedValue(null),
    };

    const auctionsService = {
        assertHandoverBusinessRules: jest.fn().mockResolvedValue(undefined),
    };

    const service = new AdminService(
        prisma,
        paymentsService as any,
        emailService as any,
        notificationsGateway as any,
        notificationsService as any,
        {} as any,
        auctionsService as any,
        { deleteProof: jest.fn(), hydrateMany: jest.fn(async (rows: any) => rows) } as any,
    );

    return {
        service,
        prisma,
        paymentsService,
        emailService,
        notificationsGateway,
        notificationsService,
        auctionsService,
    };
}

describe('AdminService — seller bonus payout idempotency', () => {
    it('blocks approval before changing payout state when the handover business-rule gate fails', async () => {
        const { service, prisma, paymentsService, auctionsService } = makeHarness();
        auctionsService.assertHandoverBusinessRules.mockRejectedValueOnce(
            new BadRequestException('The £125 auction buyer fee must be paid before handover'),
        );

        await expect(service.approveHandover('auction-1'))
            .rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.auction.updateMany).not.toHaveBeenCalled();
        expect(paymentsService.issueSellerPayout).not.toHaveBeenCalled();
    });

    it('atomically approves once and uses one stable Stripe idempotency key', async () => {
        const {
            service,
            prisma,
            paymentsService,
            notificationsGateway,
        } = makeHarness();

        const before = makeAuction();
        const after = makeAuction({
            sellerBonusReleased: true,
            sellerBonusReleasedAt: new Date(),
            stripePayoutTransferId: 'tr_bonus_1',
        });

        prisma.auction.findUnique
            .mockResolvedValueOnce(before)
            .mockResolvedValueOnce(after);
        prisma.user.findUnique.mockResolvedValue({
            email: 'seller@example.com',
            firstName: 'Sam',
            stripeConnectAccountId: 'acct_seller',
            stripeConnectOnboardingComplete: true,
        });
        prisma.auction.updateMany.mockImplementation(({ data }: any) => {
            if (data.sellerBonusReleased === true) return Promise.resolve({ count: 1 });
            if (data.stripePayoutTransferId === 'claim:seller-bonus:auction-1') {
                return Promise.resolve({ count: 1 });
            }
            if (data.stripePayoutTransferId === 'tr_bonus_1') {
                return Promise.resolve({ count: 1 });
            }
            return Promise.resolve({ count: 0 });
        });
        paymentsService.issueSellerPayout.mockResolvedValue('tr_bonus_1');

        await expect(service.approveHandover('auction-1')).resolves.toBe(after);

        expect(paymentsService.issueSellerPayout).toHaveBeenCalledTimes(1);
        expect(paymentsService.issueSellerPayout).toHaveBeenCalledWith(
            'acct_seller',
            10000,
            'auction-seller-bonus-auction-1',
        );
        expect(notificationsGateway.sendNotification).toHaveBeenCalledTimes(1);
    });

    it('does not enter payout when another approval request already won the atomic approval claim', async () => {
        const { service, prisma, paymentsService, notificationsGateway } = makeHarness();

        const before = makeAuction();
        const current = makeAuction({
            sellerBonusReleased: true,
            sellerBonusReleasedAt: new Date(),
        });

        prisma.auction.findUnique
            .mockResolvedValueOnce(before)
            .mockResolvedValueOnce(current);
        prisma.auction.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.approveHandover('auction-1')).resolves.toBe(current);

        expect(paymentsService.issueSellerPayout).not.toHaveBeenCalled();
        expect(notificationsGateway.sendNotification).not.toHaveBeenCalled();
    });

    it('resumes a retained payout claim with the same Stripe idempotency key', async () => {
        const { service, prisma, paymentsService } = makeHarness();
        const claim = 'claim:seller-bonus:auction-1';
        const before = makeAuction({
            sellerBonusReleased: true,
            stripePayoutTransferId: claim,
        });
        const after = makeAuction({
            sellerBonusReleased: true,
            stripePayoutTransferId: 'tr_bonus_1',
        });

        prisma.auction.findUnique
            .mockResolvedValueOnce(before)
            .mockResolvedValueOnce(after);
        prisma.user.findUnique.mockResolvedValue({
            stripeConnectAccountId: 'acct_seller',
            stripeConnectOnboardingComplete: true,
        });
        prisma.auction.updateMany.mockImplementation(({ data }: any) => {
            if (data.stripePayoutTransferId === claim) return Promise.resolve({ count: 1 });
            if (data.stripePayoutTransferId === 'tr_bonus_1') return Promise.resolve({ count: 1 });
            return Promise.resolve({ count: 0 });
        });
        paymentsService.issueSellerPayout.mockResolvedValue('tr_bonus_1');

        await expect(service.retryPayout('auction-1')).resolves.toBe(after);

        expect(paymentsService.issueSellerPayout).toHaveBeenCalledWith(
            'acct_seller',
            10000,
            'auction-seller-bonus-auction-1',
        );
    });

    it('releases the payout claim when Stripe rejects the transfer so retry remains possible', async () => {
        const { service, prisma, paymentsService } = makeHarness();

        const before = makeAuction({
            sellerBonusReleased: true,
            stripePayoutTransferId: null,
        });

        prisma.auction.findUnique.mockResolvedValueOnce(before);
        prisma.user.findUnique.mockResolvedValue({
            stripeConnectAccountId: 'acct_seller',
            stripeConnectOnboardingComplete: true,
        });
        prisma.auction.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        paymentsService.issueSellerPayout.mockRejectedValue(new Error('Stripe unavailable'));

        await expect(service.retryPayout('auction-1'))
            .rejects.toBeInstanceOf(BadGatewayException);

        expect(prisma.auction.updateMany).toHaveBeenLastCalledWith({
            where: {
                id: 'auction-1',
                stripePayoutTransferId: 'claim:seller-bonus:auction-1',
                manualPayoutConfirmedAt: null,
            },
            data: { stripePayoutTransferId: null },
        });
        expect(prisma.auction.update).toHaveBeenCalledWith({
            where: { id: 'auction-1' },
            data: {
                stripePayoutError: 'Stripe payout could not be completed. The seller bonus remains unpaid. Verify the seller\'s Stripe payout setup and try again.',
            },
        });
    });

    it('does not retry Stripe when onboarding is marked complete but the Connect account id is missing', async () => {
        const { service, prisma, paymentsService } = makeHarness();
        const before = makeAuction({ sellerBonusReleased: true });

        prisma.auction.findUnique.mockResolvedValueOnce(before);
        prisma.user.findUnique.mockResolvedValue({
            stripeConnectAccountId: null,
            stripeConnectOnboardingComplete: true,
        });

        await expect(service.retryPayout('auction-1'))
            .rejects.toBeInstanceOf(BadRequestException);

        expect(paymentsService.issueSellerPayout).not.toHaveBeenCalled();
    });

    it('allows a payout setup reminder when onboarding is stale-complete but no Connect account id exists', async () => {
        const { service, prisma, notificationsService, emailService } = makeHarness();
        const before = makeAuction({ sellerBonusReleased: true });

        prisma.auction.findUnique.mockResolvedValueOnce({
            ...before,
            listing: {
                ...before.listing,
                seller: {
                    id: 'seller-1',
                    email: 'seller@example.com',
                    firstName: 'Sam',
                    stripeConnectAccountId: null,
                    stripeConnectOnboardingComplete: true,
                },
            },
        });

        await expect(service.sendStripePayoutSetupReminder('auction-1')).resolves.toEqual(
            expect.objectContaining({ sent: true, emailSent: true }),
        );

        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'seller-1',
                link: '/dashboard/seller/settings#payouts',
            }),
        );
        expect(emailService.sendStripePayoutSetupReminderEmail).toHaveBeenCalled();
    });

    it('blocks manual payment while a Stripe payout claim is active or awaiting retry', async () => {
        const { service, prisma } = makeHarness();
        const claim = 'claim:seller-bonus:auction-1';
        const claimed = makeAuction({
            sellerBonusReleased: true,
            stripePayoutTransferId: claim,
        });

        prisma.auction.findUnique
            .mockResolvedValueOnce(claimed)
            .mockResolvedValueOnce(claimed);
        prisma.auction.updateMany.mockResolvedValue({ count: 0 });

        await expect(
            service.markPayoutPaidManually('auction-1'),
        ).rejects.toBeInstanceOf(ConflictException);
    });

    it('keeps only currently eligible unpaid bonuses in the pending-payout queue', async () => {
        const { service, prisma, auctionsService } = makeHarness();
        const valid = makeAuction({
            id: 'auction-valid',
            sellerBonusReleased: true,
            sellerBonusReleasedAt: new Date(),
        });
        const grandfatheredCancelled = makeAuction({
            id: 'auction-legacy-cancelled',
            sellerBonusReleased: true,
            sellerBonusReleasedAt: new Date(),
        });
        prisma.auction.findMany.mockResolvedValue([valid, grandfatheredCancelled]);
        auctionsService.assertHandoverBusinessRules.mockImplementation(
            async (auctionId: string) => {
                if (auctionId === 'auction-legacy-cancelled') {
                    throw new BadRequestException('Handover is only available for a valid ended auction');
                }
            },
        );

        await expect(service.getPendingPayouts()).resolves.toEqual([valid]);

        expect(prisma.auction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    deletedAt: null,
                    status: 'ENDED',
                    winnerId: { not: null },
                    buyerFeePaid: true,
                    buyerFeeTransactionId: { not: null },
                    buyerRefusedAt: null,
                    handoverSubmittedAt: { not: null },
                    sellerBonusReleased: true,
                    sellerBonusReleasedAt: { not: null },
                    manualPayoutConfirmedAt: null,
                    AND: [
                        {
                            OR: [
                                { handoverProofPath: { not: null } },
                                { handoverProofUrl: { not: null } },
                            ],
                        },
                        {
                            OR: [
                                { stripePayoutTransferId: null },
                                { stripePayoutTransferId: { startsWith: 'claim:seller-bonus:' } },
                            ],
                        },
                    ],
                }),
            }),
        );
        expect(auctionsService.assertHandoverBusinessRules).toHaveBeenCalledTimes(2);
        expect(auctionsService.assertHandoverBusinessRules).toHaveBeenCalledWith(
            'auction-valid',
            { requireProof: true, requireApproved: true },
        );
    });

    it('blocks payout-setup reminders when the approved legacy row is no longer payout-eligible', async () => {
        const {
            service,
            prisma,
            auctionsService,
            notificationsService,
            emailService,
        } = makeHarness();
        prisma.auction.findUnique.mockResolvedValueOnce(makeAuction({
            sellerBonusReleased: true,
            listing: {
                sellerId: 'seller-1',
                title: 'BMW M3',
                seller: {
                    id: 'seller-1',
                    email: 'seller@example.com',
                    firstName: 'Sam',
                    stripeConnectAccountId: null,
                    stripeConnectOnboardingComplete: false,
                },
            },
        }));
        auctionsService.assertHandoverBusinessRules.mockRejectedValueOnce(
            new BadRequestException('This auction was cancelled and is not payout-eligible'),
        );

        await expect(
            service.sendStripePayoutSetupReminder('auction-1'),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(notificationsService.create).not.toHaveBeenCalled();
        expect(emailService.sendStripePayoutSetupReminderEmail).not.toHaveBeenCalled();
    });

    it('blocks Stripe retry before seller/payout handling when lifecycle eligibility has been lost', async () => {
        const {
            service,
            prisma,
            auctionsService,
            paymentsService,
        } = makeHarness();
        prisma.auction.findUnique.mockResolvedValueOnce(makeAuction({
            sellerBonusReleased: true,
        }));
        auctionsService.assertHandoverBusinessRules.mockRejectedValueOnce(
            new BadRequestException('The £125 auction buyer fee payment record is invalid or incomplete'),
        );

        await expect(
            service.retryPayout('auction-1'),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(paymentsService.issueSellerPayout).not.toHaveBeenCalled();
    });
});
