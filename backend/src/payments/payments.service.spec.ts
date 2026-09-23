// ─── Stripe mock (module-level, must be before all imports) ─────────────────
const mockPaymentIntentsCreate = jest.fn();
const mockPaymentIntentsRetrieve = jest.fn();
const mockCustomersCreate = jest.fn();
const mockEphemeralKeysCreate = jest.fn();
const mockConstructEvent = jest.fn();
const mockCheckoutSessionsCreate = jest.fn();
const mockCheckoutSessionsRetrieve = jest.fn();
const mockRefundsCreate = jest.fn();
const mockRefundsList = jest.fn();
const mockTransfersCreate = jest.fn();
const mockHpiCreatePendingReport = jest.fn();

jest.mock('stripe', () => {
    const MockStripe = jest.fn().mockImplementation(() => ({
        paymentIntents: { create: mockPaymentIntentsCreate, retrieve: mockPaymentIntentsRetrieve },
        customers: { create: mockCustomersCreate },
        ephemeralKeys: { create: mockEphemeralKeysCreate },
        webhooks: { constructEvent: mockConstructEvent },
        checkout: { sessions: { create: mockCheckoutSessionsCreate, retrieve: mockCheckoutSessionsRetrieve } },
        refunds: { create: mockRefundsCreate, list: mockRefundsList },
        transfers: { create: mockTransfersCreate },
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
import { NotificationsGateway } from '../notifications/notifications.gateway';
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
        dealerProfile: {
            findUnique: jest.fn().mockResolvedValue(null),
        },
        dealerStaff: {
            findFirst: jest.fn().mockResolvedValue(null),
        },
        transaction: {
            create: jest.fn().mockResolvedValue({ id: 'txn-1' }),
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
        },
        sale: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
        },
        auction: {
            findUnique: jest.fn(),
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
            { provide: HpiService, useValue: { createPendingReport: mockHpiCreatePendingReport } },
            { provide: NotificationsService, useValue: { create: jest.fn().mockResolvedValue(null) } },
            { provide: NotificationsGateway, useValue: { sendNotification: jest.fn() } },
            { provide: EmailService, useValue: {} },
        ],
    }).compile();
}

function readyRetailListing(overrides: Record<string, unknown> = {}) {
    return {
        id: 'listing-1',
        title: 'BMW M3 2020',
        price: 30000,
        sellerId: 'user-1',
        type: 'CLASSIFIED',
        badgeTier: 'BASIC',
        status: 'DRAFT',
        deletedAt: null,
        createdAt: new Date('2026-09-19T01:00:00.000Z'),
        images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
        vrm: 'AB12CDE',
        make: 'BMW',
        model: 'M3',
        year: 2020,
        mileage: 25000,
        fuelType: 'PETROL',
        transmission: 'AUTOMATIC',
        bodyType: 'COUPE',
        location: 'Birmingham',
        owners: '1',
        description: 'Well presented vehicle with full details.',
        condition: 'GOOD',
        stolenRecovered: false,
        hasOutstandingFinance: false,
        isLegalRegisteredKeeper: true,
        isDepartedSale: false,
        hpiReport: { id: 'hpi-1' },
        ...overrides,
    };
}

describe('PaymentsService — createListingSession retail payment gate', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockCheckoutSessionsCreate.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);

        prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'USER' });
        mockCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_mock', url: 'https://checkout.stripe.test/session' });
    });

    it('charges the persisted BASIC tier even if the browser asks for PREMIUM', async () => {
        prisma.listing.findUnique.mockResolvedValue(readyRetailListing());

        await service.createListingSession('PREMIUM', 'user-1', 'listing-1');

        expect(prisma.transaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                listingId: 'listing-1',
                amount: 1,
                description: 'BASIC Listing Fee',
            }),
        });
        expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({ badgeTier: 'BASIC' }),
                line_items: [
                    expect.objectContaining({
                        price_data: expect.objectContaining({ unit_amount: 100 }),
                    }),
                ],
            }),
        );
    });

    it('heals a legacy FREE retail listing to BASIC before checkout', async () => {
        prisma.listing.findUnique.mockResolvedValue(readyRetailListing({ badgeTier: 'FREE' }));

        await service.createListingSession('BASIC', 'user-1', 'listing-1');

        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'listing-1' },
            data: { badgeTier: 'BASIC' },
        });
        expect(prisma.transaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ amount: 1 }),
        });
    });

    it('rejects hosted checkout before charging when listing fields are incomplete', async () => {
        prisma.listing.findUnique.mockResolvedValue(
            readyRetailListing({ images: [] }),
        );

        await expect(
            service.createListingSession('BASIC', 'user-1', 'listing-1'),
        ).rejects.toThrow(/not ready for payment/i);

        expect(prisma.transaction.create).not.toHaveBeenCalled();
        expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
    });

    it('allows hosted checkout when HPI has not been requested', async () => {
        prisma.listing.findUnique.mockResolvedValue(
            readyRetailListing({ hpiReport: null }),
        );

        await expect(
            service.createListingSession('BASIC', 'user-1', 'listing-1'),
        ).resolves.toEqual({ url: 'https://checkout.stripe.test/session' });

        expect(prisma.transaction.create).toHaveBeenCalled();
        expect(mockCheckoutSessionsCreate).toHaveBeenCalled();
    });

    it('does not create retail checkout for an auction listing', async () => {
        prisma.listing.findUnique.mockResolvedValue({
            id: 'listing-1',
            sellerId: 'user-1',
            type: 'AUCTION',
            badgeTier: 'FREE',
            deletedAt: null,
        });

        await expect(
            service.createListingSession('BASIC', 'user-1', 'listing-1'),
        ).rejects.toThrow('Auction listings do not require a retail listing fee');

        expect(prisma.transaction.create).not.toHaveBeenCalled();
        expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
    });
});

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

        prisma.listing.findUnique.mockResolvedValue(readyRetailListing());
        mockEphemeralKeysCreate.mockResolvedValue({ secret: 'ek_mock' });
        mockPaymentIntentsCreate.mockResolvedValue({ id: 'pi_mock', client_secret: 'pi_mock_secret' });
    });

    it('accepts type LISTING_FEE and includes the persisted badgeTier in PaymentIntent metadata', async () => {
        prisma.listing.findUnique.mockResolvedValue(readyRetailListing({ badgeTier: 'PREMIUM' }));
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

    it('rejects mobile listing-fee Payment Sheet before creating a PaymentIntent when incomplete', async () => {
        prisma.listing.findUnique.mockResolvedValue(
            readyRetailListing({ stolenRecovered: undefined }),
        );

        await expect(
            service.createPaymentSheet('listing-1', 'user-1', 1, 'LISTING_FEE', 'gbp', 'BASIC'),
        ).rejects.toThrow(/stolen\/recovered declaration/i);

        expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('omits badgeTier from metadata for non-listing-fee payment types', async () => {
        prisma.auction.findFirst.mockResolvedValue({
            id: 'auction-1',
            winnerId: 'user-1',
            buyerFeePaid: false,
        });
        await service.createPaymentSheet('listing-1', 'user-1', 125, 'COMMISSION', 'gbp');

        const callArg = mockPaymentIntentsCreate.mock.calls[0][0];
        expect(callArg.metadata.badgeTier).toBeUndefined();
    });

    it('uses the persisted retail tier when the mobile client omits badgeTier', async () => {
        await service.createPaymentSheet('listing-1', 'user-1', 25, 'LISTING_FEE', 'gbp', undefined);

        expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 100,
                metadata: expect.objectContaining({
                    type: 'LISTING_FEE',
                    badgeTier: 'BASIC',
                }),
            }),
        );
    });
});

