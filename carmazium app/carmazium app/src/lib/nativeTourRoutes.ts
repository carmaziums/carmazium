import type { MainStackParamList } from '../navigation/MainStackNavigator';

type Destination = { [K in keyof MainStackParamList]: { screen: K; params?: MainStackParamList[K] } }[keyof MainStackParamList];
const page = (screen: keyof MainStackParamList): Destination => ({ screen } as Destination);
const tab = (screen: 'DealerHome' | 'Profile' | 'Live' | 'Saved' | 'DealerBuyBid', params?: object): Destination =>
  ({ screen: 'Tabs', params: { screen, params } } as Destination);

/** A closed allowlist: tour navigation cannot submit forms or fall back to a browser. */
export function nativeTourDestination(href?: string): Destination | null {
  if (!href) return null;
  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  if (path === '/profile') {
    const section = params.get('section');
    if (!['personal', 'business', 'verification', 'notifications', 'payouts', 'appearance', 'security', 'reviews', 'account'].includes(section ?? '')) return null;
    return { screen: 'Settings', params: { section: section as NonNullable<MainStackParamList['Settings']>['section'] } };
  }
  if (path === '/dashboard/user') {
    const personal: Record<string, keyof MainStackParamList> = {
      cars: 'MyCars', offers: 'SellerOffers', earnings: 'Earnings', stats: 'SellerPerformance',
      bids: 'BuyerOffers', purchases: 'BuyerPurchaseHistory', messages: 'Messages',
    };
    const selected = params.get('tab');
    if (!selected) return page('UnifiedDashboard');
    if (selected === 'watchlist') return tab('Saved');
    return personal[selected] ? page(personal[selected]) : null;
  }
  if (path === '/dashboard/dealer') return tab('DealerHome');
  if (path === '/auctions/browse') return tab('Live');
  if (path === '/dashboard/dealer/wishlist') return tab('Saved');
  if (path === '/dashboard/dealer/bids') return params.get('tab') === 'retail'
    ? { screen: 'DealerMyOffers', params: { fromBidsOffers: true } }
    : tab('DealerBuyBid', { initialSection: 'bids' });
  if (path === '/dashboard/service/jobs') return { screen: 'ProviderJobs', params: { initialTab: params.get('tab') === 'mine' ? 'assigned' : 'open' } };
  const routes: Record<string, keyof MainStackParamList> = {
    '/search': 'Search', '/sell': 'SellLanding', '/pricing': 'Pricing',
    '/dashboard/dealer/inventory': 'DealerInventory', '/dashboard/dealer/crm': 'DealerLeads',
    '/dashboard/dealer/auctions': 'SellerAuctions', '/dashboard/dealer/offers': 'DealerOffers',
    '/dashboard/dealer/purchases': 'DealerPurchases', '/dashboard/dealer/messages': 'Messages',
    '/dashboard/dealer/team': 'DealerTeam', '/dashboard/dealer/finance': 'DealerFinance',
    '/dashboard/dealer/analytics': 'DealerAnalytics', '/dashboard/dealer/earnings': 'DealerEarnings',
    '/dashboard/warranties': 'WarrantyOrders', '/services/jobs': 'CustomerServiceJobs',
    '/dashboard/cancellations': 'SaleCancellations', '/dashboard/service': 'ProviderOverview',
    '/dashboard/service/capabilities': 'ProviderCapabilities', '/dashboard/partner': 'PartnerDashboard',
  };
  return routes[path] ? page(routes[path]) : null;
}
