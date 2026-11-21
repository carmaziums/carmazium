import { nativeGuidedTourKey, shouldAutoRunNativeTour, NATIVE_GUIDED_TOUR_VERSION } from './nativeTourCompletion';
import { nativeTourDestination } from './nativeTourRoutes';

describe('single production native tour and mainline parity', () => {
  test('a web-completed account still receives an independent native tour once', () => {
    expect(shouldAutoRunNativeTour(null)).toBe(true);
    expect(shouldAutoRunNativeTour('completed')).toBe(false);
    expect(shouldAutoRunNativeTour('skipped')).toBe(false);
    expect(shouldAutoRunNativeTour('unexpected')).toBe(true);
  });
  test('completion marker is per account and versioned', () => {
    expect(NATIVE_GUIDED_TOUR_VERSION).toBeGreaterThan(2);
    expect(nativeGuidedTourKey('dealer-A')).not.toBe(nativeGuidedTourKey('buyer-B'));
    expect(nativeGuidedTourKey('dealer-A')).toMatch(/native-guided-tour:v\d+:dealer-A/);
  });
  test('admin tour opens only existing, safe native destinations', () => {
    expect(nativeTourDestination('/dashboard/admin')).toEqual({ screen: 'AdminDashboard' });
    expect(nativeTourDestination('/dashboard/admin/listings')).toEqual({ screen: 'AdminListingsReview' });
    expect(nativeTourDestination('/dashboard/admin/dealer-verification')).toEqual({ screen: 'AdminDealerKyc' });
    expect(nativeTourDestination('/dashboard/admin/users')).toEqual({ screen: 'AdminAccounts' });
    expect(nativeTourDestination('/dashboard/admin/transactions')).toEqual({ screen: 'AdminTransactions' });
    expect(nativeTourDestination('/dashboard/admin/handovers')).toEqual({ screen: 'AdminHandovers' });
    expect(nativeTourDestination('/dashboard/admin/transactions?action=refund')).toEqual({ screen: 'AdminTransactions' });
  });
  test('unknown or potentially destructive admin routes do not navigate', () => {
    for (const route of ['/dashboard/admin/payments/refund', '/dashboard/admin/approve', '/dashboard/admin/messages', 'https://example.com']) {
      expect(nativeTourDestination(route)).toBeNull();
    }
  });
});
