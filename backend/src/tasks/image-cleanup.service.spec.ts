import { ImageCleanupService } from './image-cleanup.service';

describe('ImageCleanupService', () => {
    const ownerId = '11111111-1111-4111-8111-111111111111';
    const supabaseUrl = 'https://test.supabase.co';

    const makeService = () => {
        const prisma = {
            listing: {
                findMany: jest.fn(),
            },
        } as any;
        const config = {
            get: jest.fn(() => undefined),
        } as any;

        const remove = jest.fn().mockResolvedValue({ error: null });
        const list = jest.fn();
        const getPublicUrl = jest.fn((objectPath: string) => ({
            data: {
                publicUrl: `${supabaseUrl}/storage/v1/object/public/listings/${objectPath}`,
            },
        }));
        const from = jest.fn(() => ({
            list,
            remove,
            getPublicUrl,
        }));

        const service = new ImageCleanupService(prisma, config);
        (service as any).supabase = {
            storage: { from },
        };

        return { service, prisma, list, remove, getPublicUrl };
    };

    it('recursively scans owner vehicle folders and keeps referenced images with URL metadata fragments', async () => {
        const { service, prisma, list, remove } = makeService();
        const activePath = `${ownerId}/exterior/active.jpg`;
        const orphanPath = `${ownerId}/vehicle/orphan.jpg`;
        const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        prisma.listing.findMany.mockResolvedValue([
            {
                images: [
                    `${supabaseUrl}/storage/v1/object/public/listings/${activePath}#cm-photo=cover,50,50,1.00,EXTERIOR`,
                ],
            },
        ]);

        list.mockImplementation(async (prefix: string) => {
            if (prefix === '') {
                return {
                    data: [
                        { name: ownerId, id: null },
                        { name: 'blog', id: null },
                    ],
                    error: null,
                };
            }
            if (prefix === `${ownerId}/exterior`) {
                return {
                    data: [
                        { name: 'active.jpg', id: 'active-object', created_at: oldDate },
                    ],
                    error: null,
                };
            }
            if (prefix === `${ownerId}/vehicle`) {
                return {
                    data: [
                        { name: 'orphan.jpg', id: 'orphan-object', created_at: oldDate },
                    ],
                    error: null,
                };
            }
            return { data: [], error: null };
        });

        await service.handleCron();

        expect(list).toHaveBeenCalledWith(
            '',
            expect.objectContaining({ limit: 1000, offset: 0 }),
        );
        expect(list).toHaveBeenCalledWith(
            `${ownerId}/exterior`,
            expect.objectContaining({ limit: 1000, offset: 0 }),
        );
        expect(list).not.toHaveBeenCalledWith(
            'blog',
            expect.anything(),
        );
        expect(remove).toHaveBeenCalledWith([orphanPath]);
        expect(remove).not.toHaveBeenCalledWith(
            expect.arrayContaining([activePath]),
        );
    });

    it('does not delete unreferenced uploads until the 24 hour grace period has elapsed', async () => {
        const { service, prisma, list, remove } = makeService();
        prisma.listing.findMany.mockResolvedValue([]);

        list.mockImplementation(async (prefix: string) => {
            if (prefix === '') {
                return { data: [{ name: ownerId, id: null }], error: null };
            }
            if (prefix === `${ownerId}/damage`) {
                return {
                    data: [{
                        name: 'fresh.jpg',
                        id: 'fresh-object',
                        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    }],
                    error: null,
                };
            }
            return { data: [], error: null };
        });

        await service.handleCron();

        expect(remove).not.toHaveBeenCalled();
    });

    it('paginates large owner folders instead of silently cleaning only the first 1000 objects', async () => {
        const { service, prisma, list, remove } = makeService();
        prisma.listing.findMany.mockResolvedValue([]);

        const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const firstPage = Array.from({ length: 1000 }, (_, index) => ({
            name: `page1-${index}.jpg`,
            id: `page1-${index}`,
            created_at: oldDate,
        }));

        list.mockImplementation(async (prefix: string, options: { offset: number }) => {
            if (prefix === '') return { data: [{ name: ownerId, id: null }], error: null };
            if (prefix !== `${ownerId}/vehicle`) return { data: [], error: null };
            if (options.offset === 0) return { data: firstPage, error: null };
            if (options.offset === 1000) {
                return {
                    data: [{ name: 'page2.jpg', id: 'page2', created_at: oldDate }],
                    error: null,
                };
            }
            return { data: [], error: null };
        });

        await service.handleCron();

        expect(list).toHaveBeenCalledWith(
            `${ownerId}/vehicle`,
            expect.objectContaining({ offset: 1000 }),
        );
        expect(remove).toHaveBeenCalledTimes(11);
    });
});
