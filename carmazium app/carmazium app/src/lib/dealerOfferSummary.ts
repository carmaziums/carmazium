/**
 * Keep the native dealer Offers received metrics identical to the website:
 * src/app/dashboard/dealer/offers/page.tsx
 */
export interface DealerOfferMetric {
  key: 'pending' | 'accepted' | 'total';
  label: string;
  count: number;
  hint: string;
  icon: string;
  tone: 'warning' | 'success' | 'info';
}

export function getDealerOfferMetrics(offers: readonly { status: string }[]): DealerOfferMetric[] {
  return [
    {
      key: 'pending', label: 'Pending Offers',
      count: offers.filter(offer => offer.status === 'PENDING').length,
      hint: 'Action Required', icon: 'time-outline', tone: 'warning',
    },
    {
      key: 'accepted', label: 'Accepted',
      count: offers.filter(offer => offer.status === 'ACCEPTED').length,
      hint: 'Closed', icon: 'trophy-outline', tone: 'success',
    },
    {
      key: 'total', label: 'Total Received',
      count: offers.length,
      hint: '', icon: 'pricetag-outline', tone: 'info',
    },
  ];
}
