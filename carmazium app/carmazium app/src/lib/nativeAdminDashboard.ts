import type { AdminStats } from './adminApi';

/** Keep in sync with DEFAULT_ADMIN_CARD_IDS in website admin dashboard. */
export const DEFAULT_ADMIN_CARD_IDS = ['users', 'listings', 'sold', 'auctions', 'bids', 'revenue'] as const;
export type AdminDashboardCardId =
  | (typeof DEFAULT_ADMIN_CARD_IDS)[number]
  | 'activeListings' | 'activeAuctions' | 'endedAuctions' | 'pendingHandovers'
  | 'transactions' | 'hpi' | 'dealerKyc' | 'messages'
  | 'analytics' | 'services' | 'cancellations' | 'blog';

export type AdminDashboardCard = {
  id: AdminDashboardCardId;
  label: string;
  icon: string;
  category: 'blue' | 'green' | 'amber' | 'violet' | 'red';
  route?: string;
  webPath?: string;
};

export const ADMIN_DASHBOARD_CARDS: AdminDashboardCard[] = [
  { id: 'users', label: 'Users', icon: 'people-outline', category: 'blue', route: 'AdminAccounts' },
  { id: 'listings', label: 'Listings', icon: 'car-outline', category: 'green', route: 'AdminListingsReview' },
  { id: 'activeListings', label: 'Active listings', icon: 'car-sport-outline', category: 'blue', route: 'AdminListingsReview' },
  { id: 'sold', label: 'Sold', icon: 'checkmark-done-outline', category: 'amber', route: 'AdminListingsReview' },
  { id: 'auctions', label: 'Auctions', icon: 'hammer-outline', category: 'violet', route: 'AdminAuctions' },
  { id: 'activeAuctions', label: 'Active auctions', icon: 'timer-outline', category: 'blue', route: 'AdminAuctions' },
  { id: 'endedAuctions', label: 'Ended auctions', icon: 'archive-outline', category: 'violet', route: 'AdminAuctions' },
  { id: 'bids', label: 'Bids', icon: 'trending-up-outline', category: 'violet', route: 'AdminAuctions' },
  { id: 'revenue', label: 'Revenue', icon: 'cash-outline', category: 'amber', route: 'AdminTransactions' },
  { id: 'pendingHandovers', label: 'Pending handovers', icon: 'hand-left-outline', category: 'amber', route: 'AdminHandovers' },
  { id: 'transactions', label: 'Transactions', icon: 'receipt-outline', category: 'green', route: 'AdminTransactions' },
  { id: 'hpi', label: 'Vehicle history', icon: 'shield-checkmark-outline', category: 'violet', webPath: '/dashboard/admin/hpi' },
  { id: 'dealerKyc', label: 'Dealer KYC', icon: 'shield-outline', category: 'blue', route: 'AdminDealerKyc' },
  { id: 'messages', label: 'Messages', icon: 'chatbubbles-outline', category: 'violet', webPath: '/dashboard/admin/messages' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics-outline', category: 'green', webPath: '/dashboard/admin/analytics' },
  { id: 'services', label: 'Trade services', icon: 'briefcase-outline', category: 'blue', webPath: '/dashboard/admin/services' },
  { id: 'cancellations', label: 'Sale cancellations', icon: 'close-circle-outline', category: 'red', webPath: '/dashboard/admin/cancellations' },
  { id: 'blog', label: 'Blog', icon: 'newspaper-outline', category: 'amber', webPath: '/dashboard/admin/blog' },
];

const adminIds = new Set<AdminDashboardCardId>(ADMIN_DASHBOARD_CARDS.map(card => card.id));

export function normalizeAdminCardIds(input: unknown): AdminDashboardCardId[] {
  if (!Array.isArray(input)) return [...DEFAULT_ADMIN_CARD_IDS];
  return Array.from(new Set(input.filter(
    (value): value is AdminDashboardCardId =>
      typeof value === 'string' && adminIds.has(value as AdminDashboardCardId),
  )));
}

const numericStatFields: Partial<Record<AdminDashboardCardId, keyof AdminStats>> = {
  users: 'totalUsers',
  listings: 'totalListings',
  activeListings: 'activeListings',
  sold: 'soldListings',
  auctions: 'totalAuctions',
  activeAuctions: 'activeAuctions',
  endedAuctions: 'endedAuctions',
  bids: 'totalBids',
  revenue: 'totalRevenue',
};

export function getAdminCardValue(id: AdminDashboardCardId, stats: AdminStats | null, pending: number | null): string {
  if (id === 'pendingHandovers') return pending == null ? '—' : pending.toLocaleString('en-GB');
  if (!stats) return '—';
  if (id === 'revenue') return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(stats.totalRevenue);
  const key = numericStatFields[id];
  return key ? stats[key].toLocaleString('en-GB') : 'Open';
}
