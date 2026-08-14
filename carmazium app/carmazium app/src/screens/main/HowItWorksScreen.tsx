import React, { useState } from 'react';
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

// ─────────────────────────── data ──────────────────────────────────

type Mode = 'buyer' | 'seller';

interface Step {
  id: string;
  icon: string;
  title: string;
  desc: string;
  details: string[];
}

/**
 * The itemised fee ledger, mirroring web's RECEIPTS (how-it-works/page.tsx:45).
 * Figures kept identical to web on purpose — two different numbers for the same
 * fee across platforms is worse than showing none.
 */
const RECEIPTS = {
  seller: {
    label: 'Your sale, itemised',
    rows: [
      { k: 'Vehicle sale price', v: '£8,450', note: 'paid to you, by the dealer' },
      { k: 'CarMazium listing fee', v: '£0', note: 'free, always' },
      { k: 'CarMazium seller reward', v: '+£100', note: 'paid to you, after handover' },
    ],
    total: { k: 'You receive', v: '£8,550' },
  },
  buyer: {
    label: 'Your purchase, itemised',
    rows: [
      { k: 'Winning bid', v: '£8,450', note: 'paid to the seller, directly' },
      { k: 'CarMazium buyer fee', v: '£125', note: "unlocks the seller's contact details" },
    ],
    total: { k: 'Total to drive away', v: '£8,575' },
  },
} as const;

const BUYER_STEPS: Step[] = [
  {
    id: '01',
    icon: 'search-outline',
    title: 'Smart Search',
    desc: 'Filter by make, model, price, and location to find vehicles that match exactly what you need — with smart sorting to surface the best matches first.',
    details: ['Powerful filters', 'Saved searches & alerts', 'Side-by-side compare'],
  },
  {
    id: '02',
    icon: 'shield-checkmark-outline',
    title: 'Verified Listings',
    desc: 'Every listing comes with seller verification, vehicle history checks, and clear photos — so you know what you are looking at before you reach out.',
    details: ['Seller verification', 'History checks', 'Service records'],
  },
  {
    id: '03',
    icon: 'card-outline',
    title: 'Secure Purchase',
    desc: 'Message the seller directly, agree your terms, and complete the deal through the platform. Delivery and warranty options are available via trusted partners.',
    details: ['Direct messaging', 'Trusted delivery partners', 'Optional warranty'],
  },
];

const SELLER_STEPS: Step[] = [
  {
    id: '01',
    icon: 'calculator-outline',
    title: 'Quick Valuation',
    desc: 'Get an instant estimate of your vehicle’s value based on current market data — no obligation, just a clear starting point.',
    details: ['Instant estimate', 'Market comparison', 'No obligation'],
  },
  {
    id: '02',
    icon: 'hammer-outline',
    title: 'Choose Your Method',
    desc: 'List your car for retail sale to maximise your price, or enter it into a live auction for a quicker turnaround — whichever suits you best.',
    details: ['Retail listing', 'Live auctions', 'You set the reserve'],
  },
  {
    id: '03',
    icon: 'wallet-outline',
    title: 'Get Paid',
    desc: 'Once a deal is agreed and finalised with your buyer, the paperwork and handover are guided step-by-step so the process stays smooth from start to finish.',
    details: ['Guided handover', 'Clear paperwork steps', 'Direct buyer contact'],
  },
];

const PEACE_OF_MIND = [
  { icon: 'car-outline', title: 'Delivery', desc: 'Via trusted 3rd-party couriers' },
  { icon: 'umbrella-outline', title: 'Warranty', desc: 'Optional 3rd-party coverage' },
  { icon: 'people-outline', title: 'Direct Deals', desc: 'Buyer & seller connect directly' },
  { icon: 'headset-outline', title: 'Support', desc: 'Help on hand when you need it' },
];

// ═══════════════════════════ COMPONENT ════════════════════════════

