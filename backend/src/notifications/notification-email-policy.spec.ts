import {
    CHAT_NOTIFICATION_EMAIL_DELAY_MS,
    notificationEmailPolicy,
} from './notification-email-policy';

describe('notificationEmailPolicy', () => {
    it('emails ordinary notifications immediately', () => {
        expect(notificationEmailPolicy({ type: 'DELIVERY_REQUESTED' })).toEqual({
            eligible: true,
            delayMs: 0,
        });
    });

    it('delays chat notifications for five minutes', () => {
        expect(notificationEmailPolicy({ type: 'MESSAGE_RECEIVED' })).toEqual({
            eligible: true,
            delayMs: CHAT_NOTIFICATION_EMAIL_DELAY_MS,
        });
    });

    it('skips admin broadcasts because they already send email', () => {
        expect(notificationEmailPolicy({
            type: 'MESSAGE_RECEIVED',
            data: { adminBroadcast: true },
        })).toEqual({
            eligible: false,
            delayMs: 0,
            reason: 'admin-broadcast-has-own-email',
        });
    });

    it.each([
        'OFFER_ACCEPTED',
        'AUCTION_WON',
        'HANDOVER_APPROVED',
        'KYC_APPROVED',
        'LISTING_APPROVED',
    ])('skips %s because a dedicated email already exists', (type) => {
        expect(notificationEmailPolicy({ type })).toEqual({
            eligible: false,
            delayMs: 0,
            reason: 'dedicated-email-exists',
        });
    });
});
