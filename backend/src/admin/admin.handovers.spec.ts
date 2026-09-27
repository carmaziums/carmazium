import { AdminService } from './admin.service';

describe('AdminService secure handover review queue', () => {
    const makeService = (rows: any[]) => {
        const prisma: any = {
            auction: {
                findMany: jest.fn().mockResolvedValue(rows),
            },
        };
        const handoverDocuments = {
            hydrateMany: jest.fn(async (items: any[]) =>
                items.map(({ handoverProofPath, ...item }) => ({
                    ...item,
                    handoverProofUrl: handoverProofPath
                        ? `https://signed.example/${encodeURIComponent(handoverProofPath)}`
                        : item.handoverProofUrl,
                    handoverProofIsPrivate: Boolean(handoverProofPath),
                })),
            ),
        };

        const service = new AdminService(
            prisma,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            handoverDocuments as any,
        );

        return { service, prisma, handoverDocuments };
    };

    it('queues both private-path and legacy-URL proofs while keeping the private key out of the response', async () => {
        const rows = [
            {
                id: 'private-auction',
                status: 'ENDED',
                handoverProofPath: 'private-auction/proof.jpg',
                handoverProofUrl: null,
                sellerBonusReleased: false,
            },
            {
                id: 'legacy-auction',
                status: 'ENDED',
                handoverProofPath: null,
                handoverProofUrl: 'https://legacy.example/proof.jpg',
                sellerBonusReleased: false,
            },
        ];
        const { service, prisma, handoverDocuments } = makeService(rows);

        const result = await service.getPendingHandovers();

        expect(prisma.auction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    deletedAt: null,
                    status: 'ENDED',
                    sellerBonusReleased: false,
                    OR: [
                        { handoverProofPath: { not: null } },
                        { handoverProofUrl: { not: null } },
                    ],
                },
                orderBy: { handoverSubmittedAt: 'asc' },
            }),
        );
        expect(handoverDocuments.hydrateMany).toHaveBeenCalledWith(rows);
        expect(result).toEqual([
            expect.objectContaining({
                id: 'private-auction',
                handoverProofUrl: expect.stringContaining('https://signed.example/'),
                handoverProofIsPrivate: true,
            }),
            expect.objectContaining({
                id: 'legacy-auction',
                handoverProofUrl: 'https://legacy.example/proof.jpg',
                handoverProofIsPrivate: false,
            }),
        ]);
        expect(result[0]).not.toHaveProperty('handoverProofPath');
        expect(result[1]).not.toHaveProperty('handoverProofPath');
    });
});
