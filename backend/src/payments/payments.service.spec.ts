// ─── Stripe mock (module-level, must be before all imports) ─────────────────
const mockPaymentIntentsCreate = jest.fn();
const mockCustomersCreate = jest.fn();
const mockEphemeralKeysCreate = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
    const MockStripe = jest.fn().mockImplementation(() => ({
        paymentIntents: { create: mockPaymentIntentsCreate },
        customers: { create: mockCustomersCreate },
        ephemeralKeys: { create: mockEphemeralKeysCreate },
        webhooks: { constructEvent: mockConstructEvent },
    }));
    // `payments.service.ts` loads Stripe via a dynamic `await import('stripe')`
    // (unlike dealers.service.ts's static import) — __esModule: true is required
    // here so TS's dynamic-import interop unwraps `.default` to MockStripe itself
    // instead of double-wrapping it.
    return { __esModule: true, default: MockStripe };
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { HpiService } from '../hpi/hpi.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

function buildPrismaMock() {
    return {
        listing: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        user: {
            findUnique: jest.fn().mockResolvedValue({ id: 'user-1', email: 'buyer@example.com', stripeCustomerId: 'cus_existing' }),
            update: jest.fn(),
        },
        transaction: {
            create: jest.fn().mockResolvedValue({ id: 'txn-1' }),
            update: jest.fn(),
        },
        sale: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
        },
        auction: {
            findFirst: jest.fn(),
            update: jest.fn(),
        },
        $transaction: jest.fn((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(prismaTxProxy))),
    };
}

// Used only by the $transaction((tx) => ...) callback form — mirror the same mock shape.
let prismaTxProxy: any;

function buildModule(prisma: any) {
    prismaTxProxy = prisma;
    return Test.createTestingModule({
        providers: [
            PaymentsService,
            { provide: PrismaService, useValue: prisma },
            { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('sk_test_mock') } },
            { provide: HpiService, useValue: { generateAndSaveReport: jest.fn() } },
            { provide: NotificationsService, useValue: { create: jest.fn().mockResolvedValue(null) } },
            { provide: EmailService, useValue: {} },
        ],
    }).compile();
}

describe('PaymentsService — createPaymentSheet (LISTING_FEE)', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockPaymentIntentsCreate.mockReset();
        mockCustomersCreate.mockReset();
        mockEphemeralKeysCreate.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);

        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', deletedAt: null });
        mockEphemeralKeysCreate.mockResolvedValue({ secret: 'ek_mock' });
        mockPaymentIntentsCreate.mockResolvedValue({ id: 'pi_mock', client_secret: 'pi_mock_secret' });
    });

    it('accepts type LISTING_FEE (previously rejected by DTO validation) and includes badgeTier in the PaymentIntent metadata', async () => {
        await service.createPaymentSheet('listing-1', 'user-1', 25, 'LISTING_FEE', 'gbp', 'PREMIUM');

        expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 2500,
                metadata: expect.objectContaining({
                    type: 'LISTING_FEE',
                    badgeTier: 'PREMIUM',
                }),
            }),
        );
    });

    it('omits badgeTier from metadata for non-listing-fee payment types', async () => {
        await service.createPaymentSheet('listing-1', 'user-1', 125, 'COMMISSION', 'gbp');

        const callArg = mockPaymentIntentsCreate.mock.calls[0][0];
        expect(callArg.metadata.badgeTier).toBeUndefined();
    });
});

describe('PaymentsService — handleWebhook payment_intent.succeeded (LISTING_FEE)', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockConstructEvent.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);
    });

    it('activates the listing at the correct tier when a LISTING_FEE PaymentIntent succeeds (PREMIUM → featured)', async () => {
        mockConstructEvent.mockReturnValue({
            type: 'payment_intent.succeeded',
            data: {
                object: {
                    id: 'pi_mock',
                    metadata: { transactionId: 'txn-1', listingId: 'listing-1', type: 'LISTING_FEE', badgeTier: 'PREMIUM' },
                },
            },
        });

        await service.handleWebhook(Buffer.from('{}'), 'sig');

        expect(prisma.transaction.update).toHaveBeenCalledWith({
            where: { id: 'txn-1' },
            data: { status: 'COMPLETED', stripePaymentId: 'pi_mock' },
        });
        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'listing-1' },
            data: expect.objectContaining({
                status: 'ACTIVE',
                badgeTier: 'PREMIUM',
                isFeatured: true,
            }),
        });
    });

    it('activates the listing without featuring it for a BASIC tier LISTING_FEE payment', async () => {
        mockConstructEvent.mockReturnValue({
            type: 'payment_intent.succeeded',
            data: {
                object: {
                    id: 'pi_mock',
                    metadata: { transactionId: 'txn-1', listingId: 'listing-1', type: 'LISTING_FEE', badgeTier: 'BASIC' },
                },
            },
        });

        await service.handleWebhook(Buffer.from('{}'), 'sig');

        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'listing-1' },
            data: expect.objectContaining({
                status: 'ACTIVE',
                badgeTier: 'BASIC',
                isFeatured: false,
                featuredUntil: null,
            }),
        });
    });
});
