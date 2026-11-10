import { MaziumSupportDispatcher } from './mazium-support-dispatcher.service';
import { SupportMessageEvents } from '../chat/support-message-events';

describe('support dispatcher', () => {
    const botId = 'e641510d-0b2c-4eb1-96c6-8874bb9e6b53';
    const setup = (settings = {}) => {
        const values = { MAZIUM_SUPPORT_AUTO_REPLY_ENABLED: 'true', MAZIUM_SUPPORT_DISPATCH_ENABLED: 'true', MAZIUM_SUPPORT_BOT_USER_ID: botId, MAZIUM_SUPPORT_AUDIENCE: 'all', ...settings };
        const config = { get: jest.fn(key => values[key]) };
        const bot = { id: botId, email: `mazium-support-${botId}@system.carmazium.invalid`, role: 'BUYER', deletedAt: null, lockoutUntil: new Date('9999-01-01') };
        const prisma: any = { user: { upsert: jest.fn().mockResolvedValue(bot), findUnique: jest.fn().mockResolvedValue(bot) },
            $queryRaw: jest.fn(), message: { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn().mockResolvedValue([]) } };
        prisma.$transaction = jest.fn(fn => fn(prisma));
        const auto = { inspect: jest.fn().mockResolvedValue({ eligible: true, customerId: 'customer', plan: { kind: 'FIXED' } }), processCustomerMessage: jest.fn().mockResolvedValue(true) };
        const events = new SupportMessageEvents();
        const dispatcher = new MaziumSupportDispatcher(config as any, prisma, auto as any, events);
        return { dispatcher, prisma, auto, events };
    };
    it('provisions only a non-interactive non-admin identity and claims new messages once', async () => {
        const { dispatcher, prisma, auto } = setup();
        await dispatcher.onModuleInit();
        const create = prisma.user.upsert.mock.calls[0][0].create;
        expect(create).toMatchObject({ role: 'BUYER', isEmailVerified: false, showPublicProfile: false });
        expect(create.lockoutUntil.getFullYear()).toBe(9999);
        prisma.message.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
        await dispatcher.processOne('room', 'message'); await dispatcher.processOne('room', 'message');
        expect(auto.processCustomerMessage).toHaveBeenCalledTimes(1);
        expect(prisma.message.updateMany.mock.calls[0][0].where.createdAt.gte).toBeInstanceOf(Date);
        dispatcher.onModuleDestroy();
    });
    it('does not expand pilot delivery without explicit all-customer rollout', async () => {
        const { dispatcher, auto, prisma } = setup({ MAZIUM_SUPPORT_AUDIENCE: 'test' });
        await dispatcher.onModuleInit(); await dispatcher.processOne('room', 'message'); await dispatcher.dispatch();
        expect(auto.processCustomerMessage).not.toHaveBeenCalled(); expect(prisma.message.findMany).not.toHaveBeenCalled();
        dispatcher.onModuleDestroy();
    });
    it('recovers missed events only from fresh official support customer messages', async () => {
        const { dispatcher, prisma } = setup(); await dispatcher.onModuleInit(); await dispatcher.dispatch();
        expect(prisma.message.findMany.mock.calls[0][0].where).toMatchObject({ aiGenerated: false, sender: { role: { not: 'ADMIN' } }, chatRoom: { context: 'SUPPORT', deletedAt: null, supportClosedAt: null } });
        dispatcher.onModuleDestroy();
    });
});
