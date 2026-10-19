import React from 'react';
import {
  ScrollView,
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
import { useAppearanceStore } from '../../store/appearanceStore';
import { adaptLegacyLightStyles, mergeAppearanceStyles, appearancePalette } from '../../theme/appearancePalette';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { PRICING } from '../../constants/pricing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
import { useAppearance } from '../../theme/useAppearance';
import { ThemedStatusBar } from '../../components/ThemedStatusBar';
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
      { label: 'Verified Traders can bid', included: true },
      { label: '24-hour auction duration', included: true },
      { label: 'Anti-snipe protection', included: true },
      { label: 'Real-time bid feed', included: true },
      { label: 'Post-auction seller chat', included: true },
    ],
  },
  {
    id: 'basic',
    title: 'Basic',
    subtitle: '£1 one-off · advertised until sold',
    price: `£${PRICING.listing.basic.price}`,
    period: 'one-off',
    accentColor: Colors.textSecondary,
    accentBg: Colors.whiteAlpha06,
    accentBorder: Colors.whiteAlpha15,
    features: [
      { label: 'Public marketplace listing', included: true },
      { label: 'Offer & negotiation system', included: true },
      { label: 'Direct buyer chat', included: true },
      { label: 'DVLA auto-fill', included: true },
      { label: 'Featured Boost available separately', included: true },
      { label: 'Performance analytics', included: true },
    ],
  },
  {
    id: 'standard',
    title: 'Standard',
    subtitle: 'HPI vehicle-history report included',
    price: `£${PRICING.listing.standard.price}`,
    period: 'one-off',
    accentColor: Colors.infoBlue,
    accentBg: Colors.infoBlueAlpha10,
    accentBorder: Colors.infoBlueAlpha25,
    features: [
      { label: 'Everything in Basic', included: true },
      { label: 'HPI vehicle-history report included', included: true },
      { label: 'Standard package badge', included: true },
      { label: 'Advertised until sold', included: true },
      { label: 'Featured Boost available separately', included: true },
    ],
  },
  {
    id: 'premium',
    title: 'Premium',
    subtitle: 'HPI + 28-day Featured Boost included',
    price: `£${PRICING.listing.premium.price}`,
    period: 'one-off',
    badge: 'BEST VALUE',
    accentColor: Colors.accent,
    accentBg: Colors.accentAlpha10,
    accentBorder: Colors.accentAlpha25,
    features: [
      { label: 'Everything in Standard', included: true },
      { label: 'HPI vehicle-history report included', included: true },
      { label: 'Premium listing badge and presentation', included: true },
      { label: 'Advertised until sold', included: true },
      { label: 'Featured Boost included for 28 days', included: true },
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
    subtitle: 'Optional for Auction and Basic Retail. Standard and Premium Retail already include the HPI report.',
    price: `£${PRICING.hpiReport.price}`,
    icon: 'shield-checkmark-outline',
    accentColor: Colors.success,
    accentBg: Colors.successAlpha10,
  },
  {
    id: 'boost',
    title: 'Featured Boost',
    subtitle: '£25 for 28 days when bought separately. Premium already includes the first 28-day Featured Boost.',
    price: `£${PRICING.featuredBoost.price}`,
    meta: `${PRICING.featuredBoost.durationDays} days`,
    icon: 'flash-outline',
    accentColor: Colors.warning,
    accentBg: Colors.warningAlpha10,
  },
];

// ═══════════════════════════ COMPONENT ════════════════════════════

