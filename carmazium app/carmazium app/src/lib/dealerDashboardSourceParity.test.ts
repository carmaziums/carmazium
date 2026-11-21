import { DEALER_ITEMS } from './dashboardNavigation';
import { getUnsoldAuctionPrompt, DEALER_SERVICES_NOTICE_VERSION, shouldShowDealerServicesNotice } from './dealerNoticeRules';
import type { AppNotification } from './notificationsApi';

// The website is the reference, not an independently invented card list.
const catalog: { dealer: Array<{ id: string; label: string; requiredPermission?: string }> } =
  require('../../../../src/data/dashboardCards.json');

test('native dealer dashboard cards have the exact website IDs and labels', () => {
  const native = [
    { id: 'add-vehicle', label: 'Add Vehicle', requiredPermission: 'MANAGE_INVENTORY' },
    ...DEALER_ITEMS.filter(card => card.id !== 'dealer-home'),
  ];
  const nativeMap = new Map(native.map(card => [card.id, card]));
  expect(nativeMap.size).toBe(catalog.dealer.length);
  expect([...nativeMap.keys()].sort()).toEqual(catalog.dealer.map(card => card.id).sort());
  for (const websiteCard of catalog.dealer) {
    const appCard = nativeMap.get(websiteCard.id);
    expect(appCard?.label).toBe(websiteCard.label);
    expect(appCard?.requiredPermission || '').toBe(websiteCard.requiredPermission || '');
  }
});

test('website dealer bottom tabs correspond to native permission-protected destinations', () => {
  const nativeById = new Map(DEALER_ITEMS.map(x => [x.id, x]));
  expect(nativeById.get('dealer-home')?.tabName).toBe('DealerHome');
  expect(nativeById.get('dealer-stock')?.tabName).toBe('DealerStock');
  expect(nativeById.get('dealer-stock')?.requiredPermission).toBe('VIEW_INVENTORY');
  expect(nativeById.get('dealer-customers')?.tabName).toBe('DealerCustomers');
  expect(nativeById.get('dealer-customers')?.requiredPermission).toBe('MANAGE_CRM');
  expect(nativeById.get('dealer-live')?.tabName).toBe('DealerBuyBid');
  expect(nativeById.get('dealer-live')?.requiredPermission).toBe('VIEW_TRADE');
});

test('find unread unsold auction recommendation, not a generic message', () => {
  const make = (id: string, type: string, isRead: boolean): AppNotification =>
    ({ id, type, isRead, title: '', message: '', userId: 'test', createdAt: '2026-11-21T00:00:00Z' });
  expect(getUnsoldAuctionPrompt([
    make('1', 'OFFER_RECEIVED', false),
    make('2', 'AUCTION_ENDED_NO_SALE', true),
    make('3', 'AUCTION_ENDED_NO_SALE', false),
  ])?.id).toBe('3');
  expect(getUnsoldAuctionPrompt([make('4', 'AUCTION_ENDED_NO_SALE', true)])).toBeNull();
});

test('service-notice backend version matches website welcome version', () => {
  // Website uses WELCOME_TOUR_VERSION=2 for PATCH /users/me/introduction.
  expect(DEALER_SERVICES_NOTICE_VERSION).toBe(2);
});

test('service notice shows only for the matching dealer, until acknowledged', () => {
  const dealer = { id: 'dealer-one', dealerProfile: {}, preferences: {} };
  expect(shouldShowDealerServicesNotice(dealer, 'dealer-one')).toBe(true);
  expect(shouldShowDealerServicesNotice(dealer, 'dealer-two')).toBe(false);
  expect(shouldShowDealerServicesNotice({ ...dealer, dealerProfile: null }, 'dealer-one')).toBe(false);
  expect(shouldShowDealerServicesNotice({ ...dealer, preferences: { dealerServicesNoticeV1: true } }, 'dealer-one')).toBe(false);
});
