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

// Web's /finance page (src/app/finance/page.tsx) has a "Trusted Lending
// Partners" grid of made-up company names (Global Bank, Auto Finance Co,
// Prime Lenders...) and an application form with no onSubmit handler at all
// — neither is wired to anything real even on web. Mobile deliberately
// doesn't port either: the eligibility bullets and representative-example
// disclosure below are ported as-is (they're genuine product terms, not
// fabricated), but the fake partner grid and dead-end form are replaced
// with an honest CTA. See mobile-production-readiness-plan.md F14.

const ELIGIBILITY_POINTS = [
  'No impact on credit score to check eligibility',
  'Flexible terms from 12 to 60 months',
  'Low APR starting from 19% (subject to status)',
  'Zero deposit options available',
];

export const FinanceScreen: React.FC = () => {
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
        <Text style={styles.headerTitle}>Vehicle Finance</Text>
        <HamburgerButton />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.introTitle}>Smart financing for your next car</Text>
        <Text style={styles.introSub}>
          Competitive rates and transparent terms — here's what to expect before you apply.
        </Text>

        <View style={styles.sectionCard}>
          {ELIGIBILITY_POINTS.map((p) => (
            <View key={p} style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.bulletText}>{p}</Text>
            </View>
          ))}
        </View>

        <View style={styles.exampleCard}>
          <Text style={styles.exampleTitle}>Representative example</Text>
          <Text style={styles.exampleText}>
            Borrowing £20,000 over 48 months with a representative APR of 19%, an annual interest rate
            of 19% (fixed) and a deposit of £2,000. The amount payable would be £425.32 per month, with
            a total cost of credit of £2,415.36 and a total amount payable of £22,415.36.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Calculate your monthly payments</Text>
          <Text style={styles.bodyText}>
            Every listing has a finance calculator for that specific vehicle's price — open any car
            you're interested in and expand the "Finance Calculator" section to see estimated payments.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Tabs' as any, { screen: 'Search' } as any)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Browse cars with finance estimates</Text>
            <Text style={styles.ctaSub}>Find a vehicle and see its monthly payment estimate</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={Colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryCta}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Contact')}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.accent} />
          <Text style={styles.secondaryCtaText}>Have a question about financing? Contact us</Text>
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

  sectionCard: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.card,
    padding: 18,
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
    marginBottom: 4,
  },
  bodyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 19,
  },

  exampleCard: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    borderRadius: Radius.inline,
    padding: 16,
    marginBottom: 16,
  },
  exampleTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
    marginBottom: 6,
  },
  exampleText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 17,
  },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: Radius.card,
    padding: 18,
    gap: 12,
    marginBottom: 12,
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

  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  secondaryCtaText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.accent,
  },
});
