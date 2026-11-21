import { apiClient } from './apiClient';

/** Shared, read-only transport for the website's /admin/auctions and /admin/transactions. */
export type AdminPersonSummary = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  dealerProfile?: { companyName?: string; isVerified?: boolean } | null;
};

export type AdminAuctionRecord = {
  id: string;
  status: string;
  reservePrice?: number | string | null;
  buyItNowPrice?: number | string | null;
  listing?: {
    id?: string;
    title?: string;
    vrm?: string | null;
    year?: number | null;
    make?: string | null;
    status?: string;
    images?: string[];
    seller?: AdminPersonSummary | null;
    bids?: Array<{ amount?: number | string | null }>;
    _count?: { bids?: number };
  } | null;
  winner?: AdminPersonSummary | null;
};

export type AdminTransactionRecord = {
  id: string;
  amount: number | string;
  type: string;
  status: string;
  createdAt?: string | null;
  description?: string | null;
  stripePaymentId?: string | null;
  user?: AdminPersonSummary | null;
  listing?: {
    id?: string;
    title?: string;
    year?: number;
    make?: string;
    hpiReport?: { status?: string; pdfUploadedAt?: string | null; isClear?: boolean | null } | null;
  } | null;
};

export type AdminTransactionFilters = { q?: string; status?: string; type?: string; from?: string; to?: string };
export type AdminPage<T> = { data: T[]; pagination: { total: number; page: number; limit: number; totalPages: number } };

function buildParams(page: number, limit: number, filters: Record<string, string | undefined>) {
  const p = new URLSearchParams({ page: String(Math.max(1, page)), limit: String(limit) });
  for (const [key, value] of Object.entries(filters)) {
    if (value?.trim()) p.set(key, value.trim());
  }
  return p.toString();
}

export async function getNativeAdminTransactions(page = 1, limit = 20, filters: AdminTransactionFilters = {}): Promise<AdminPage<AdminTransactionRecord>> {
  return apiClient<AdminPage<AdminTransactionRecord>>(`/admin/transactions?${buildParams(page, limit, filters)}`);
}

export async function getNativeAdminAuctions(page = 1, limit = 20, search = ''): Promise<AdminPage<AdminAuctionRecord>> {
  return apiClient<AdminPage<AdminAuctionRecord>>(`/admin/auctions?${buildParams(page, limit, { search })}`);
}

export function paymentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    DEPOSIT: 'Deposit', FULL_PAYMENT: 'Full Payment',
    COMMISSION: 'Auction Fee', REFUND: 'Refund',
    HPI_REPORT: 'Vehicle History Report',
    HPI_REPORT_EMAIL: 'Vehicle History Report (emailed)',
    LISTING_FEE: 'Listing Fee', BOOST: 'Boost',
    KYC_VERIFICATION: 'Dealer KYC',
  };
  return labels[type] || type;
}

export function requiresStripeReview(record: Pick<AdminTransactionRecord, 'type' | 'status' | 'createdAt'>, now = Date.now()) {
  if (record.type !== 'LISTING_FEE' || record.status !== 'PENDING' || !record.createdAt) return false;
  const elapsed = now - Date.parse(record.createdAt);
  return Number.isFinite(elapsed) && elapsed > 48 * 60 * 60 * 1000;
}

export function paymentStatusLabel(record: Pick<AdminTransactionRecord, 'type' | 'status' | 'createdAt'>, now = Date.now()) {
  if (requiresStripeReview(record, now)) return 'STRIPE REVIEW REQUIRED';
  if (record.type === 'LISTING_FEE' && record.status === 'PENDING') return 'PAYMENT UNCONFIRMED';
  return record.status;
}

export function paymentAmount(amount: number | string, isRefund = false) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  return (isRefund ? '-' : '') + '£' + value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function personName(person?: AdminPersonSummary | null) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim() || 'Unknown user';
}
