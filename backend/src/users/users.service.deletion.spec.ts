import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService account deletion', () => {
    function build(options?: {
        liveAuction?: boolean;
        activeBid?: boolean;
        storageError?: string;
        authError?: string;
        soldDamage?: Array<{ listingId: string; imageUrl: string }>;
        cancelledListings?: Array<{ listingId: string }>;
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
            // Used by the damage-evidence repoint transaction.
            damageRecord: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
            $executeRaw: jest.fn().mockResolvedValue(1),
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
            },
            saleCancellationRequest: {
                findMany: jest.fn().mockResolvedValue(options?.cancelledListings ?? []),
            },
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

    describe('damage evidence of purchased vehicles', () => {
        const owner = '11111111-1111-4111-8111-111111111111';
        const base = 'https://example.supabase.co/storage/v1/object/public/listings/';
        const damageUrl = `${base}${owner}/damage/scratch.jpg`;
        const removedUrl = `${base}${owner}/damage/removed-after-sale.jpg`;
        const retained = (p: string) => `${base}retained-evidence/damage/l1/${p.replace(/\//g, '_')}`;
        const owned = [
            { bucket_id: 'listings', name: `${owner}/vehicle/front.jpg` },
            { bucket_id: 'listings', name: `${owner}/damage/scratch.jpg` },
            { bucket_id: 'listings', name: `${owner}/damage/removed-after-sale.jpg` },
        ];

        it('copies damage photos from records AND snapshots, repoints them in one transaction, then deletes originals', async () => {
            const { service, prisma, tx, remove, copy } = build({
                soldDamage: [{ listingId: 'l1', imageUrl: damageUrl }],
                cancelledListings: [{ listingId: 'l9' }],
            });
            prisma.$queryRaw
                .mockResolvedValueOnce(owned)
                .mockResolvedValueOnce([{ present: true }])
                // A damage record the seller deleted after the sale survives only in the snapshot.
                .mockResolvedValueOnce([{ listingId: 'l1', url: removedUrl }, { listingId: 'l1', url: damageUrl }]);

            await service.deleteAccount(owner);

            // Bought vehicles: a Sale exists, or a recorded sale was cancelled.
            expect(prisma.damageRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: {
                    imageUrl: { not: null },
                    listing: { sellerId: owner, OR: [{ sale: { isNot: null } }, { id: { in: ['l9'] } }] },
                },
            }));
            expect(copy).toHaveBeenCalledWith(`${owner}/damage/scratch.jpg`, `retained-evidence/damage/l1/${owner}_damage_scratch.jpg`);
            expect(copy).toHaveBeenCalledWith(`${owner}/damage/removed-after-sale.jpg`, `retained-evidence/damage/l1/${owner}_damage_removed-after-sale.jpg`);
            expect(tx.damageRecord.updateMany).toHaveBeenCalledWith({
                where: { imageUrl: damageUrl }, data: { imageUrl: retained(`${owner}/damage/scratch.jpg`) },
            });
            expect(tx.$executeRaw).toHaveBeenCalledTimes(2); // one per original URL, inside the transaction
            const removed = remove.mock.calls.flatMap((c: any[]) => c[0]);
            expect(removed).toEqual(expect.arrayContaining([`${owner}/vehicle/front.jpg`, `${owner}/damage/scratch.jpg`]));
            expect(removed.some((p: string) => p.startsWith('retained-evidence/'))).toBe(false);
        });

        it('a failed repoint deletes nothing, and the retry still protects every snapshot reference', async () => {
            const first = build({ soldDamage: [{ listingId: 'l1', imageUrl: damageUrl }] });
            first.prisma.$queryRaw
                .mockResolvedValueOnce(owned)
                .mockResolvedValueOnce([{ present: true }])
                .mockResolvedValueOnce([{ listingId: 'l1', url: damageUrl }]);
            // The snapshot update fails inside the single repoint transaction.
            first.tx.$executeRaw.mockRejectedValueOnce(new Error('snapshot update failed'));
            await expect(first.service.deleteAccount(owner)).rejects.toThrow('snapshot update failed');
            expect(first.remove).not.toHaveBeenCalled();
            expect(first.deleteUser).not.toHaveBeenCalled();

            // Retry. Even if the live record had already moved (simulated: no
            // record left pointing at the original), the snapshot still does,
            // so the original is copied again (copy exists) and repointed
            // before any deletion.
            const retry = build({ soldDamage: [], copyError: 'The resource already exists' });
            retry.prisma.$queryRaw
                .mockResolvedValueOnce(owned)
                .mockResolvedValueOnce([{ present: true }])
                .mockResolvedValueOnce([{ listingId: 'l1', url: damageUrl }]);
            await retry.service.deleteAccount(owner);
            expect(retry.copy).toHaveBeenCalledWith(`${owner}/damage/scratch.jpg`, `retained-evidence/damage/l1/${owner}_damage_scratch.jpg`);
            expect(retry.tx.$executeRaw).toHaveBeenCalledTimes(1);
            const repointOrder = retry.tx.$executeRaw.mock.invocationCallOrder[0];
            const removeOrder = retry.remove.mock.invocationCallOrder[0];
            expect(repointOrder).toBeLessThan(removeOrder);
        });

        it('stops before deleting anything if a damage photo cannot be copied', async () => {
            const { service, prisma, tx, remove, deleteUser } = build({
                soldDamage: [{ listingId: 'l1', imageUrl: damageUrl }],
                copyError: 'storage unavailable',
            });
            prisma.$queryRaw.mockResolvedValueOnce(owned).mockResolvedValueOnce([{ present: false }]);
            await expect(service.deleteAccount(owner)).rejects.toBeInstanceOf(ServiceUnavailableException);
            expect(remove).not.toHaveBeenCalled();
            expect(deleteUser).not.toHaveBeenCalled();
            expect(tx.damageRecord.updateMany).not.toHaveBeenCalled();
        });

        it('never copies gallery photos, and copies nothing when no vehicle was bought', async () => {
            const { service, copy, remove } = build();
            await service.deleteAccount(owner);
            expect(copy).not.toHaveBeenCalled();
            expect(remove).toHaveBeenCalled();
        });
    });
});
