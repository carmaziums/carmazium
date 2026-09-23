import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { Colors } from '../../constants/colors';
import { useStripe } from '@stripe/stripe-react-native';
import { createPaymentSheet, reconcileAuctionFeeIntent } from '../../lib/paymentsApi';
import { apiClient } from '../../lib/apiClient';
import ConfettiCannon from 'react-native-confetti-cannon';
import { haptics } from '../../lib/haptics';
import { useAuthStore } from '../../store/authStore';
import { DealerAccess, getDealerAccess } from '../../lib/dealerAccessApi';

import { IconButton } from '../../components/IconButton';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const confettiRef = useRef<any>(null);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const role = useAuthStore((s) => s.role);
  const [dealerAccess, setDealerAccess] = useState<DealerAccess | null>(null);
  const [dealerAccessLoading, setDealerAccessLoading] = useState(false);

  useEffect(() => {
    if (role !== 'dealer' || !currentUserId) {
      setDealerAccess(null);
      setDealerAccessLoading(false);
      return;
    }

    let mounted = true;
    setDealerAccessLoading(true);
    getDealerAccess()
      .then((access) => { if (mounted) setDealerAccess(access); })
      .catch(() => { if (mounted) setDealerAccess(null); })
      .finally(() => { if (mounted) setDealerAccessLoading(false); });

    return () => { mounted = false; };
  }, [role, currentUserId]);

  const canPayAuctionFee =
    role === 'dealer'
    && Boolean(dealerAccess?.permissions?.includes('PAY_AUCTION_FEE'));

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
    auctionId,
    hammerPrice,
    buyerFee = 125,
    bidCount,
    lotNumber,
    listingTitle,
    listingImage,
    paymentDeadline,
  } = params;

  // Countdown to the real payment deadline, or nothing at all.
  //
  // This used to fall back to "24 hours from whenever this screen mounted" when
  // no deadline was passed — and the socket win path passed none, so that
  // fabricated figure was what most winners saw. The real grace period is 72h
  // from `wonAt` (`auctions.service.ts:23,618-626`), so a winner could be told
  // they had hours left when they had days, and the number changed every time
  // they reopened the screen (AUC-022).
  //
  // Both callers now pass a real deadline. If one ever does not, show no
  // countdown rather than inventing one — `null` also leaves payment enabled,
  // since refusing a payment on a deadline we do not know would be worse than
  // showing no timer.
  const getInitialSeconds = (): number | null => {
    if (!paymentDeadline) return null;
    return Math.max(0, Math.floor((new Date(paymentDeadline).getTime() - Date.now()) / 1000));
  };

  const [timeLeft, setTimeLeft] = useState<number | null>(getInitialSeconds);
  useEffect(() => {
    if (timeLeft === null) return;
    const timer = setInterval(
      () => setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : prev)),
      1000,
    );
    return () => clearInterval(timer);
  }, [timeLeft === null]);

  // ── Count-up price animation (JS-driven, updates React state) ─────────────
  const [displayPrice, setDisplayPrice] = useState(0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hammerPrice || hammerPrice <= 0) {
      setDisplayPrice(hammerPrice);
      return;
    }

    // Haptic on mount
    haptics.success();

    const duration = 1400; // ms
    const startTime = Date.now();
    const startValue = 0;
    const endValue = hammerPrice;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quad
      const easedProgress = 1 - (1 - progress) * (1 - progress);
      const current = Math.round(startValue + (endValue - startValue) * easedProgress);
      setDisplayPrice(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayPrice(endValue);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [hammerPrice]);

  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  // Once Stripe has accepted the native charge, confirmation retries must use
  // that exact transaction rather than creating a second £125 PaymentIntent.
  const [pendingConfirmationId, setPendingConfirmationId] = useState<string | null>(null);

  // ── Seller review state (shown in success screen) ─────────────────────────
  const [sellerProfileId, setSellerProfileId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  const handlePayFee = useCallback(async () => {
    if (dealerAccessLoading) return;
    if (!canPayAuctionFee) {
      Alert.alert(
        'Payment permission required',
        'The £125 auction buyer fee must be paid by the dealership Owner, Admin or Finance Manager.',
      );
      return;
    }
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
      // If Stripe already accepted the charge, only reconcile that transaction.
      // Never create another PaymentIntent while server confirmation is pending.
      if (pendingConfirmationId) {
        const result = await reconcileAuctionFeeIntent(pendingConfirmationId);
        if (result.applied) {
          setPendingConfirmationId(null);
          setPaid(true);
        } else {
          Alert.alert(
            'Payment confirmation pending',
            'Your payment is still being confirmed. Do not pay again. Retry this payment status check shortly.',
          );
        }
        return;
      }

      const sheet = await createPaymentSheet({
        listingId,
        amount: buyerFee,
        type: 'COMMISSION',
        currency: 'gbp',
      });

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

      if (initError) {
        Alert.alert('Payment error', initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === 'Canceled') {
          Alert.alert(
            'Payment cancelled',
            'You still won this auction. Pay the £125 buyer fee within 72 hours to unlock seller chat and complete the handover, or the win may be cancelled and the vehicle relisted.',
          );
        } else {
          Alert.alert('Payment failed', presentError.message);
        }
        return;
      }

      // Stripe accepted the charge. Reconcile the exact PaymentIntent against
      // the backend before this screen can say "Buyer fee paid".
      setPendingConfirmationId(sheet.transactionId);
      try {
        const result = await reconcileAuctionFeeIntent(sheet.transactionId);
        if (result.applied) {
          setPendingConfirmationId(null);
          setPaid(true);
        } else {
          Alert.alert(
            'Payment submitted — confirmation pending',
            'Stripe accepted your payment, but CarMazium is still confirming the auction update. Do not pay again. Use Confirm Payment Status to retry this same transaction.',
          );
        }
      } catch {
        Alert.alert(
          'Payment submitted — confirmation pending',
          'Your card payment was submitted, but CarMazium could not confirm the auction update yet. Do not pay again. Use Confirm Payment Status to retry this same transaction.',
        );
      }
    } catch (err: any) {
      Alert.alert('Payment error', err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setPaying(false);
    }
  }, [
    listingId,
    buyerFee,
    timeLeft,
    initPaymentSheet,
    presentPaymentSheet,
    pendingConfirmationId,
    dealerAccessLoading,
    canPayAuctionFee,
  ]);

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
          colors={[Colors.accentGreenAlpha08, 'rgba(0,0,0,0)', Colors.bgPrimary]}
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
              {/* This read "PURCHASE COMPLETE / Handover confirmed", which the
                  YOUR JOURNEY list directly below contradicts — it shows
                  "Handover to be booked" and "Handover confirmed" as still
                  outstanding, and no buyer-side action can ever complete them
                  (`submitHandoverProof` is seller-only,
                  `SellerAuctionsScreen.tsx:309`). What has actually happened at
                  this point is the buyer fee clearing, nothing more (AUC-038). */}
              <Text style={styles.headerLabelGreen}>PAYMENT COMPLETE</Text>
              <Text style={styles.headerTitle}>Buyer fee paid</Text>
            </View>
            <View style={{ width: 38 }} />
          </View>

          {/* Car Card */}
          <View style={styles.carCard}>
            {listingImage ? (
              <Image source={{ uri: listingImage }} style={styles.carImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.carImg, styles.carImgPlaceholder]}>
                <Ionicons name="car-outline" size={20} color={Colors.iconMuted} />
              </View>
            )}
            <View style={styles.carInfo}>
              <Text style={styles.carTitle} numberOfLines={2}>{listingTitle}</Text>
              <View style={styles.carStatusRow}>
                <Ionicons name="checkmark-circle-outline" size={14} color={Colors.accentGreen} />
                <Text style={styles.carStatusText}>Fee paid · Handover to be arranged</Text>
              </View>
            </View>
          </View>


          {/* ── Seller review ── */}
          {sellerProfileId && (
            <View style={styles.reviewBox}>
              <Text style={styles.reviewTitle}>Rate your seller</Text>
              <Text style={styles.reviewSub}>How was your experience?</Text>

              {reviewDone ? (
                <View style={styles.reviewDoneRow}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.accentGreen} />
                  <Text style={styles.reviewDoneText}>Review submitted — thank you!</Text>
                </View>
              ) : (
                <>
                  {/* Stars */}
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <IconButton key={star} icon={<Ionicons name={star <= reviewRating ? 'star' : 'star-outline'} size={32} color={star <= reviewRating ? Colors.warning : 'rgba(255,255,255,0.25)'} />} onPress={() => setReviewRating(star)} accessibilityLabel={`Rate ${star} star${star === 1 ? '' : 's'}`} />
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
                      <ActivityIndicator size="small" color={Colors.white} />
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
        colors={[Colors.accentGreenAlpha06, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      {/* Confetti cannon — absolutely positioned, pointerEvents=none so it doesn't block touches */}
      <ConfettiCannon
        ref={confettiRef}
        count={150}
        origin={{ x: SCREEN_WIDTH / 2, y: -20 }}
        fadeOut
        autoStart
        explosionSpeed={350}
        fallSpeed={2800}
        colors={[Colors.accent, Colors.accentGlow, Colors.white, Colors.warning]}
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
          <Text style={styles.headerLabelGreen}>AUCTION COMPLETE</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Hero */}
        <View style={styles.heroWrap}>
          <View style={styles.trophyWrap}>
            <View style={styles.trophyGlow} />
            <Ionicons name="trophy-outline" size={42} color={Colors.accentGreen} />
          </View>
          <Text style={styles.heroSubGreen}>YOU WON THE AUCTION</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>{listingTitle}</Text>
        </View>

        {/* Hammer Price — animated count-up */}
        <View style={styles.hammerBox}>
          <Text style={styles.hammerLabel}>HAMMER PRICE</Text>
          <Text style={styles.hammerPrice}>{fmt(displayPrice)}</Text>
          <Text style={styles.hammerMeta}>
            {[bidCount != null && `${bidCount} bid${bidCount !== 1 ? 's' : ''}`, lotNumber && `LOT ${lotNumber}`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        {/* Countdown — rendered only when the deadline is actually known.
            Note `timeLeft` is `number | null`, and `null < 3600` coerces to
            true, so every urgency comparison must be explicit about the null
            case rather than relying on the bare `<`. */}
        {timeLeft !== null && (
          <View style={[styles.timerBox, timeLeft < 3600 && styles.timerBoxUrgent]}>
            <View style={styles.timerLeft}>
              <Ionicons
                name="time-outline"
                size={20}
                color={timeLeft < 3600 ? Colors.error : Colors.warning}
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
        )}

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
          <Ionicons name="lock-closed-outline" size={16} color={Colors.accentGreen} />
          <Text style={styles.paymentNoteText}>
            Secure payment via Stripe. Card, Apple Pay &amp; Google Pay accepted.
          </Text>
        </View>
      </ScrollView>

      {/* Floating CTA */}
      <View style={[styles.floatingBottom, { paddingBottom: insets.bottom || 20 }]}>
        <TouchableOpacity
          style={[styles.payBtn, (paying || dealerAccessLoading || !canPayAuctionFee) && styles.payBtnDisabled]}
          onPress={handlePayFee}
          activeOpacity={0.85}
          disabled={paying || dealerAccessLoading || !canPayAuctionFee || timeLeft === 0}
        >
          <LinearGradient
            colors={[Colors.accentGlow, Colors.accent]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          {paying ? (
            <ActivityIndicator color={Colors.white} style={{ marginRight: 12 }} />
          ) : (
            <Ionicons name="lock-closed-outline" size={18} color={Colors.white} style={{ marginRight: 12 }} />
          )}
          <Text style={styles.payBtnText}>
            {dealerAccessLoading
              ? 'CHECKING PAYMENT PERMISSION…'
              : !canPayAuctionFee
                ? 'OWNER / ADMIN / FINANCE TO PAY'
                : paying
                  ? 'PROCESSING…'
                  : pendingConfirmationId
                    ? 'CONFIRM PAYMENT STATUS'
                    : `COMPLETE PAYMENT · ${fmt(buyerFee)}`}
          </Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          {canPayAuctionFee
            ? 'Buyer fee is paid securely via Stripe. If handover proof is denied, the current CarMazium flow refunds £100 of the £125 fee; the £25 platform fee remains.'
            : 'This win belongs to the dealership. Fee payment is restricted to the Owner, Admin or Finance Manager.'}
        </Text>
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerLabelGreen: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.accentGreen,
    letterSpacing: 2,
    textAlign: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.lg,
    color: Colors.white,
    marginTop: 4,
  },

  // Won hero
  heroWrap: { alignItems: 'center', marginBottom: 32 },
  trophyWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.accentGreen,
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
    backgroundColor: Colors.accentGreenAlpha20,
  },
  heroSubGreen: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.accentGreen,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  heroTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.size22,
    color: Colors.white,
    textAlign: 'center',
  },

  // Hammer box
  hammerBox: {
    backgroundColor: Colors.accentGreenAlpha05,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.accentGreenAlpha20,
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  hammerLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.textSecondary,
    letterSpacing: 2,
    marginBottom: 10,
  },
  hammerPrice: {
    // Mono font for price — per spec (was FontFamily.black)
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size42,
    color: Colors.white,
    letterSpacing: -1,
    marginBottom: 8,
  },
  hammerMeta: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.iconMuted },

  // Timer
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.warningAlpha05,
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
    borderRadius: Radius.sheet,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 40,
  },
  timerBoxUrgent: {
    backgroundColor: 'rgba(239,68,68,0.05)',
    borderColor: Colors.errorAlpha30,
  },
  timerLeft: { flexDirection: 'row', alignItems: 'center' },
  timerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.warning, marginBottom: 2 },
  timerTitleUrgent: { color: Colors.error },
  timerValue: { fontFamily: FontFamily.mono, fontSize: FontSize.size22, color: Colors.white, letterSpacing: 1 },
  timerValueUrgent: { color: Colors.error },
  timerRight: { alignItems: 'flex-end' },
  timerRightText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary },

  sectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.white,
    letterSpacing: 1.5,
    marginBottom: 16,
  },

  // Summary
  summaryBox: {
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 20,
    marginBottom: 20,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  summaryLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.size14, color: Colors.textSecondary },
  summaryLabelNote: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted, marginTop: 2 },
  // Mono font for price values in summary
  summaryValue: { fontFamily: FontFamily.mono, fontSize: FontSize.size14, color: Colors.white },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha06,
    marginBottom: 16,
  },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryTotalLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    letterSpacing: 1,
  },
  // Mono font for total price
  summaryTotalValue: { fontFamily: FontFamily.mono, fontSize: FontSize.xl, color: Colors.white },
  summaryTotalNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.iconMuted,
    lineHeight: 18,
  },

  // Payment note
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.accentGreenAlpha05,
    borderWidth: 1,
    borderColor: Colors.accentGreenAlpha15,
    borderRadius: Radius.inline,
    padding: 14,
    gap: 10,
  },
  paymentNoteText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.bgPrimary,
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
  payBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.white, letterSpacing: 1.2 },
  footerNote: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.iconMuted,
    textAlign: 'center',
  },

  // ── Success / confirmation screen ──────────────────────────────────
  carCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.accentGreenAlpha20,
    padding: 16,
    marginBottom: 32,
  },
  feeConfirmPendingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.warningAlpha05,
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
    borderRadius: Radius.inline,
    padding: 14,
    marginTop: -16,
    marginBottom: 24,
  },
  feeConfirmPendingText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.warning,
    lineHeight: 17,
  },
  carImg: { width: 70, height: 50, borderRadius: 8, marginRight: 16 },
  carImgPlaceholder: {
    backgroundColor: Colors.whiteAlpha04,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carInfo: { flex: 1 },
  carTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white, marginBottom: 6 },
  carStatusRow: { flexDirection: 'row', alignItems: 'center' },
  carStatusText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accentGreen, marginLeft: 4 },

  journeyBox: {
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 20,
    marginBottom: 24,
  },
  journeyItemWrap: { position: 'relative' },
  journeyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  journeyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  journeyCircleDone: {
    backgroundColor: Colors.accentGreenAlpha15,
    borderColor: Colors.accentGreen,
  },
  journeyCirclePending: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.iconMuted,
  },
  journeyLabel: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.size14, color: Colors.iconMuted },
  journeyLabelDone: { color: Colors.textSecondary },
  journeyLabelBold: { fontFamily: FontFamily.bold, color: Colors.white },
  journeyLine: {
    position: 'absolute',
    top: 36,
    left: 11,
    width: 1,
    height: 20,
    backgroundColor: Colors.accentGreenAlpha30,
  },
  journeyLinePending: { backgroundColor: Colors.whiteAlpha08 },

  nextBox: {
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 20,
    marginBottom: 28,
  },
  nextText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // ── Seller review ──
  reviewBox: {
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.warningAlpha20,
    padding: 20,
    marginBottom: 28,
  },
  reviewTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
    marginBottom: 4,
  },
  reviewSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    marginBottom: 18,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  reviewInput: {
    backgroundColor: Colors.whiteAlpha04,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.white,
    lineHeight: 20,
    marginBottom: 16,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  reviewBtn: {
    height: 46,
    borderRadius: Radius.inline,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBtnDisabled: {
    opacity: 0.45,
  },
  reviewBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.black,
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
    fontSize: FontSize.size14,
    color: Colors.accentGreen,
  },

  doneBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.inline,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  doneBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 1,
  },
});