describe('PaymentsService — reconcileAuctionFeeIntent', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockPaymentIntentsRetrieve.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);
    });

    it('heals a delayed native auction-fee webhook and marks the ended auction paid', async () => {
        prisma.transaction.findUnique.mockResolvedValue({
            id: 'txn-commission',
            userId: 'buyer-1',
            listingId: 'listing-auction',
            type: 'COMMISSION',
            status: 'PENDING',
            stripePaymentId: 'pi_commission',
        });
        mockPaymentIntentsRetrieve.mockResolvedValue({
            id: 'pi_commission',
            status: 'succeeded',
            metadata: {
                transactionId: 'txn-commission',
                userId: 'buyer-1',
                listingId: 'listing-auction',
                type: 'COMMISSION',
            },
        });
        prisma.auction.findFirst.mockResolvedValue({
            id: 'auction-1',
            buyerFeePaid: false,
            buyerFeeTransactionId: null,
        });

        await expect(
            service.reconcileAuctionFeeIntent('txn-commission', 'buyer-1'),
        ).resolves.toEqual({ applied: true, status: 'succeeded' });

        expect(prisma.transaction.update).toHaveBeenCalledWith({
            where: { id: 'txn-commission' },
            data: {
                status: 'COMPLETED',
                stripePaymentId: 'pi_commission',
            },
        });
        expect(prisma.auction.update).toHaveBeenCalledWith({
            where: { id: 'auction-1' },
            data: {
                buyerFeePaid: true,
                buyerFeeTransactionId: 'txn-commission',
            },
        });
    });

    it('never lets one buyer reconcile another buyers transaction', async () => {
        prisma.transaction.findUnique.mockResolvedValue({
            id: 'txn-commission',
            userId: 'buyer-2',
            listingId: 'listing-auction',
            type: 'COMMISSION',
            status: 'PENDING',
            stripePaymentId: 'pi_commission',
        });

        await expect(
            service.reconcileAuctionFeeIntent('txn-commission', 'buyer-1'),
        ).rejects.toThrow(/permission/i);

        expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled();
        expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it('keeps an unconfirmed PaymentIntent pending and does not unlock the auction', async () => {
        prisma.transaction.findUnique.mockResolvedValue({
            id: 'txn-commission',
            userId: 'buyer-1',
            listingId: 'listing-auction',
            type: 'COMMISSION',
            status: 'PENDING',
            stripePaymentId: 'pi_commission',
        });
        mockPaymentIntentsRetrieve.mockResolvedValue({
            id: 'pi_commission',
            status: 'processing',
            metadata: {
                transactionId: 'txn-commission',
                userId: 'buyer-1',
                listingId: 'listing-auction',
                type: 'COMMISSION',
            },
        });

        await expect(
            service.reconcileAuctionFeeIntent('txn-commission', 'buyer-1'),
        ).resolves.toEqual({ applied: false, status: 'processing' });

        expect(prisma.transaction.update).not.toHaveBeenCalled();
        expect(prisma.auction.findFirst).not.toHaveBeenCalled();
        expect(prisma.auction.update).not.toHaveBeenCalled();
    });
});