export const HowItWorksScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const [mode, setMode] = useState<Mode>('buyer');
  const steps = mode === 'buyer' ? BUYER_STEPS : SELLER_STEPS;
  const receipt = mode === 'buyer' ? RECEIPTS.buyer : RECEIPTS.seller;

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

      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>How It Works</Text>
        <HamburgerButton />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.introSub}>
          Whether you’re buying your next car or selling your current one, here’s exactly
          what to expect at every step.
        </Text>

        {/* Tab toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'buyer' && styles.toggleBtnActive]}
            activeOpacity={0.8}
            onPress={() => setMode('buyer')}
          >
            <Text style={[styles.toggleText, mode === 'buyer' && styles.toggleTextActive]}>I’M BUYING</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'seller' && styles.toggleBtnActive]}
            activeOpacity={0.8}
            onPress={() => setMode('seller')}
          >
            <Text style={[styles.toggleText, mode === 'seller' && styles.toggleTextActive]}>I’M SELLING</Text>
          </TouchableOpacity>
        </View>

        {/* Steps */}
        {steps.map((step) => (
          <View key={step.id} style={styles.stepCard}>
            <View style={styles.stepTopRow}>
              <View style={styles.stepIconWrap}>
                <Ionicons name={step.icon} size={22} color={Colors.accent} />
              </View>
              <Text style={styles.stepNumber}>{step.id}</Text>
            </View>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDesc}>{step.desc}</Text>
            <View style={styles.detailChipsRow}>
              {step.details.map((d) => (
                <View key={d} style={styles.detailChip}>
                  <Ionicons name="checkmark" size={11} color={Colors.success} />
                  <Text style={styles.detailChipText}>{d}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Itemised receipt — web's how-it-works rewrite (7ee31c40) added this
            and it's the most useful thing on that page: it states the actual
            economics instead of describing them. Mobile had no fee figures on
            this screen at all, so a seller couldn't find out what they'd be
            paid, or a buyer what they'd owe, without starting a transaction. */}
        <Text style={styles.sectionTitle}>{receipt.label}</Text>
        <View style={styles.receiptCard}>
          {receipt.rows.map((row) => (
            <View key={row.k} style={styles.receiptRow}>
              <View style={styles.receiptRowLeft}>
                <Text style={styles.receiptKey}>{row.k}</Text>
                <Text style={styles.receiptNote}>{row.note}</Text>
              </View>
              <Text style={styles.receiptValue}>{row.v}</Text>
            </View>
          ))}
          <View style={styles.receiptTotalRow}>
            <Text style={styles.receiptTotalKey}>{receipt.total.k}</Text>
            <Text style={styles.receiptTotalValue}>{receipt.total.v}</Text>
          </View>
          <Text style={styles.receiptFootnote}>
            Example figures on an £8,450 vehicle. CarMazium never holds the sale
            money — it moves directly between buyer and seller.
          </Text>
        </View>

        {/* Peace of mind grid */}
        <Text style={styles.sectionTitle}>Complete Peace of Mind</Text>
        <View style={styles.peaceGrid}>
          {PEACE_OF_MIND.map((item) => (
            <View key={item.title} style={styles.peaceCard}>
              <Ionicons name={item.icon} size={20} color={Colors.textSecondary} />
              <Text style={styles.peaceTitle}>{item.title}</Text>
              <Text style={styles.peaceDesc}>{item.desc}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════ STYLES ════════════════════════════════

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
  headerPlaceholder: { width: 38 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 16,
  },

  introSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
  },

  // ── Toggle ──
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.whiteAlpha04,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.accent,
  },
  toggleText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    letterSpacing: 0.6,
    color: Colors.textMuted,
  },
  toggleTextActive: {
    color: Colors.white,
  },

  // ── Step card ──
  stepCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 18,
    gap: 8,
  },
  stepTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepIconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accentAlpha10,
    borderWidth: 1,
    borderColor: Colors.accentAlpha22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['3xl'],
    color: Colors.whiteAlpha07,
  },
  stepTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size17,
    color: Colors.white,
  },
  stepDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  detailChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.successAlpha08,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.18)',
    borderRadius: Radius.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  detailChipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  // ── Peace of mind ──
  receiptCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    padding: 18,
    marginBottom: 8,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  receiptRowLeft: {
    flex: 1,
    minWidth: 0,
  },
  receiptKey: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  receiptNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size11_5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  receiptValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 14,
  },
  receiptTotalKey: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  receiptTotalValue: {
    fontFamily: FontFamily.monoExtraBold,
    fontSize: FontSize.size22,
    color: Colors.accent,
  },
  receiptFootnote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size11_5,
    lineHeight: 16,
    color: Colors.textMuted,
    marginTop: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
    marginTop: 6,
  },
  peaceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  peaceCard: {
    width: '48%',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 14,
    gap: 6,
  },
  peaceTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  peaceDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 16,
  },
});
