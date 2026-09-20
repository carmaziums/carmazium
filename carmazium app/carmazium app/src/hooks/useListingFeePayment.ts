import { useStripe } from '@stripe/stripe-react-native';
import { createPaymentSheet } from '../lib/paymentsApi';
import { Colors } from '../constants/colors';

const LISTING_FEES: Record<'BASIC' | 'STANDARD' | 'PREMIUM', number> = {
  BASIC: 1,
  STANDARD: 10,
  PREMIUM: 25,
};

// Shared with SellCarFlowScreen.tsx's own inline copy of this flow (new-listing
// publish) — extracted here so SellerListingsScreen (publishing an existing
// DRAFT) can trigger the same native Stripe Payment Sheet instead of skipping
// the fee entirely via a bare PATCH /status call.
export function useListingFeePayment() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  async function triggerListingFeePayment(
    listingId: string,
    tier: 'BASIC' | 'STANDARD' | 'PREMIUM',
  ): Promise<boolean> {
    const amount = LISTING_FEES[tier];
    const sheet = await createPaymentSheet({ listingId, amount, type: 'LISTING_FEE', currency: 'gbp', badgeTier: tier });
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: 'Carmazium',
      customerId: sheet.customerId,
      customerEphemeralKeySecret: sheet.ephemeralKey,
      paymentIntentClientSecret: sheet.clientSecret,
      allowsDelayedPaymentMethods: false,
      appearance: {
        colors: {
          primary: Colors.accent,
          background: Colors.bgSecondaryAlt,
          componentBackground: Colors.deepBlue_18181f,
          componentBorder: Colors.whiteAlpha08Hex,
          componentDivider: Colors.whiteAlpha06Hex,
          primaryText: Colors.white,
          secondaryText: Colors.textSecondary,
          componentText: Colors.white,
          placeholderText: Colors.iconMuted,
          icon: Colors.textSecondary,
          error: Colors.accent,
        },
      },
    });
    if (initError) throw new Error(initError.message);

    const { error: presentError } = await presentPaymentSheet();
    if (presentError) {
      if (presentError.code !== 'Canceled') throw new Error(presentError.message);
      return false; // user cancelled
    }
    return true;
  }

  return { triggerListingFeePayment };
}
