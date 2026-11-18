import { classifySupportMessage, safeAutomaticSupportReply } from './mazium-support-policy';
import { fixedSupportReply, supportReplyPlan, supportNeedsHumanReply, HUMAN_HANDOFF_REPLY, HUMAN_REVIEW_REPLY, SUPPORT_UNAVAILABLE_REPLY } from './support-automatic-responses';

describe('automatic support answers', () => {
    const now = new Date();
    it('acknowledges a human request after opt-out without model consent', () => {
        expect(supportReplyPlan({ supportAiOptedOutAt: now, supportHumanTakeoverAt: now }, "I'd like to speak to a human support agent, please.", now)).toEqual({ kind: 'FIXED', reply: HUMAN_HANDOFF_REPLY });
        expect(HUMAN_HANDOFF_REPLY).not.toMatch(/joined|available now|shortly|minutes/i);
    });
    it.each(['hi can you help me', 'i want to upload a car'])('provides useful local support without a dispatcher: %s', text => {
        const plan = supportReplyPlan({}, text, now);
        expect(plan?.kind).toBe('FIXED');
        if (plan?.kind === 'FIXED') {
            expect(plan.reply.length).toBeGreaterThan(70);
            expect(plan.reply).not.toBe(SUPPORT_UNAVAILABLE_REPLY);
        }
    });
    it.each(['How much does a retail listing cost?', 'How do I list my car?', 'How many photos do I need?', 'Where do I download the app?'])('answers common questions without referring them to a person: %s', text => {
        expect(supportReplyPlan({}, text, now)?.kind).toBe('FIXED');
        expect(fixedSupportReply(text)).not.toBe(SUPPORT_UNAVAILABLE_REPLY);
        expect(fixedSupportReply(text)).not.toMatch(/human support|talk to a person/i);
    });
    it.each(['How does identity verification work?', 'How do I reset my password?', 'Why can I not log in?', 'I have a complaint about uploading photos'])('does not confuse routine help with approval: %s', text => {
        expect(classifySupportMessage(text).action).toBe('DRAFT');
    });
    it.each(['Refund my fee', 'Can you waive the payment?', 'Where is my £100 reward?', 'Delete my account'])('routes decisions to staff with a receipt: %s', text => {
        expect(supportReplyPlan({}, text, now)).toEqual({ kind: 'FIXED', reply: HUMAN_REVIEW_REPLY });
    });
    it('respects explicit opt-out and current staff conversation', () => {
        expect(supportReplyPlan({ supportAiOptedOutAt: now }, 'How much to list?', now)).toBeNull();
        expect(supportReplyPlan({ supportHumanTakeoverAt: now }, 'How much to list?', now)).toBeNull();
        expect(supportReplyPlan({ supportHumanTakeoverAt: new Date(now.getTime() - 3600000) }, 'How much to list my car?', now)?.kind).toBe('FIXED');
    });
    it('answers general unmatched questions with MaziuM by default, without an opt-in panel', () => {
        const text = 'Why does the app close when I select a photo?';
        expect(supportReplyPlan({}, text, now)).toEqual({ kind: 'AI' });
        expect(supportReplyPlan({ supportAiConsentAt: new Date(now.getTime() + 1000) }, text, now)).toEqual({ kind: 'AI' });
        expect(supportReplyPlan({ supportAiOptedOutAt: now }, text, now)).toBeNull();
    });
    it.each([
        'Please put me through to customer service',
        'I want to speak with the support department',
        'Please connect me with your team',
        'I would prefer a human being',
    ])('hands a natural request to staff without requiring a button: %s', text => {
        expect(supportReplyPlan({}, text, now)).toEqual({ kind: 'FIXED', reply: HUMAN_HANDOFF_REPLY });
    });
    it.each([
        'Please email me at customer@example.com about my account',
        'My phone number is 07911 123456, can you call me?',
        'I need to discuss my medical condition with customer support',
        'My date of birth is in the listing details',
    ])('does not send obvious personal details to the external AI model: %s', text => {
        expect(classifySupportMessage(text).action).toBe('ESCALATE');
        expect(supportReplyPlan({}, text, now)).toEqual({ kind: 'FIXED', reply: HUMAN_REVIEW_REPLY });
    });
    it.each(['I will refund you £100.', 'Your payout has been approved.', "I'm a human agent.", 'Send us your password.'])('blocks unsupported commitments: %s', reply => expect(safeAutomaticSupportReply(reply)).toBe(false));
    it('allows factual fee information', () => expect(safeAutomaticSupportReply('A Basic retail listing costs £1 until sold.')).toBe(true));
    it('keeps only pending handoffs and unresolved questions in the staff queue', () => {
        expect(supportNeedsHumanReply(null)).toBe(false);
        expect(supportNeedsHumanReply({ aiGenerated: false, content: 'Question', sender: { role: 'BUYER' } })).toBe(true);
        expect(supportNeedsHumanReply({ aiGenerated: false, content: 'Staff reply', sender: { role: 'ADMIN' } })).toBe(false);
        expect(supportNeedsHumanReply({ aiGenerated: true, content: 'A basic listing costs £1', sender: { role: 'BUYER' } })).toBe(false);
        expect(supportNeedsHumanReply({ aiGenerated: true, content: HUMAN_HANDOFF_REPLY })).toBe(true);
        expect(supportNeedsHumanReply({ aiGenerated: true, content: HUMAN_REVIEW_REPLY })).toBe(true);
        expect(supportNeedsHumanReply({ aiGenerated: true, content: SUPPORT_UNAVAILABLE_REPLY })).toBe(true);
    });

});
