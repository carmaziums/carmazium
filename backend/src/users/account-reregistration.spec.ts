import { BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AdminService } from '../admin/admin.service';
import { SELF_DELETED_PASSWORD_MARKER, isSelfDeletedAccount } from './account-deletion';

// Owner rule (31 Oct 2026): someone who deleted their own account can sign up
// again later with the same email. An admin ban still keeps a person out.

const supabaseUser = (id: string, email: string) => ({
    data: { user: { id, email, email_confirmed_at: '2026-10-31T12:00:00Z', user_metadata: {} } },
    error: null,
});

function makeAuth(prisma: any, getUser: any, deleteUser = jest.fn().mockResolvedValue({ error: null })) {
    const service = new AuthService(prisma, { sendWelcomeEmail: jest.fn().mockResolvedValue(undefined) } as any);
    (service as any).supabase = { auth: { getUser, admin: { deleteUser } } };
    jest.spyOn(service as any, 'verifyTokenLocally').mockResolvedValue(null);
    jest.spyOn(service as any, 'processPendingInvitations').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'sendNewAccountOnboarding').mockImplementation(() => undefined);
    return { service, deleteUser };
}

describe('re-registering after deleting an account', () => {
    it('creates a fresh account for the same email once the old one was deleted', async () => {
        // Deletion anonymised the old row's email and removed its sign-in
        // identity, so the new sign-up has a new id and no matching local row.
        const created = { id: 'new-auth-id', email: 'sam@example.com', deletedAt: null, passwordHash: 'SUPABASE_EXTERNAL_AUTH' };
        const prisma: any = {
            user: {
                findUnique: jest.fn().mockResolvedValue(null),
                upsert: jest.fn().mockResolvedValue(created),
                update: jest.fn(),
            },
        };
        const { service } = makeAuth(prisma, jest.fn().mockResolvedValue(supabaseUser('new-auth-id', 'Sam@Example.com')));
        const result: any = await service.verifySupabaseToken('token');
        expect(result?.id).toBe('new-auth-id');
        expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { email: 'sam@example.com' },
            create: expect.objectContaining({ id: 'new-auth-id', email: 'sam@example.com' }),
        }));
    });

    it('releases a leftover sign-in identity of a self-deleted account so the email can register again', async () => {
        const oldRow = { id: 'old-auth-id', email: 'deleted-old-auth-id@deleted.carmazium.com', deletedAt: new Date(), passwordHash: SELF_DELETED_PASSWORD_MARKER, isEmailVerified: true };
        const prisma: any = { user: { findUnique: jest.fn().mockResolvedValueOnce(oldRow), upsert: jest.fn(), update: jest.fn() } };
        const { service, deleteUser } = makeAuth(prisma, jest.fn().mockResolvedValue(supabaseUser('old-auth-id', 'sam@example.com')));
        expect(await service.verifySupabaseToken('token')).toBeNull();
        expect(deleteUser).toHaveBeenCalledWith('old-auth-id');
        expect(prisma.user.upsert).not.toHaveBeenCalled();
    });

    it('never releases the sign-in identity of an admin-banned account', async () => {
        const banned = { id: 'banned-id', email: 'ban@example.com', deletedAt: new Date(), passwordHash: 'SUPABASE_EXTERNAL_AUTH', isEmailVerified: true };
        const prisma: any = { user: { findUnique: jest.fn().mockResolvedValueOnce(banned), upsert: jest.fn(), update: jest.fn() } };
        const { service, deleteUser } = makeAuth(prisma, jest.fn().mockResolvedValue(supabaseUser('banned-id', 'ban@example.com')));
        expect(await service.verifySupabaseToken('token')).toBeNull();
        expect(deleteUser).not.toHaveBeenCalled();
    });
});

describe('admin Unban on deleted accounts', () => {
    const makeAdmin = (user: any) => {
        const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn().mockResolvedValue({ ...user, deletedAt: null }) } };
        const service = new AdminService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
        return { service, prisma };
    };

    it('refuses to revive a self-deleted (anonymised) account', async () => {
        const { service, prisma } = makeAdmin({ id: 'u1', deletedAt: new Date(), passwordHash: SELF_DELETED_PASSWORD_MARKER });
        await expect(service.unbanUser('u1')).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('still unbans an admin-banned account', async () => {
        const { service, prisma } = makeAdmin({ id: 'u2', deletedAt: new Date(), passwordHash: 'SUPABASE_EXTERNAL_AUTH' });
        await service.unbanUser('u2');
        expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u2' }, data: { deletedAt: null } });
    });

    it('tells self-deletion apart from a ban', () => {
        expect(isSelfDeletedAccount({ deletedAt: new Date(), passwordHash: SELF_DELETED_PASSWORD_MARKER })).toBe(true);
        expect(isSelfDeletedAccount({ deletedAt: new Date(), passwordHash: 'x' })).toBe(false);
        expect(isSelfDeletedAccount({ deletedAt: null, passwordHash: SELF_DELETED_PASSWORD_MARKER })).toBe(false);
    });
});
