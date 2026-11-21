import type { AppNotification } from './notificationsApi';

// Website's /users/me/introduction version for service-notice dismissal.
// Native tour state is versioned independently; do not mix the two.
export const DEALER_SERVICES_NOTICE_VERSION = 2;

export function getUnsoldAuctionPrompt(notifications: AppNotification[]): AppNotification | null {
  return notifications.find(notification =>
    notification.type === 'AUCTION_ENDED_NO_SALE' && !notification.isRead
  ) || null;
}

export function shouldShowDealerServicesNotice(input: {
  id?: string;
  dealerProfile?: object | null;
  preferences?: { dealerServicesNoticeV1?: unknown };
}, expectedUserId: string): boolean {
  return input.id === expectedUserId &&
    !!input.dealerProfile &&
    !input.preferences?.dealerServicesNoticeV1;
}
