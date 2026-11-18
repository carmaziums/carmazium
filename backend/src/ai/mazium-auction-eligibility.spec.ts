import {
    verifiedAuctionEligibilityReply,
    contradictsDealerOnlyAuctionRule,
    MaziumConversationMessage,
} from './mazium-auction-eligibility';

const u = (content: string): MaziumConversationMessage => ({ role: 'user', content });
const a = (content: string): MaziumConversationMessage => ({ role: 'assistant', content });

describe('MaziuM verified dealer-only auction policy', () => {
    it.each([
        'tell me how to bid on auction cars if you are not dealer',
        'Can I bid as a private buyer?',
        'As a private seller, can I place bids on auctions?',
        'I am not a car dealer but I want to buy from auctions',
        'Can non-dealers participate in public auctions?',
        'Is there a way to buy auction cars without a dealer account?',
        'Can everyone place a bid on CarMazium auctions?',
        'I want to buy a car through the auctions as an individual',
    ])('does not permit non-dealers to bid: %s', question => {
        const answer = verifiedAuctionEligibilityReply([u(question)]) || '';
        expect(answer).toContain('verified motor-trade dealers only');
        expect(answer).toContain('cannot place bids');
        expect(answer).toContain('/search');
        expect(answer).not.toMatch(/private (buyer|seller).*can (?:place )?bid/i);
    });

    it('corrects the exact contradictory two-turn conversation from the mobile screenshots', () => {
        const messages = [
            u('tell me how to bid on auction cars if you are not dealer'),
            a("I'm sorry, but I can't assist with auction bidding processes for non-dealers."),
            u('but i want to buy from auctions'),
        ];
        const answer = verifiedAuctionEligibilityReply(messages);
        expect(answer).toContain('only');
        expect(answer).toContain('A private buyer or seller cannot place bids');
        expect(answer).toContain('/search');
    });

    it('preserves an earlier private buyer constraint even when the new question is brief', () => {
        const messages = [
            u('I want to bid on one of your live auctions'),
            a('What type of account do you have?'),
            u('I am a private buyer, not a dealer'),
            a('Can I help you with buying?'),
            u('But can I still buy?'),
        ];
        const answer = verifiedAuctionEligibilityReply(messages);
        expect(answer).toContain('private buyer or seller cannot place bids');
    });

    it('gives a verified dealer actionable bidding steps without claiming their account is approved', () => {
        const answer = verifiedAuctionEligibilityReply([u("I'm a verified dealer. How do I bid at an auction?")]) || '';
        expect(answer).toContain('/auctions');
        expect(answer).toContain('permissions');
        expect(answer).not.toMatch(/your account is approved/i);
    });

    it('states dealer-only permissions to an unspecified potential bidder', () => {
        const answer = verifiedAuctionEligibilityReply([u('How can I bid on a car auction?')]) || '';
        expect(answer).toContain('Only verified');
        expect(answer).toContain('Private buyers and sellers');
    });

    it.each([
        'I want to list my car for a free auction',
        'How do I sell a car at auction?',
        'What happens when the reserve price is not met?',
        'Can I withdraw my retail advert?',
        'How do I upload a car?',
        'Tell me about your warranty',
        'Where do I see my retail purchases?',
    ])('does not hijack unrelated seller/support topics: %s', question => {
        expect(verifiedAuctionEligibilityReply([u(question)])).toBeNull();
    });

    it.each([
        'As a private seller, you can participate in public auctions. You can place a bid directly on that listing.',
        'Anyone can bid on our auctions.',
        'A non-dealer can place a bid directly in the auction.',
        'Private buyers may bid at CarMazium auctions.',
        'Private buyers cannot bid. But individuals can bid at auctions.',
    ])('rejects model answers granting unauthorised auction permissions: %s', answer => {
        expect(contradictsDealerOnlyAuctionRule(answer)).toBe(true);
    });

    it.each([
        'Private buyers cannot bid on CarMazium auctions.',
        'Private buyers can buy retail. Only dealers can bid at auction.',
        'Private buyers can buy retail; verified dealers can bid at auction.',
        'Private buyers can not bid on CarMazium auctions.',
        'Private individuals may not participate in CarMazium auctions.',
        'Only approved dealers can bid at /auctions.',
        'The auction is visible to everyone, but private sellers cannot place bids.',
        'For a retail purchase, message the seller directly.',
    ])('does not falsely reject correct guidance: %s', answer => {
        expect(contradictsDealerOnlyAuctionRule(answer)).toBe(false);
    });
});
