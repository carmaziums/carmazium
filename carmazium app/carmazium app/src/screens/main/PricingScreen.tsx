import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { PRICING } from '../../constants/pricing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

import { IconButton } from '../../components/IconButton';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─────────────────────────── data ──────────────────────────────────
// Mirrors the web app's pricing page (src/app/pricing/page.tsx) and its
// single source of truth, src/lib/pricingConfig.ts — these are listing-fee
// tiers (how much it costs to publish a car), not account/role plans. The
// previous version of this screen modeled buyer/seller/dealer subscription
// tiers with "Coming Soon" placeholders, which doesn't match the real
// pricing model at all.

interface PlanCard {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  period: string;
  badge?: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  features: { label: string; included: boolean }[];
}

const PLANS: PlanCard[] = [
  {
    id: 'auction',
    title: 'Auction',
    subtitle: '24-hour live open auction',
    price: 'Free',
    period: '',
    accentColor: Colors.warning,
    accentBg: Colors.warningAlpha10,
    accentBorder: Colors.warningAlpha25,
    features: [
      { label: 'Live bidding marketplace', included: true },
      { label: 'Open to all buyers', included: true },
      { label: '24-hour auction duration', included: true },
      { label: 'Anti-snipe protection', included: true },
      { label: 'Real-time bid feed', included: true },
      { label: 'Post-auction seller chat', included: true },
    ],
  },
  {
    id: 'basic',
    title: 'Basic',
    subtitle: 'Standard listing, quick to list',
    price: `£${PRICING.listing.basic.price}`,
    period: 'one-off',
    accentColor: Colors.textSecondary,
    accentBg: Colors.whiteAlpha06,
    accentBorder: Colors.whiteAlpha15,
    features: [
      { label: 'Public marketplace listing', included: true },
      { label: 'Up to 20 photos', included: true },
      { label: 'Offer & negotiation system', included: true },
      { label: 'Direct buyer chat', included: true },
      { label: 'DVLA auto-fill', included: true },
      { label: 'Analytics', included: false },
      { label: 'Priority placement', included: false },
    ],
  },
  {
    id: 'standard',
    title: 'Standard',
    subtitle: '30-day listing, more reach',
    price: `£${PRICING.listing.standard.price}`,
    period: 'one-off',
    accentColor: Colors.infoBlue,
    accentBg: Colors.infoBlueAlpha10,
    accentBorder: Colors.infoBlueAlpha25,
    features: [
      { label: 'Everything in Basic', included: true },
      { label: 'Up to 50 photos', included: true },
      { label: 'Performance analytics', included: true },
      { label: 'Featured boost eligible', included: true },
      { label: '30-day listing duration', included: true },
      { label: 'Priority search placement', included: false },
      { label: 'Free HPI included', included: false },
    ],
  },
  {
    id: 'premium',
    title: 'Premium',
    subtitle: 'Advertise until sold, maximum exposure',
    price: `£${PRICING.listing.premium.price}`,
    period: 'one-off',
    badge: 'MOST POPULAR',
    accentColor: Colors.accent,
    accentBg: Colors.accentAlpha10,
    accentBorder: Colors.accentAlpha25,
    features: [
      { label: 'Everything in Standard', included: true },
      { label: 'Up to 100 photos', included: true },
      { label: 'Priority search placement', included: true },
      { label: 'HPI Verified badge included', included: true },
      { label: 'Advertise until sold', included: true },
      { label: 'Featured boost eligible', included: true },
      { label: 'Full analytics: views, enquiries, offers & earnings', included: true },
    ],
  },
];

interface AddOn {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  meta?: string;
  icon: string;
  accentColor: string;
  accentBg: string;
}

const ADD_ONS: AddOn[] = [
  {
    id: 'hpi',
    title: 'HPI Vehicle Check',
    subtitle: 'Outstanding finance, write-off history, mileage anomalies, stolen records, and plate changes. Adds a verified badge to your listing.',
    price: `£${PRICING.hpiReport.price}`,
    icon: 'shield-checkmark-outline',
    accentColor: Colors.success,
    accentBg: Colors.successAlpha10,
  },
  {
    id: 'boost',
    title: 'Featured Boost',
    subtitle: 'Pin your listing to the homepage carousel and top of search results. Renewable at any time.',
    price: `£${PRICING.featuredBoost.price}`,
    meta: `${PRICING.featuredBoost.durationDays} days`,
    icon: 'flash-outline',
    accentColor: Colors.warning,
    accentBg: Colors.warningAlpha10,
  },
];

// ═══════════════════════════ COMPONENT ════════════════════════════