export const PricingScreen: React.FC = () => {
  const { tc } = useAppearance();
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? mergeAppearanceStyles(adaptLegacyLightStyles(styles), lightContrastStyles) : styles;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  return (
    <View style={ts.container}>
      <ThemedStatusBar />
      <LinearGradient
        colors={appearanceMode === 'light' ? ['#EEF5FB', '#F7FBFF', '#EEF5FB'] : [Colors.accentAlpha06, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={ts.header}>
        <IconButton style={ts.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={ts.headerTitle}>Pricing</Text>
        <HamburgerButton />
      </View>

      <ScrollView
        style={ts.scroll}
        contentContainerStyle={ts.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Intro ── */}
        <View style={ts.introSection}>
          <Text style={ts.introHeading}>Simple, honest pricing</Text>
          <Text style={ts.introSub}>
            List your car for free at auction, or choose Basic £1, Standard £10
            with HPI included, or Premium £25 with HPI and a 28-day Featured Boost. Retail buyers pay no CarMazium buyer fee.
          </Text>
        </View>

        {/* ── Plan cards ── */}
        {PLANS.map((plan) => (
          <View
            key={plan.id}
            style={[
              ts.planCard,
              { borderColor: plan.accentBorder },
            ]}
          >
            {/* Card top accent bar */}
            <View style={[ts.planTopBar, { backgroundColor: plan.accentColor }]} />

            {plan.badge && (
              <View style={ts.mostPopularBadge}>
                <Ionicons name="star" size={10} color={Colors.white} />
                <Text style={ts.mostPopularText}>{plan.badge}</Text>
              </View>
            )}

            {/* Card header */}
            <View style={ts.planHeader}>
              <View style={[ts.planIconWrap, { backgroundColor: plan.accentBg }]}>
                <Ionicons
                  name={plan.id === 'auction' ? 'hammer-outline' : 'pricetag-outline'}
                  size={20}
                  color={plan.accentColor}
                />
              </View>
              <View style={ts.planTitleWrap}>
                <Text style={ts.planTitle}>{plan.title}</Text>
                <Text style={ts.planSubtitle}>{plan.subtitle}</Text>
              </View>
            </View>

            {/* Price */}
            <View style={ts.priceRow}>
              <Text style={[ts.planPrice, { color: plan.accentColor, fontFamily: FontFamily.mono }]}>
                {plan.price}
              </Text>
              {plan.period ? (
                <Text style={ts.planPeriod}> {plan.period}</Text>
              ) : null}
            </View>

            {/* Divider */}
            <View style={ts.planDivider} />

            {/* Features */}
            <View style={ts.featuresSection}>
              {plan.features.map((feat) => (
                <View key={feat.label} style={ts.featureRow}>
                  <Ionicons
                    name={feat.included ? 'checkmark' : 'close'}
                    size={14}
                    color={tc(feat.included ? plan.accentColor : Colors.textFaint)}
                  />
                  <Text style={[ts.featureText, !feat.included && ts.featureTextExcluded]}>
                    {feat.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* ── Add-ons ── */}
        <View style={ts.sectionHeadingWrap}>
          <Text style={ts.sectionHeading}>Optional add-ons</Text>
          <Text style={ts.sectionSub}>Enhance any listing at any time — buy once, apply instantly.</Text>
        </View>

        {ADD_ONS.map((addon) => (
          <View key={addon.id} style={ts.addonCard}>
            <View style={[ts.addonIconWrap, { backgroundColor: addon.accentBg }]}>
              <Ionicons name={addon.icon as any} size={22} color={addon.accentColor} />
            </View>
            <View style={ts.addonBody}>
              <View style={ts.addonTitleRow}>
                <Text style={ts.addonTitle}>{addon.title}</Text>
                <View style={ts.addonPriceWrap}>
                  <Text style={ts.addonPrice}>{addon.price}</Text>
                  {addon.meta && <Text style={ts.addonMeta}>{addon.meta}</Text>}
                </View>
              </View>
              <Text style={ts.addonSubtitle}>{addon.subtitle}</Text>
            </View>
          </View>
        ))}

        {/* ── Dealer prompt ── */}
        <TouchableOpacity
          style={ts.dealerPrompt}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DealerOnboarding')}
        >
          <View style={ts.dealerPromptIconWrap}>
            <Ionicons name="business-outline" size={20} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ts.dealerPromptTitle}>Motor trader or automotive business?</Text>
            <Text style={ts.dealerPromptSub}>Use a Partner Account for verified business tools and auction access.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={tc(Colors.textMuted)} accessibilityElementsHidden importantForAccessibility="no" />
        </TouchableOpacity>

        {/* ── Footer note ── */}
        <View style={ts.footerNote}>
          <Ionicons name="information-circle-outline" size={16} color={tc(Colors.textMuted)} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={ts.footerNoteText}>
            Retail buyers pay no CarMazium buyer fee. Vehicle sale money is paid directly between buyer and seller; CarMazium does not hold it.
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 16,
  },
  dealerPromptIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.inline,
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
    borderRadius: Radius.inline,
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

const LIGHT_PALETTE = appearancePalette('light');

// Light-mode text colours for keys the screen's light map did not cover.
// Generated from the contrast audit (scripts/theme-audit); dark mode is untouched.
const lightContrastStyles = StyleSheet.create({
  introSub: { color: LIGHT_PALETTE.secondary },
  planPeriod: { color: LIGHT_PALETTE.muted },
  sectionSub: { color: LIGHT_PALETTE.muted },
  dealerPromptSub: { color: LIGHT_PALETTE.muted },
  mostPopularText: { color: Colors.white }, // on a solid brand/semantic fill in both modes
});
