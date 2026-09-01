import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { useStripe } from '@stripe/stripe-react-native';
import { createPaymentSheet } from '../../lib/paymentsApi';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';

import { IconButton } from '../../components/IconButton';
// ─────────────────────────────── types ────────────────────────────────

export interface PurchaseFlowParams {
  /** Listing being purchased */
  listingId: string;
  /**
   * Agreed sale price in GBP. Ignored when paymentType is 'COMMISSION' —
   * the auction buyer fee is a standalone charge of `buyerFee` alone.
   */
  salePrice: number;
  /**
   * Buyer platform fee in GBP. **Required** — every caller must state the fee
   * it is charging.
   *
   * This was optional with a £95 default, while web's constant is £125
   * (`src/app/checkout/page.tsx:16`). All five live callers passed 125
   * explicitly, so the £95 path was unreachable rather than actively
   * mispricing anything — but it was one forgetful caller away from silently
   * undercharging by £30 on a real payment. Making it required means the
   * compiler catches that caller instead of the accounting (OQ-9 / BUY-028).
   */
  buyerFee: number;
  /** Display title for the listing */
  listingTitle: string;
  /** First image URL */
  listingImage?: string;
  /** Seller / dealer display name */
  sellerName?: string;
  /**
   * Payment type — defaults to FULL_PAYMENT.
   * 'COMMISSION' is used by auction winners paying the £125 buyer fee.
   */
  paymentType?: 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION';
  /**
   * Optional auction id — when set and paymentType is 'COMMISSION' the
   * screen refetches the auction after a successful payment so the
   * caller sees `buyerFeePaid = true` on next render.
   */
  auctionId?: string;
}

// ──────────────────────────── helpers ─────────────────────────────────

const fmt = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ═══════════════════════════ COMPONENT ════════════════════════════════

