import { getDealerOfferMetrics } from './dealerOfferSummary';

describe('dealer Offers received metrics match website', () => {
  test('uses the website labels, statuses and tone order', () => {
    expect(getDealerOfferMetrics([])).toEqual([
      { key: 'pending', label: 'Pending Offers', count: 0, hint: 'Action Required', icon: 'time-outline', tone: 'warning' },
      { key: 'accepted', label: 'Accepted', count: 0, hint: 'Closed', icon: 'trophy-outline', tone: 'success' },
      { key: 'total', label: 'Total Received', count: 0, hint: '', icon: 'pricetag-outline', tone: 'info' },
    ]);
  });

  test('withdrawn, countered and rejected count in total but not pending/accepted', () => {
    const metrics = getDealerOfferMetrics([
      { status: 'PENDING' }, { status: 'ACCEPTED' }, { status: 'COUNTERED' },
      { status: 'WITHDRAWN' }, { status: 'REJECTED' }, { status: 'PENDING' },
    ]);
    expect(metrics.map(x => x.count)).toEqual([2, 1, 6]);
  });

  test('the single withdrawn offer seen in the live dealer session displays total 1', () => {
    expect(getDealerOfferMetrics([{ status: 'WITHDRAWN' }]).map(x => x.count)).toEqual([0, 0, 1]);
  });
});