export const PricingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha06, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>Pricing</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Intro ── */}
        <View style={styles.introSection}>
          <Text style={styles.introHeading}>Simple, honest pricing</Text>
          <Text style={styles.introSub}>
            List your car for free at auction, or pay a one-off fee for a retail
            listing. No subscriptions. No surprises.
          </Text>
        </View>

        {/* ── Plan cards ── */}
        {PLANS.map((plan) => (
          <View
            key={plan.id}
            style={[
              styles.planCard,
              { borderColor: plan.accentBorder },
            ]}
          >
            {/* Card top accent bar */}
            <View style={[styles.planTopBar, { backgroundColor: plan.accentColor }]} />

            {plan.badge && (
              <View style={styles.mostPopularBadge}>
                <Ionicons name="star" size={10} color={Colors.white} />
                <Text style={styles.mostPopularText}>{plan.badge}</Text>
              </View>
            )}

            {/* Card header */}
            <View style={styles.planHeader}>
              <View style={[styles.planIconWrap, { backgroundColor: plan.accentBg }]}>
                <Ionicons
                  name={plan.id === 'auction' ? 'hammer-outline' : 'pricetag-outline'}
                  size={20}
                  color={plan.accentColor}
                />
              </View>
              <View style={styles.planTitleWrap}>
                <Text style={styles.planTitle}>{plan.title}</Text>
                <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
              </View>
            </View>

            {/* Price */}
            <View style={styles.priceRow}>
              <Text style={[styles.planPrice, { color: plan.accentColor, fontFamily: FontFamily.mono }]}>
                {plan.price}
              </Text>
              {plan.period ? (
                <Text style={styles.planPeriod}> {plan.period}</Text>
              ) : null}
            </View>

            {/* Divider */}
            <View style={styles.planDivider} />

            {/* Features */}
            <View style={styles.featuresSection}>
              {plan.features.map((feat) => (
                <View key={feat.label} style={styles.featureRow}>
                  <Ionicons
                    name={feat.included ? 'checkmark' : 'close'}
                    size={14}
                    color={feat.included ? plan.accentColor : Colors.textFaint}
                  />
                  <Text style={[styles.featureText, !feat.included && styles.featureTextExcluded]}>
                    {feat.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* ── Add-ons ── */}
        <View style={styles.sectionHeadingWrap}>
          <Text style={styles.sectionHeading}>Optional add-ons</Text>
          <Text style={styles.sectionSub}>Enhance any listing at any time — buy once, apply instantly.</Text>
        </View>

        {ADD_ONS.map((addon) => (
          <View key={addon.id} style={styles.addonCard}>
            <View style={[styles.addonIconWrap, { backgroundColor: addon.accentBg }]}>
              <Ionicons name={addon.icon as any} size={22} color={addon.accentColor} />
            </View>
            <View style={styles.addonBody}>
              <View style={styles.addonTitleRow}>
                <Text style={styles.addonTitle}>{addon.title}</Text>
                <View style={styles.addonPriceWrap}>
                  <Text style={styles.addonPrice}>{addon.price}</Text>
                  {addon.meta && <Text style={styles.addonMeta}>{addon.meta}</Text>}
                </View>
              </View>
              <Text style={styles.addonSubtitle}>{addon.subtitle}</Text>
            </View>
          </View>
        ))}

        {/* ── Dealer prompt ── */}
        <TouchableOpacity
          style={styles.dealerPrompt}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DealerOnboarding')}
        >
          <View style={styles.dealerPromptIconWrap}>
            <Ionicons name="business-outline" size={20} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dealerPromptTitle}>Need to list multiple vehicles?</Text>
            <Text style={styles.dealerPromptSub}>Dealers get a dashboard with CRM, inventory management, and analytics.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        </TouchableOpacity>

        {/* ── Footer note ── */}
        <View style={styles.footerNote}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={styles.footerNoteText}>
            All payments are handled via Stripe and shown in GBP. CarMazium never stores your card details.
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════ STYLES ════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  headerPlaceholder: {
    width: 38,
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
  },

  // ── Intro ──
  introSection: {
    gap: 8,
    paddingBottom: 4,
  },
  introHeading: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
  },
  introSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
  },

  // ── Plan card ──
  planCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  planTopBar: {
    height: 3,
    width: '100%',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingBottom: 12,
  },
  planIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  planTitleWrap: {
    flex: 1,
    gap: 2,
  },
  planTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  planSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  mostPopularBadge: {
    position: 'absolute',
    top: 11,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 1,
  },
  mostPopularText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.white,
    letterSpacing: 0.5,
  },

  // ── Price ──
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  planPrice: {
    fontSize: FontSize['2xl'],
  },
  planPeriod: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },

  // ── Divider ──
  planDivider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha06,
    marginHorizontal: 16,
  },

  // ── Features ──
  featuresSection: {
    padding: 16,
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  featureTextExcluded: {
    color: Colors.textFaint,
  },

  // ── Add-ons / Dealer prompt ──
  sectionHeadingWrap: {
    gap: 4,
    paddingTop: 8,
  },
  sectionHeading: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  sectionSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  addonCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 16,
  },
  addonIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addonBody: {
    flex: 1,
    gap: 4,
  },
  addonTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  addonTitle: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  addonPriceWrap: {
    alignItems: 'flex-end',
  },
  addonPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  addonMeta: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  addonSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  dealerPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 16,
  },
  dealerPromptIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accentAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dealerPromptTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  dealerPromptSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },

  // ── Footer note ──
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: Colors.glassBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  footerNoteText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
});
