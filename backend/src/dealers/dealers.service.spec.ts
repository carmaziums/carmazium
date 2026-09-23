// ─── Stripe mock (module-level, must be before all imports) ─────────────────
// We capture the mock constructor and the per-instance mock separately so
// each test can configure checkout.sessions responses independently.
const mockSessionsCreate = jest.fn();
const mockSessionsRetrieve = jest.fn();

jest.mock('stripe', () => {
    const MockStripe = jest.fn().mockImplementation(() => ({
        checkout: {
            sessions: {
                create: mockSessionsCreate,
                retrieve: mockSessionsRetrieve,
            },
        },
    }));
    return { default: MockStripe };
});

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DealersService } from './dealers.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

function buildModule(prisma: any) {
    return Test.createTestingModule({
        providers: [
            DealersService,
            { provide: PrismaService, useValue: prisma },
            {
                provide: EmailService,
                useValue: { sendKycSubmissionAdminAlert: jest.fn().mockResolvedValue(null) },
            },
            {
                provide: NotificationsService,
                useValue: { create: jest.fn().mockResolvedValue(null) },
            },
            {
                provide: ConfigService,
                useValue: { get: jest.fn().mockReturnValue('sk_test_mock') },
            },
        ],
    }).compile();
}

function buildPrismaMock() {
    return {
        dealerProfile: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),
        },
        dealerStaff: {
            findFirst: jest.fn().mockResolvedValue(null),
        },
        contractorProfile: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        dealerKyc: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        user: {
            findUnique: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
        },
    };
}

// ─── createKycCheckoutSession ────────────────────────────────────────────────

describe('DealersService — KYC: createKycCheckoutSession', () => {
    let service: DealersService;
    let prisma: any;

    beforeEach(async () => {
        mockSessionsCreate.mockReset();
        mockSessionsRetrieve.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<DealersService>(DealersService);
    });

    it('throws BadRequestException when no KYC record exists yet', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'profile-1',
            userId: 'user-1',
            companyName: 'Test Motors',
            kyc: null,
        });

        await expect(service.createKycCheckoutSession('user-1')).rejects.toBeInstanceOf(BadRequestException);
        expect(mockSessionsCreate).not.toHaveBeenCalled();
    });

    it('returns { alreadyPaid: true, chargedAt } when stripeChargedAt is already set', async () => {
        const chargedAt = new Date('2026-06-01T12:00:00Z');
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'profile-1',
            userId: 'user-1',
            companyName: 'Test Motors',
            kyc: { id: 'kyc-1', stripeChargedAt: chargedAt, stripeCheckoutSessionId: 'cs_old' },
        });

        const result = await service.createKycCheckoutSession('user-1');

        expect(result).toEqual({ alreadyPaid: true, chargedAt });
        expect(mockSessionsCreate).not.toHaveBeenCalled();
    });

    it('reuses an existing open Checkout Session instead of creating a duplicate', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'profile-1',
            userId: 'user-1',
            companyName: 'Test Motors',
            kyc: { id: 'kyc-1', stripeChargedAt: null, stripeCheckoutSessionId: 'cs_existing_123' },
        });

        mockSessionsRetrieve.mockResolvedValue({
            id: 'cs_existing_123',
            status: 'open',
            url: 'https://checkout.stripe.com/c/pay/cs_existing_123',
            payment_status: 'unpaid',
        });

        const result = await service.createKycCheckoutSession('user-1');

        expect(result).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_existing_123', alreadyPaid: false });
        expect(mockSessionsCreate).not.toHaveBeenCalled();
    });

    it('heals the record when Stripe shows the existing session already paid (webhook delayed/missed)', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'profile-1',
            userId: 'user-1',
            companyName: 'Test Motors',
            kyc: { id: 'kyc-1', stripeChargedAt: null, stripeCheckoutSessionId: 'cs_paid_123', documentStatuses: {} },
        });

        mockSessionsRetrieve.mockResolvedValue({
            id: 'cs_paid_123',
            status: 'complete',
            payment_status: 'paid',
            payment_intent: 'pi_healed_123',
        });

        const result = await service.createKycCheckoutSession('user-1');

        expect(result.alreadyPaid).toBe(true);
        expect(mockSessionsCreate).not.toHaveBeenCalled();
        expect(prisma.dealerKyc.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'kyc-1' },
                data: expect.objectContaining({
                    stripeChargedAt: expect.any(Date),
                    stripePaymentIntentId: 'pi_healed_123',
                }),
            }),
        );
    });

    it('creates a new £1 Checkout Session and stores its id on the KYC record', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'profile-1',
            userId: 'user-1',
            companyName: 'Test Motors',
            kyc: { id: 'kyc-1', stripeChargedAt: null, stripeCheckoutSessionId: null },
        });

        mockSessionsCreate.mockResolvedValue({
            id: 'cs_new_123',
            url: 'https://checkout.stripe.com/c/pay/cs_new_123',
        });

        const result = await service.createKycCheckoutSession('user-1');

        expect(mockSessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'payment',
                line_items: [
                    expect.objectContaining({
                        price_data: expect.objectContaining({ currency: 'gbp', unit_amount: 100 }),
                        quantity: 1,
                    }),
                ],
                metadata: expect.objectContaining({ type: 'KYC_VERIFICATION', kycId: 'kyc-1', userId: 'user-1' }),
            }),
        );
        expect(prisma.dealerKyc.update).toHaveBeenCalledWith({
            where: { id: 'kyc-1' },
            data: { stripeCheckoutSessionId: 'cs_new_123' },
        });
        expect(result).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_new_123', alreadyPaid: false });
    });
});

