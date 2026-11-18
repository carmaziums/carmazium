import { MaziumSupportAutoReplyService } from './mazium-support-auto-reply.service';
import { HUMAN_HANDOFF_REPLY, SUPPORT_UNAVAILABLE_REPLY } from '../chat/support-automatic-responses';

describe('automatic support delivery', () => {
    const setup = (plan: any) => {
        const config = { get: jest.fn(key => ({ MAZIUM_SUPPORT_AUTO_REPLY_ENABLED: 'true', MAZIUM_SUPPORT_BOT_USER_ID: 'bot' })[key]) };
        const chat = { getRoomMessages: jest.fn().mockResolvedValue({ data: [{ senderId: 'customer', content: 'Question' }] }), inspectSupportAutoReply: jest.fn().mockResolvedValue({ eligible: true, customerId: 'customer', content: 'Question', plan }), persistSupportAutoReply: jest.fn().mockResolvedValue({ created: true, message: { id: 'reply' } }) };
        const gateway = { broadcastMessage: jest.fn() };
        const ai = { draftSupportReply: jest.fn().mockResolvedValue('Try choosing a smaller photo and uploading again.') };
        return { service: new MaziumSupportAutoReplyService(config as any, chat as any, gateway as any, ai as any), chat, ai, gateway };
    };
    it('sends human acknowledgement without any model call', async () => {
        const { service, chat, ai, gateway } = setup({ kind: 'FIXED', reply: HUMAN_HANDOFF_REPLY });
        expect(await service.processCustomerMessage('room', 'source')).toBe(true);
        expect(ai.draftSupportReply).not.toHaveBeenCalled();
        expect(chat.persistSupportAutoReply).toHaveBeenCalledWith('room', 'source', 'bot', HUMAN_HANDOFF_REPLY, 'FIXED');
        expect(gateway.broadcastMessage).toHaveBeenCalledTimes(1);
    });
    it('answers eligible questions directly as the disclosed assistant', async () => {
        const { service, ai } = setup({ kind: 'AI' });
        await service.processCustomerMessage('room', 'source');
        expect(ai.draftSupportReply).toHaveBeenCalledWith([{ role: 'user', content: 'Question' }], { automatic: true, userId: 'customer' });
    });
    it('provides a receipt if generation is unavailable or budget is reached', async () => {
        const { service, chat, ai } = setup({ kind: 'AI' });
        await service.processCustomerMessage('room', 'source', false);
        expect(ai.draftSupportReply).not.toHaveBeenCalled();
        expect(chat.persistSupportAutoReply).toHaveBeenCalledWith('room', 'source', 'bot', SUPPORT_UNAVAILABLE_REPLY, 'FIXED');
    });
    it('preserves follow-up context while withholding earlier sensitive messages and attachments', async () => {
        const { service, chat, ai } = setup({ kind: 'AI' });
        chat.getRoomMessages.mockResolvedValue({ data: [
            { senderId: 'customer', content: 'I am a private buyer.' },
            { senderId: 'bot', content: 'You can use Retail.' },
            { senderId: 'customer', content: 'my password is private' },
            { senderId: 'customer', content: 'Attachment', attachmentPath: 'private-document' },
            { senderId: 'customer', content: 'And what does that cost?' },
        ] } as any);
        await service.processCustomerMessage('room', 'source');
        expect(chat.getRoomMessages).toHaveBeenCalledWith('room', 'customer', 1, 40);
        const context = ai.draftSupportReply.mock.calls[0][0];
        expect(context[0]).toEqual({ role: 'user', content: 'I am a private buyer.' });
        expect(context[1].role).toBe('assistant');
        expect(context.at(-1).content).toBe('And what does that cost?');
        expect(JSON.stringify(context)).not.toMatch(/password is private|private-document|Attachment/);
    });
    it('never broadcasts a reply rejected by the final race/duplicate check', async () => {
        const { service, chat, gateway } = setup({ kind: 'AI' });
        chat.persistSupportAutoReply.mockResolvedValue({ created: false, reason: 'SOURCE_CHANGED_OR_SENSITIVE' } as any);
        expect(await service.processCustomerMessage('room', 'source')).toBe(false);
        expect(gateway.broadcastMessage).not.toHaveBeenCalled();
    });
    it('withholds model financial commitments', async () => {
        const { service, chat, ai } = setup({ kind: 'AI' });
        ai.draftSupportReply.mockResolvedValue('I will refund you £100.');
        await service.processCustomerMessage('room', 'source');
        expect(chat.persistSupportAutoReply).toHaveBeenCalledWith('room', 'source', 'bot', SUPPORT_UNAVAILABLE_REPLY, 'FIXED');
    });
});