describe('PaymentsService — hosted Checkout recovery ownership', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockCheckoutSessionsRetrieve.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);
    });

    it('lets the session owner read their own Checkout status', async () => {
        mockCheckoutSessionsRetrieve.mockResolvedValue({
            id: 'cs_owner',
            status: 'complete',
            payment_status: 'paid',
            customer_details: { email: 'buyer@example.com' },
            metadata: {
                type: 'HPI_REPORT_EMAIL',
                userId: 'user-1',
                listingId: 'listing-1',
            },
            amount_total: 999,
            currency: 'gbp',
        });

        await expect(
            service.getSessionStatus('cs_owner', 'user-1'),
        ).resolves.toEqual({
            status: 'complete',
            paymentStatus: 'paid',
            customerEmail: 'buyer@example.com',
            metadata: {
                type: 'HPI_REPORT_EMAIL',
                userId: 'user-1',
                listingId: 'listing-1',
            },
            amountTotal: 999,
            currency: 'gbp',
        });
    });

    it('does not expose another users Checkout session by session id alone', async () => {
        mockCheckoutSessionsRetrieve.mockResolvedValue({
            id: 'cs_other',
            status: 'complete',
            payment_status: 'paid',
            metadata: {
                type: 'HPI_REPORT_EMAIL',
                userId: 'buyer-2',
                listingId: 'listing-1',
            },
        });

        await expect(
            service.getSessionStatus('cs_other', 'buyer-1'),
        ).rejects.toThrow(/permission/i);
    });

    it('allows verified FINANCE_MANAGER to inspect the dealerships auction-fee Checkout', async () => {
        mockCheckoutSessionsRetrieve.mockResolvedValue({
            id: 'cs_commission',
            status: 'complete',
            payment_status: 'paid',
            metadata: {
                type: 'COMMISSION',
                userId: 'owner-1',
                listingId: 'listing-auction',
            },
            amount_total: 12500,
            currency: 'gbp',
        });
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'FINANCE_MANAGER',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });

        await expect(
            service.getSessionStatus('cs_commission', 'finance-1'),
        ).resolves.toEqual(expect.objectContaining({
            status: 'complete',
            paymentStatus: 'paid',
            amountTotal: 12500,
        }));
    });

    it('blocks SALES_AGENT from auction-fee Checkout recovery', async () => {
        mockCheckoutSessionsRetrieve.mockResolvedValue({
            id: 'cs_commission',
            status: 'complete',
            payment_status: 'paid',
            metadata: {
                type: 'COMMISSION',
                userId: 'owner-1',
                listingId: 'listing-auction',
            },
        });
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'SALES_AGENT',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });

        await expect(
            service.getSessionStatus('cs_commission', 'sales-1'),
        ).rejects.toThrow(/does not allow this payment action/i);
    });

    it('keeps KYC Checkout recovery owner-only even for dealer ADMIN staff', async () => {
        mockCheckoutSessionsRetrieve.mockResolvedValue({
            id: 'cs_kyc',
            status: 'complete',
            payment_status: 'paid',
            metadata: {
                type: 'KYC_VERIFICATION',
                userId: 'owner-1',
                kycId: 'kyc-1',
            },
        });
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'ADMIN',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });

        await expect(
            service.getSessionStatus('cs_kyc', 'admin-staff-1'),
        ).rejects.toThrow(/does not allow this payment action/i);
    });

    it('blocks another user from applying an HPI email entitlement before any Stripe or HPI side effect', async () => {
        prisma.transaction.findFirst.mockResolvedValue({
            id: 'txn-hpi-email',
            userId: 'buyer-2',
            listingId: 'listing-1',
            type: 'HPI_REPORT_EMAIL',
            status: 'PENDING',
            stripePaymentId: 'cs_hpi_email',
        });

        await expect(
            service.applyHpiEmailFee('cs_hpi_email', 'buyer-1'),
        ).rejects.toThrow(/permission/i);

        expect(mockCheckoutSessionsRetrieve).not.toHaveBeenCalled();
        expect(prisma.transaction.update).not.toHaveBeenCalled();
    });
});

