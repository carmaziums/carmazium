import { randomUUID } from 'node:crypto';
import { ChatContext, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';
import { HUMAN_HANDOFF_REPLY, HUMAN_REVIEW_REPLY, SUPPORT_HELP_OFFER } from './support-automatic-responses';

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
    const previousAutoReplyEnabled = process.env.MAZIUM_SUPPORT_AUTO_REPLY_ENABLED;

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
        process.env.MAZIUM_SUPPORT_AUTO_REPLY_ENABLED = 'true';
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
        if (previousAutoReplyEnabled === undefined) delete process.env.MAZIUM_SUPPORT_AUTO_REPLY_ENABLED;
        else process.env.MAZIUM_SUPPORT_AUTO_REPLY_ENABLED = previousAutoReplyEnabled;
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

    it('keeps staff review queued across AI follow-ups, then clears on staff reply or closure', async () => {
        const room = await roomFor(UserRole.BUYER);
        const add = (senderId: string, aiGenerated: boolean, content: string, second: number) => prisma.message.create({data:{
            chatRoomId:room.id,senderId,aiGenerated,content,createdAt:new Date(`2026-11-19T01:00:${String(second).padStart(2,'0')}Z`),
        }});
        const pending = async () => (await service.getUserRooms(adminId)).find(r=>r.id===room.id)?.needsReply;
        await add(botId,true,HUMAN_REVIEW_REPLY,1);
        await add(customers.get(UserRole.BUYER)!,false,'How do I edit my advert?',2);
        await add(botId,true,'Open My cars and choose Edit.',3);
        expect(await pending()).toBe(true);
        await add(adminId,false,'I have reviewed your account request.',4);
        expect(await pending()).toBe(false);
        // A customer's copied escalation receipt cannot create a pending staff
        // review after their next ordinary question has been answered by AI.
        await add(customers.get(UserRole.BUYER)!,false,HUMAN_REVIEW_REPLY,5);
        await add(botId,true,'Here are the listing steps.',6);
        expect(await pending()).toBe(false);
        await add(botId,true,HUMAN_HANDOFF_REPLY,7);
        await add(botId,true,'Here are some more listing steps.',8);
        expect(await pending()).toBe(true);
        await prisma.chatRoom.update({where:{id:room.id},data:{supportClosedAt:new Date()}});
        expect(await pending()).toBe(false);
    });

    it.each([UserRole.BUYER, UserRole.SELLER, UserRole.DEALER])(
        'saves one customer request and one matching support receipt for a %s',
        async role => {
            const room = await roomFor(role);
            const customerId = customers.get(role)!;
            const key = randomUUID();
            const result = await service.sendMessage(room.id, customerId, {
                content: "I still want to speak to a human support agent, please.",
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
                content: "I still want to speak to a human support agent, please.",
                clientMessageId: key,
            });
            expect(retry.created).toBe(false);
            expect(await prisma.message.count({ where: { chatRoomId: room.id } })).toBe(2);
        },
    );

    it.each([UserRole.BUYER, UserRole.SELLER, UserRole.DEALER])('offers help once then persists a confirmed handoff for %s', async role => {
        const room = await roomFor(role);
        const customerId = customers.get(role)!;
        const first = await service.sendMessage(room.id, customerId, {
            content: 'I want to talk to a human', clientMessageId: randomUUID(),
        });
        expect(first.automaticReply.content).toBe(SUPPORT_HELP_OFFER);
        expect((await prisma.chatRoom.findUniqueOrThrow({ where: { id: room.id } })).supportAiOptedOutAt).toBeNull();
        const key = randomUUID();
        const second = await service.sendMessage(room.id, customerId, { content: 'yes please', clientMessageId: key });
        expect(second.automaticReply.content).toBe(HUMAN_HANDOFF_REPLY);
        expect((await prisma.chatRoom.findUniqueOrThrow({ where: { id: room.id } })).supportAiOptedOutAt).not.toBeNull();
        expect((await service.sendMessage(room.id, customerId, { content: 'yes please', clientMessageId: key })).created).toBe(false);
        expect(await prisma.message.count({ where: { chatRoomId: room.id } })).toBe(4);
    });

    it.each([
        [UserRole.BUYER, 'hi can you help me'],
        [UserRole.DEALER, 'hello'],
    ])('persists a safe immediate reply for a %s without a worker: %s', async (role, content) => {
        const room = await roomFor(role as UserRole);
        const customerId = customers.get(role as UserRole)!;
        const result = await service.sendMessage(room.id, customerId, {
            content: content as string,
            clientMessageId: randomUUID(),
        });
        expect(result.created).toBe(true);
        expect(result.automaticReply?.content).toEqual(expect.any(String));
        expect(result.automaticReply?.aiGenerated).toBe(true);
        const saved = await prisma.message.findMany({
            where: { chatRoomId: room.id },
            orderBy: { createdAt: 'asc' },
        });
        expect(saved).toHaveLength(2);
        expect(saved[1]).toMatchObject({
            senderId: botId,
            aiGenerated: true,
            aiSourceMessageId: saved[0].id,
            content: result.automaticReply.content,
        });
        const updated = await prisma.chatRoom.findUniqueOrThrow({ where: { id: room.id } });
        expect(updated.supportAiOptedOutAt).toBeNull();
        expect(updated.supportHumanTakeoverAt).toBeNull();
    });

    it('saves AI replies through the Prisma-safe global advisory lock', async () => {
        const room = await roomFor(UserRole.BUYER);
        const customerId = customers.get(UserRole.BUYER)!;
        const source = await prisma.message.create({
            data: { chatRoomId: room.id, senderId: customerId,
                content: 'Why does my photo upload fail unexpectedly?' },
        });
        const reply = 'Please check your connection and try the photo upload again. If it fails, tell us the exact error displayed.';
        const result = await service.persistSupportAutoReply(room.id, source.id, botId, reply, 'AI');
        expect(result.created).toBe(true);
        if (!result.created) throw new Error('AI reply persistence failed');
        const saved = await prisma.message.findUniqueOrThrow({
            where: { aiSourceMessageId: source.id },
        });
        expect(saved.content).toBe(reply);
        expect(saved.aiGenerated).toBe(true);
        expect(saved.senderId).toBe(botId);
        expect(await prisma.message.count({ where: { chatRoomId: room.id } })).toBe(2);
    });

    it('loads only this customer conversation and excludes protected historical details', async () => {
        const room = await roomFor(UserRole.DEALER);
        const other = await roomFor(UserRole.BUYER);
        const customerId = customers.get(UserRole.DEALER)!;
        await prisma.message.create({ data: { chatRoomId: other.id, senderId: customers.get(UserRole.BUYER)!, content: 'Another customer problem' } });
        await prisma.message.create({ data: { chatRoomId: room.id, senderId: customerId, content: 'My email is private@example.com', createdAt: new Date(Date.now() - 4000) } });
        await prisma.message.create({ data: { chatRoomId: room.id, senderId: customerId, content: 'Photo upload closes on Samsung', createdAt: new Date(Date.now() - 3000) } });
        await prisma.message.create({ data: { chatRoomId: room.id, senderId: botId, aiGenerated: true, content: 'Try one smaller image.', createdAt: new Date(Date.now() - 2000) } });
        const latest = await prisma.message.create({ data: { chatRoomId: room.id, senderId: customerId, content: 'I tried that and it still closes' } });
        const result = await service.inspectSupportAutoReply(room.id, latest.id);
        expect(result.eligible).toBe(true);
        if (!result.eligible) throw new Error(result.reason);
        expect(result.customerRole).toBe('DEALER');
        expect(result.conversation.map(m => m.content)).toEqual([
            'Photo upload closes on Samsung', 'Try one smaller image.', 'I tried that and it still closes',
        ]);
    });

    it('keeps answering when the customer chooses help instead of a person', async () => {
        const room = await roomFor(UserRole.BUYER);
        const customerId = customers.get(UserRole.BUYER)!;
        await service.sendMessage(room.id, customerId, { content: 'I want a human', clientMessageId: randomUUID() });
        const help = await service.sendMessage(room.id, customerId, { content: 'i want to upload a car', clientMessageId: randomUUID() });
        expect(help.automaticReply).toBeUndefined();
        const pending = await service.inspectSupportAutoReply(room.id, help.message.id);
        expect(pending).toMatchObject({ eligible: true, plan: { kind: 'AI' } });
        expect((await prisma.chatRoom.findUniqueOrThrow({ where: { id: room.id } })).supportAiOptedOutAt).toBeNull();
        const human = await service.sendMessage(room.id, customerId, { content: 'I want a human', clientMessageId: randomUUID() });
        expect(human.automaticReply.content).toBe(HUMAN_HANDOFF_REPLY);
    });

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
