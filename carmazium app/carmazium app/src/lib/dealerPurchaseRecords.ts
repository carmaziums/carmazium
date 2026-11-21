export interface ReconciledPurchase {
  id: string;
  listingId: string;
  vehicleTitle: string;
  sellerName: string;
  originalListedAt: string;
  originalAuctionListingId?: string;
  registration?: string;
  imageUrl: string | null;
  vehicleSubtitle: string;
  collectedAt?: string;
  purchaseDate: string;
  buyerCollectedAt: string;
  purchasePrice: number | null;
  purchaseChannel: 'RECONCILED';
}

/** Preserve the website's status precedence: a completed collection must not
 * be downgraded to Purchased simply because the listing was sold retail. */
export function normalisePurchaseStatus(item: { status: string; retailSold?: boolean; offerAccepted?: boolean }) {
  if (item.status === 'AWAITING_CONFIRMATION' && item.retailSold) return 'SOLD';
  if (item.status === 'AWAITING_CONFIRMATION' && item.offerAccepted) return 'SALE_CONFIRMED';
  return item.status;
}

export function mapReconciledPurchases(records: ReconciledPurchase[]) {
  if (!Array.isArray(records)) throw Error('Recovered purchase records unavailable.');
  return records.map(item => ({
    ...item,
    imageUrl: item.imageUrl ?? undefined,
    purchasePrice: item.purchasePrice ?? 0,
    purchasePriceUnrecorded: item.purchasePrice === null,
    reconciledPurchase: true,
    status: 'CHECKS_COMPLETE' as const,
  }));
}

export function purchaseReceiptPath(id: string, reconciled = false) {
  return `/dealers/purchases/${reconciled ? 'reconciled/' : ''}${encodeURIComponent(id)}/receipt.pdf`;
}