describe('PaymentsService — createPaymentSheet (F2: server-side amount, ignores client amount)', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockPaymentIntentsCreate.mockReset();
        mockCustomersCreate.mockReset();
        mockEphemeralKeysCreate.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);

        mockEphemeralKeysCreate.mockResolvedValue({ secret: 'ek_mock' });
        mockPaymentIntentsCreate.mockResolvedValue({ id: 'pi_mock', client_secret: 'pi_mock_secret' });
    });

    it('charges the real listing price for FULL_PAYMENT regardless of a lower client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, deletedAt: null });

        await service.createPaymentSheet('listing-1', 'user-1', 1, 'FULL_PAYMENT', 'gbp');

        expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
            expect.objectContaining({ amount: 3000000 }), // £30,000 in pence, NOT the client's £1
        );
        expect(prisma.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ amount: 30000 }) }),
        );
    });

    it('charges the fixed £500 deposit for DEPOSIT regardless of client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, deletedAt: null });

        await service.createPaymentSheet('listing-1', 'user-1', 1, 'DEPOSIT', 'gbp');

        expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 50000 }));
    });

    it('charges the fixed £125 auction buyer fee for COMMISSION regardless of client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, deletedAt: null });
        prisma.auction.findFirst.mockResolvedValue({
            id: 'auction-1',
            winnerId: 'user-1',
            buyerFeePaid: false,
        });

        await service.createPaymentSheet('listing-1', 'user-1', 1, 'COMMISSION', 'gbp');

        expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 12500 }));
    });

    it('rejects an auction buyer-fee PaymentSheet when the caller is not the recorded winner', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, deletedAt: null });
        prisma.auction.findFirst.mockResolvedValue({
            id: 'auction-1',
            winnerId: 'different-user',
            buyerFeePaid: false,
        });

        await expect(
            service.createPaymentSheet('listing-1', 'user-1', 125, 'COMMISSION', 'gbp'),
        ).rejects.toThrow(/winning dealership/i);

        expect(prisma.transaction.create).not.toHaveBeenCalled();
        expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    });

    it('rejects a second auction buyer-fee PaymentSheet after the auction is already paid', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, deletedAt: null });
        prisma.auction.findFirst.mockResolvedValue({
            id: 'auction-1',
            winnerId: 'user-1',
            buyerFeePaid: true,
        });

        await expect(
            service.createPaymentSheet('listing-1', 'user-1', 125, 'COMMISSION', 'gbp'),
        ).rejects.toThrow(/already been paid/i);

        expect(prisma.transaction.create).not.toHaveBeenCalled();
        expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    });

    it('charges the real LISTING_FEES[badgeTier] amount regardless of a lower client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue(readyRetailListing({ badgeTier: 'PREMIUM' }));

        await service.createPaymentSheet('listing-1', 'user-1', 1, 'LISTING_FEE', 'gbp', 'PREMIUM');

        expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 2500 })); // £25 PREMIUM fee, not the client's £1
    });

    it('lets FINANCE_MANAGER pay a dealership auction fee while keeping the transaction on the owner', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, deletedAt: null });
        prisma.user.findUnique.mockResolvedValue({
            id: 'finance-1',
            email: 'finance@example.com',
            firstName: 'Fran',
            lastName: 'Finance',
            stripeCustomerId: 'cus_finance',
        });
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'FINANCE_MANAGER',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });
        prisma.auction.findFirst.mockResolvedValue({
            id: 'auction-1',
            winnerId: 'owner-1',
            buyerFeePaid: false,
        });

        await service.createPaymentSheet('listing-1', 'finance-1', 125, 'COMMISSION', 'gbp');

        expect(prisma.transaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                listingId: 'listing-1',
                userId: 'owner-1',
                amount: 125,
                type: 'COMMISSION',
            }),
        });
        expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    userId: 'owner-1',
                    actorUserId: 'finance-1',
                    type: 'COMMISSION',
                }),
            }),
        );
    });

    it('blocks SALES_AGENT from paying the dealership auction fee', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, deletedAt: null });
        prisma.user.findUnique.mockResolvedValue({
            id: 'sales-1',
            email: 'sales@example.com',
            stripeCustomerId: 'cus_sales',
        });
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'SALES_AGENT',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });

        await expect(
            service.createPaymentSheet('listing-1', 'sales-1', 125, 'COMMISSION', 'gbp'),
        ).rejects.toThrow(/does not allow auction fee payments/i);

        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('lets FINANCE_MANAGER pay a dealership listing fee without moving listing ownership', async () => {
        prisma.listing.findUnique.mockResolvedValue(
            readyRetailListing({ sellerId: 'owner-1', badgeTier: 'BASIC' }),
        );
        prisma.user.findUnique.mockResolvedValue({
            id: 'finance-1',
            email: 'finance@example.com',
            stripeCustomerId: 'cus_finance',
        });
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'FINANCE_MANAGER',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });

        await service.createPaymentSheet('listing-1', 'finance-1', 1, 'LISTING_FEE', 'gbp', 'BASIC');

        expect(prisma.transaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                listingId: 'listing-1',
                userId: 'owner-1',
                amount: 1,
                type: 'LISTING_FEE',
            }),
        });
        expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    userId: 'owner-1',
                    actorUserId: 'finance-1',
                    type: 'LISTING_FEE',
                }),
            }),
        );
    });
});

