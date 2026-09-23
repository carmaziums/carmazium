import { apiClient } from './apiClient';

export type PaymentSheetType =
  | 'DEPOSIT'
  | 'FULL_PAYMENT'
  | 'COMMISSION'
  | 'LISTING_FEE'
  | 'HPI_REPORT'
  | 'BOOST';

export interface PaymentSheetParams {
  listingId: string;
  amount: number;
  type?: PaymentSheetType;
  currency?: string;
  /** Required when type is 'LISTING_FEE' — tells the backend webhook which tier to activate the listing at. */
  badgeTier?: 'BASIC' | 'STANDARD' | 'PREMIUM';
  /** Required when type is 'HPI_REPORT' — tells the backend webhook which VRM to run the check against. */
  vrm?: string;
}

export interface PaymentSheetResult {
  clientSecret: string;
  ephemeralKey: string;
  customerId: string;
  transactionId: string;
  publishableKey: string;
}

/**
 * Ask the backend to create a Stripe PaymentIntent + EphemeralKey
 * for the React Native Payment Sheet.
 */
export async function createPaymentSheet(
  params: PaymentSheetParams,
): Promise<PaymentSheetResult> {
  const res = await apiClient<{ success: boolean; data: PaymentSheetResult }>(
    '/payments/intent',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  );
  return res.data;
}


export interface AuctionFeeReconciliationResult {
  applied: boolean;
  status: string;
}

/**
 * Confirm a native auction buyer-fee PaymentIntent against Stripe and apply
 * the auction unlock server-side. This is the native equivalent of the web
 * checkout success fallback and prevents the app from declaring success before
 * a delayed webhook has updated the auction.
 */
export async function reconcileAuctionFeeIntent(
  transactionId: string,
): Promise<AuctionFeeReconciliationResult> {
  const res = await apiClient<{ success: boolean; data: AuctionFeeReconciliationResult }>(
    '/payments/reconcile-auction-fee-intent',
    {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    },
  );
  return res.data;
}
