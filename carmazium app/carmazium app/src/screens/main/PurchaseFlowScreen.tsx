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
import { FontFamily } from '../../constants/typography';
import { useStripe } from '@stripe/stripe-react-native';
import { createPaymentSheet } from '../../lib/paymentsApi';

// ─────────────────────────────── types ────────────────────────────────

export interface PurchaseFlowParams {
  /** Listing being purchased */
  listingId: string;
  /** Agreed sale price in GBP */
  salePrice: number;
  /** Buyer platform fee in GBP (typically £95) */
  buyerFee?: number;
  /** Display title for the listing */
  listingTitle: string;
  /** First image URL */
  listingImage?: string;
  /** Seller / dealer display name */
  sellerName?: string;
  /** Payment type — defaults to FULL_PAYMENT */
  paymentType?: 'DEPOSIT' | 'FULL_PAYMENT';
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
  const params: PurchaseFlowParams = route?.params ?? {
    listingId: '',
    salePrice: 0,
    listingTitle: 'Vehicle',
    buyerFee: 95,
  };

  const {
    listingId,
    salePrice,
    buyerFee = 95,
    listingTitle,
    listingImage,
    sellerName,
    paymentType = 'FULL_PAYMENT',
  } = params;

  const total = salePrice + buyerFee;

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
            primary: '#DC1F26',
            background: '#111116',
            componentBackground: '#18181f',
            componentBorder: 'rgba(255,255,255,0.08)',
            componentDivider: 'rgba(255,255,255,0.06)',
            primaryText: '#FFFFFF',
            secondaryText: '#A0A0AB',
            componentText: '#FFFFFF',
            placeholderText: '#606070',
            icon: '#A0A0AB',
            error: '#DC1F26',
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
    } catch (err: any) {
      Alert.alert('Payment error', err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setPaying(false);
    }
  }, [listingId, total, paymentType, initPaymentSheet, presentPaymentSheet]);

  // ── Success screen ────────────────────────────────────────────────
  if (paid) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={['rgba(16,185,129,0.08)', 'rgba(0,0,0,0)', '#0A0A0C']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.4 }}
        />
        <View style={[styles.successWrap, { paddingTop: insets.top + 60 }]}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark-circle" size={56} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Payment successful</Text>
          <Text style={styles.successSub}>
            {fmt(total)} · {listingTitle}
          </Text>
          <Text style={styles.successNote}>
            Your payment has been received. The seller will be in touch to arrange handover.
          </Text>
          <TouchableOpacity
            style={styles.doneBtn}
            activeOpacity={0.8}
            onPress={() => navigation?.navigate('Tabs')}
          >
            <Text style={styles.doneBtnText}>BACK TO HOME</Text>
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
        colors={['rgba(220,31,38,0.03)', 'rgba(0,0,0,0)', '#0A0A0C']}
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
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation?.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerSub}>OFFER ACCEPTED</Text>
            <Text style={styles.headerTitle}>Complete purchase</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          {listingImage ? (
            <Image source={{ uri: listingImage }} style={styles.heroImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.heroImg, styles.heroImgPlaceholder]}>
              <Ionicons name="car-outline" size={24} color="#606070" />
            </View>
          )}
          <View style={styles.heroInfo}>
            <View style={styles.successRow}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#10B981" />
              <Text style={styles.successText}>Seller accepted your offer</Text>
            </View>
            <Text style={styles.heroCarTitle} numberOfLines={2}>
              {listingTitle}
            </Text>
            {sellerName ? <Text style={styles.heroDealer}>{sellerName}</Text> : null}
          </View>
        </View>

        {/* Order Summary */}
        <Text style={styles.sectionTitle}>ORDER SUMMARY</Text>
        <View style={styles.summaryBox}>
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
          <View style={styles.summaryDivider} />
          <View style={styles.summaryTotalRow}>
            <Text style={styles.summaryTotalLabel}>TOTAL PAYABLE</Text>
            <Text style={styles.summaryTotalValue}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Payment method note */}
        <View style={styles.paymentNote}>
          <Ionicons name="lock-closed-outline" size={16} color="#10B981" />
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
            <ActivityIndicator color="#FFFFFF" style={{ marginRight: 10 }} />
          ) : (
            <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" style={styles.btnIconLeft} />
          )}
          <Text style={styles.mainBtnText}>
            {paying ? 'PROCESSING…' : `CONFIRM PURCHASE · ${fmt(total)}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ──────────────────────────── styles ──────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerSub: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#10B981',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: 18, color: '#FFFFFF' },

  // Hero
  heroCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16,185,129,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  heroImg: { width: 64, height: 48, borderRadius: 8, marginRight: 16 },
  heroImgPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: { flex: 1 },
  successRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  successText: { fontFamily: FontFamily.medium, fontSize: 12, color: '#10B981', marginLeft: 6 },
  heroCarTitle: { fontFamily: FontFamily.bold, fontSize: 14, color: '#FFFFFF', marginBottom: 2 },
  heroDealer: { fontFamily: FontFamily.regular, fontSize: 12, color: '#A0A0AB' },

  // Summary
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  summaryBox: {
    backgroundColor: '#111116',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: { fontFamily: FontFamily.regular, fontSize: 14, color: '#A0A0AB' },
  summaryValue: { fontFamily: FontFamily.medium, fontSize: 14, color: '#FFFFFF' },
  summaryValueGreen: { fontFamily: FontFamily.bold, fontSize: 14, color: '#10B981' },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  summaryTotalValue: { fontFamily: FontFamily.bold, fontSize: 20, color: '#FFFFFF' },

  // Payment note
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16,185,129,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  paymentNoteText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#A0A0AB',
    lineHeight: 20,
  },

  bottomNote: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#606070',
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
    backgroundColor: '#0A0A0C',
  },
  mainBtn: {
    backgroundColor: '#DC1F26',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBtnDisabled: { opacity: 0.6 },
  mainBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
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
    borderColor: 'rgba(16,185,129,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  successSub: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: '#10B981',
    marginBottom: 16,
    textAlign: 'center',
  },
  successNote: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#A0A0AB',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  doneBtn: {
    backgroundColor: '#DC1F26',
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  doneBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