describe('PaymentsService — handleWebhook checkout.session.completed (LISTING_FEE)', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockConstructEvent.mockReset();
        mockHpiCreatePendingReport.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);
    });

    it('records hosted Checkout payment but does not submit an incomplete listing', async () => {
        prisma.listing.findUnique.mockResolvedValue(
            readyRetailListing({ description: '' }),
        );
        mockConstructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_mock',
                    payment_intent: 'pi_checkout',
                    metadata: {
                        transactionId: 'txn-1',
                        listingId: 'listing-1',
                        userId: 'user-1',
                        type: 'LISTING_FEE',
                        badgeTier: 'BASIC',
                    },
                },
            },
        });

        await service.handleWebhook(Buffer.from('{}'), 'sig');

        expect(prisma.transaction.update).toHaveBeenCalledWith({
            where: { id: 'txn-1' },
            data: {
                status: 'COMPLETED',
                stripePaymentId: 'pi_checkout',
            },
        });
        expect(prisma.listing.update).not.toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'PENDING_REVIEW' }),
            }),
        );
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
        prisma.listing.findUnique.mockResolvedValue(readyRetailListing());
    });

    it('moves the listing to PENDING_REVIEW (not ACTIVE) when a PREMIUM LISTING_FEE PaymentIntent succeeds — featuring is deferred to admin approval', async () => {
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
                status: 'PENDING_REVIEW',
                badgeTier: 'PREMIUM',
            }),
        });
    });

    it('creates the included HPI request when a STANDARD listing fee succeeds', async () => {
        prisma.listing.findUnique.mockResolvedValue(
            readyRetailListing({ badgeTier: 'STANDARD' }),
        );
        mockConstructEvent.mockReturnValue({
            type: 'payment_intent.succeeded',
            data: {
                object: {
                    id: 'pi_standard',
                    metadata: { transactionId: 'txn-standard', listingId: 'listing-1', type: 'LISTING_FEE', badgeTier: 'STANDARD' },
                },
            },
        });

        await service.handleWebhook(Buffer.from('{}'), 'sig');

        expect(mockHpiCreatePendingReport).toHaveBeenCalledWith(
            'listing-1',
            'AB12CDE',
            'txn-standard',
        );
    });

    it('records genuine payment but leaves an incomplete listing out of review', async () => {
        prisma.listing.findUnique.mockResolvedValue(
            readyRetailListing({ images: [] }),
        );
        mockConstructEvent.mockReturnValue({
            type: 'payment_intent.succeeded',
            data: {
                object: {
                    id: 'pi_mock',
                    metadata: {
                        transactionId: 'txn-1',
                        listingId: 'listing-1',
                        type: 'LISTING_FEE',
                        badgeTier: 'BASIC',
                    },
                },
            },
        });

        await service.handleWebhook(Buffer.from('{}'), 'sig');

        expect(prisma.transaction.update).toHaveBeenCalledWith({
            where: { id: 'txn-1' },
            data: { status: 'COMPLETED', stripePaymentId: 'pi_mock' },
        });
        expect(prisma.listing.update).not.toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'PENDING_REVIEW' }),
            }),
        );
    });

    it('moves a BASIC tier LISTING_FEE payment to PENDING_REVIEW the same way', async () => {
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
                status: 'PENDING_REVIEW',
                badgeTier: 'BASIC',
            }),
        });
    });
});

