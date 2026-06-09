import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily } from '../../constants/typography';
import { Colors } from '../../constants/colors';
import { useStripe } from '@stripe/stripe-react-native';
import { createPaymentSheet } from '../../lib/paymentsApi';
import { apiClient } from '../../lib/apiClient';

// ─────────────────────────────── types ────────────────────────────────

export interface AuctionCompleteParams {
  /** Listing ID (used to create the payment intent) */
  listingId: string;
  /** Auction ID — used to track buyer fee payment */
  auctionId: string;
  /** Winning bid amount in GBP */
  hammerPrice: number;
  /** Buyer fee in GBP (default £125) */
  buyerFee?: number;
  /** Number of bids placed */
  bidCount?: number;
  /** Lot number label */
  lotNumber?: string;
  /** Display title for the car */
  listingTitle: string;
  /** First image URL */
  listingImage?: string;
  /** ISO 8601 deadline by which payment must be made */
  paymentDeadline?: string;
}

// ──────────────────────────── helpers ─────────────────────────────────

const fmt = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatCountdown = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':');
};

// ═══════════════════════════ COMPONENT ════════════════════════════════

export const AuctionCompleteScreen: React.FC<{ navigation?: any; route?: any }> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Nav params
  const params: AuctionCompleteParams = route?.params ?? {
    listingId: '',
    auctionId: '',
    hammerPrice: 0,
    listingTitle: 'Vehicle',
    buyerFee: 125,
  };

  const {
    listingId,
    hammerPrice,
    buyerFee = 125,
    bidCount,
    lotNumber,
    listingTitle,
    listingImage,
    paymentDeadline,
  } = params;

  // Countdown — initialised from paymentDeadline if provided, else 24h default
  const getInitialSeconds = () => {
    if (paymentDeadline) {
      const diff = Math.floor(
        (new Date(paymentDeadline).getTime() - Date.now()) / 1000,
      );
      return Math.max(0, diff);
    }
    return 24 * 3600; // 24h fallback
  };

  const [timeLeft, setTimeLeft] = useState(getInitialSeconds);
  useEffect(() => {
    const timer = setInterval(
      () => setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  // ── Seller review state (shown in success screen) ─────────────────────────
  const [sellerProfileId, setSellerProfileId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  const handlePayFee = useCallback(async () => {
    if (!listingId) {
      Alert.alert('Error', 'No listing found for this auction.');
      return;
    }
    if (timeLeft === 0) {
      Alert.alert('Deadline passed', 'The payment deadline has passed. Please contact support.');
      return;
    }

    setPaying(true);
    try {
      // 1. Create PaymentIntent for the auction buyer fee (COMMISSION type)
      const sheet = await createPaymentSheet({
        listingId,
        amount: buyerFee,
        type: 'COMMISSION',
        currency: 'gbp',
      });

      // 2. Initialise Payment Sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Carmazium',
        customerId: sheet.customerId,
        customerEphemeralKeySecret: sheet.ephemeralKey,
        paymentIntentClientSecret: sheet.clientSecret,
        allowsDelayedPaymentMethods: false,
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

      // 4. Fee paid — show success state
      setPaid(true);
    } catch (err: any) {
      Alert.alert('Payment error', err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setPaying(false);
    }
  }, [listingId, buyerFee, timeLeft, initPaymentSheet, presentPaymentSheet]);

  // ── Fetch seller profile ID once payment succeeds ──────────────────────────
  useEffect(() => {
    if (!paid || !listingId || sellerProfileId) return;
    apiClient<{ success: boolean; data: any }>(`/listings/${listingId}`)
      .then((res) => {
        const sp = res?.data?.seller?.sellerProfile;
        if (sp?.id) setSellerProfileId(sp.id);
      })
      .catch(() => {});
  }, [paid, listingId, sellerProfileId]);

  // ── Submit seller review ────────────────────────────────────────────────────
  const handleSubmitReview = useCallback(async () => {
    if (!sellerProfileId || reviewRating === 0 || submittingReview) return;
    setSubmittingReview(true);
    try {
      await apiClient('/sellers/reviews', {
        method: 'POST',
        body: JSON.stringify({
          sellerId: sellerProfileId,
          listingId,
          rating: reviewRating,
          ...(reviewComment.trim().length >= 10
            ? { comment: reviewComment.trim() }
            : {}),
        }),
      });
      setReviewDone(true);
    } catch (err: any) {
      Alert.alert(
        'Review failed',
        err?.message ?? 'Could not submit review. You may have already reviewed this seller.',
      );
    } finally {
      setSubmittingReview(false);
    }
  }, [sellerProfileId, listingId, reviewRating, reviewComment, submittingReview]);

  // ── Fee paid — confirmation screen ───────────────────────────────
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
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 20, paddingBottom: 60 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={{ width: 38 }} />
            <View style={styles.headerCenter}>
              <Text style={styles.headerLabelGreen}>PURCHASE COMPLETE</Text>
              <Text style={styles.headerTitle}>Handover confirmed</Text>
            </View>
            <View style={{ width: 38 }} />
          </View>

          {/* Car Card */}
          <View style={styles.carCard}>
            {listingImage ? (
              <Image source={{ uri: listingImage }} style={styles.carImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.carImg, styles.carImgPlaceholder]}>
                <Ionicons name="car-outline" size={20} color="#606070" />
              </View>
            )}
            <View style={styles.carInfo}>
              <Text style={styles.carTitle} numberOfLines={2}>{listingTitle}</Text>
              <View style={styles.carStatusRow}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#10B981" />
                <Text style={styles.carStatusText}>Fee paid · Handover to be arranged</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionLabel}>YOUR JOURNEY</Text>

          <View style={styles.journeyBox}>
            {[
              { label: 'Auction ended', done: true },
              { label: 'Buyer fee paid', done: true, bold: true },
              { label: 'Handover to be booked', done: false },
              { label: 'Handover confirmed', done: false },
            ].map((item, i, arr) => (
              <View key={i} style={styles.journeyItemWrap}>
                <View style={styles.journeyItem}>
                  <View style={[styles.journeyCircle, item.done && styles.journeyCircleDone]}>
                    {item.done ? (
                      <Ionicons name="checkmark" size={14} color="#10B981" />
                    ) : (
                      <View style={styles.journeyCirclePending} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.journeyLabel,
                      item.done && styles.journeyLabelDone,
                      item.bold && styles.journeyLabelBold,
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
                {i < arr.length - 1 && (
                  <View style={[styles.journeyLine, !item.done && styles.journeyLinePending]} />
                )}
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>WHAT HAPPENS NEXT</Text>
          <View style={styles.nextBox}>
            <Text style={styles.nextText}>
              The seller has been notified. They will contact you within 24 hours to arrange
              handover. Check your messages in the app.
            </Text>
          </View>

          {/* ── Seller review ── */}
          {sellerProfileId && (
            <View style={styles.reviewBox}>
              <Text style={styles.reviewTitle}>Rate your seller</Text>
              <Text style={styles.reviewSub}>How was your experience?</Text>

              {reviewDone ? (
                <View style={styles.reviewDoneRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.reviewDoneText}>Review submitted — thank you!</Text>
                </View>
              ) : (
                <>
                  {/* Stars */}
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setReviewRating(star)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <Ionicons
                          name={star <= reviewRating ? 'star' : 'star-outline'}
                          size={32}
                          color={star <= reviewRating ? '#F59E0B' : 'rgba(255,255,255,0.25)'}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Comment */}
                  {reviewRating > 0 && (
                    <TextInput
                      style={styles.reviewInput}
                      placeholder="Add a comment (optional, min 10 chars)…"
                      placeholderTextColor={Colors.textMuted}
                      value={reviewComment}
                      onChangeText={setReviewComment}
                      multiline
                      numberOfLines={3}
                      maxLength={500}
                    />
                  )}

                  <TouchableOpacity
                    style={[
                      styles.reviewBtn,
                      (reviewRating === 0 || submittingReview) && styles.reviewBtnDisabled,
                    ]}
                    activeOpacity={0.85}
                    onPress={handleSubmitReview}
                    disabled={reviewRating === 0 || submittingReview}
                  >
                    {submittingReview ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.reviewBtnText}>SUBMIT REVIEW</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.doneBtn}
            activeOpacity={0.8}
            onPress={() => navigation?.navigate('Tabs')}
          >
            <Text style={styles.doneBtnText}>BACK TO HOME</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Main screen — pay buyer fee ───────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(16,185,129,0.06)', 'rgba(0,0,0,0)', '#0A0A0C']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
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
          <Text style={styles.headerLabelGreen}>AUCTION COMPLETE</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Hero */}
        <View style={styles.heroWrap}>
          <View style={styles.trophyWrap}>
            <View style={styles.trophyGlow} />
            <Ionicons name="trophy-outline" size={42} color="#10B981" />
          </View>
          <Text style={styles.heroSubGreen}>YOU WON THE AUCTION</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>{listingTitle}</Text>
        </View>

        {/* Hammer Price */}
        <View style={styles.hammerBox}>
          <Text style={styles.hammerLabel}>HAMMER PRICE</Text>
          <Text style={styles.hammerPrice}>{fmt(hammerPrice)}</Text>
          <Text style={styles.hammerMeta}>
            {[bidCount != null && `${bidCount} bid${bidCount !== 1 ? 's' : ''}`, lotNumber && `LOT ${lotNumber}`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        {/* Countdown */}
        <View style={[styles.timerBox, timeLeft < 3600 && styles.timerBoxUrgent]}>
          <View style={styles.timerLeft}>
            <Ionicons
              name="time-outline"
              size={20}
              color={timeLeft < 3600 ? '#EF4444' : '#F59E0B'}
              style={{ marginRight: 10 }}
            />
            <View>
              <Text style={[styles.timerTitle, timeLeft < 3600 && styles.timerTitleUrgent]}>
                Complete payment within
              </Text>
              <Text style={[styles.timerValue, timeLeft < 3600 && styles.timerValueUrgent]}>
                {formatCountdown(timeLeft)}
              </Text>
            </View>
          </View>
          <View style={styles.timerRight}>
            <Text style={styles.timerRightText}>or the lot</Text>
            <Text style={styles.timerRightText}>goes to next bidder</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>ORDER SUMMARY</Text>

        {/* Summary */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Hammer price</Text>
            <Text style={styles.summaryValue}>{fmt(hammerPrice)}</Text>
          </View>
          <View style={[styles.summaryRow, { marginBottom: 20 }]}>
            <View>
              <Text style={styles.summaryLabel}>Buyer fee</Text>
              <Text style={styles.summaryLabelNote}>
                £100 released to seller + £25 platform fee
              </Text>
            </View>
            <Text style={styles.summaryValue}>{fmt(buyerFee)}</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryTotalRow}>
            <Text style={styles.summaryTotalLabel}>FEE DUE NOW</Text>
            <Text style={styles.summaryTotalValue}>{fmt(buyerFee)}</Text>
          </View>
          <Text style={styles.summaryTotalNote}>
            The hammer price of {fmt(hammerPrice)} is settled directly with the seller at handover.
          </Text>
        </View>

        {/* Stripe badge */}
        <View style={styles.paymentNote}>
          <Ionicons name="lock-closed-outline" size={16} color="#10B981" />
          <Text style={styles.paymentNoteText}>
            Secure payment via Stripe. Card, Apple Pay &amp; Google Pay accepted.
          </Text>
        </View>
      </ScrollView>

      {/* Floating CTA */}
      <View style={[styles.floatingBottom, { paddingBottom: insets.bottom || 20 }]}>
        <TouchableOpacity
          style={[styles.payBtn, paying && styles.payBtnDisabled]}
          onPress={handlePayFee}
          activeOpacity={0.85}
          disabled={paying || timeLeft === 0}
        >
          <LinearGradient
            colors={['#FF2D35', '#DC1F26']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          {paying ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginRight: 12 }} />
          ) : (
            <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" style={{ marginRight: 12 }} />
          )}
          <Text style={styles.payBtnText}>
            {paying ? 'PROCESSING…' : `COMPLETE PAYMENT · ${fmt(buyerFee)}`}
          </Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>Buyer fee is paid securely via Stripe and is non-refundable</Text>
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerLabelGreen: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#10B981',
    letterSpacing: 2,
    textAlign: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 4,
  },

  // Won hero
  heroWrap: { alignItems: 'center', marginBottom: 32 },
  trophyWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  trophyGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  heroSubGreen: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#10B981',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  heroTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // Hammer box
  hammerBox: {
    backgroundColor: 'rgba(16,185,129,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  hammerLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#A0A0AB',
    letterSpacing: 2,
    marginBottom: 10,
  },
  hammerPrice: {
    fontFamily: FontFamily.black,
    fontSize: 42,
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 8,
  },
  hammerMeta: { fontFamily: FontFamily.medium, fontSize: 13, color: '#606070' },

  // Timer
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245,158,11,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 40,
  },
  timerBoxUrgent: {
    backgroundColor: 'rgba(239,68,68,0.05)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  timerLeft: { flexDirection: 'row', alignItems: 'center' },
  timerTitle: { fontFamily: FontFamily.bold, fontSize: 12, color: '#F59E0B', marginBottom: 2 },
  timerTitleUrgent: { color: '#EF4444' },
  timerValue: { fontFamily: FontFamily.extraBold, fontSize: 22, color: '#FFFFFF', letterSpacing: 1 },
  timerValueUrgent: { color: '#EF4444' },
  timerRight: { alignItems: 'flex-end' },
  timerRightText: { fontFamily: FontFamily.regular, fontSize: 11, color: '#A0A0AB' },

  sectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1.5,
    marginBottom: 16,
  },

  // Summary
  summaryBox: {
    backgroundColor: '#111116',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    marginBottom: 20,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  summaryLabel: { fontFamily: FontFamily.regular, fontSize: 14, color: '#A0A0AB' },
  summaryLabelNote: { fontFamily: FontFamily.regular, fontSize: 11, color: '#606070', marginTop: 2 },
  summaryValue: { fontFamily: FontFamily.bold, fontSize: 14, color: '#FFFFFF' },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryTotalLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  summaryTotalValue: { fontFamily: FontFamily.bold, fontSize: 20, color: '#FFFFFF' },
  summaryTotalNote: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#606070',
    lineHeight: 18,
  },

  // Payment note
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16,185,129,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.15)',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  paymentNoteText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#A0A0AB',
    lineHeight: 20,
  },

  // Floating CTA
  floatingBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#0A0A0C',
  },
  payBtn: {
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { fontFamily: FontFamily.bold, fontSize: 14, color: '#FFFFFF', letterSpacing: 1.2 },
  footerNote: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#606070',
    textAlign: 'center',
  },

  // ── Success / confirmation screen ──────────────────────────────────
  carCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111116',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    padding: 16,
    marginBottom: 32,
  },
  carImg: { width: 70, height: 50, borderRadius: 8, marginRight: 16 },
  carImgPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carInfo: { flex: 1 },
  carTitle: { fontFamily: FontFamily.bold, fontSize: 15, color: '#FFFFFF', marginBottom: 6 },
  carStatusRow: { flexDirection: 'row', alignItems: 'center' },
  carStatusText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#10B981', marginLeft: 4 },

  journeyBox: {
    backgroundColor: '#111116',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    marginBottom: 24,
  },
  journeyItemWrap: { position: 'relative' },
  journeyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  journeyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  journeyCircleDone: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: '#10B981',
  },
  journeyCirclePending: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#606070',
  },
  journeyLabel: { flex: 1, fontFamily: FontFamily.medium, fontSize: 14, color: '#606070' },
  journeyLabelDone: { color: '#A0A0AB' },
  journeyLabelBold: { fontFamily: FontFamily.bold, color: '#FFFFFF' },
  journeyLine: {
    position: 'absolute',
    top: 36,
    left: 11,
    width: 1,
    height: 20,
    backgroundColor: 'rgba(16,185,129,0.3)',
  },
  journeyLinePending: { backgroundColor: 'rgba(255,255,255,0.08)' },

  nextBox: {
    backgroundColor: '#111116',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    marginBottom: 28,
  },
  nextText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#A0A0AB',
    lineHeight: 22,
  },

  // ── Seller review ──
  reviewBox: {
    backgroundColor: '#111116',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    padding: 20,
    marginBottom: 28,
  },
  reviewTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  reviewSub: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#A0A0AB',
    marginBottom: 18,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  reviewInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 16,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  reviewBtn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBtnDisabled: {
    opacity: 0.45,
  },
  reviewBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#000000',
    letterSpacing: 0.8,
  },
  reviewDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  reviewDoneText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#10B981',
  },

  doneBtn: {
    backgroundColor: '#DC1F26',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  doneBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
