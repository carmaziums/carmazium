import type { AppNotification } from './notificationsApi';

function normalizeNotificationHref(href: string): string {
    if (!href.startsWith('/')) return '/dashboard/user?tab=overview';
    if (href.startsWith('/dashboard/user')) return href;
    // Old provider setup links still work on the web, but notifications
    // should open the canonical inline service hub instead of an extra page.
    if (/^\/dashboard\/service\/capabilities\/[^/]+\/verification(?:[?#].*)?$/.test(href)) {
        return '/dashboard/partner#provider-business';
    }
    if (/^\/dashboard\/service\/capabilities\/[^/]+\/matching(?:[?#].*)?$/.test(href)) {
        return '/dashboard/partner#provider-preferences';
    }
    if (href === '/dashboard/service/capabilities' || href.startsWith('/dashboard/service/capabilities/')) {
        return '/dashboard/partner#provider-services';
    }
    if (href === '/dashboard/service/settings') return '/dashboard/partner#provider-business';
    if (href.startsWith('/dashboard/buyer/offers')) return '/dashboard/user?tab=bids';
    if (href.startsWith('/dashboard/seller/offers')) return '/dashboard/user?tab=offers';
    if (href.startsWith('/dashboard/buyer/messages')) {
        const match = href.match(/[?&]room=([^&]+)/);
        return match
            ? `/dashboard/user?tab=messages&room=${decodeURIComponent(match[1])}`
            : '/dashboard/user?tab=messages';
    }
    if (href === '/admin/kyc') return '/dashboard/admin/dealer-verification';
    if (href === '/dashboard' || href === '/dashboard/') return '/dashboard/user?tab=overview';
    return href;
}

export function resolveWebNotificationHref(
    notification: AppNotification,
    role?: string | null,
): string {
    const data = notification.data && typeof notification.data === 'object'
        ? notification.data as Record<string, unknown>
        : {};
    const dataLink = typeof data.link === 'string' ? data.link : null;
    const topLink = typeof notification.link === 'string' ? notification.link : null;
    const direct = dataLink || topLink;

    if (notification.type.startsWith('AUCTION_')) {
        const auctionId = typeof data.auctionId === 'string'
            ? data.auctionId
            : notification.entityId;

        if (notification.type === 'AUCTION_WON' && auctionId) {
            return '/dashboard/dealer/auctions/won';
        }

        if (
            auctionId &&
            [
                'AUCTION_BID',
                'AUCTION_BID_PLACED',
                'AUCTION_OUTBID',
                'AUCTION_ENDED',
                'AUCTION_STARTED',
                'AUCTION_ENDING_SOON',
                'AUCTION_RESERVE_MET',
            ].includes(notification.type)
        ) {
            return `/auctions/live/${auctionId}`;
        }

        if (
            notification.type === 'AUCTION_ENDED_NO_SALE' ||
            notification.type === 'AUCTION_CANCELLED'
        ) {
            return role === 'DEALER'
                ? '/dashboard/dealer/auctions'
                : '/dashboard/seller/auctions';
        }
    }

    if (direct) return normalizeNotificationHref(direct);

    if (typeof data.roomId === 'string') {
        return `/dashboard/user?tab=messages&room=${data.roomId}`;
    }

    if (notification.entityType === 'AUCTION' && notification.entityId) {
        return `/auctions/live/${notification.entityId}`;
    }
    if (notification.entityType === 'LISTING' && notification.entityId) {
        return '/dashboard/user?tab=inventory';
    }
    if (notification.entityType === 'OFFER' && notification.entityId) {
        return notification.type === 'OFFER_COUNTERED'
            ? '/dashboard/user?tab=bids'
            : '/dashboard/user?tab=offers';
    }

    if (notification.type === 'DEAL_CLOSED') return '/dashboard/user?tab=offers';
    if (notification.type === 'MESSAGE_RECEIVED' || notification.type === 'NEW_MESSAGE') {
        return '/dashboard/user?tab=messages';
    }
    if (notification.type.startsWith('OFFER_')) return '/dashboard/user?tab=offers';

    return '/dashboard/user?tab=overview';
}
