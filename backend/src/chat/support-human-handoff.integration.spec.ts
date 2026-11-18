import { randomUUID } from 'node:crypto';
import { ChatContext, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';
import { HUMAN_HANDOFF_REPLY } from './support-automatic-responses';

const integration = process.env.TRADE_POSTGRES_TEST === '1' ? describe : describe.skip;

integration('human-support request and receipt with disposable PostgreSQL', () => {
    let prisma: PrismaService;
    let service: ChatService;
    const roomIds: string[] = [];
    const userIds: string[] = [];
    const customers = new Map<UserRole, string>();
    let adminId: string;
    let botId: string;
    const previousBotId = process.env.MAZIUM_SUPPORT_BOT_USER_ID;

    beforeAll(async () => {
        if (!process.env.DATABASE_URL?.includes('@127.0.0.1:5432/carmazium_damage_qa')) {
            throw new Error('Human-support integration tests require disposable local PostgreSQL');
        }
        prisma = new PrismaService();
        const makeUser = async (role: UserRole, locked = false) => {
            const user = await prisma.user.create({
                data: {
                    email: `handoff-${randomUUID()}@invalid.example`,
                    passwordHash: '!SYNTHETIC_TEST!',
                    role,
                    ...(locked ? { lockoutUntil: new Date('9999-12-31T00:00:00.000Z') } : {}),
                },
            });
            userIds.push(user.id);
            return user.id;
        };
        adminId = await makeUser(UserRole.ADMIN);
        botId = await makeUser(UserRole.BUYER, true);
        process.env.MAZIUM_SUPPORT_BOT_USER_ID = botId;
        for (const role of [UserRole.BUYER, UserRole.SELLER, UserRole.DEALER]) {
            customers.set(role, await makeUser(role));
        }
        service = new ChatService(prisma, {} as any, {} as any, {} as any,
            {} as any, {} as any, { assertAllowedText: jest.fn() } as any);
        // Only unrelated routing and notifications are mocked. The request and
        // receipt both use real Prisma transactions, constraints and messages.
        jest.spyOn(service, 'assertCanMessageRoom').mockImplementation(async (roomId: string) => {
            const room = await prisma.chatRoom.findUniqueOrThrow({
                where: { id: roomId },
                include: { initiator: { select: { role: true } }, participant: { select: { role: true } } },
            });
            return room as any;
        });
        jest.spyOn(service as any, 'resolveMessageRouting').mockResolvedValue({
            recipients: [], roomUpdate: {},
        });
        jest.spyOn(service as any, 'notifyMessageRecipients').mockResolvedValue(undefined);
    });

    afterAll(async () => {
        if (!prisma) return;
        await prisma.chatRoom.deleteMany({ where: { id: { in: roomIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        await prisma.$disconnect();
        if (previousBotId === undefined) delete process.env.MAZIUM_SUPPORT_BOT_USER_ID;
        else process.env.MAZIUM_SUPPORT_BOT_USER_ID = previousBotId;
    });

    const roomFor = async (role: UserRole) => {
        const room = await prisma.chatRoom.create({
            data: {
                initiatorId: adminId,
                participantId: customers.get(role)!,
                context: ChatContext.SUPPORT,
                conversationKey: `SUPPORT:handoff:${randomUUID()}`,
            },
        });
        roomIds.push(room.id);
        return room;
    };

    it.each([UserRole.BUYER, UserRole.SELLER, UserRole.DEALER])(
        'saves one customer request and one matching support receipt for a %s',
        async role => {
            const room = await roomFor(role);
            const customerId = customers.get(role)!;
            const key = randomUUID();
            const result = await service.sendMessage(room.id, customerId, {
                content: "I'd like to speak to a human support agent, please.",
                clientMessageId: key,
            });
            expect(result.created).toBe(true);
            expect(result.automaticReply?.content).toBe(HUMAN_HANDOFF_REPLY);
            const saved = await prisma.message.findMany({
                where: { chatRoomId: room.id },
                orderBy: { createdAt: 'asc' },
            });
            expect(saved).toHaveLength(2);
            expect(saved[0].senderId).toBe(customerId);
            expect(saved[1]).toMatchObject({
                senderId: botId,
                aiGenerated: true,
                aiSourceMessageId: saved[0].id,
                content: HUMAN_HANDOFF_REPLY,
            });
            const preferences = await prisma.chatRoom.findUniqueOrThrow({ where: { id: room.id } });
            expect(preferences.supportAiOptedOutAt).not.toBeNull();
            expect(preferences.supportHumanTakeoverAt).not.toBeNull();
            const retry = await service.sendMessage(room.id, customerId, {
                content: "I'd like to speak to a human support agent, please.",
                clientMessageId: key,
            });
            expect(retry.created).toBe(false);
            expect(await prisma.message.count({ where: { chatRoomId: room.id } })).toBe(2);
        },
    );

    it('rolls back both messages and opt-out if the trusted bot identity is missing', async () => {
        const room = await roomFor(UserRole.BUYER);
        const original = process.env.MAZIUM_SUPPORT_BOT_USER_ID;
        process.env.MAZIUM_SUPPORT_BOT_USER_ID = randomUUID();
        try {
            await expect(service.sendMessage(room.id, customers.get(UserRole.BUYER)!, {
                content: 'Please connect me with a human support agent.',
                clientMessageId: randomUUID(),
            })).rejects.toThrow('Human support receipt is temporarily unavailable');
            expect(await prisma.message.count({ where: { chatRoomId: room.id } })).toBe(0);
            const updated = await prisma.chatRoom.findUniqueOrThrow({ where: { id: room.id } });
            expect(updated.supportAiOptedOutAt).toBeNull();
        } finally {
            process.env.MAZIUM_SUPPORT_BOT_USER_ID = original;
        }
    });

    it('does not generate an automated receipt to an actual admin message', async () => {
        const room = await roomFor(UserRole.BUYER);
        const result = await service.sendMessage(room.id, adminId, {
            content: 'I am a human support agent.',
            clientMessageId: randomUUID(),
        });
        expect(result.automaticReply).toBeUndefined();
        expect(await prisma.message.count({ where: { chatRoomId: room.id } })).toBe(1);
    });
});