// ─── submitKyc ────────────────────────────────────────────────────────────────
// The £1 fee is now collected via a hosted Stripe Checkout redirect, confirmed
// asynchronously by the webhook — submitKyc never touches Stripe or payment state.

describe('DealersService — KYC: submitKyc', () => {
    let service: DealersService;
    let prisma: any;
    let emailService: any;

    const baseDto = {
        companyHouseName: 'Test Motors Ltd',
        representativeName: 'John Doe',
        representativePosition: 'Director',
        vatNumber: 'GB123456789',
        companyRegistrationNumber: '12345678',
        personOfSignificantControl: 'John Doe',
        directorName: 'John Doe',
        businessWebsite: 'https://testmotors.co.uk',
        businessRegisteredAddress: '1 Test Street, London',
    };

    beforeEach(async () => {
        mockSessionsCreate.mockReset();
        mockSessionsRetrieve.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<DealersService>(DealersService);
        emailService = module.get(EmailService);
    });

    it('first submission: saves fields as PENDING and does NOT alert admins yet (fee unpaid)', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'profile-1',
            userId: 'user-1',
            companyName: 'Test Motors',
            kyc: null,
            user: { id: 'user-1', role: 'DEALER', firstName: 'John', lastName: 'Doe' },
        });

        prisma.dealerKyc.create.mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'kyc-new', ...data }),
        );
        prisma.dealerProfile.update.mockResolvedValue({});

        const result = await service.submitKyc('user-1', baseDto as any);

        expect(result.status).toBe('PENDING');
        // No Stripe fields should be set by submitKyc itself
        expect(prisma.dealerKyc.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.not.objectContaining({ stripeChargedAt: expect.anything() }),
            }),
        );
        // paymentReference/paymentScreenshot are saved PENDING (they're in fieldsList) but
        // must NOT be auto-approved — the £1 fee hasn't been paid yet
        const createdData = prisma.dealerKyc.create.mock.calls[0][0].data;
        expect(createdData.documentStatuses.paymentReference.status).toBe('PENDING');
        // Submission alert is deferred to the webhook, not fired here
        expect(emailService.sendKycSubmissionAdminAlert).not.toHaveBeenCalled();
    });

    it('resubmission when already Stripe-verified: alerts admins immediately and keeps payment fields approved', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'profile-1',
            userId: 'user-1',
            companyName: 'Test Motors',
            kyc: {
                id: 'kyc-1',
                stripeChargedAt: new Date('2026-06-01T12:00:00Z'),
                documentStatuses: { paymentReference: { status: 'APPROVED', note: 'Stripe verified' } },
                companyHouseName: 'Old Name',
            },
            user: { id: 'user-1', role: 'DEALER', firstName: 'John', lastName: 'Doe' },
        });

        prisma.dealerKyc.update.mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'kyc-1', ...data }),
        );
        prisma.dealerProfile.update.mockResolvedValue({});
        prisma.user.findMany.mockResolvedValue([{ email: 'admin@carmazium.uk' }]);

        await service.submitKyc('user-1', baseDto as any);

        const updatedData = prisma.dealerKyc.update.mock.calls[0][0].data;
        expect(updatedData.documentStatuses.paymentReference.status).toBe('APPROVED');
        expect(emailService.sendKycSubmissionAdminAlert).toHaveBeenCalledWith(
            ['admin@carmazium.uk'],
            'Test Motors',
        );
    });

    it('synchronises the dealership business identity into an existing ContractorProfile projection', async () => {
        prisma.dealerProfile.findUnique
            // assertDealerOwner()
            .mockResolvedValueOnce({
                id: 'profile-1',
                userId: 'user-1',
                isVerified: false,
            })
            // submitKyc() profile + current KYC
            .mockResolvedValueOnce({
                id: 'profile-1',
                userId: 'user-1',
                companyName: 'Old Motors',
                phone: '07000000000',
                businessAddress: 'Old Address',
                kyc: null,
                user: { id: 'user-1', role: 'DEALER', firstName: 'John', lastName: 'Doe' },
            })
            // syncProfileFromKyc() business projection
            .mockResolvedValueOnce({
                id: 'profile-1',
                userId: 'user-1',
                companyName: 'Test Motors Ltd',
                phone: '07000000000',
                businessAddress: '1 Test Street, London',
            });
        prisma.dealerKyc.create.mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'kyc-new', ...data }),
        );
        prisma.dealerProfile.update.mockResolvedValue({});

        await service.submitKyc('user-1', baseDto as any);

        expect(prisma.contractorProfile.updateMany).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
            data: {
                businessName: 'Test Motors Ltd',
                phone: '07000000000',
                serviceArea: '1 Test Street, London',
            },
        });
    });

    it('never throws on Stripe-related errors — submitKyc no longer talks to Stripe at all', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'profile-1',
            userId: 'user-1',
            companyName: 'Test Motors',
            kyc: null,
            user: { id: 'user-1', role: 'DEALER', firstName: 'John', lastName: 'Doe' },
        });
        prisma.dealerKyc.create.mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'kyc-new', ...data }),
        );
        prisma.dealerProfile.update.mockResolvedValue({});

        await expect(service.submitKyc('user-1', baseDto as any)).resolves.toBeDefined();
        expect(mockSessionsCreate).not.toHaveBeenCalled();
        expect(mockSessionsRetrieve).not.toHaveBeenCalled();
    });
});

describe('DealersService — staff permission boundaries', () => {
    let service: DealersService;
    let prisma: any;

    beforeEach(async () => {
        prisma = buildPrismaMock();
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        const module: TestingModule = await buildModule(prisma);
        service = module.get<DealersService>(DealersService);
    });

    it('prevents staff from entering the dealership owner KYC flow', async () => {
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'ADMIN',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });

        await expect(service.getKyc('admin-staff-1'))
            .rejects.toThrow(/only the dealership owner/i);
    });

    it('allows dealer ADMIN staff to read the team but blocks FINANCE_MANAGER', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'ADMIN',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
                staff: [],
            },
        });
        prisma.dealerStaff.findMany = jest.fn().mockResolvedValue([]);
        (prisma as any).dealerInvite = { findMany: jest.fn().mockResolvedValue([]) };

        await expect(service.getStaff('admin-staff-1')).resolves.toEqual({
            active: [],
            pending: [],
        });

        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'FINANCE_MANAGER',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
                staff: [],
            },
        });

        await expect(service.getStaff('finance-1'))
            .rejects.toThrow(/permission/i);
    });
});

