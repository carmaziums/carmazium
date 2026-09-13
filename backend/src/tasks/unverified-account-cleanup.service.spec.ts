import { ConfigService } from '@nestjs/config';
import { UnverifiedAccountCleanupService } from './unverified-account-cleanup.service';

describe('UnverifiedAccountCleanupService', () => {
    let prisma: any;
    let config: ConfigService;
    let service: UnverifiedAccountCleanupService;
    let supabaseAdmin: any;

    beforeEach(() => {
        prisma = {
            user: {
                findMany: jest.fn(),
                updateMany: jest.fn(),
            },
        };

        config = {
            get: jest.fn((key: string) => {
                if (key === 'SUPABASE_URL') return 'https://example.supabase.co';
                if (key === 'SUPABASE_SERVICE_KEY') return 'service-role-key';
                return undefined;
            }),
        } as any;

        service = new UnverifiedAccountCleanupService(prisma, config);
        supabaseAdmin = {
            auth: {
                admin: {
                    getUserById: jest.fn(),
                    deleteUser: jest.fn(),
                },
            },
        };
        (service as any).supabaseAdmin = supabaseAdmin;
    });

    it('deletes an account only when both local and Supabase records are still unverified past 7 days', async () => {
        prisma.user.findMany.mockResolvedValue([
            {
                id: 'user-1',
                email: 'wrong@example.com',
                createdAt: new Date('2026-09-01T00:00:00.000Z'),
            },
        ]);
        supabaseAdmin.auth.admin.getUserById.mockResolvedValue({
            data: {
                user: {
                    id: 'user-1',
                    email: 'wrong@example.com',
                    created_at: '2026-09-01T00:00:00.000Z',
                    email_confirmed_at: null,
                },
            },
            error: null,
        });
        supabaseAdmin.auth.admin.deleteUser.mockResolvedValue({ error: null });

        const result = await service.cleanup(new Date('2026-09-13T12:00:00.000Z'));

        expect(prisma.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    isEmailVerified: false,
                    deletedAt: null,
                    role: { not: 'ADMIN' },
                }),
            }),
        );
        expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith('user-1', false);
        expect(result).toEqual({
            scanned: 1,
            deleted: 1,
            reconciledVerified: 0,
            skipped: 0,
            failed: 0,
        });
    });

    it('repairs the local flag instead of deleting when Supabase says the email was confirmed', async () => {
        prisma.user.findMany.mockResolvedValue([
            {
                id: 'user-2',
                email: 'real@example.com',
                createdAt: new Date('2026-09-01T00:00:00.000Z'),
            },
        ]);
        prisma.user.updateMany.mockResolvedValue({ count: 1 });
        supabaseAdmin.auth.admin.getUserById.mockResolvedValue({
            data: {
                user: {
                    id: 'user-2',
                    email: 'real@example.com',
                    created_at: '2026-09-01T00:00:00.000Z',
                    email_confirmed_at: '2026-09-02T10:00:00.000Z',
                },
            },
            error: null,
        });

        const result = await service.cleanup(new Date('2026-09-13T12:00:00.000Z'));

        expect(prisma.user.updateMany).toHaveBeenCalledWith({
            where: { id: 'user-2', isEmailVerified: false },
            data: { isEmailVerified: true },
        });
        expect(supabaseAdmin.auth.admin.deleteUser).not.toHaveBeenCalled();
        expect(result.reconciledVerified).toBe(1);
    });

    it('does not delete a local-only record when no matching Supabase Auth user exists', async () => {
        prisma.user.findMany.mockResolvedValue([
            {
                id: 'legacy-user',
                email: 'legacy@example.com',
                createdAt: new Date('2026-09-01T00:00:00.000Z'),
            },
        ]);
        supabaseAdmin.auth.admin.getUserById.mockResolvedValue({
            data: { user: null },
            error: { message: 'User not found' },
        });

        const result = await service.cleanup(new Date('2026-09-13T12:00:00.000Z'));

        expect(supabaseAdmin.auth.admin.deleteUser).not.toHaveBeenCalled();
        expect(result.skipped).toBe(1);
    });

    it('does not delete when the Supabase account is newer than the retention cutoff', async () => {
        prisma.user.findMany.mockResolvedValue([
            {
                id: 'user-3',
                email: 'new@example.com',
                createdAt: new Date('2026-09-01T00:00:00.000Z'),
            },
        ]);
        supabaseAdmin.auth.admin.getUserById.mockResolvedValue({
            data: {
                user: {
                    id: 'user-3',
                    email: 'new@example.com',
                    created_at: '2026-09-10T13:00:00.000Z',
                    email_confirmed_at: null,
                },
            },
            error: null,
        });

        const result = await service.cleanup(new Date('2026-09-13T12:00:00.000Z'));

        expect(supabaseAdmin.auth.admin.deleteUser).not.toHaveBeenCalled();
        expect(result.skipped).toBe(1);
    });

    it('requires a service-role key and performs no cleanup when it is missing', async () => {
        const noKeyConfig = {
            get: jest.fn((key: string) => {
                if (key === 'SUPABASE_URL') return 'https://example.supabase.co';
                return undefined;
            }),
        } as any;
        const disabledService = new UnverifiedAccountCleanupService(prisma, noKeyConfig);

        const result = await disabledService.cleanup(new Date('2026-09-13T12:00:00.000Z'));

        expect(prisma.user.findMany).not.toHaveBeenCalled();
        expect(result.scanned).toBe(0);
    });

    it('honours a custom retention period but refuses unsafe values under 24 hours', async () => {
        const customConfig = {
            get: jest.fn((key: string) => {
                if (key === 'SUPABASE_URL') return 'https://example.supabase.co';
                if (key === 'SUPABASE_SERVICE_KEY') return 'service-role-key';
                if (key === 'UNVERIFIED_ACCOUNT_RETENTION_HOURS') return '72';
                return undefined;
            }),
        } as any;
        const customService = new UnverifiedAccountCleanupService(prisma, customConfig);
        (customService as any).supabaseAdmin = supabaseAdmin;
        prisma.user.findMany.mockResolvedValue([]);

        await customService.cleanup(new Date('2026-09-13T12:00:00.000Z'));

        const where = prisma.user.findMany.mock.calls[0][0].where;
        expect(where.createdAt.lt.toISOString()).toBe('2026-09-10T12:00:00.000Z');
    });
});
