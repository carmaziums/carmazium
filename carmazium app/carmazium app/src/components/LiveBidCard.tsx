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
import { useAppearanceStore } from '../store/appearanceStore';
import { mergeAppearanceStyles, lightReadableText, appearancePalette } from '../theme/appearancePalette';
import { FontFamily, FontSize } from '../constants/typography';
import { Radius } from '../constants/spacing';
import { ImageCarousel } from './ImageCarousel';
import { GradeChip } from './GradeChip';
import { AuctionCardChips, AuctionCardTrustBadges } from './AuctionCardBadges';
import { WishlistHeart } from './WishlistHeart';
import { getAuctionFirstOfferFloor } from '../lib/auctionPricing';
import { useAppearance } from '../theme/useAppearance';

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

  const mode = useAppearanceStore(state => state.mode);
  const ts = mode === 'light' ? liveBidCardLightStyles : styles;
  return (
    <RNAnimated.View
      style={[
        ts.timeBlock,
        urgent && ts.timeBlockUrgent,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <Text style={[ts.timeValue, urgent && ts.timeValueUrgent]}>
        {String(value).padStart(2, '0')}
      </Text>
      <Text style={ts.timeLabel}>{label}</Text>
    </RNAnimated.View>
  );
};

export const LiveBidCard: React.FC<LiveBidCardProps> = ({
  auction,
  onPress,
  onBid,
}) => {
  const { tc } = useAppearance();
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? mergeAppearanceStyles(mergeAppearanceStyles(styles, lightLiveBidCardStyles), lightContrastStyles) : styles;
  const countdown = useCountdown(auction.endsAt);
  const hasRealBids = auction.totalBids > 0;
  const displayBid = hasRealBids ? auction.currentBid : auction.startingBid;
  const firstOfferFloor = getAuctionFirstOfferFloor(auction.startingBid, auction.reserve);

  return (
    <TouchableOpacity
      style={ts.card}
      onPress={onPress}
      activeOpacity={0.92}
    >
      {/* Car image */}
      <View style={ts.imageWrapper}>
        <ImageCarousel
          images={auction.images}
          width={CARD_IMG_WIDTH}
          height={160}
          onPress={onPress}
          showIndicator={false}
        />
        <View style={ts.imageOverlay} pointerEvents="none" />

        {/* Live / upcoming badge */}
        <View style={[ts.liveBadge, !auction.isLive && ts.upcomingBadge]} pointerEvents="none">
          {auction.isLive && <View style={ts.liveDot} />}
          <Text style={ts.liveText}>{auction.isLive ? 'LIVE' : 'UPCOMING'}</Text>
        </View>

        {/* Viewers */}
        {auction.isLive && (
          <View style={ts.viewersBadge} pointerEvents="none">
            <Ionicons name="eye-outline" size={11} color={tc("rgba(255,255,255,0.8)")} />
            <Text style={ts.viewersText}>{auction.viewers}</Text>
          </View>
        )}

        <WishlistHeart listing={auction} />

        <View style={{ position: 'absolute', top: 34, left: 10, right: 10 }} pointerEvents="none">
          <AuctionCardTrustBadges
            badgeTier={auction.badgeTier}
            isFeatured={auction.isFeatured}
            isDepartedSale={auction.isDepartedSale}
            isImported={auction.isImported}
          />
        </View>
      </View>

      {/* Content */}
      <View style={ts.content}>
        {/* Car title */}
        <View style={ts.carTitle}>
          <Text style={ts.makeText}>{auction.make}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={ts.modelText}>
              {auction.model} {auction.variant}
            </Text>
            <GradeChip grade={auction.exteriorGrade} />
          </View>
        </View>

        <AuctionCardChips
          year={auction.year}
          mileage={auction.mileage}
          fuelType={auction.fuelType}
          transmission={auction.transmission}
          bodyType={auction.category}
          location={auction.location}
          deliveryAvailable={auction.deliveryAvailable}
        />

        {/* Bid section */}
        <View style={ts.bidSection}>
          <View>
            <Text style={ts.bidLabel}>{hasRealBids ? 'CURRENT BID' : 'STARTING BID'}</Text>
            <Text style={ts.bidAmount}>{formatPrice(displayBid)}</Text>
            <View style={ts.bidMeta}>
              <Ionicons name="people-outline" size={11} color={tc(Colors.textMuted)} />
              <Text style={ts.bidCount}>{auction.totalBids} bids</Text>
              {!hasRealBids && firstOfferFloor > 0 && (
                <Text style={[ts.bidCount, { color: tc(Colors.warning) }]}>
                  First offer {formatPrice(firstOfferFloor)}
                </Text>
              )}
              {/* Reserve status is never shown to buyers (Ground Rules: reserve
                  is enforced server-side, display-only shows "Buy it now"). */}
              {!!auction.buyItNowPrice && (
                <View style={ts.binBadge}>
                  <Text style={ts.binBadgeText}>Buy it now: {formatPrice(auction.buyItNowPrice)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Countdown */}
          <View style={ts.countdown}>
            <Text style={ts.endsLabel}>
              {auction.isLive ? 'ENDS IN' : 'STARTS IN'}
            </Text>
            <View style={ts.timeRow}>
              {countdown.h > 0 && (
                <>
                  <TimeBlock value={countdown.h} label="HRS" urgent={countdown.urgent} />
                  <Text style={ts.timeSep}>:</Text>
                </>
              )}
              <TimeBlock value={countdown.m} label="MIN" urgent={countdown.urgent} />
              <Text style={ts.timeSep}>:</Text>
              <TimeBlock value={countdown.s} label="SEC" urgent={countdown.urgent} />
            </View>
          </View>
        </View>

        {/* CTA */}
        {auction.isLive && (
          <TouchableOpacity style={ts.bidBtn} onPress={onBid} activeOpacity={0.85}>
            <Ionicons name="hammer-outline" size={15} color={Colors.white} />
            <Text style={ts.bidBtnText}>Place Bid</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const lightLiveBidCardStyles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: '#D5E1EC' },
  content: { backgroundColor: '#FFFFFF' },
  carTitle: { color: '#0F172A' },
  makeText: { color: '#0F172A' },
  modelText: { color: '#526177' },
  bidSection: { backgroundColor: '#F7FBFF', borderColor: '#D5E1EC' },
  bidLabel: { color: '#526177' },
  bidAmount: { color: '#0F172A' },
  bidMeta: { color: '#526177' },
  bidCount: { color: '#526177' },
  countdown: { backgroundColor: '#F7FBFF' },
  endsLabel: { color: '#526177' },
  timeBlock: { backgroundColor: '#F7FBFF', borderColor: '#D5E1EC' },
  timeValue: { color: '#0F172A' },
  timeLabel: { color: '#526177' },
  timeSep: { color: '#526177' },
});

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
    color: Colors.successLight,
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

const LIGHT_PALETTE = appearancePalette('light');

// Light-mode text colours for keys the screen's light map did not cover.
// Generated from the contrast audit (scripts/theme-audit); dark mode is untouched.
const lightContrastStyles = StyleSheet.create({
  binBadgeText: { color: lightReadableText.success },
  viewersBadge: { backgroundColor: LIGHT_PALETTE.card },
  viewersText: { color: LIGHT_PALETTE.secondary },
});

// Countdown blocks render in their own component; share the card's light map.
const liveBidCardLightStyles = mergeAppearanceStyles(mergeAppearanceStyles(styles, lightLiveBidCardStyles), lightContrastStyles);
