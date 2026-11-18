import { ChatContext } from '@prisma/client';
import { ChatService } from './chat.service';
import { HUMAN_HANDOFF_REPLY } from './support-automatic-responses';

describe('atomic human support requests', () => {
    const customerId = '11111111-1111-4111-8111-111111111111';
    const adminId = '22222222-2222-4222-8222-222222222222';
    const previousBotId = process.env.MAZIUM_SUPPORT_BOT_USER_ID;

    beforeEach(() => {
        process.env.MAZIUM_SUPPORT_BOT_USER_ID = 'e641510d-0b2c-4eb1-96c6-8874bb9e6b53';
    });
    afterAll(() => {
        if (previousBotId === undefined) delete process.env.MAZIUM_SUPPORT_BOT_USER_ID;
        else process.env.MAZIUM_SUPPORT_BOT_USER_ID = previousBotId;
    });

    const setup = (role = 'BUYER') => {
        const room: any = {
            id: 'room', context: ChatContext.SUPPORT,
            initiatorId: customerId, participantId: adminId,
            initiator: { role: 'BUYER' }, participant: { role: 'ADMIN' },
            supportAssignedAdminId: adminId,
        };
        const prisma = {
            user: { findUnique: jest.fn().mockResolvedValue({ role }) },
            message: { findFirst: jest.fn().mockResolvedValue(null) },
            chatRoom: { update: jest.fn().mockResolvedValue(room) },
        };
        const safety = { assertAllowedText: jest.fn().mockResolvedValue(undefined) };
        const events = { publish: jest.fn() };
        const service = new ChatService(prisma as any, {} as any, {} as any,
            {} as any, {} as any, {} as any, safety as any, events as any);
        jest.spyOn(service, 'assertCanMessageRoom').mockResolvedValue(room as any);
        jest.spyOn(service as any, 'resolveMessageRouting').mockResolvedValue({
            recipients: [{ id: adminId, role: 'ADMIN' }], roomUpdate: {},
        });
        jest.spyOn(service as any, 'notifyMessageRecipients').mockResolvedValue(undefined);
        const createNormal = jest.spyOn(service as any, 'createInboundMessage').mockResolvedValue({
            id: 'source', senderId: customerId, content: 'How much to list?',
        });
        const receipt = { id: 'receipt', aiGenerated: true, content: HUMAN_HANDOFF_REPLY };
        const createPaired = jest.spyOn(service as any, 'createHumanSupportRequestWithReceipt')
            .mockResolvedValue({ message: { id: 'source', senderId: customerId }, automaticReply: receipt });
        return { service, prisma, events, createNormal, createPaired, receipt, room };
    };

    it('returns an already-persisted receipt without a second dispatcher attempt', async () => {
        const { service, createPaired, createNormal, events, receipt } = setup();
        const result = await service.sendMessage('room', customerId,
            { content: "I'd like to speak to a human support agent, please." });
        expect(result).toMatchObject({ created: true, automaticReply: receipt });
        expect(createPaired).toHaveBeenCalledTimes(1);
        expect(createNormal).not.toHaveBeenCalled();
        expect(events.publish).not.toHaveBeenCalled();
    });

    it('does not report delivery or fall back to saving the request alone if the pair fails', async () => {
        const { service, createPaired, createNormal, events } = setup();
        createPaired.mockRejectedValueOnce(new Error('database transaction failed'));
        await expect(service.sendMessage('room', customerId,
            { content: 'I want a human support agent' })).rejects.toThrow('database transaction failed');
        expect(createNormal).not.toHaveBeenCalled();
        expect(events.publish).not.toHaveBeenCalled();
    });

    it('routes normal support messages to the existing dispatcher unchanged', async () => {
        const { service, createPaired, createNormal, events } = setup();
        const result = await service.sendMessage('room', customerId,
            { content: 'Why does my browser close after I upload a photo?' });
        expect(result.automaticReply).toBeUndefined();
        expect(createPaired).not.toHaveBeenCalled();
        expect(createNormal).toHaveBeenCalledTimes(1);
        expect(events.publish).toHaveBeenCalledWith('room', 'source');
    });

    it.each(['hi can you help me', 'i want to upload a car'])(
        'persists known answers in the same request without relying on dispatcher: %s', async content => {
            const { service, createPaired, createNormal, events } = setup();
            const result = await service.sendMessage('room', customerId, { content });
            expect(result.created).toBe(true);
            expect(result.automaticReply).toBeDefined();
            expect(createPaired).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'room' }), customerId,
                expect.objectContaining({ content }),
                expect.objectContaining({ humanHandoff: false, reply: expect.any(String) }),
            );
            expect(createNormal).not.toHaveBeenCalled();
            expect(events.publish).not.toHaveBeenCalled();
        },
    );
    it('does not send a local automatic reply after a customer explicitly paused AI', async () => {
        const { service, createPaired, createNormal, events, room } = setup();
        room.supportAiOptedOutAt = new Date();
        await service.sendMessage('room', customerId, { content: 'i want to upload a car' });
        expect(createPaired).not.toHaveBeenCalled();
        expect(createNormal).toHaveBeenCalledTimes(1);
        expect(events.publish).toHaveBeenCalledTimes(1);
    });

    it('never sends an automatic human receipt to a staff sender', async () => {
        const { service, createPaired, events } = setup('ADMIN');
        await service.sendMessage('room', adminId, { content: 'I am the human support agent.' });
        expect(createPaired).not.toHaveBeenCalled();
        expect(events.publish).not.toHaveBeenCalled();
    });
});
