import { ChatContext } from '@prisma/client';
import { ChatService } from './chat.service';
import { HUMAN_HANDOFF_REPLY } from './support-automatic-responses';

describe('immediate human-support acknowledgement', () => {
    const botId = 'e641510d-0b2c-4eb1-96c6-8874bb9e6b53';
    const customerId = '11111111-1111-4111-8111-111111111111';
    const adminId = '22222222-2222-4222-8222-222222222222';
    const sourceId = '33333333-3333-4333-8333-333333333333';
    const previousBotId = process.env.MAZIUM_SUPPORT_BOT_USER_ID;

    beforeEach(() => { process.env.MAZIUM_SUPPORT_BOT_USER_ID = botId; });
    afterAll(() => {
        if (previousBotId === undefined) delete process.env.MAZIUM_SUPPORT_BOT_USER_ID;
        else process.env.MAZIUM_SUPPORT_BOT_USER_ID = previousBotId;
    });

    const setup = (senderRole = 'BUYER') => {
        const room = {
            id: 'room', context: ChatContext.SUPPORT,
            initiatorId: customerId, participantId: adminId,
            initiator: { role: 'BUYER' }, participant: { role: 'ADMIN' },
            supportAssignedAdminId: adminId,
        };
        const prisma = {
            user: { findUnique: jest.fn().mockResolvedValue({ role: senderRole }) },
            chatRoom: { update: jest.fn().mockResolvedValue(room) },
        };
        const safety = { assertAllowedText: jest.fn().mockResolvedValue(undefined) };
        const events = { publish: jest.fn() };
        const service = new ChatService(prisma as any, {} as any, {} as any,
            {} as any, {} as any, {} as any, safety as any, events as any);
        jest.spyOn(service, 'assertCanMessageRoom').mockResolvedValue(room as any);
        jest.spyOn(service as any, 'createInboundMessage').mockImplementation(async (_room, senderId, data) =>
            ({ id: sourceId, senderId, ...(data as Record<string, unknown>) }));
        jest.spyOn(service as any, 'resolveMessageRouting').mockResolvedValue({
            recipients: [{ id: adminId, role: 'ADMIN' }], roomUpdate: {},
        });
        jest.spyOn(service as any, 'notifyMessageRecipients').mockResolvedValue(undefined);
        const persist = jest.spyOn(service, 'persistSupportAutoReply');
        const reply = { id: 'receipt', chatRoomId: 'room', senderId: botId,
            aiGenerated: true, aiSourceMessageId: sourceId, content: HUMAN_HANDOFF_REPLY };
        persist.mockResolvedValue({ created: true, message: reply, customerId } as any);
        return { service, events, persist, reply };
    };

    it('returns a persisted, canonical automated reply in the same send operation', async () => {
        const { service, events, persist, reply } = setup();
        const result = await service.sendMessage('room', customerId,
            { content: "I'd like to speak to a human support agent, please." });
        expect(result.created).toBe(true);
        expect(result.automaticReply).toEqual(reply);
        expect(persist).toHaveBeenCalledWith('room', sourceId, botId, HUMAN_HANDOFF_REPLY, 'FIXED');
        expect(events.publish).not.toHaveBeenCalled();
    });

    it('preserves background recovery if immediate persistence fails', async () => {
        const { service, events, persist } = setup();
        persist.mockRejectedValueOnce(new Error('temporary failure'));
        const result = await service.sendMessage('room', customerId, { content: 'I want a human agent' });
        expect(result.created).toBe(true);
        expect(result.automaticReply).toBeUndefined();
        expect(events.publish).toHaveBeenCalledWith('room', sourceId);
    });

    it('leaves normal customer support messages to the existing dispatcher', async () => {
        const { service, events, persist } = setup();
        const result = await service.sendMessage('room', customerId,
            { content: 'How much does a retail listing cost?' });
        expect(result.automaticReply).toBeUndefined();
        expect(persist).not.toHaveBeenCalled();
        expect(events.publish).toHaveBeenCalledWith('room', sourceId);
    });

    it('does not send an automated handoff after a staff message', async () => {
        const { service, events, persist } = setup('ADMIN');
        await service.sendMessage('room', adminId, { content: 'A human agent is here.' });
        expect(persist).not.toHaveBeenCalled();
        expect(events.publish).not.toHaveBeenCalled();
    });
});
