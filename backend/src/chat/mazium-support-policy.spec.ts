import { canPrepareSupportDraft, classifySupportMessage } from './mazium-support-policy';

describe('MaziuM support safety policy', () => {
    it.each([
        'Please refund my listing fee',
        'I want to dispute this sale',
        'Change my bank account',
        'Delete my account',
        'Can you waive the fee?',
        'I need a solicitor',
        'My OTP is 123456',
    ])('escalates sensitive requests: %s', (message) => {
        expect(classifySupportMessage(message).action).toBe('ESCALATE');
    });

    it('permits routine support questions for drafting only', () => {
        expect(classifySupportMessage('How do I list my car for retail?')).toEqual({
            action: 'DRAFT',
            reason: 'ROUTINE_SUPPORT',
        });
    });

    const eligible = {
        context: 'SUPPORT',
        supportClosedAt: null,
        humanAssigned: false,
        latestSenderIsCustomer: true,
        alreadyRepliedToLatestMessage: false,
        consentToAi: true,
    };

    it('requires all eligibility conditions', () => {
        expect(canPrepareSupportDraft(eligible)).toBe(true);
        expect(canPrepareSupportDraft({ ...eligible, context: 'VEHICLE' })).toBe(false);
        expect(canPrepareSupportDraft({ ...eligible, humanAssigned: true })).toBe(false);
        expect(canPrepareSupportDraft({ ...eligible, supportClosedAt: new Date() })).toBe(false);
        expect(canPrepareSupportDraft({ ...eligible, latestSenderIsCustomer: false })).toBe(false);
        expect(canPrepareSupportDraft({ ...eligible, alreadyRepliedToLatestMessage: true })).toBe(false);
        expect(canPrepareSupportDraft({ ...eligible, consentToAi: false })).toBe(false);
    });
});
