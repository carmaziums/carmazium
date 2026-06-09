import { apiClient } from './apiClient';

export interface PaymentSheetParams {
  listingId: string;
  amount: number;
  type?: 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION';
  currency?: string;
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
