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
import { HamburgerButton } from '../../components/HamburgerButton';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─────────────────────────── data ──────────────────────────────────

const WHY_BULLETS = [
  {
    icon: 'shield-checkmark-outline',
    title: 'Verified Listings',
    desc: 'Every vehicle listing is verified — seller identity checks, history reports, and clear imagery so you know exactly what you are getting.',
  },
  {
    icon: 'gavel-outline' as const,
    title: 'Live Auctions',
    desc: 'Bid in real-time on premium vehicles with transparent auction mechanics, anti-snipe protection, and live bidding feeds.',
  },
  {
    icon: 'eye-outline',
    title: 'Transparent Process',
    desc: 'No hidden fees, no surprises. Pricing is clear, seller info is verified, and every step of the deal is guided.',
  },
  {
    icon: 'people-outline',
    title: 'Buyer & Seller Focused',
    desc: 'Whether you are buying your next dream car or selling your current one, Carmazium is built for both sides of every transaction.',
  },
];

// ═══════════════════════════ COMPONENT ════════════════════════════

export const AboutScreen: React.FC = () => {
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
        <Text style={styles.headerTitle}>About</Text>
        <HamburgerButton />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero intro ── */}
        <View style={styles.heroSection}>
          <View style={styles.logoMark}>
            <Ionicons name="car-sport-outline" size={32} color={Colors.accent} />
          </View>
          <Text style={styles.heroTitle}>CARMAZIUM</Text>
          <Text style={styles.heroTagline}>Premium Automotive Marketplace</Text>
          <Text style={styles.heroDesc}>
            Carmazium is the UK's premium automotive marketplace — connecting buyers
            with curated, verified vehicle listings and live auction experiences.
          </Text>
        </View>

        {/* ── Why Carmazium ── */}
        <Text style={styles.sectionTitle}>Why Carmazium</Text>

        {WHY_BULLETS.map((item) => (
          <View key={item.title} style={styles.bulletCard}>
            <View style={styles.bulletIconWrap}>
              <Ionicons name={item.icon as any} size={20} color={Colors.accent} />
            </View>
            <View style={styles.bulletText}>
              <Text style={styles.bulletTitle}>{item.title}</Text>
              <Text style={styles.bulletDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}

        {/* ── Footer brand ── */}
        <View style={styles.footerBrand}>
          <Text style={styles.footerWordmark}>CARMAZIUM</Text>
          <Text style={styles.footerTaglineText}>
            Buy smarter. Sell faster. Drive premium.
          </Text>
          <Text style={styles.footerVersion}>
            Built in the UK &bull; Est. 2024
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

  // ── Hero ──
  heroSection: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.accentAlpha12,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
    letterSpacing: 4,
  },
  heroTagline: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.accent,
    letterSpacing: 1,
  },
  heroDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },

  // ── Section title ──
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    marginTop: 4,
  },

  // ── Bullet cards ──
  bulletCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 16,
  },
  bulletIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: Colors.accentAlpha10,
    borderWidth: 1,
    borderColor: Colors.accentAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    gap: 4,
  },
  bulletTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  bulletDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ── Footer brand ──
  footerBrand: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.whiteAlpha06,
    gap: 6,
  },
  footerWordmark: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.accent,
    letterSpacing: 3,
  },
  footerTaglineText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footerVersion: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