export const PurchaseFlowScreen: React.FC<{ navigation?: any; route?: any }> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Nav params — graceful fallback so the screen never crashes if navigated bare
  // Bare-navigation fallback so the screen cannot crash. The zero fee here is
  // deliberate and safe: with no listingId the payment path is unusable anyway,
  // and a visible £0 is a far better failure than a plausible-looking wrong
  // charge (OQ-9).
  const params: PurchaseFlowParams = route?.params ?? {
    listingId: '',
    salePrice: 0,
    listingTitle: 'Vehicle',
    buyerFee: 0,
  };

  const {
    listingId,
    salePrice,
    buyerFee,
    listingTitle,
    listingImage,
    sellerName,
    paymentType = 'FULL_PAYMENT',
    auctionId,
  } = params;

  const isCommission = paymentType === 'COMMISSION';
  /** An auction buyer fee, as opposed to a retail purchase — the two want
   *  different next steps on success. */
  const isWonAuctionFee = isCommission && !!auctionId;
  // Auction winners pay only the platform commission — no sale price is
  // being settled here (they still owe the seller the winning bid amount
  // out-of-band). For deposits and full payments the sale price stacks
  // with the buyer fee.
  const total = isCommission ? buyerFee : salePrice + buyerFee;

  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const handlePay = useCallback(async () => {
    if (!listingId) {
      Alert.alert('Error', 'No listing selected.');
      return;
    }

    setPaying(true);
    try {
      // 1. Ask the backend to create a PaymentIntent + EphemeralKey
      const sheet = await createPaymentSheet({
        listingId,
        amount: total,
        type: paymentType,
        currency: 'gbp',
      });

      // 2. Initialise the Payment Sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Carmazium',
        customerId: sheet.customerId,
        customerEphemeralKeySecret: sheet.ephemeralKey,
        paymentIntentClientSecret: sheet.clientSecret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {},
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

      if (initError) {
        Alert.alert('Payment error', initError.message);
        return;
      }

      // 3. Present the native Payment Sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Payment failed', presentError.message);
        }
        return;
      }

      // 4. Payment succeeded — show success state
      setPaid(true);

      // For auction commission payments, refetch the auction so downstream
      // screens (LiveAuctionDetailed) observe buyerFeePaid = true on their
      // next render. The Stripe webhook flips the flag server-side; we do
      // NOT set it optimistically.
      if (isCommission && auctionId) {
        try {
          await apiClient(`/auctions/${auctionId}`);
        } catch {
          // Non-fatal — user still sees success. Auction screen will
          // refetch on its own mount.
        }
      }
    } catch (err: any) {
      Alert.alert('Payment error', err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setPaying(false);
    }
  }, [listingId, total, paymentType, initPaymentSheet, presentPaymentSheet, isCommission, auctionId]);

  // ── Success screen ────────────────────────────────────────────────
  if (paid) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={[Colors.accentGreenAlpha08, 'rgba(0,0,0,0)', Colors.bgPrimary]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.4 }}
        />
        <View style={[styles.successWrap, { paddingTop: insets.top + 60 }]}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.accentGreen} />
          </View>
          <Text style={styles.successTitle}>Payment successful</Text>
          <Text style={styles.successSub}>
            {fmt(total)} · {listingTitle}
          </Text>
          <Text style={styles.successNote}>
            {isWonAuctionFee
              ? 'Your payment has been received. Next, arrange handover with the seller from your won auctions.'
              : 'Your payment has been received. The seller will be in touch to arrange handover.'}
          </Text>
          {/* This used to always send the user Home, which left an auction
              winner with no signal about what to do next. Web's checkout
              success page (checkout/success/page.tsx:34,198-204) routes an
              auction buyer-fee payment to their won-auctions list precisely so
              they go on to submit handover proof. */}
          <TouchableOpacity
            style={styles.doneBtn}
            activeOpacity={0.8}
            onPress={() =>
              isWonAuctionFee
                ? navigation?.navigate('BuyerBids')
                : navigation?.navigate('Tabs')
            }
          >
            <Text style={styles.doneBtnText}>
              {isWonAuctionFee ? 'VIEW MY AUCTIONS' : 'BACK TO HOME'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Payment screen ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha03, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.3 }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 14, paddingBottom: 140 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />
          <View style={styles.headerCenter}>
            <Text style={styles.headerSub}>
              {isCommission ? 'AUCTION WON' : 'OFFER ACCEPTED'}
            </Text>
            <Text style={styles.headerTitle}>
              {isCommission ? 'Pay auction fee' : 'Complete purchase'}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          {listingImage ? (
            <Image source={{ uri: listingImage }} style={styles.heroImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.heroImg, styles.heroImgPlaceholder]}>
              <Ionicons name="car-outline" size={24} color={Colors.iconMuted} />
            </View>
          )}
          <View style={styles.heroInfo}>
            <View style={styles.successRow}>
              <Ionicons
                name={isCommission ? 'trophy-outline' : 'checkmark-circle-outline'}
                size={14}
                color={Colors.accentGreen}
              />
              <Text style={styles.successText}>
                {isCommission ? 'You won this auction' : 'Seller accepted your offer'}
              </Text>
            </View>
            <Text style={styles.heroCarTitle} numberOfLines={2}>
              {listingTitle}
            </Text>
            {sellerName ? <Text style={styles.heroDealer}>{sellerName}</Text> : null}
          </View>
        </View>

        {/* Order Summary */}
        <Text style={styles.sectionTitle}>
          {isCommission ? 'FEE BREAKDOWN' : 'ORDER SUMMARY'}
        </Text>
        <View style={styles.summaryBox}>
          {isCommission ? (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Auction buyer fee</Text>
                <Text style={styles.summaryValue}>{fmt(buyerFee)}</Text>
              </View>
              <Text style={styles.commissionNote}>
                Unlocks chat with the seller and releases the £100 seller payout on
                handover approval. The winning bid is paid to the seller directly
                out-of-band.
              </Text>
            </>
          ) : (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Agreed sale price</Text>
                <Text style={styles.summaryValue}>{fmt(salePrice)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Carmazium buyer fee</Text>
                <Text style={styles.summaryValue}>{fmt(buyerFee)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>HPI check</Text>
                <Text style={styles.summaryValueGreen}>Included</Text>
              </View>
            </>
          )}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryTotalRow}>
            <Text style={styles.summaryTotalLabel}>TOTAL PAYABLE</Text>
            <Text style={styles.summaryTotalValue}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Payment method note */}
        <View style={styles.paymentNote}>
          <Ionicons name="lock-closed-outline" size={16} color={Colors.accentGreen} />
          <Text style={styles.paymentNoteText}>
            Secure payment via Stripe. Card, Apple Pay &amp; Google Pay accepted.
          </Text>
        </View>

        <Text style={styles.bottomNote}>
          Payment is processed securely via Stripe. The seller will be notified to arrange handover once payment is received.
        </Text>
      </ScrollView>

      {/* Floating CTA */}
      <View style={[styles.floatingBottom, { paddingBottom: insets.bottom || 20 }]}>
        <TouchableOpacity
          style={[styles.mainBtn, paying && styles.mainBtnDisabled]}
          onPress={handlePay}
          activeOpacity={0.85}
          disabled={paying}
        >
          {paying ? (
            <ActivityIndicator color={Colors.white} style={{ marginRight: 10 }} />
          ) : (
            <Ionicons name="lock-closed-outline" size={18} color={Colors.white} style={styles.btnIconLeft} />
          )}
          <Text style={styles.mainBtnText}>
            {paying
              ? 'PROCESSING…'
              : isCommission
                ? `PAY FEE · ${fmt(total)}`
                : `CONFIRM PURCHASE · ${fmt(total)}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ──────────────────────────── styles ──────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scrollContent: { paddingHorizontal: 20 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerSub: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.accentGreen,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },

  // Hero
  heroCard: {
    flexDirection: 'row',
    backgroundColor: Colors.accentGreenAlpha05,
    borderWidth: 1,
    borderColor: Colors.accentGreenAlpha20,
    borderRadius: Radius.card,
    padding: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  heroImg: { width: 64, height: 48, borderRadius: 8, marginRight: 16 },
  heroImgPlaceholder: {
    backgroundColor: Colors.whiteAlpha04,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: { flex: 1 },
  successRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  successText: { fontFamily: FontFamily.medium, fontSize: FontSize.size12, color: Colors.accentGreen, marginLeft: 6 },
  heroCarTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.white, marginBottom: 2 },
  heroDealer: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textSecondary },

  // Summary
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.white,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  summaryBox: {
    backgroundColor: Colors.bgSecondaryAlt,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    borderRadius: Radius.card,
    padding: 20,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.size14, color: Colors.textSecondary },
  summaryValue: { fontFamily: FontFamily.medium, fontSize: FontSize.size14, color: Colors.white },
  summaryValueGreen: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.accentGreen },
  commissionNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha06,
    marginVertical: 4,
    marginBottom: 20,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTotalLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    letterSpacing: 1,
  },
  summaryTotalValue: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.white },

  // Payment note
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.accentGreenAlpha05,
    borderWidth: 1,
    borderColor: Colors.accentGreenAlpha15,
    borderRadius: Radius.inline,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  paymentNoteText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  bottomNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.iconMuted,
    textAlign: 'center',
    marginTop: 4,
  },

  // Floating button
  floatingBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: Colors.bgPrimary,
  },
  mainBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.inline,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBtnDisabled: { opacity: 0.6 },
  mainBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 1,
  },
  btnIconLeft: { marginRight: 10 },

  // Success screen
  successWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 2,
    borderColor: Colors.accentGreenAlpha30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.white,
    marginBottom: 8,
  },
  successSub: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.accentGreen,
    marginBottom: 16,
    textAlign: 'center',
  },
  successNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  doneBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.inline,
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  doneBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 1,
  },
});
