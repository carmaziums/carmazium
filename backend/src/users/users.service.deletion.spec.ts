import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService account deletion', () => {
    function build(options?: {
        liveAuction?: boolean;
        activeBid?: boolean;
        storageError?: string;
        authError?: string;
    }) {
        const tx: any = {
            addressVerification: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
            notification: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
            watchlistItem: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
            analyticsEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
            financeApplication: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
            insuranceQuote: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
            serviceLead: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
            lead: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
            sale: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
            hpiReportEmailRequest: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
            sellerReview: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
            message: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
            listing: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
            dealerKyc: { delete: jest.fn().mockResolvedValue({}) },
            dealerInvite: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
            dealerStaff: {
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
                deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            dealerProfile: { update: jest.fn().mockResolvedValue({}) },
            contractorProfile: {
                findUnique: jest.fn().mockResolvedValue(null),
                update: jest.fn().mockResolvedValue({}),
            },
            contractorCapability: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
            partnerProfile: {
                findMany: jest.fn().mockResolvedValue([]),
                update: jest.fn().mockResolvedValue({}),
            },
            user: { update: jest.fn().mockResolvedValue({}) },
        };

        const prisma: any = {
            user: {
                findUnique: jest.fn().mockResolvedValue({
                    id: '11111111-1111-4111-8111-111111111111',
                    email: 'person@example.com',
                    deletedAt: null,
                    profileImage: 'https://example.supabase.co/storage/v1/object/public/listings/11111111-1111-4111-8111-111111111111/profile.jpg',
                }),
            },
            listing: {
                findFirst: jest.fn().mockResolvedValue(
                    options?.liveAuction ? { id: 'listing-live' } : null,
                ),
                findMany: jest.fn().mockResolvedValue([
                    {
                        images: [
                            'https://example.supabase.co/storage/v1/object/public/listings/11111111-1111-4111-8111-111111111111/vehicle/front.jpg',
                        ],
                    },
                ]),
            },
            bid: {
                findFirst: jest.fn().mockResolvedValue(
                    options?.activeBid ? { id: 'bid-live' } : null,
                ),
            },
            dealerProfile: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'dealer-1',
                    logo: null,
                    kyc: {
                        id: 'kyc-1',
                        directorIdProofPath: 'dealer-1/directorIdProof/id.jpg',
                        proofOfAddressPath: 'dealer-1/proofOfAddress/address.jpg',
                        vatProofPath: null,
                        companyRegistrationProofPath: null,
                        paymentScreenshotPath: null,
                        directorIdProof: null,
                        proofOfAddress: null,
                        vatProof: null,
                        companyRegistrationProof: null,
                        paymentScreenshot: null,
                    },
                }),
            },
            message: {
                findMany: jest.fn().mockResolvedValue([
                    { attachmentPath: 'room-1/11111111-1111-4111-8111-111111111111/photo.jpg' },
                ]),
            },
            $queryRaw: jest.fn().mockResolvedValue([
                {
                    bucket_id: 'listings',
                    name: '11111111-1111-4111-8111-111111111111/vehicle/front.jpg',
                },
            ]),
            $transaction: jest.fn(async (fn: any) => fn(tx)),
        };

        const config: any = {
            get: jest.fn(() => undefined),
        };
        const service = new UsersService(prisma, {} as any, config);

        const remove = jest.fn().mockResolvedValue(
            options?.storageError ? { error: { message: options.storageError } } : { error: null },
        );
        const deleteUser = jest.fn().mockResolvedValue(
            options?.authError ? { error: { message: options.authError } } : { error: null },
        );
        (service as any).supabaseAdmin = {
            storage: { from: jest.fn(() => ({ remove })) },
            auth: { admin: { deleteUser } },
        };

        return { service, prisma, tx, remove, deleteUser };
    }

    it('refuses deletion before touching Storage/Auth when the seller has a live auction', async () => {
        const { service, prisma, remove, deleteUser } = build({ liveAuction: true });

        await expect(
            service.deleteAccount('11111111-1111-4111-8111-111111111111'),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
        expect(deleteUser).not.toHaveBeenCalled();
    });

    it('refuses deletion before touching Storage/Auth when the buyer has an active live bid', async () => {
        const { service, prisma, remove, deleteUser } = build({ activeBid: true });

        await expect(
            service.deleteAccount('11111111-1111-4111-8111-111111111111'),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
        expect(deleteUser).not.toHaveBeenCalled();
    });

    it('removes Storage, deletes Supabase Auth and atomically anonymises application PII', async () => {
        const { service, prisma, tx, remove, deleteUser } = build();

        const result = await service.deleteAccount(
            '11111111-1111-4111-8111-111111111111',
        );

        expect(remove).toHaveBeenCalled();
        expect(deleteUser).toHaveBeenCalledWith(
            '11111111-1111-4111-8111-111111111111',
        );
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(tx.dealerKyc.delete).toHaveBeenCalledWith({ where: { id: 'kyc-1' } });
        expect(tx.addressVerification.deleteMany).toHaveBeenCalled();
        expect(tx.notification.deleteMany).toHaveBeenCalled();
        expect(tx.watchlistItem.deleteMany).toHaveBeenCalled();
        expect(tx.analyticsEvent.deleteMany).toHaveBeenCalled();
        expect(tx.message.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { senderId: '11111111-1111-4111-8111-111111111111' },
                data: expect.objectContaining({ attachmentPath: null }),
            }),
        );
        expect(tx.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: '11111111-1111-4111-8111-111111111111' },
                data: expect.objectContaining({
                    email: 'deleted-11111111-1111-4111-8111-111111111111@deleted.carmazium.com',
                    phone: null,
                    profileImage: null,
                    location: null,
                    postcode: null,
                    bankAccountNumber: null,
                    showPublicProfile: false,
                }),
            }),
        );
        expect(result.success).toBe(true);
        expect(result.retainedRecordClasses).toContain('completed transactions and payments');
    });

    it('fails closed before Auth/database deletion if Storage cleanup fails', async () => {
        const { service, prisma, deleteUser } = build({ storageError: 'storage unavailable' });

        await expect(
            service.deleteAccount('11111111-1111-4111-8111-111111111111'),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);

        expect(deleteUser).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not report application deletion complete when Supabase Auth deletion fails', async () => {
        const { service, prisma } = build({ authError: 'unexpected auth failure' });

        await expect(
            service.deleteAccount('11111111-1111-4111-8111-111111111111'),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);

        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
