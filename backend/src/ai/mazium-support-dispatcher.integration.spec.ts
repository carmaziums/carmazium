import { randomUUID } from 'node:crypto';
import { ChatContext, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupportMessageEvents } from '../chat/support-message-events';
import { MaziumSupportDispatcher } from './mazium-support-dispatcher.service';

const integration = process.env.TRADE_POSTGRES_TEST === '1' ? describe : describe.skip;

integration('support dispatcher processes real PostgreSQL messages', () => {
    let prisma: PrismaService;
    const ids: string[] = [];
    const roomIds: string[] = [];

    beforeAll(async () => {
        if (!process.env.DATABASE_URL?.includes('@127.0.0.1:5432/carmazium_damage_qa')) {
            throw new Error('Use disposable local PostgreSQL for support dispatcher tests');
        }
        prisma = new PrismaService();
    });

    afterAll(async () => {
        if (!prisma) return;
        await prisma.message.deleteMany({ where: { chatRoomId: { in: roomIds } } });
        await prisma.chatRoom.deleteMany({ where: { id: { in: roomIds } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
        await prisma.$disconnect();
    });

    it('claims and processes an eligible dealer message instead of silently dropping it', async () => {
        const admin = await prisma.user.create({
            data: { email: `ai-poll-admin-${randomUUID()}@invalid.example`, passwordHash: '!TEST!', role: UserRole.ADMIN },
        });
        const dealer = await prisma.user.create({
            data: { email: `ai-poll-dealer-${randomUUID()}@invalid.example`, passwordHash: '!TEST!', role: UserRole.DEALER },
        });
        ids.push(admin.id, dealer.id);
        const botId = randomUUID();
        ids.push(botId);
        const config: Record<string, string> = {
            MAZIUM_SUPPORT_AUTO_REPLY_ENABLED: 'true',
            MAZIUM_SUPPORT_DISPATCH_ENABLED: 'true',
            MAZIUM_SUPPORT_AUDIENCE: 'all',
            MAZIUM_SUPPORT_BOT_USER_ID: botId,
            OPENAI_API_KEY: 'SYNTHETIC_TEST_KEY',
        };
        const autoReply = {
            inspect: jest.fn().mockImplementation(async (_roomId: string, _msgId: string) => ({
                eligible: true, customerId: dealer.id, plan: { kind: 'FIXED' },
                content: 'hi can you help me',
            })),
            processCustomerMessage: jest.fn().mockResolvedValue(true),
        };
        const dispatcher = new MaziumSupportDispatcher({
            get: (key: string) => config[key],
        } as any, prisma, autoReply as any, new SupportMessageEvents());

        await dispatcher.onModuleInit();
        const room = await prisma.chatRoom.create({
            data: { initiatorId: admin.id, participantId: dealer.id, context: ChatContext.SUPPORT,
                conversationKey: `SUPPORT:worker-qa:${randomUUID()}` },
        });
        roomIds.push(room.id);
        const message = await prisma.message.create({
            data: { chatRoomId: room.id, senderId: dealer.id, content: 'hi can you help me' },
        });
        await dispatcher.dispatch();
        const saved = await prisma.message.findUniqueOrThrow({ where: { id: message.id } });
        expect(saved.aiSupportAttemptedAt).not.toBeNull();
        expect(autoReply.processCustomerMessage).toHaveBeenCalledWith(room.id, message.id, true);
        expect(await dispatcher.publicHealth()).toMatchObject({
            ready: true, status: 'READY', fixedRepliesAvailable: true, pollFailureCode: null,
            assistantVersion: 'context-tools-v1', configuredModel: 'gpt-6.2-sol',
        });
        dispatcher.onModuleDestroy();
    });
});
