import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';

describe('website introduction preferences', () => {
    const setup = () => {
        const prisma = { $executeRaw: jest.fn().mockResolvedValue(1) };
        return { prisma, service: new UsersService(prisma as any, {} as any, { get: () => undefined } as any) };
    };
    it.each([undefined, null, {}, [], 'approved', 'services_enabled', 'tour_reset'])('rejects unsupported action %p without writes', async action => {
        const { prisma, service } = setup();
        await expect(service.updateIntroduction('user-a', action)).rejects.toThrow('Unknown introduction action');
        expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
    it.each([
        ['tour_skipped', 'websiteIntroductionV1', 'skipped'],
        ['tour_completed', 'websiteIntroductionV1', 'completed'],
        ['services_dismissed', 'dealerServicesNoticeV1', 'dismissed'],
        ['services_viewed', 'dealerServicesNoticeV1', 'viewed'],
    ])('stores only the %s preference for the authenticated account', async (action, key, status) => {
        const { prisma, service } = setup();
        await service.updateIntroduction('user-a', action);
        const [, patch, identity] = prisma.$executeRaw.mock.calls[0];
        expect(identity).toBe('user-a');
        const parsed = JSON.parse(patch);
        expect(Object.keys(parsed)).toEqual([key]);
        expect(parsed[key].status).toBe(status);
        expect(Number.isFinite(Date.parse(parsed[key].updatedAt))).toBe(true);
    });
    it('does not report successful persistence for deleted or missing accounts', async () => {
        const { prisma, service } = setup();
        prisma.$executeRaw.mockResolvedValue(0);
        await expect(service.updateIntroduction('missing', 'tour_skipped')).rejects.toThrow('User not found');
    });
    it('guards the endpoint and ignores a user ID supplied in the request body', async () => {
        const service = { updateIntroduction: jest.fn().mockResolvedValue({ saved: true }) };
        const controller = new UsersController(service as any, {} as any);
        const guards = Reflect.getMetadata('__guards__', controller.updateIntroduction);
        expect(guards).toContain(SessionAuthGuard);
        await controller.updateIntroduction({ id: 'authenticated-user' }, { action: 'tour_skipped', userId: 'other-user', isVerified: true } as any);
        expect(service.updateIntroduction).toHaveBeenCalledWith('authenticated-user', 'tour_skipped');
    });
});
