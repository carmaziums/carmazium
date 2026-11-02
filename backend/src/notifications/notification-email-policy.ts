/**
 * Which in-app notifications are also sent by email, and how.
 *
 * Many events already send their own purpose-built email (offers, auction
 * results, handover, KYC, listing review, history reports, welcome, team
 * invites). Those types are excluded here so nobody receives the same news
 * twice. Every other notification gets one generic branded email, queued on
 * the notification row itself and sent by NotificationEmailOutboxService.
 */
export const TYPES_WITH_DEDICATED_EMAIL: ReadonlySet<string> = new Set([
    'ACCOUNT_WELCOME',
    'AUCTION_ENDED',
    'AUCTION_ENDED_NO_SALE',
    'AUCTION_FEE_REMINDER',
    'AUCTION_OFFER_RECEIVED',
    'AUCTION_PROVISIONAL_BID',
    'AUCTION_PROVISIONAL_DECLINED',
    'AUCTION_PROVISIONAL_EMAIL_FAILURE',
    'AUCTION_PROVISIONAL_EXPIRED',
    'AUCTION_PROVISIONAL_REMINDER',
    'AUCTION_WON',
    'DEAL_CLOSED',
    'HANDOVER_APPROVED',
    'HANDOVER_DENIED',
    'HANDOVER_PAYOUT_RECORDED',
    'HPI_REPORT',
    'HPI_REPORT_READY',
    'KYC_APPROVED',
    'KYC_REJECTED',
    'KYC_VERIFICATION',
    'LISTING_APPROVED',
    'LISTING_REJECTED',
    'OFFER_ACCEPTED',
    'OFFER_COUNTERED',
    'OFFER_RECEIVED',
    'OFFER_REJECTED',
    // SYSTEM is a catch-all used next to payout and bank-detail emails.
    'SYSTEM',
    'TEAM_INVITE',
]);

/** Notification data key holding the email queue state. */
export const EMAIL_QUEUE_KEY = 'emailQueue';

export type EmailQueueStatus =
    | 'pending'
    | 'sending'
    | 'retry'
    | 'submitted'
    | 'skipped'
    | 'failed';

/** Decide at creation time whether a notification is queued for email. */
export function shouldQueueNotificationEmail(type: string, data: Record<string, any> | null | undefined): boolean {
    if (!type || TYPES_WITH_DEDICATED_EMAIL.has(type)) return false;
    // Admin broadcasts send their own email copy.
    if (data?.adminBroadcast === true) return false;
    // A caller can opt a single notification out explicitly.
    if (data?.skipEmail === true) return false;
    return true;
}

/**
 * Chat messages wait a few minutes: someone actively chatting reads the
 * message in the app first and is not emailed at all.
 */
export const MESSAGE_EMAIL_DELAY_MS = 5 * 60 * 1000;

/** At most one message email per conversation per recipient in this window. */
export const MESSAGE_EMAIL_THROTTLE_MS = 30 * 60 * 1000;

/** Never email notifications older than this (e.g. a backlog when enabling). */
export const EMAIL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const EMAIL_MAX_ATTEMPTS = 3;

export function isMessageNotification(type: string): boolean {
    return type === 'MESSAGE_RECEIVED' || type === 'NEW_MESSAGE';
}

/**
 * Message-specific checks, made at send time.
 * - already read in the app: no email;
 * - this conversation was emailed recently: no email (one nudge is enough).
 */
export function messageEmailSkipReason(input: {
    isRead: boolean;
    emailedForRoomRecently: boolean;
}): string | null {
    if (input.isRead) return 'Read in the app before the email was due';
    if (input.emailedForRoomRecently) return 'Conversation already emailed recently';
    return null;
}

/** Bounded integer setting; invalid or missing values use the default. */
export function boundedSetting(raw: string | undefined, fallback: number, min: number, max: number): number {
    const value = Number(raw);
    if (!raw || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(value)));
}

/**
 * The button target in the email. Only same-site paths are followed;
 * anything else (absolute URLs, protocol-relative, odd schemes) falls back
 * to the notifications page so an email can never link off-site.
 */
export function notificationEmailUrl(frontendUrl: string, link: unknown): string {
    const base = frontendUrl.replace(/\/+$/, '');
    if (typeof link === 'string' && /^\/(?![/\\])[^\s]*$/.test(link)) {
        return base + link;
    }
    return base + '/notifications';
}

const HTML_ESCAPES: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Subject and branded body for a generic notification email. */
export function renderNotificationEmail(input: {
    title: string;
    message: string;
    url: string;
    settingsUrl: string;
}): { subject: string; bodyHtml: string } {
    const title = (input.title || 'CarMazium notification').trim().slice(0, 140);
    const message = (input.message || '').trim().slice(0, 600);
    return {
        subject: `${title} — CarMazium`,
        bodyHtml: '<h1>' + escapeHtml(title) + '</h1>'
            + (message ? '<p>' + escapeHtml(message) + '</p>' : '')
            + '<p><a href="' + escapeHtml(input.url) + '">Open in CarMazium</a></p>'
            + '<p style="font-size:12px;color:#94a3b8">You are receiving this because you have email'
            + ' notifications switched on. <a href="' + escapeHtml(input.settingsUrl) + '">Change your email'
            + ' notification settings</a>.</p>',
    };
}
