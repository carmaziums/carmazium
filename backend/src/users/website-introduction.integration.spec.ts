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
    it('never modifies a deleted account', async () => {
        await prisma.user.update({ where: { id: ids[1] }, data: { deletedAt: new Date() } });
        await expect(service.updateIntroduction(ids[1], 'tour_completed')).rejects.toThrow('User not found');
    });
});
