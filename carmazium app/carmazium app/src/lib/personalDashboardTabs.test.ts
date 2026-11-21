import { getPersonalDashboardTabs, personalTabIsActive, isPersonalDashboardRoute } from './personalDashboardTabs';

describe('buyer / seller bottom navigation matches mobile website sidebar', () => {
  test('seller dashboard has exactly four website shortcuts in order', () => {
    expect(getPersonalDashboardTabs('seller').map(x => x.label)).toEqual([
      'Home', 'My cars', 'Offers Received', 'Messages',
    ]);
    expect(getPersonalDashboardTabs('seller').map(x => x.route)).toEqual([
      'Profile', 'MyCars', 'SellerOffers', 'Messages',
    ]);
  });

  test('buyer dashboard has exactly four website shortcuts in order', () => {
    expect(getPersonalDashboardTabs('buyer').map(x => x.label)).toEqual([
      'Home', 'My Offers', 'Purchases', 'Messages',
    ]);
    expect(getPersonalDashboardTabs('buyer').map(x => x.route)).toEqual([
      'Profile', 'BuyerOffers', 'BuyerPurchaseHistory', 'Messages',
    ]);
  });

  test('dashboard nav only wraps personal account screens', () => {
    for (const route of ['MyCars', 'SellerOffers', 'BuyerOffers', 'BuyerPurchaseHistory', 'Messages']) {
      expect(isPersonalDashboardRoute(route)).toBe(true);
    }
    for (const route of ['Tabs', 'AdminDashboard', 'DealerPurchases', 'VehicleDeepLink', 'SellCarFlow']) {
      expect(isPersonalDashboardRoute(route)).toBe(false);
    }
  });

  test('active state matches related seller listing screens', () => {
    expect(personalTabIsActive('MyCars', 'SellerListings')).toBe(true);
    expect(personalTabIsActive('MyCars', 'MyCars')).toBe(true);
    expect(personalTabIsActive('SellerOffers', 'MyCars')).toBe(false);
  });
});
