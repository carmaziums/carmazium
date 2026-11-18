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
    it('retains a reward explanation and its offered next step for yes please', () => {
        const turns = safeSupportConversation([
            user('How does the £100 seller reward work?'),
            bot('Payout checks apply. Would you like steps on uploading the handover photo?'),
            user('Yes please'),
        ], 'customer', 'Yes please');
        expect(turns).toHaveLength(3);
        expect(turns[1].content).toContain('handover photo');
    });
    it('keeps generic security advice without forwarding a disclosed credential', () => {
        expect(safeSupportConversation([
            user('How do I reset a password?'), bot('Use Forgot password. Never share a one-time code.'),
            user('The link expired'),
        ], 'customer', 'The link expired')).toHaveLength(3);
        expect(safeSupportConversation([
            user('My OTP is 123456'), bot('Do not share that code.'), user('How do I reset a password?'),
        ], 'customer', 'How do I reset a password?')).toHaveLength(1);
    });
});
