import {
  ADMIN_DASHBOARD_CARDS, DEFAULT_ADMIN_CARD_IDS,
  normalizeAdminCardIds, getAdminCardValue,
} from './nativeAdminDashboard';
import type { AdminStats } from './adminApi';

const stats: AdminStats = {
  totalUsers: 1653,
  totalListings: 869,
  activeListings: 200,
  soldListings: 66,
  totalAuctions: 809,
  activeAuctions: 8,
  endedAuctions: 801,
  totalBids: 1964,
  totalRevenue: 1264.85,
};

test('website default admin card order is preserved', () => {
  expect(DEFAULT_ADMIN_CARD_IDS).toEqual(['users', 'listings', 'sold', 'auctions', 'bids', 'revenue']);
});

test('all 18 admin card types are unique, clickable and backed by a real destination', () => {
  expect(ADMIN_DASHBOARD_CARDS).toHaveLength(18);
  expect(new Set(ADMIN_DASHBOARD_CARDS.map(card => card.id)).size).toBe(18);
  for (const card of ADMIN_DASHBOARD_CARDS) {
    expect(Boolean(card.route) !== Boolean(card.webPath)).toBe(true);
  }
});

test('server-side saved card preferences round-trip and deduplicate', () => {
  expect(normalizeAdminCardIds(['users', 'revenue', 'users', 'unknown'])).toEqual(['users', 'revenue']);
  expect(normalizeAdminCardIds(undefined)).toEqual([...DEFAULT_ADMIN_CARD_IDS]);
  expect(normalizeAdminCardIds([])).toEqual([]);
});

test('values match the website admin stat fields', () => {
  expect(getAdminCardValue('users', stats, 3)).toBe('1,653');
  expect(getAdminCardValue('listings', stats, 3)).toBe('869');
  expect(getAdminCardValue('sold', stats, 3)).toBe('66');
  expect(getAdminCardValue('auctions', stats, 3)).toBe('809');
  expect(getAdminCardValue('bids', stats, 3)).toBe('1,964');
  expect(getAdminCardValue('revenue', stats, 3)).toBe('£1,264.85');
  expect(getAdminCardValue('pendingHandovers', stats, 3)).toBe('3');
  expect(getAdminCardValue('transactions', stats, 3)).toBe('Open');
  expect(getAdminCardValue('users', null, 3)).toBe('—');
});