describe('PaymentsService — auction buyer-fee refunds', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockCheckoutSessionsRetrieve.mockReset();
        mockRefundsCreate.mockReset();
        mockRefundsList.mockReset();
        mockRefundsList.mockResolvedValue({ data: [] });
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);

        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            buyerFeeTransactionId: 'txn-commission',
        });
    });

    it('refunds a native PaymentSheet commission directly from its PaymentIntent id', async () => {
        prisma.transaction.findUnique.mockResolvedValue({
            id: 'txn-commission',
            stripePaymentId: 'pi_native_commission',
        });

        await service.issueRefundForAuction('auction-1');

        expect(mockCheckoutSessionsRetrieve).not.toHaveBeenCalled();
        expect(mockRefundsCreate).toHaveBeenCalledWith({
            payment_intent: 'pi_native_commission',
            amount: 10000,
        });
        expect(prisma.transaction.update).toHaveBeenCalledWith({
            where: { id: 'txn-commission' },
            data: { status: 'REFUNDED' },
        });
    });

    it('keeps hosted web Checkout refunds working through the session PaymentIntent', async () => {
        prisma.transaction.findUnique.mockResolvedValue({
            id: 'txn-commission',
            stripePaymentId: 'cs_web_commission',
        });
        mockCheckoutSessionsRetrieve.mockResolvedValue({
            payment_intent: 'pi_from_checkout',
        });

        await service.issueRefundForAuction('auction-1');

        expect(mockCheckoutSessionsRetrieve).toHaveBeenCalledWith('cs_web_commission');
        expect(mockRefundsCreate).toHaveBeenCalledWith({
            payment_intent: 'pi_from_checkout',
            amount: 10000,
        });
    });

    it('refunds the full £125 after a faulted purchase-linked inspection', async () => {
        prisma.transaction.findUnique.mockResolvedValue({
            id: 'txn-commission',
            status: 'COMPLETED',
            stripePaymentId: 'pi_native_commission',
        });

        await service.issueFullRefundForAuctionInspection('auction-1');

        expect(mockRefundsCreate).toHaveBeenCalledWith(
            {
                payment_intent: 'pi_native_commission',
                amount: 12500,
            },
            {
                idempotencyKey: 'auction-inspection-refusal-txn-commission-12500',
            },
        );
        expect(prisma.transaction.update).toHaveBeenCalledWith({
            where: { id: 'txn-commission' },
            data: { status: 'REFUNDED' },
        });
    });

    it('tops up an earlier £100 handover refund with only the remaining £25', async () => {
        prisma.transaction.findUnique.mockResolvedValue({
            id: 'txn-commission',
            status: 'REFUNDED',
            stripePaymentId: 'pi_native_commission',
        });
        mockRefundsList.mockResolvedValue({
            data: [{ id: 're_partial', amount: 10000, status: 'succeeded' }],
        });

        await service.issueFullRefundForAuctionInspection('auction-1');

        expect(mockRefundsCreate).toHaveBeenCalledWith(
            {
                payment_intent: 'pi_native_commission',
                amount: 2500,
            },
            {
                idempotencyKey: 'auction-inspection-refusal-txn-commission-2500',
            },
        );
        expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it('does not create another refund when Stripe already shows the full £125 refunded', async () => {
        prisma.transaction.findUnique.mockResolvedValue({
            id: 'txn-commission',
            status: 'REFUNDED',
            stripePaymentId: 'pi_native_commission',
        });
        mockRefundsList.mockResolvedValue({
            data: [{ id: 're_full', amount: 12500, status: 'succeeded' }],
        });

        await service.issueFullRefundForAuctionInspection('auction-1');

        expect(mockRefundsCreate).not.toHaveBeenCalled();
        expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

});

describe('PaymentsService — seller bonus Stripe idempotency', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockTransfersCreate.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);
    });

    it('uses the supplied idempotency key for the £100 Connect transfer', async () => {
        mockTransfersCreate.mockResolvedValue({ id: 'tr_seller_bonus' });

        await expect(
            service.issueSellerPayout(
                'acct_seller',
                10000,
                'auction-seller-bonus-auction-1',
            ),
        ).resolves.toBe('tr_seller_bonus');

        expect(mockTransfersCreate).toHaveBeenCalledWith(
            {
                amount: 10000,
                currency: 'gbp',
                destination: 'acct_seller',
            },
            { idempotencyKey: 'auction-seller-bonus-auction-1' },
        );
    });
});

