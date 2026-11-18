import { AiService } from './ai.service';

describe('Messages customer-support intelligence', () => {
    const setup = () => {
        const config = { get: jest.fn(key => key === 'OPENAI_API_KEY' ? 'synthetic-test-only' : undefined) };
        const service = new AiService(config as any, {} as any);
        const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: 'Try one smaller image. What error appears?' } }] });
        (service as any).openai = {
            moderations: { create: jest.fn().mockResolvedValue({ results: [{ flagged: false }] }) },
            chat: { completions: { create } },
        };
        return { service, create };
    };
    it('retrieves knowledge from the earlier problem and carries follow-up context', async () => {
        const { service, create } = setup();
        const conversation = [
            { role: 'user' as const, content: 'How do I edit an existing listing?' },
            { role: 'assistant' as const, content: 'Open your inventory and choose Edit.' },
            { role: 'user' as const, content: 'I tried that, but the photos do not save' },
        ];
        expect(await service.draftSupportReply(conversation, { automatic: true, customerRole: 'DEALER' })).toBeTruthy();
        const request = create.mock.calls[0][0];
        expect(request.model).toBe('gpt-4.1');
        expect(request.messages[0].content).toContain('[edit-existing-listing]');
        expect(request.messages[0].content).toContain('Authenticated account role: DEALER');
        expect(request.messages).toEqual(expect.arrayContaining(conversation));
    });
    it('keeps the latest topic in retrieval even after a long earlier question', async () => {
        const { service, create } = setup();
        await service.draftSupportReply([
            { role: 'user', content: 'Tell me about photos. '.repeat(50) },
            { role: 'user', content: 'How do I post a TradeXchange job?' },
        ], { automatic: true });
        expect(create.mock.calls[0][0].messages[0].content).toContain('[tradexchange-jobs]');
    });
    it('rejects a made-up support route instead of delivering it', async () => {
        const { service, create } = setup();
        create.mockResolvedValue({ choices: [{ message: { content: 'Go to /dashboard/fake-editor.' } }] });
        expect(await service.draftSupportReply([{ role: 'user', content: 'My photo upload failed' }], { automatic: true })).toBeNull();
    });
});
