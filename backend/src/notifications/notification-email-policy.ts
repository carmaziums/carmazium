export interface NotificationEmailPolicyInput {
    type: string;
    data?: Record<string, any> | null;
}

export interface NotificationEmailPolicyDecision {
    eligible: boolean;
    delayMs: number;
    reason?: string;
}

/**
 * Notification types that already have a purpose-built transactional email
 * in the same business flow. The generic notification email worker must never
 * send a second copy for these.
 */
const DEDICATED_EMAIL_TYPES = new Set([
    'OFFER_RECEIVED',
    'OFFER_ACCEPTED',
    'OFFER_REJECTED',
    'OFFER_COUNTERED',

    'AUCTION_WON',
    'AUCTION_ENDED',
    'AUCTION_ENDED_NO_SALE',
    'AUCTION_FEE_REMINDER',
    'AUCTION_PROVISIONAL_REMINDER',
    'AUCTION_PROVISIONAL_EXPIRED',
    'AUCTION_PROVISIONAL_DECLINED',
    'AUCTION_PROVISIONAL_BID',
    'AUCTION_PROVISIONAL_EMAIL_FAILURE',

    'HANDOVER_APPROVED',
    'HANDOVER_DENIED',
    'HANDOVER_PAYOUT_RECORDED',

    'KYC_APPROVED',
    'KYC_REJECTED',

    'LISTING_APPROVED',
    'LISTING_REJECTED',
]);

export const CHAT_NOTIFICATION_EMAIL_DELAY_MS = 5 * 60 * 1000;

export function notificationEmailPolicy(
    input: NotificationEmailPolicyInput,
): NotificationEmailPolicyDecision {
    if (input.data?.adminBroadcast === true) {
        return { eligible: false, delayMs: 0, reason: 'admin-broadcast-has-own-email' };
    }

    if (DEDICATED_EMAIL_TYPES.has(input.type)) {
        return { eligible: false, delayMs: 0, reason: 'dedicated-email-exists' };
    }

    if (input.type === 'MESSAGE_RECEIVED' || input.type === 'NEW_MESSAGE') {
        return { eligible: true, delayMs: CHAT_NOTIFICATION_EMAIL_DELAY_MS };
    }

    return { eligible: true, delayMs: 0 };
}
