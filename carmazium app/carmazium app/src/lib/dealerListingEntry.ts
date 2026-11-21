/** Website dealer listing wizard's first screen: explicit auction or retail choice. */
export type DealerListingChoice = {
  method: 'AUCTION' | 'CLASSIFIED';
  title: string;
  action: string;
  description: string;
  benefits: readonly string[];
};

export const DEALER_LISTING_CHOICES: readonly DealerListingChoice[] = [
  {
    method: 'AUCTION',
    title: 'Auction',
    action: 'List for Auction',
    description: 'Let verified motor dealers bid for your vehicle in real time. Live auctions include anti-snipe protection.',
    benefits: [
      'Free to list',
      'Real-time live bidding',
      'Anti-snipe protection',
      'Set your reserve price',
      'Connect with winner via chat',
    ],
  },
  {
    method: 'CLASSIFIED',
    title: 'Retail Listing',
    action: 'Start Listing',
    description: 'Set your asking price and let buyers submit offers. You choose who to accept.',
    benefits: [
      'Starting from £1',
      'Registration lookup for motor vehicles',
      'Set your own asking price',
      'Reach retail buyers across the UK',
    ],
  },
];

export const DEALER_LISTING_STEPS: readonly { index: number; title: string }[] = [
  { index: 1, title: 'Details' },
  { index: 2, title: 'Media' },
  { index: 3, title: 'Pricing' },
  { index: 4, title: 'Review' },
];
