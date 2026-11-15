import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const integration = process.env.TRADE_POSTGRES_TEST === '1' ? describe : describe.skip;
integration('Account introduction with disposable PostgreSQL', () => {
    let prisma: PrismaService;
    let service: UsersService;
    const ids: string[] = [];
    beforeAll(async () => {
        if (!process.env.DATABASE_URL?.includes('@127.0.0.1:5432/carmazium_damage_qa')) throw new Error('Requires the disposable CI PostgreSQL database');
        prisma = new PrismaService();
        service = new UsersService(prisma, {} as any, { get: () => undefined } as any);
        for (let i = 0; i < 2; i++) {
            const user = await prisma.user.create({ data: { email: `intro-${randomUUID()}@invalid.example`, passwordHash: 'synthetic-only', preferences: { theme: 'dark', nested: { keep: true } } } });
            ids.push(user.id);
        }
    });
    afterAll(async () => {
        if (!prisma) return;
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
        await prisma.$disconnect();
    });
    it('persists skip across profile reads without touching other accounts or verification', async () => {
        await service.updateIntroduction(ids[0], 'tour_skipped');
        const current = await service.getProfile(ids[0]);
        expect(current.preferences).toMatchObject({ theme: 'dark', nested: { keep: true }, websiteIntroductionV1: { status: 'skipped', version: 1 } });
        expect(current.role).toBe('BUYER');
        expect(current.isAddressVerified).toBe(false);
        expect((await service.getProfile(ids[1])).preferences).toEqual({ theme: 'dark', nested: { keep: true } });
    });
    it('concurrent tour completion and notice dismissal preserve both choices and existing preferences', async () => {
        await Promise.all([service.updateIntroduction(ids[0], 'tour_completed'), service.updateIntroduction(ids[0], 'services_dismissed')]);
        expect((await service.getProfile(ids[0])).preferences).toMatchObject({ theme: 'dark', nested: { keep: true }, websiteIntroductionV1: { status: 'completed' }, dealerServicesNoticeV1: { status: 'dismissed' } });
    });
    it('reviewing settings persists the notice acknowledgement, including null preferences', async () => {
        await prisma.$executeRaw`UPDATE users SET preferences = NULL WHERE id = ${ids[1]}`;
        await service.updateIntroduction(ids[1], 'services_viewed');
        expect((await service.getProfile(ids[1])).preferences).toMatchObject({ dealerServicesNoticeV1: { status: 'viewed' } });
    });
    it('rollout 2 persists across reads and old clients cannot acknowledge it or erase it', async () => {
        await service.updateIntroduction(ids[0], 'tour_skipped', 2);
        await service.updateIntroduction(ids[0], 'tour_completed');
        expect((await service.getProfile(ids[0])).preferences).toMatchObject({ theme: 'dark', websiteIntroductionV1: { status: 'completed', version: 1 }, websiteIntroductionV2: { status: 'skipped', version: 2 } });
        await service.updateIntroduction(ids[0], 'tour_completed', 2);
        expect((await service.getProfile(ids[0])).preferences).toMatchObject({ websiteIntroductionV2: { status: 'completed', version: 2 } });
    });
    it('claims new-account onboarding once under concurrent signup with real unique constraints', async () => {
        const email = `signup-race-${randomUUID()}@invalid.example`;
        const emailService = { sendWelcomeEmail: jest.fn().mockResolvedValue({ id: 'synthetic-mail' }) };
        const signup = new UsersService(prisma, emailService as any, { get: () => undefined } as any);
        const originalFind = prisma.user.findUnique.bind(prisma.user);
        let arrivals = 0;
        let release: () => void;
        const ready = new Promise<void>(resolve => { release = resolve; });
        const lookup = jest.spyOn(prisma.user as any, 'findUnique').mockImplementation(async (args: any) => {
            if (args.where.email === email && arrivals < 10) {
                arrivals++;
                if (arrivals === 10) release();
                await ready;
                return null;
            }
            return originalFind(args);
        });
        try {
            const results = await Promise.all(Array.from({ length: 10 }, () => signup.syncUser({ email })));
            ids.push(results[0].user.id);
            expect(results.filter(result => result.isNewUser)).toHaveLength(1);
            expect(new Set(results.map(result => result.user.id)).size).toBe(1);
            expect(emailService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
            // Onboarding notification is deliberately asynchronous.
            for (let attempt = 0; attempt < 40; attempt++) {
                if (await prisma.notification.count({ where: { userId: results[0].user.id, type: 'ACCOUNT_WELCOME' } })) break;
                await new Promise(resolve => setTimeout(resolve, 25));
            }
            expect(await prisma.notification.count({ where: { userId: results[0].user.id, type: 'ACCOUNT_WELCOME' } })).toBe(1);
        } finally {
            lookup.mockRestore();
        }
    });
    it('never modifies a deleted account', async () => {
        await prisma.user.update({ where: { id: ids[1] }, data: { deletedAt: new Date() } });
        await expect(service.updateIntroduction(ids[1], 'tour_completed')).rejects.toThrow('User not found');
    });
});
