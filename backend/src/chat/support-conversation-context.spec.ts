import { safeSupportConversation } from './support-conversation-context';

describe('support conversation memory', () => {
    const user = (content: string) => ({ senderId: 'customer', aiGenerated: false, content });
    const bot = (content: string) => ({ senderId: 'bot', aiGenerated: true, content });
    it('preserves the problem and failed attempt for a short follow-up', () => {
        const turns = safeSupportConversation([
            user('The photo upload closes on my Samsung'),
            bot('Try uploading one smaller photo.'), user('I tried that and it still closes'),
        ], 'customer', 'I tried that and it still closes');
        expect(turns).toEqual([
            { role: 'user', content: 'The photo upload closes on my Samsung' },
            { role: 'assistant', content: 'Try uploading one smaller photo.' },
            { role: 'user', content: 'I tried that and it still closes' },
        ]);
    });
    it('does not forward private contact details or unrelated human messages', () => {
        const turns = safeSupportConversation([
            user('My email is private@example.com'), bot('Thanks for the details.'),
            { senderId: 'someone-else', aiGenerated: false, content: 'Internal note' },
            user('How do I add photos?'),
        ], 'customer', 'How do I add photos?');
        expect(turns).toEqual([{ role: 'user', content: 'How do I add photos?' }]);
    });
    it('bounds context while always retaining the latest question', () => {
        const turns = safeSupportConversation(Array.from({ length: 60 }, (_, i) => user(`Question ${i}`)), 'customer', 'Latest question');
        expect(turns).toHaveLength(40);
        expect(turns.at(-1)?.content).toBe('Latest question');
    });
});