describe('PaymentsService — createCheckoutSession (F6: server-side amount, same fix as F2)', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockCheckoutSessionsCreate.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);

        mockCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_mock', url: 'https://checkout.stripe.com/cs_mock' });
    });

    it('charges the real listing price for FULL_PAYMENT regardless of a lower client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, make: 'BMW', model: 'M3', year: 2022, images: [], deletedAt: null });

        await service.createCheckoutSession('listing-1', 'user-1', 1, 'FULL_PAYMENT', 'gbp');

        expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 3000000 }) })],
            }),
        );
        expect(prisma.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ amount: 30000 }) }),
        );
    });

    it('charges the fixed £500 deposit for DEPOSIT regardless of client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, make: 'BMW', model: 'M3', year: 2022, images: [], deletedAt: null });

        await service.createCheckoutSession('listing-1', 'user-1', 1, 'DEPOSIT', 'gbp');

        expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 50000 }) })],
            }),
        );
    });

    it('charges the fixed £125 auction buyer fee for COMMISSION regardless of client-supplied amount', async () => {
        prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1', title: 'BMW M3', price: 30000, make: 'BMW', model: 'M3', year: 2022, images: [], deletedAt: null });
        prisma.auction.findFirst.mockResolvedValue({
            id: 'auction-1',
            winnerId: 'user-1',
            buyerFeePaid: false,
        });

        await service.createCheckoutSession('listing-1', 'user-1', 1, 'COMMISSION', 'gbp');

        expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 12500 }) })],
            }),
        );
    });
});


