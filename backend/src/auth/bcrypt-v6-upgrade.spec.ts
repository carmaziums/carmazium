import * as bcrypt from 'bcrypt';
import { existsSync, readFileSync } from 'fs';
import { AuthService } from './auth.service';

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({ auth: { getUser: jest.fn() } })),
}));

type SyntheticVector = {
    kind: string;
    password: string;
    digest: string;
    cost: number;
};

function legacyFixture(): SyntheticVector | undefined {
    const path = process.env.BCRYPT_SYNTHETIC_FIXTURE_PATH;
    if (!path || !existsSync(path)) return undefined;
    const fixture = JSON.parse(readFileSync(path, 'utf8')) as {
        testOnly: boolean; libraryVersion: string; entries: SyntheticVector[];
    };
    expect(fixture.testOnly).toBe(true);
    expect(fixture.libraryVersion).toBe('5.1.1');
    return fixture.entries.find((entry) => entry.kind === 'ordinary');
}

function harness() {
    const prisma = {
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
        },
        dealerInvite: { findMany: jest.fn().mockResolvedValue([]) },
        notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const email = { sendWelcomeEmail: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(prisma as any, email as any);
    return { service, prisma, email };
}

function syntheticUser(passwordHash: string, loginAttempts = 0) {
    return {
        id: 'synthetic-test-only-id',
        email: 'synthetic.bcrypt-migration@example.invalid',
        passwordHash,
        firstName: 'Synthetic',
        lastName: 'Tester',
        role: 'BUYER',
        loginAttempts,
        lockoutUntil: null,
    };
}

describe('bcrypt major security upgrade: actual CarMazium authentication flows', () => {
    it('registration stores bcrypt6 hash, preserves cost 12 and removes hash from response', async () => {
        const { service, prisma } = harness();
        const dto = {
            email: 'SYNTHETIC.BCRYPT-MIGRATION@EXAMPLE.INVALID',
            password: 'synthetic-registration-pass#2026',
            firstName: 'Synthetic',
            lastName: 'Tester',
        };
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockImplementation(async ({ data }) =>
            syntheticUser(data.passwordHash));
        const result = await service.register(dto as any);
        const hashed = prisma.user.create.mock.calls[0][0].data.passwordHash as string;
        expect(hashed).toMatch(/^\$2b\$12\$/);
        expect(bcrypt.getRounds(hashed)).toBe(12);
        expect(await bcrypt.compare(dto.password, hashed)).toBe(true);
        expect(result).not.toHaveProperty('passwordHash');
        expect(prisma.user.create.mock.calls[0][0].data.email)
            .toBe('synthetic.bcrypt-migration@example.invalid');
        expect(prisma.dealerInvite.findMany).toHaveBeenCalledTimes(1);
    });

    it('valid bcrypt6 login succeeds, resets lockout count and never returns stored password', async () => {
        const { service, prisma } = harness();
        const password = 'synthetic-current-pass#2026';
        prisma.user.findUnique.mockResolvedValue(syntheticUser(
            await bcrypt.hash(password, 10), 2,
        ));
        const result = await service.login({
            email: 'synthetic.bcrypt-migration@example.invalid', password,
        } as any);
        expect(result).not.toHaveProperty('passwordHash');
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'synthetic-test-only-id' },
            data: { loginAttempts: 0, lockoutUntil: null },
        });
    });

    it('invalid password still increments attempts and enforces the fifth-attempt lockout', async () => {
        const { service, prisma } = harness();
        prisma.user.findUnique.mockResolvedValue(syntheticUser(
            await bcrypt.hash('synthetic-correct-password', 10), 4,
        ));
        await expect(service.login({
            email: 'synthetic.bcrypt-migration@example.invalid',
            password: 'synthetic-WRONG-password',
        } as any)).rejects.toThrow('Invalid email or password');
        const mutation = prisma.user.update.mock.calls[0][0];
        expect(mutation.data.loginAttempts).toBe(5);
        expect(mutation.data.lockoutUntil).toBeInstanceOf(Date);
        expect(mutation.data.lockoutUntil.getTime()).toBeGreaterThan(Date.now());
    });

    it('external Supabase-managed password marker remains excluded from local bcrypt reset', async () => {
        const { service, prisma } = harness();
        prisma.user.findUnique.mockResolvedValue(
            syntheticUser('SUPABASE_EXTERNAL_AUTH'));
        await expect(service.resetPassword('synthetic-test-only-id', {
            oldPassword: 'synthetic-old-password',
            newPassword: 'synthetic-new-password',
        })).rejects.toThrow('external authentication provider');
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    const shouldTestLegacy = !!process.env.BCRYPT_SYNTHETIC_FIXTURE_PATH;
    (shouldTestLegacy ? it : it.skip)(
        'real bcrypt5 synthetic legacy hash logs in, resets with bcrypt6 hash and never rewrites existing hash on login',
        async () => {
            const legacy = legacyFixture();
            expect(legacy).toBeDefined();
            const { service, prisma } = harness();
            prisma.user.findUnique.mockResolvedValue(
                syntheticUser(legacy!.digest));
            const login = await service.login({
                email: 'synthetic.bcrypt-migration@example.invalid',
                password: legacy!.password,
            } as any);
            expect(login).not.toHaveProperty('passwordHash');
            expect(prisma.user.update.mock.calls[0][0].data)
                .toEqual({ loginAttempts: 0, lockoutUntil: null });
            // No forced hash rewrite when the legacy user successfully logs in.
            expect(prisma.user.update.mock.calls[0][0].data)
                .not.toHaveProperty('passwordHash');

            await service.resetPassword('synthetic-test-only-id', {
                oldPassword: legacy!.password,
                newPassword: 'synthetic-password-after-bcrypt6-upgrade',
            });
            const updated = prisma.user.update.mock.calls[1][0];
            expect(updated.data.passwordHash).toMatch(/^\$2b\$12\$/);
            expect(await bcrypt.compare('synthetic-password-after-bcrypt6-upgrade',
                updated.data.passwordHash)).toBe(true);
            expect(await bcrypt.compare(legacy!.password,
                updated.data.passwordHash)).toBe(false);
        });
});
