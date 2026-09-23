import { getAuction, auctionToListingParam } from './auctionApi';

export interface RoutableNotification {
  type?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  link?: string | null;
  data?: Record<string, any> | null;
  screen?: string | null;
  params?: Record<string, any> | string | null;
  [key: string]: any;
}

export interface MobileNotificationTarget {
  screen: string;
  params?: Record<string, any>;
}

function value(
  notification: RoutableNotification,
  key: string,
): any {
  if (notification[key] != null) return notification[key];
  if (notification.data && notification.data[key] != null) {
    return notification.data[key];
  }
  return undefined;
}

function parseParams(raw: unknown): Record<string, any> | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw !== 'string') return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? parsed as Record<string, any>
      : undefined;
  } catch {
    return undefined;
  }
}

function roomIdFromLink(link?: string | null): string | undefined {
  if (!link) return undefined;
  const match = link.match(/[?&]room=([^&#]+)/i);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeFromLink(
  link: string | null | undefined,
  role?: string | null,
): MobileNotificationTarget | null {
  if (!link) return null;

  const roomId = roomIdFromLink(link);
  if (/messages/i.test(link) && roomId) {
    return { screen: 'ChatScreen', params: { threadId: roomId } };
  }
  if (/messages/i.test(link)) {
    return { screen: 'Messages' };
  }

  if (/dashboard\/dealer\/auctions\/won/i.test(link)) {
    return { screen: 'BuyerBids' };
  }
  if (/dashboard\/dealer\/offers/i.test(link)) {
    return { screen: 'DealerOffers' };
  }
  if (/dashboard\/dealer\/my-offers/i.test(link)) {
    return { screen: 'DealerMyOffers' };
  }
  if (/dashboard\/buyer\/offers/i.test(link)) {
    return { screen: role === 'dealer' ? 'DealerMyOffers' : 'BuyerOffers' };
  }
  if (/dashboard\/seller\/offers/i.test(link)) {
    return { screen: role === 'dealer' ? 'DealerOffers' : 'SellerOffers' };
  }
  if (/dashboard\/dealer\/inventory/i.test(link)) {
    return { screen: 'DealerInventory' };
  }
  if (/dashboard\/seller\/(inventory|listings)/i.test(link)) {
    return { screen: role === 'dealer' ? 'DealerInventory' : 'SellerListings' };
  }
  if (/dashboard\/buyer\/delivery/i.test(link)) {
    return { screen: 'BuyerDeliveryRequests' };
  }
  if (/dashboard\/dealer\/kyc/i.test(link)) {
    return { screen: 'DealerKYC' };
  }
  if (/settings/i.test(link)) {
    return { screen: 'Settings' };
  }

  return null;
}

/**
 * One routing contract for notification-list taps and Expo push taps.
 *
 * The backend may provide identifiers at the row top level (in-app API),
 * inside data (Expo push), or through a legacy web link. This resolver accepts
 * all three and returns the corresponding native route.
 */
export async function resolveMobileNotificationTarget(
  notification: RoutableNotification,
  role?: string | null,
): Promise<MobileNotificationTarget | null> {
  const type = String(value(notification, 'type') ?? '');
  const entityType = String(value(notification, 'entityType') ?? '').toUpperCase();
  const entityId = value(notification, 'entityId') as string | undefined;
  const link = (value(notification, 'link') as string | undefined) ?? null;
  const roomId = value(notification, 'roomId') as string | undefined;

  const explicitScreen = value(notification, 'screen');
  if (typeof explicitScreen === 'string' && explicitScreen) {
    return {
      screen: explicitScreen,
      params: parseParams(value(notification, 'params')),
    };
  }

  if (
    (type === 'MESSAGE_RECEIVED' || type === 'NEW_MESSAGE')
    && (roomId || roomIdFromLink(link))
  ) {
    return {
      screen: 'ChatScreen',
      params: { threadId: roomId ?? roomIdFromLink(link)! },
    };
  }

  if (type === 'AUCTION_WIN_EXPIRED') {
    return { screen: 'BuyerBids' };
  }

  const auctionId =
    (value(notification, 'auctionId') as string | undefined)
    ?? (entityType === 'AUCTION' ? entityId : undefined);

  if (
    auctionId
    && (
      entityType === 'AUCTION'
      || type.startsWith('AUCTION_')
      || type === 'OUTBID'
      || type === 'BID_PLACED'
    )
  ) {
    try {
      const auction = await getAuction(auctionId);
      return {
        screen: 'LiveAuctionDetailed',
        params: { listing: auctionToListingParam(auction) },
      };
    } catch {
      // Ended/deleted auctions can disappear between delivery and tap. Bid
      // history remains the useful fallback for the buyer.
      return { screen: 'BuyerBids' };
    }
  }

  switch (type) {
    case 'OUTBID':
    case 'BID_PLACED':
    case 'AUCTION_WON':
      return { screen: 'BuyerBids' };

    case 'OFFER_RECEIVED':
    case 'OFFER_COUNTERED':
      if (role === 'dealer') return { screen: 'DealerOffers' };
      if (role === 'seller') return { screen: 'SellerOffers' };
      return { screen: 'BuyerOffers' };

    case 'OFFER_ACCEPTED':
    case 'OFFER_REJECTED':
    case 'OFFER_WITHDRAWN':
    case 'DEAL_CLOSED': {
      const isSentByMe = !!link?.includes('/buyer/');
      if (isSentByMe) {
        return { screen: role === 'dealer' ? 'DealerMyOffers' : 'BuyerOffers' };
      }
      return { screen: role === 'dealer' ? 'DealerOffers' : 'SellerOffers' };
    }

    case 'KYC_APPROVED':
    case 'KYC_REJECTED':
      return { screen: 'DealerKYC' };

    case 'LISTING_SUBMITTED':
    case 'LISTING_APPROVED':
    case 'LISTING_REJECTED':
      return { screen: role === 'dealer' ? 'DealerInventory' : 'SellerListings' };

    case 'DELIVERY_REQUESTED':
    case 'DELIVERY_ACCEPTED':
    case 'DELIVERY_DECLINED':
    case 'DELIVERY_EXPIRED':
      return link?.includes('/buyer/')
        ? { screen: 'BuyerDeliveryRequests' }
        : { screen: 'SellerOffers' };

    case 'PAYOUT_FAILED':
      return { screen: 'Settings' };

    default:
      return routeFromLink(link, role);
  }
}
