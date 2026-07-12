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
import { MainStackParamList } from '../../navigation/MainStackNavigator';

import { IconButton } from '../../components/IconButton';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─────────────────────────── data ──────────────────────────────────

interface PlanCard {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  period: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  features: string[];
}

const PLANS: PlanCard[] = [
  {
    id: 'buyer',
    title: 'Buyer',
    subtitle: 'Always free for verified buyers',
    price: '£0',
    period: 'forever',
    accentColor: Colors.success,
    accentBg: Colors.successAlpha10,
    accentBorder: Colors.successAlpha25,
    features: [
      'Browse all verified listings',
      'Live auction bidding',
      'Saved searches & alerts',
      'Side-by-side compare',
      'Direct messaging with sellers',
    ],
  },
  {
    id: 'private-seller',
    title: 'Private Seller',
    subtitle: 'For individual car owners',
    price: 'Coming Soon',
    period: '',
    accentColor: Colors.infoBlue,
    accentBg: Colors.infoBlueAlpha10,
    accentBorder: Colors.infoBlueAlpha25,
    features: [
      'Priority listing placement',
      'AI-powered vehicle valuation',
      'Analytics & view stats',
      'Auction listing access',
      'Offer management tools',
    ],
  },
  {
    id: 'dealer',
    title: 'Dealer',
    subtitle: 'For professional car dealers',
    price: 'Coming Soon',
    period: '',
    accentColor: Colors.warning,
    accentBg: Colors.warningAlpha10,
    accentBorder: Colors.warningAlpha25,
    features: [
      'Unlimited inventory listings',
      'Dealer analytics dashboard',
      'Team management tools',
      'AI insights & lead scoring',
      'Priority dealer support',
      'KYC-verified dealer badge',
    ],
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
          <Text style={styles.introHeading}>Simple, transparent pricing</Text>
          <Text style={styles.introSub}>
            Premium dealer and private seller plans coming soon — priority listings,
            AI insights and more.
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

            {/* Card header */}
            <View style={styles.planHeader}>
              <View style={[styles.planIconWrap, { backgroundColor: plan.accentBg }]}>
                <Ionicons
                  name={
                    plan.id === 'buyer'
                      ? 'person-outline'
                      : plan.id === 'private-seller'
                      ? 'car-outline'
                      : 'storefront-outline'
                  }
                  size={20}
                  color={plan.accentColor}
                />
              </View>
              <View style={styles.planTitleWrap}>
                <Text style={styles.planTitle}>{plan.title}</Text>
                <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
              </View>
              {plan.id !== 'buyer' && (
                <View style={[styles.comingSoonBadge, { backgroundColor: plan.accentBg, borderColor: plan.accentBorder }]}>
                  <Text style={[styles.comingSoonText, { color: plan.accentColor }]}>
                    SOON
                  </Text>
                </View>
              )}
            </View>

            {/* Price */}
            <View style={styles.priceRow}>
              <Text style={[styles.planPrice, { color: plan.accentColor, fontFamily: FontFamily.mono }]}>
                {plan.price}
              </Text>
              {plan.period ? (
                <Text style={styles.planPeriod}> / {plan.period}</Text>
              ) : null}
            </View>

            {/* Divider */}
            <View style={styles.planDivider} />

            {/* Features */}
            <View style={styles.featuresSection}>
              {plan.features.map((feat) => (
                <View key={feat} style={styles.featureRow}>
                  <Ionicons name="checkmark" size={14} color={plan.accentColor} />
                  <Text style={styles.featureText}>{feat}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* ── Footer note ── */}
        <View style={styles.footerNote}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={styles.footerNoteText}>
            Paid plans are in development. All prices will be displayed in GBP and include VAT where applicable.
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
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  comingSoonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
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
