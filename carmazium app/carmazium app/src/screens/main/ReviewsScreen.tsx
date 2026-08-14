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
import { Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

// Web's /reviews page (src/app/reviews/page.tsx) is a static marketing page
// with hardcoded fake stats ("50k+ Happy Customers", "4.9/5 Average Rating")
// and six identical fabricated testimonials. Mobile deliberately does not
// port that content — this session's other fixes (mobile-audit.md W1, F8's
// buyer-facing damage viewer) were specifically about removing fabricated
// data shown to users, so adding more here would cut against that. Instead
// this is an honest explainer: real claims about how the platform actually
// works, and a pointer to where real reviews genuinely live (seller
// profiles) rather than invented testimonials. See mobile-production-
// readiness-plan.md F14 for the full reasoning.

interface TrustBadge {
  icon: string;
  title: string;
  sub: string;
}

const TRUST_BADGES: TrustBadge[] = [
  { icon: 'shield-checkmark-outline', title: 'Verified Sellers', sub: 'Dealers complete KYC before listing' },
  { icon: 'lock-closed-outline', title: 'Secure Payments', sub: 'All transactions run through Stripe' },
  { icon: 'shield-outline', title: 'Buyer Protection', sub: 'Deposit and delivery safeguards' },
];

export const ReviewsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha05, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>Trust & Reviews</Text>
        <HamburgerButton />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.introTitle}>Buying and selling with confidence</Text>
        <Text style={styles.introSub}>
          Carmazium is built around verified sellers, secure payments, and transparent history checks —
          here's what that means in practice.
        </Text>

        <View style={styles.badgeGrid}>
          {TRUST_BADGES.map((b) => (
            <View key={b.title} style={styles.badgeCard}>
              <View style={styles.badgeIconWrap}>
                <Ionicons name={b.icon} size={20} color={Colors.accent} />
              </View>
              <Text style={styles.badgeTitle}>{b.title}</Text>
              <Text style={styles.badgeSub}>{b.sub}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Where reviews come from</Text>
          <Text style={styles.bodyText}>
            After a sale completes, buyers can leave a rating and comment for the seller they dealt with.
            Those reviews — real ones, tied to a real transaction — show up on that seller's public profile,
            alongside their reliability score, response rate, and sales history.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Tabs' as any, { screen: 'Search' } as any)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>See a seller's reviews</Text>
            <Text style={styles.ctaSub}>Open any listing and tap through to the seller's profile</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={Colors.white} />
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

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
    color: Colors.white,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  introTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.xl,
    color: Colors.white,
    marginBottom: 8,
  },
  introSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },

  badgeGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  badgeCard: {
    flex: 1,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 14,
    padding: 14,
  },
  badgeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentAlpha12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  badgeTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    marginBottom: 2,
  },
  badgeSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    lineHeight: 14,
  },

  sectionCard: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.card,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
    marginBottom: 8,
  },
  bodyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
  },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: Radius.card,
    padding: 18,
    gap: 12,
  },
  ctaTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  ctaSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
});
