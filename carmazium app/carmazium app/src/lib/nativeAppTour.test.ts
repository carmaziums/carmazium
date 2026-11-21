import {
  getNativeAppTourSteps, nativeTourStorageKey, NATIVE_APP_TOUR_VERSION,
  requestNativeAppTourReplay, subscribeNativeAppTourReplay,
} from './nativeAppTour';

const roles = ['buyer', 'seller', 'dealer', 'contractor', 'admin', 'finance_partner', 'insurance_partner'] as const;

describe('native app tour and website role parity', () => {
  test.each(roles)('%s has a safe tour with account-settings replay', role => {
    const steps = getNativeAppTourSteps(role);
    expect(steps.length).toBeGreaterThan(8);
    expect(steps[0].id).toBe('welcome');
    expect(steps[steps.length - 1].id).toBe('finish');
    expect(steps[steps.length - 1].destination).toEqual({
      screen: 'Settings', params: { section: 'personal' },
    });
    expect(new Set(steps.map(s => s.id)).size).toBe(steps.length);
    expect(steps.every(s => !!s.title.trim() && !!s.description.trim())).toBe(true);
    expect(steps.some(s => s.id === 'pricing')).toBe(role !== 'admin');
  });

  test('admin tour uses native moderation, verification, auction, transaction and handover routes', () => {
    const steps = getNativeAppTourSteps('admin');
    const ids = steps.map(s => s.id);
    expect(ids).toEqual(expect.arrayContaining([
      'admin-overview', 'admin-listings', 'admin-dealers', 'admin-users',
      'admin-auctions', 'admin-transactions', 'admin-handovers', 'admin-analytics',
    ]));
    expect(ids).not.toContain('my-cars');
    expect(ids).not.toContain('stock');
  });

  test('dealer tour includes stock, bidding, purchases, service setup and team', () => {
    const ids = getNativeAppTourSteps('dealer').map(s => s.id);
    expect(ids).toEqual(expect.arrayContaining([
      'stock', 'add', 'customers', 'bids', 'purchases', 'messages', 'team',
      'settings-business', 'settings-verification', 'settings-appearance',
    ]));
    expect(ids).not.toContain('my-cars');
  });

  test('personal tour includes seller and buyer workflows under one account', () => {
    const ids = getNativeAppTourSteps('buyer').map(s => s.id);
    expect(ids).toEqual(expect.arrayContaining([
      'my-cars', 'offers-received', 'earnings', 'performance', 'offers-made',
      'saved', 'purchases', 'messages', 'warranties', 'cancellations',
    ]));
  });

  test('provider tours include available and accepted jobs; specialist tour excludes payout walkthrough', () => {
    const provider = getNativeAppTourSteps('contractor').map(s => s.id);
    expect(provider).toEqual(expect.arrayContaining(['jobs', 'my-work', 'capabilities']));
    for (const role of ['finance_partner', 'insurance_partner']) {
      const ids = getNativeAppTourSteps(role).map(s => s.id);
      expect(ids).toContain('specialist-home');
      expect(ids).not.toContain('settings-payouts');
    }
  });

  test('every step destination names a valid existing native screen and never submits mutations', () => {
    const routes = new Set([
      'SellLanding', 'Pricing', 'DealerListingMethod', 'SellerAuctions',
      'DealerMyOffers', 'DealerOffers', 'DealerPurchases', 'Messages',
      'DealerTeam', 'DealerFinance', 'DealerAnalytics', 'DealerEarnings',
      'AdminDashboard', 'AdminListingsReview', 'AdminDealerKyc', 'AdminAccounts',
      'AdminAuctions', 'AdminTransactions', 'AdminHandovers', 'AdminAppInsights',
      'MyCars', 'SellerOffers', 'Earnings', 'SellerPerformance', 'BuyerOffers',
      'BuyerPurchaseHistory', 'BuyerDeliveryRequests', 'WarrantyOrders', 'ProviderOverview',
      'SaleCancellations', 'ProviderCapabilities', 'ProviderJobs', 'ProviderMessages',
      'Settings', 'Tabs',
    ]);
    const possibleTab = new Set(['Home', 'Search', 'Live', 'Saved', 'Profile', 'DealerStock', 'DealerCustomers', 'DealerBuyBid']);
    for (const role of roles) for (const s of getNativeAppTourSteps(role)) {
      if (!s.destination) continue;
      expect(routes.has(s.destination.screen)).toBe(true);
      if (s.destination.screen === 'Tabs' && 'tab' in s.destination) {
        expect(possibleTab.has(s.destination.tab)).toBe(true);
      }
      expect(s.destination.screen).not.toMatch(/submit|checkout|payment|approve|delete|setrole|placebid/i);
    }
  });

  test('completion key is per-user and versioned independently of the website', () => {
    expect(NATIVE_APP_TOUR_VERSION).toBeGreaterThan(1);
    expect(nativeTourStorageKey('person-a')).not.toBe(nativeTourStorageKey('person-b'));
    expect(nativeTourStorageKey('person-a')).toMatch(/native-app-tour:v\d+:person-a/);
  });

  test('replay works until unsubscribed', () => {
    const callback = jest.fn();
    const unsubscribe = subscribeNativeAppTourReplay(callback);
    requestNativeAppTourReplay();
    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
    requestNativeAppTourReplay();
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
