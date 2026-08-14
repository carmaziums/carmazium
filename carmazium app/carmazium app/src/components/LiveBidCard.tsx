import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated as RNAnimated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { AuctionListing, formatPrice, formatMileage } from '../data/listings';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Radius } from '../constants/spacing';
import { ImageCarousel } from './ImageCarousel';
import { GradeChip } from './GradeChip';
import { AuctionCardChips, AuctionCardTrustBadges } from './AuctionCardBadges';
import { WishlistHeart } from './WishlistHeart';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// This card renders full-width inside its parent's own horizontal padding —
// no fixed width prop exists on the component, so mirror the same
// 24px-each-side convention LiveScreen.tsx uses for its own full-width cards.
const CARD_IMG_WIDTH = SCREEN_WIDTH - 48;

interface LiveBidCardProps {
  auction: AuctionListing;
  onPress: () => void;
  onBid: () => void;
}

const useCountdown = (endsAt: Date) => {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, urgent: false });

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, endsAt.getTime() - Date.now());
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ h, m, s, urgent: diff < 1000 * 60 * 15 }); // urgent if < 15 min
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return timeLeft;
};

const TimeBlock: React.FC<{ value: number; label: string; urgent: boolean }> = ({
  value,
  label,
  urgent,
}) => {
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    if (urgent) {
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          RNAnimated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [urgent]);

  return (
    <RNAnimated.View
      style={[
        styles.timeBlock,
        urgent && styles.timeBlockUrgent,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <Text style={[styles.timeValue, urgent && styles.timeValueUrgent]}>
        {String(value).padStart(2, '0')}
      </Text>
      <Text style={styles.timeLabel}>{label}</Text>
    </RNAnimated.View>
  );
};

export const LiveBidCard: React.FC<LiveBidCardProps> = ({
  auction,
  onPress,
  onBid,
}) => {
  const countdown = useCountdown(auction.endsAt);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.92}
    >
      {/* Car image */}
      <View style={styles.imageWrapper}>
        <ImageCarousel
          images={auction.images}
          width={CARD_IMG_WIDTH}
          height={160}
          onPress={onPress}
          showIndicator={false}
        />
        <View style={styles.imageOverlay} pointerEvents="none" />

        {/* Live / upcoming badge */}
        <View style={[styles.liveBadge, !auction.isLive && styles.upcomingBadge]} pointerEvents="none">
          {auction.isLive && <View style={styles.liveDot} />}
          <Text style={styles.liveText}>{auction.isLive ? 'LIVE' : 'UPCOMING'}</Text>
        </View>

        {/* Viewers */}
        {auction.isLive && (
          <View style={styles.viewersBadge} pointerEvents="none">
            <Ionicons name="eye-outline" size={11} color="rgba(255,255,255,0.8)" />
            <Text style={styles.viewersText}>{auction.viewers}</Text>
          </View>
        )}

        <WishlistHeart listing={auction} />

        <View style={{ position: 'absolute', top: 34, left: 10, right: 10 }} pointerEvents="none">
          <AuctionCardTrustBadges
            badgeTier={auction.badgeTier}
            isFeatured={auction.isFeatured}
            isDepartedSale={auction.isDepartedSale}
          />
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Car title */}
        <View style={styles.carTitle}>
          <Text style={styles.makeText}>{auction.make}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.modelText}>
              {auction.model} {auction.variant}
            </Text>
            <GradeChip grade={auction.exteriorGrade} />
          </View>
        </View>

        <AuctionCardChips
          year={auction.year}
          mileage={auction.mileage}
          fuelType={auction.fuelType}
          bodyType={auction.category}
          location={auction.location}
          deliveryAvailable={auction.deliveryAvailable}
        />

        {/* Bid section */}
        <View style={styles.bidSection}>
          <View>
            <Text style={styles.bidLabel}>CURRENT BID</Text>
            <Text style={styles.bidAmount}>{formatPrice(auction.currentBid)}</Text>
            <View style={styles.bidMeta}>
              <Ionicons name="people-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.bidCount}>{auction.totalBids} bids</Text>
              {/* Reserve status is never shown to buyers (Ground Rules: reserve
                  is enforced server-side, display-only shows "Buy it now"). */}
              {!!auction.buyItNowPrice && (
                <View style={styles.binBadge}>
                  <Text style={styles.binBadgeText}>Buy it now: {formatPrice(auction.buyItNowPrice)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Countdown */}
          <View style={styles.countdown}>
            <Text style={styles.endsLabel}>
              {auction.isLive ? 'ENDS IN' : 'STARTS IN'}
            </Text>
            <View style={styles.timeRow}>
              {countdown.h > 0 && (
                <>
                  <TimeBlock value={countdown.h} label="HRS" urgent={countdown.urgent} />
                  <Text style={styles.timeSep}>:</Text>
                </>
              )}
              <TimeBlock value={countdown.m} label="MIN" urgent={countdown.urgent} />
              <Text style={styles.timeSep}>:</Text>
              <TimeBlock value={countdown.s} label="SEC" urgent={countdown.urgent} />
            </View>
          </View>
        </View>

        {/* CTA */}
        {auction.isLive && (
          <TouchableOpacity style={styles.bidBtn} onPress={onBid} activeOpacity={0.85}>
            <Ionicons name="hammer-outline" size={15} color={Colors.white} />
            <Text style={styles.bidBtnText}>Place Bid</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  imageWrapper: {
    height: 160,
    position: 'relative',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  liveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.chip,
  },
  upcomingBadge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: Colors.whiteAlpha15,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.white,
  },
  liveText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.white,
    letterSpacing: 1.5,
  },
  viewersBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.blackAlpha55,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  viewersText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.8)',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  carTitle: {
    gap: 2,
  },
  makeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  modelText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  bidSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  bidLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  bidAmount: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize['2xl'],
    color: Colors.white,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  bidMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bidCount: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  binBadge: {
    backgroundColor: Colors.successAlpha15,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.successAlpha25,
  },
  binBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size9,
    color: Colors.success,
    letterSpacing: 0.3,
  },
  // Countdown
  countdown: {
    alignItems: 'flex-end',
  },
  endsLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 5,
    textAlign: 'right',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeBlock: {
    alignItems: 'center',
    backgroundColor: Colors.whiteAlpha07,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 38,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
  },
  timeBlockUrgent: {
    backgroundColor: Colors.accentSubtle,
    borderColor: Colors.accentAlpha30,
  },
  timeValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.white,
    letterSpacing: 1,
  },
  timeValueUrgent: {
    color: Colors.accent,
  },
  timeLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size8,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  timeSep: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  bidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  bidBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.white,
    letterSpacing: 0.3,
  },
});