describe('PaymentsService — TradeXchange SERVICE_JOB webhook', () => {
    let service: PaymentsService;
    let prisma: any;

    beforeEach(async () => {
        mockConstructEvent.mockReset();
        prisma = buildPrismaMock();
        const module: TestingModule = await buildModule(prisma);
        service = module.get<PaymentsService>(PaymentsService);
    });

    it('hands a completed service checkout to ServicesService with the exact job, payment and PaymentIntent ids', async () => {
        const markServiceJobPaid = jest
            .spyOn(service as any, 'markServiceJobPaid')
            .mockResolvedValue(undefined);

        mockConstructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_service_1',
                    payment_intent: 'pi_service_1',
                    metadata: {
                        type: 'SERVICE_JOB',
                        jobId: 'job-1',
                        paymentId: 'payment-1',
                        userId: 'customer-1',
                    },
                },
            },
        });

        await service.handleWebhook(Buffer.from('{}'), 'sig');

        expect(markServiceJobPaid).toHaveBeenCalledTimes(1);
        expect(markServiceJobPaid).toHaveBeenCalledWith(
            'job-1',
            'payment-1',
            'pi_service_1',
        );
    });

    it('propagates a service payment transition failure so Stripe can retry the webhook', async () => {
        jest
            .spyOn(service as any, 'markServiceJobPaid')
            .mockRejectedValue(new Error('temporary database failure'));

        mockConstructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_service_retry',
                    payment_intent: 'pi_service_retry',
                    metadata: {
                        type: 'SERVICE_JOB',
                        jobId: 'job-retry',
                        paymentId: 'payment-retry',
                    },
                },
            },
        });

        await expect(
            service.handleWebhook(Buffer.from('{}'), 'sig'),
        ).rejects.toThrow('temporary database failure');
    });
});
