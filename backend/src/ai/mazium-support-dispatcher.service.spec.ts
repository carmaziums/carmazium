import { MaziumSupportDispatcher } from './mazium-support-dispatcher.service';
import { SupportMessageEvents } from '../chat/support-message-events';

describe('support dispatcher', () => {
    const botId = 'e641510d-0b2c-4eb1-96c6-8874bb9e6b53';
    const setup = (settings = {}) => {
        const values = { MAZIUM_SUPPORT_AUTO_REPLY_ENABLED: 'true', MAZIUM_SUPPORT_DISPATCH_ENABLED: 'true', MAZIUM_SUPPORT_BOT_USER_ID: botId, MAZIUM_SUPPORT_AUDIENCE: 'all', OPENAI_API_KEY: 'synthetic-test-key', ...settings };
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
    it('can recover a recent explicit human request that predates process startup', async () => {
        const { dispatcher, prisma, auto } = setup();
        await dispatcher.onModuleInit();
        auto.inspect.mockResolvedValue({
            eligible: true, customerId: 'customer',
            content: "I'd like to speak to a human support agent, please.",
            plan: { kind: 'FIXED' },
        });
        await dispatcher.processOne('room', 'handoff');
        const earliest = prisma.message.updateMany.mock.calls[0][0].where.createdAt.gte as Date;
        expect(Date.now() - earliest.getTime()).toBeGreaterThan(23 * 60 * 60 * 1000);
        expect(auto.processCustomerMessage).toHaveBeenCalledTimes(1);
        dispatcher.onModuleDestroy();
    });
    it('recovers recent handoffs from the database without replaying unrelated old messages', async () => {
        const { dispatcher, prisma, auto } = setup();
        await dispatcher.onModuleInit();
        prisma.message.findMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                { id: 'handoff', chatRoomId: 'room', content: "I'd like to speak to a human support agent, please." },
                { id: 'unrelated', chatRoomId: 'room', content: 'How much to list?' },
            ]);
        auto.inspect.mockResolvedValue({
            eligible: true, customerId: 'customer',
            content: "I'd like to speak to a human support agent, please.",
            plan: { kind: 'FIXED' },
        });
        await dispatcher.dispatch();
        expect(prisma.message.findMany).toHaveBeenCalledTimes(2);
        expect(prisma.message.findMany.mock.calls[1][0].where.chatRoom.supportAiOptedOutAt).toEqual({ not: null });
        expect(auto.processCustomerMessage).toHaveBeenCalledTimes(1);
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
    it('exposes ready only after a successful scheduled worker poll', async () => {
        const { dispatcher } = setup();
        await dispatcher.onModuleInit();
        expect((await dispatcher.publicHealth()).status).toBe('POLL_NOT_STARTED');
        await dispatcher.dispatch();
        expect(await dispatcher.publicHealth()).toEqual({
            ready: true, status: 'READY', fixedRepliesAvailable: true, pollFailureCode: null,
        });
        dispatcher.onModuleDestroy();
    });
    it('shows a disabled worker as unavailable without exposing secret values', async () => {
        const { dispatcher } = setup({ MAZIUM_SUPPORT_DISPATCH_ENABLED: 'false' });
        await dispatcher.onModuleInit();
        expect(await dispatcher.publicHealth()).toEqual({
            ready: false, status: 'DISABLED', fixedRepliesAvailable: true, pollFailureCode: null,
        });
        dispatcher.onModuleDestroy();
    });

});
