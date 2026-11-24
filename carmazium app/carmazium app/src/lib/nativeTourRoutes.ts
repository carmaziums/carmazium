import type { MainStackParamList } from '../navigation/MainStackNavigator';

type Destination = { [K in keyof MainStackParamList]: { screen: K; params?: MainStackParamList[K] } }[keyof MainStackParamList];
const page = (screen: keyof MainStackParamList): Destination => ({ screen } as Destination);
const tab = (screen: 'DealerHome' | 'Profile' | 'Live' | 'Saved' | 'DealerBuyBid' | 'Search', params?: object): Destination =>
  ({ screen: 'Tabs', params: { screen, params } } as Destination);

/** A closed allowlist: tour navigation cannot submit forms or fall back to a browser. */
export function nativeTourDestination(href?: string, role?: string): Destination | null {
  if (!href) return null;
  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  if (path === '/profile') {
    const section = params.get('section');
    if (section === 'business' && role === 'contractor') return { screen: 'PartnerDashboard', params: { openSection: 'business' } };
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
  if (path === '/search') return tab('Search');
  if (path === '/auctions/browse') return role === 'dealer' ? tab('DealerBuyBid', { initialSection: 'live' }) : tab('Live');
  if (path === '/dashboard/dealer/wishlist') return page('DealerSaved');
  if (path === '/dashboard/dealer/bids') return params.get('tab') === 'retail'
    ? { screen: 'DealerMyOffers', params: { fromBidsOffers: true } }
    : tab('DealerBuyBid', { initialSection: 'bids' });
  if (path === '/dashboard/service/jobs') return { screen: 'ProviderJobs', params: { initialTab: params.get('tab') === 'mine' ? 'assigned' : 'open' } };
  // All customer/provider job and historic setup links stay on their existing
  // native screen; no WebView or second TradeXchange navigation layer.
  const providerJob = /^\/dashboard\/service\/jobs\/([a-zA-Z0-9_-]+)$/.exec(path);
  if (providerJob) return { screen: 'ProviderJobDetail', params: { jobId: providerJob[1] } };
  const customerJob = /^\/services\/jobs\/([a-zA-Z0-9_-]+)$/.exec(path);
  if (customerJob) return { screen: 'CustomerServiceJobDetail', params: { jobId: customerJob[1] } };
  if (path === '/dashboard/service/settings' || path === '/dashboard/service/capabilities') {
    return page('PartnerDashboard');
  }
  if (/^\/dashboard\/service\/capabilities\/[^/]+\/(verification|matching)$/.test(path)) {
    return { screen: 'PartnerDashboard', params: {
      openSection: path.endsWith('/verification') ? 'business' : 'preferences',
    } };
  }
  const routes: Record<string, keyof MainStackParamList> = {
    '/dashboard/admin': 'AdminDashboard',
    '/dashboard/admin/listings': 'AdminListingsReview',
    '/dashboard/admin/dealer-verification': 'AdminDealerKyc',
    '/dashboard/admin/users': 'AdminAccounts',
    '/dashboard/admin/transactions': 'AdminTransactions',
    '/dashboard/admin/handovers': 'AdminHandovers',
    '/sell': 'SellLanding', '/pricing': 'Pricing',
    '/dashboard/dealer/inventory': 'DealerInventory', '/dashboard/dealer/crm': 'DealerLeads',
    '/dashboard/dealer/auctions': 'SellerAuctions', '/dashboard/dealer/offers': 'DealerOffers',
    '/dashboard/dealer/purchases': 'DealerPurchases', '/dashboard/dealer/messages': 'Messages',
    '/dashboard/dealer/team': 'DealerTeam', '/dashboard/dealer/finance': 'DealerFinance',
    '/dashboard/dealer/analytics': 'DealerAnalytics', '/dashboard/dealer/earnings': 'DealerEarnings',
    '/dashboard/warranties': 'WarrantyOrders', '/services/jobs': 'CustomerServiceJobs',
    '/dashboard/cancellations': 'SaleCancellations', '/dashboard/service': 'ProviderOverview',
    '/dashboard/service/capabilities': 'PartnerDashboard', '/dashboard/partner': 'PartnerDashboard',
  };
  return routes[path] ? page(routes[path]) : null;
}

/** Check the actual focused leaf route, including requested section/tab params. */
export function nativeTourRouteMatches(destination: Destination | null, actual?: { name: string; params?: object } | null): boolean {
  if (!destination || !actual) return false;
  const nested = destination.screen === 'Tabs' ? destination.params as { screen?: string; params?: object } | undefined : undefined;
  const name = nested?.screen ?? destination.screen;
  const expected = nested ? nested.params : destination.params;
  if (actual.name !== name) return false;
  return Object.entries(expected ?? {}).every(([key, value]) =>
    (actual.params as Record<string, unknown> | undefined)?.[key] === value);
}