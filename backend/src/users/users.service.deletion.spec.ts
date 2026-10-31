import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService account deletion', () => {
    function build(options?: {
        liveAuction?: boolean;
        activeBid?: boolean;
        storageError?: string;
        authError?: string;
        soldDamage?: Array<{ id: string; listingId: string; imageUrl: string }>;
        copyError?: string;
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
            damageRecord: {
                findMany: jest.fn().mockResolvedValue(options?.soldDamage ?? []),
                update: jest.fn().mockResolvedValue({}),
            },
            $executeRaw: jest.fn().mockResolvedValue(1),
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
        const copy = jest.fn().mockResolvedValue(
            options?.copyError ? { error: { message: options.copyError } } : { data: {}, error: null },
        );
        const getPublicUrl = jest.fn((path: string) => ({
            data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/listings/${path}` },
        }));
        (service as any).supabaseAdmin = {
            storage: { from: jest.fn(() => ({ remove, copy, getPublicUrl })) },
            auth: { admin: { deleteUser } },
        };

        return { service, prisma, tx, remove, deleteUser, copy };
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

    describe('damage evidence of sold vehicles', () => {
        const owner = '11111111-1111-4111-8111-111111111111';
        const damageUrl = `https://example.supabase.co/storage/v1/object/public/listings/${owner}/damage/scratch.jpg`;

        it('copies sold vehicles\' damage photos to retained evidence and repoints the records', async () => {
            const { service, prisma, remove, copy } = build({
                soldDamage: [{ id: 'd1', listingId: 'l1', imageUrl: damageUrl }],
            });
            prisma.$queryRaw
                .mockResolvedValueOnce([
                    { bucket_id: 'listings', name: `${owner}/vehicle/front.jpg` },
                    { bucket_id: 'listings', name: `${owner}/damage/scratch.jpg` },
                ])
                .mockResolvedValueOnce([{ present: true }]);

            await service.deleteAccount(owner);

            // Only sold vehicles (a Sale exists) owned by this seller.
            expect(prisma.damageRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { imageUrl: { not: null }, listing: { sellerId: owner, sale: { isNot: null } } },
            }));
            expect(copy).toHaveBeenCalledWith(`${owner}/damage/scratch.jpg`, 'retained-evidence/damage/l1/d1-scratch.jpg');
            expect(prisma.damageRecord.update).toHaveBeenCalledWith({
                where: { id: 'd1' },
                data: { imageUrl: 'https://example.supabase.co/storage/v1/object/public/listings/retained-evidence/damage/l1/d1-scratch.jpg' },
            });
            expect(prisma.$executeRaw).toHaveBeenCalled();
            // Originals (gallery and damage) are still removed from the seller's space.
            const removed = remove.mock.calls.flatMap((c: any[]) => c[0]);
            expect(removed).toEqual(expect.arrayContaining([`${owner}/vehicle/front.jpg`, `${owner}/damage/scratch.jpg`]));
            // The copy itself is never removed.
            expect(removed).not.toContain('retained-evidence/damage/l1/d1-scratch.jpg');
        });

        it('stops before deleting anything if a damage photo cannot be copied', async () => {
            const { service, prisma, remove, deleteUser } = build({
                soldDamage: [{ id: 'd1', listingId: 'l1', imageUrl: damageUrl }],
                copyError: 'storage unavailable',
            });
            prisma.$queryRaw.mockResolvedValueOnce([{ bucket_id: 'listings', name: `${owner}/damage/scratch.jpg` }]);

            await expect(service.deleteAccount(owner)).rejects.toBeInstanceOf(ServiceUnavailableException);
            expect(remove).not.toHaveBeenCalled();
            expect(deleteUser).not.toHaveBeenCalled();
            expect(prisma.damageRecord.update).not.toHaveBeenCalled();
        });

        it('leaves gallery photos to normal deletion when nothing was sold', async () => {
            const { service, copy, remove } = build();
            await service.deleteAccount(owner);
            expect(copy).not.toHaveBeenCalled();
            expect(remove).toHaveBeenCalled();
        });
    });
});
