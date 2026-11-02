import {
    TYPES_WITH_DEDICATED_EMAIL,
    boundedSetting,
    escapeHtml,
    messageEmailSkipReason,
    notificationEmailUrl,
    renderNotificationEmail,
    shouldQueueNotificationEmail,
} from './notification-email-policy';

describe('notification email policy', () => {
    it('queues chat messages and other events without their own email', () => {
        expect(shouldQueueNotificationEmail('MESSAGE_RECEIVED', { roomId: 'r1' })).toBe(true);
        expect(shouldQueueNotificationEmail('OUTBID', {})).toBe(true);
        expect(shouldQueueNotificationEmail('SERVICE_JOB_POSTED', undefined)).toBe(true);
        expect(shouldQueueNotificationEmail('DELIVERY_ACCEPTED', null)).toBe(true);
    });

    it('never doubles up on events that already send a dedicated email', () => {
        for (const type of ['OFFER_RECEIVED', 'AUCTION_WON', 'AUCTION_PROVISIONAL_EXPIRED',
            'HANDOVER_APPROVED', 'KYC_APPROVED', 'LISTING_REJECTED', 'ACCOUNT_WELCOME']) {
            expect(TYPES_WITH_DEDICATED_EMAIL.has(type)).toBe(true);
            expect(shouldQueueNotificationEmail(type, {})).toBe(false);
        }
    });

    it('skips admin broadcasts (emailed separately) and explicit opt-outs', () => {
        expect(shouldQueueNotificationEmail('MESSAGE_RECEIVED', { adminBroadcast: true })).toBe(false);
        expect(shouldQueueNotificationEmail('OUTBID', { skipEmail: true })).toBe(false);
        expect(shouldQueueNotificationEmail('', {})).toBe(false);
    });

    it('does not email a message already read, or a conversation emailed recently', () => {
        expect(messageEmailSkipReason({ isRead: true, emailedForRoomRecently: false })).not.toBeNull();
        expect(messageEmailSkipReason({ isRead: false, emailedForRoomRecently: true })).not.toBeNull();
        expect(messageEmailSkipReason({ isRead: false, emailedForRoomRecently: false })).toBeNull();
    });

    it('only links to pages on the CarMazium site', () => {
        const base = 'https://www.carmazium.com/';
        expect(notificationEmailUrl(base, '/dashboard/user?tab=messages&room=1'))
            .toBe('https://www.carmazium.com/dashboard/user?tab=messages&room=1');
        for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', 42, null]) {
            expect(notificationEmailUrl(base, bad)).toBe('https://www.carmazium.com/notifications');
        }
    });

    it('escapes notification text in the email body', () => {
        const { subject, bodyHtml } = renderNotificationEmail({
            title: 'New <b>Message</b>',
            message: '<script>alert(1)</script> "hi"',
            url: 'https://www.carmazium.com/x?a=1&b=2',
            settingsUrl: 'https://www.carmazium.com/notifications',
        });
        expect(subject).toBe('New <b>Message</b> — CarMazium');
        expect(bodyHtml).not.toContain('<script>');
        expect(bodyHtml).toContain('&lt;script&gt;');
        expect(bodyHtml).toContain('x?a=1&amp;b=2');
        expect(escapeHtml(`'&`)).toBe('&#39;&amp;');
    });

    it('bounds the daily cap setting', () => {
        expect(boundedSetting(undefined, 400, 1, 5000)).toBe(400);
        expect(boundedSetting('99999', 400, 1, 5000)).toBe(5000);
        expect(boundedSetting('nope', 400, 1, 5000)).toBe(400);
    });
});
