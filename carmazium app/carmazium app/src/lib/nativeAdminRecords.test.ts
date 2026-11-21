import {
  getNativeAdminAuctions, getNativeAdminTransactions, paymentAmount,
  paymentStatusLabel, paymentTypeLabel, personName, requiresStripeReview,
} from './nativeAdminRecords';
import { apiClient } from './apiClient';

jest.mock('./apiClient', () => ({ apiClient: jest.fn() }));
const api = apiClient as jest.Mock;

beforeEach(() => api.mockReset());

test('admin auctions uses same read-only backend endpoint as website with pagination/search', async () => {
  api.mockResolvedValueOnce({ data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } });
  await getNativeAdminAuctions(2, 20, '  AB12 CDE  ');
  expect(api).toHaveBeenCalledWith('/admin/auctions?page=2&limit=20&search=AB12+CDE');
  expect(api.mock.calls[0]).toHaveLength(1);
});

test('admin transactions filters pass through website query names', async () => {
  api.mockResolvedValueOnce({ data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } });
  await getNativeAdminTransactions(3, 20, {
    q: 'ABC 123', status: 'COMPLETED', type: 'LISTING_FEE', from: '2026-11-01', to: '2026-11-21',
  });
  const url: string = api.mock.calls[0][0];
  expect(url).toContain('/admin/transactions?');
  expect(url).toContain('page=3');
  expect(url).toContain('limit=20');
  expect(url).toContain('q=ABC+123');
  expect(url).toContain('status=COMPLETED');
  expect(url).toContain('type=LISTING_FEE');
  expect(url).toContain('from=2026-11-01');
  expect(url).toContain('to=2026-11-21');
  expect(api.mock.calls[0]).toHaveLength(1);
});

test('read-only admin calls have no POST/PATCH/DELETE options', async () => {
  api.mockResolvedValue({ data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } });
  await getNativeAdminAuctions();
  await getNativeAdminTransactions();
  expect(api.mock.calls.every(call => call.length === 1)).toBe(true);
});

test('pending listing fees are not shown as money received', () => {
  const now = Date.parse('2026-11-21T12:00:00Z');
  expect(requiresStripeReview({ type: 'LISTING_FEE', status: 'PENDING', createdAt: '2026-11-18T00:00:00Z' }, now)).toBe(true);
  expect(paymentStatusLabel({ type: 'LISTING_FEE', status: 'PENDING', createdAt: '2026-11-18T00:00:00Z' }, now)).toBe('STRIPE REVIEW REQUIRED');
  expect(paymentStatusLabel({ type: 'LISTING_FEE', status: 'PENDING', createdAt: '2026-11-21T00:00:00Z' }, now)).toBe('PAYMENT UNCONFIRMED');
  expect(paymentStatusLabel({ type: 'LISTING_FEE', status: 'COMPLETED' }, now)).toBe('COMPLETED');
});

test('transaction type and GBP/refund labels match website', () => {
  expect(paymentTypeLabel('HPI_REPORT_EMAIL')).toBe('Vehicle History Report (emailed)');
  expect(paymentTypeLabel('COMMISSION')).toBe('Auction Fee');
  expect(paymentAmount(9.99)).toBe('£9.99');
  expect(paymentAmount('1.0')).toBe('£1.00');
  expect(paymentAmount(250, true)).toBe('-£250.00');
  expect(personName({ firstName: 'Bob', lastName: 'Brown' })).toBe('Bob Brown');
});
