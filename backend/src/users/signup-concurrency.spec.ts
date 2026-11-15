import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '@prisma/client';

const input = { id: 'signup-user', email: 'New@Example.com ', firstName: 'New', role: UserRole.DEALER };
const uniqueConflict = () => Object.assign(new Error('Unique constraint'), { code: 'P2002' });

function setup() {
    let row: any = null;
    // The first two email reads both see no account, reproducing the stale-read race.
    let initialReads = 0;
    let release: () => void;
    const ready = new Promise<void>(resolve => { release = resolve; });
    const prisma: any = {
        user: {
            findUnique: jest.fn(async ({ where }: any) => {
                if (where.email && initialReads < 2) {
                    initialReads++;
                    if (initialReads === 2) release();
                    await ready;
                    return null;
                }
                return row && (where.email === row.email || where.id === row.id) ? { ...row } : null;
            }),
            create: jest.fn(async ({ data }: any) => {
                if (row) throw uniqueConflict();
                row = { role: 'BUYER', isEmailVerified: true, deletedAt: null, ...data };
                return { ...row };
            }),
            update: jest.fn(async ({ data }: any) => { row = { ...row, ...data }; return { ...row }; }),
        },
        notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const email = { sendWelcomeEmail: jest.fn().mockResolvedValue({ id: 'mock-mail' }) };
    const users = new UsersService(prisma, email as any, { get: () => undefined } as any);
    const auth = new AuthService(prisma, email as any);
    (auth as any).supabase = { auth: { getUser: jest.fn().mockResolvedValue({
        data: { user: { id: input.id, email: input.email.trim(), email_confirmed_at: '2026-11-15T00:00:00Z', user_metadata: { role: 'BUYER' } } }, error: null,
    }) } };
    jest.spyOn(auth as any, 'verifyTokenLocally').mockResolvedValue(null);
    const invitations = jest.spyOn(auth as any, 'processPendingInvitations').mockResolvedValue(undefined);
    return { prisma, email, users, auth, invitations };
}

describe('signup onboarding concurrency', () => {
    it('sends one welcome and emits one first-registration signal for concurrent syncs', async () => {
        const { prisma, email, users } = setup();
        const results = await Promise.all([users.syncUser(input), users.syncUser(input)]);
        expect(results.filter(result => result.isNewUser)).toHaveLength(1);
        expect(results.map(result => result.user.id)).toEqual([input.id, input.id]);
        expect(email.sendWelcomeEmail).toHaveBeenCalledTimes(1);
        expect(prisma.notification.create).toHaveBeenCalledTimes(1);
        expect((await users.syncUser({ ...input, role: UserRole.BUYER })).isNewUser).toBe(false);
        expect(email.sendWelcomeEmail).toHaveBeenCalledTimes(1);
        expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { firstName: 'New' } }));
    });

    it('shares insert ownership across sync and authenticated auto-provisioning', async () => {
        const { prisma, email, users, auth } = setup();
        const [synced, authenticated] = await Promise.all([users.syncUser(input), auth.verifySupabaseToken('mock-token')]);
        expect(synced.user.id).toBe(input.id);
        expect(authenticated?.id).toBe(input.id);
        expect(email.sendWelcomeEmail).toHaveBeenCalledTimes(1);
        expect(prisma.notification.create).toHaveBeenCalledTimes(1);
        // Neither losing path may change the winner's role from stale metadata.
        for (const [args] of prisma.user.update.mock.calls) expect(args.data).not.toHaveProperty('role');
    });

    it('sends one welcome and processes invitations once for concurrent auth requests', async () => {
        const { prisma, email, auth, invitations } = setup();
        const results = await Promise.all([auth.verifySupabaseToken('one'), auth.verifySupabaseToken('two')]);
        expect(results.map(result => result?.id)).toEqual([input.id, input.id]);
        expect(email.sendWelcomeEmail).toHaveBeenCalledTimes(1);
        expect(prisma.notification.create).toHaveBeenCalledTimes(1);
        expect(invitations).toHaveBeenCalledTimes(1);
    });

    it('does not turn a database failure into a successful registration', async () => {
        const { prisma, email, users } = setup();
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockRejectedValue(new Error('Database unavailable'));
        await expect(users.syncUser(input)).rejects.toThrow('Database unavailable');
        expect(email.sendWelcomeEmail).not.toHaveBeenCalled();
        expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('does not recover an ID conflict when the requested email has no account', async () => {
        const { prisma, email, users } = setup();
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockRejectedValue(uniqueConflict());
        await expect(users.syncUser(input)).rejects.toMatchObject({ code: 'P2002' });
        expect(prisma.user.update).not.toHaveBeenCalled();
        expect(email.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it('still ignores privileged self-service role requests', async () => {
        const { prisma, users } = setup();
        prisma.user.findUnique.mockResolvedValue(null);
        const result = await users.syncUser({ ...input, role: UserRole.ADMIN });
        expect(result.user.role).toBe(UserRole.BUYER);
        expect(prisma.user.create.mock.calls[0][0].data).not.toHaveProperty('role');
    });
});
