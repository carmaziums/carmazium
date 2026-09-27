import { ForbiddenException } from '@nestjs/common';
import { HandoverDocumentsService } from './handover-documents.service';

const validJpeg = {
    originalname: 'handover.jpg',
    mimetype: 'image/jpeg',
    size: 4,
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
};

function makeHarness() {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const prisma: any = {
        dealerProfile: {
            findUnique: jest.fn().mockResolvedValue(null),
        },
        dealerStaff: {
            findFirst: jest.fn().mockResolvedValue(null),
        },
        auction: {
            findUnique: jest.fn().mockResolvedValue({
                id: 'auction-1',
                deletedAt: null,
                listing: { sellerId: 'seller-owner-1' },
            }),
        },
    };

    const service = new HandoverDocumentsService(prisma);
    (service as any).supabase = {
        storage: {
            from: jest.fn().mockReturnValue({
                upload,
            }),
        },
    };

    return { service, prisma, upload };
}

describe('HandoverDocumentsService dealership permissions', () => {
    it('allows the canonical dealership owner to store private handover proof', async () => {
        const { service, prisma, upload } = makeHarness();
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'dealer-1',
            userId: 'seller-owner-1',
            isVerified: true,
        });

        const key = await service.storeProof('seller-owner-1', 'auction-1', validJpeg);

        expect(key).toMatch(/^auction-1\/.+\.jpg$/);
        expect(upload).toHaveBeenCalledTimes(1);
    });

    it.each(['ADMIN', 'SALES_AGENT'])(
        'allows active %s staff with MANAGE_INVENTORY to upload on behalf of the dealership',
        async (role) => {
            const { service, prisma, upload } = makeHarness();
            prisma.dealerStaff.findFirst.mockResolvedValue({
                role,
                dealerProfile: {
                    id: 'dealer-1',
                    userId: 'seller-owner-1',
                    isVerified: true,
                },
            });

            const key = await service.storeProof('staff-1', 'auction-1', validJpeg);

            expect(key).toMatch(/^auction-1\/.+\.jpg$/);
            expect(prisma.dealerStaff.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'staff-1', isActive: true },
                }),
            );
            expect(upload).toHaveBeenCalledTimes(1);
        },
    );

    it('blocks FINANCE_MANAGER staff because the role is read-only for inventory handover', async () => {
        const { service, prisma, upload } = makeHarness();
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'FINANCE_MANAGER',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'seller-owner-1',
                isVerified: true,
            },
        });

        await expect(
            service.storeProof('finance-staff-1', 'auction-1', validJpeg),
        ).rejects.toMatchObject({
            message: 'Your dealership role does not allow handover submission.',
        });

        expect(upload).not.toHaveBeenCalled();
        expect(prisma.auction.findUnique).not.toHaveBeenCalled();
    });

    it('blocks inactive staff because they cannot resolve to the dealership owner', async () => {
        const { service, prisma, upload } = makeHarness();
        prisma.dealerStaff.findFirst.mockResolvedValue(null);

        await expect(
            service.storeProof('inactive-staff-1', 'auction-1', validJpeg),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(upload).not.toHaveBeenCalled();
    });

    it('blocks staff from another dealership even when their role can manage inventory', async () => {
        const { service, prisma, upload } = makeHarness();
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'ADMIN',
            dealerProfile: {
                id: 'dealer-2',
                userId: 'different-owner',
                isVerified: true,
            },
        });

        await expect(
            service.storeProof('other-admin-1', 'auction-1', validJpeg),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(upload).not.toHaveBeenCalled();
    });

    it('keeps private sellers working when they are not dealership actors', async () => {
        const { service, prisma, upload } = makeHarness();
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            deletedAt: null,
            listing: { sellerId: 'private-seller-1' },
        });

        await expect(
            service.storeProof('private-seller-1', 'auction-1', validJpeg),
        ).resolves.toMatch(/^auction-1\/.+\.jpg$/);

        expect(upload).toHaveBeenCalledTimes(1);
    });
});
