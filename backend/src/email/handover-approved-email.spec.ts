import { EmailService } from './email.service';
import type { SellerBonusEmailState } from '../admin/seller-bonus-email-state';

describe('seller handover approval email truthfulness', () => {
    const makeEmailService = () => {
        const email: any = Object.create(EmailService.prototype);
        email.frontendUrl = 'https://www.carmazium.com';
        email.sendBrandedEmail = jest.fn().mockResolvedValue({ id: 'test-message' });
        return email;
    };
    it.each([
        ['APPROVED_PAYOUT_PENDING', 'payout pending', 'NOT yet been paid'],
        ['APPROVED_SETUP_NEEDED', 'connect your payout account', 'NOT yet been paid'],
        ['STRIPE_TRANSFER_RECORDED', 'Stripe transfer initiated', 'does not mean the funds have reached your bank'],
        ['MANUAL_PAYMENT_RECORDED', 'marked paid', 'recorded your £100 seller bonus as paid manually'],
    ] as [SellerBonusEmailState, string, string][])(
        'renders the correct %s subject and content',
        async (stage, subject, message) => {
            const email = makeEmailService();
            await email.sendHandoverApprovedEmail(
                'seller@example.com', 'Sam', 'BMW M3', stage,
            );
            expect(email.sendBrandedEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'seller@example.com',
                    subject: expect.stringContaining(subject),
                    bodyHtml: expect.stringContaining(message),
                }),
            );
        },
    );
    it('escapes seller and vehicle text without inserting untrusted HTML', async () => {
        const email = makeEmailService();
        await email.sendHandoverApprovedEmail(
            'seller@example.com', '<script>alert(1)</script>', '<img src=x onerror=alert(2)>',
            'APPROVED_PAYOUT_PENDING',
        );
        const body = email.sendBrandedEmail.mock.calls[0][0].bodyHtml;
        expect(body).not.toContain('<script>');
        expect(body).not.toContain('<img');
        expect(body).toContain('&lt;script&gt;');
    });
});
