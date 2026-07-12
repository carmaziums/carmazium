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

interface ServiceItem {
  title: string;
  desc: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}

const SERVICES: ServiceItem[] = [
  {
    title: 'Vehicle Delivery',
    desc: 'Professional vehicle delivery — your car gets transported to your door safely and on schedule, via trusted third-party couriers.',
    icon: 'car-outline',
    color: Colors.infoBlueLight,
    bg: Colors.infoBlueAlpha10,
    border: 'rgba(59,130,246,0.22)',
  },
  {
    title: 'Car Inspection',
    desc: 'Connect with certified inspectors who carry out detailed, independent vehicle evaluations before you commit to a purchase.',
    icon: 'search-outline',
    color: Colors.lightGreen_34d399,
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.22)',
  },
  {
    title: 'Warranty Coverage',
    desc: 'Extended third-party warranty options give you protection against unexpected mechanical or electrical failures after purchase.',
    icon: 'ribbon-outline',
    color: Colors.palePurple_c084fc,
    bg: 'rgba(168,85,247,0.10)',
    border: 'rgba(168,85,247,0.22)',
  },
  {
    title: 'Vehicle Financing',
    desc: 'Get matched with finance providers offering structured payment plans and pre-approvals tailored to your budget.',
    icon: 'cash-outline',
    color: Colors.lightOrange_fbbf24,
    bg: Colors.warningAlpha10,
    border: 'rgba(245,158,11,0.22)',
  },
  {
    title: 'Maintenance',
    desc: 'Find trusted garages and mobile mechanics for routine servicing, repairs, and specialist maintenance work near you.',
    icon: 'build-outline',
    color: Colors.accent,
    bg: Colors.accentAlpha10,
    border: Colors.accentAlpha22,
  },
  {
    title: 'Insurance',
    desc: 'Compare comprehensive vehicle insurance options from trusted providers, with coverage levels to suit every driver.',
    icon: 'umbrella-outline',
    color: Colors.lightTeal_22d3ee,
    bg: 'rgba(34,211,238,0.10)',
    border: 'rgba(34,211,238,0.22)',
  },
];

// ═══════════════════════════ COMPONENT ════════════════════════════

export const ServicesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(34,211,238,0.05)', 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>Services</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.introTitle}>Carmazium Service Hub</Text>
        <Text style={styles.introSub}>
          Everything you need around your vehicle, in one place — connect with trusted,
          vetted professionals across the automotive world.
        </Text>

        <View style={{ height: 8 }} />

        {SERVICES.map((service) => (
          <View key={service.title} style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: service.bg, borderColor: service.border }]}>
              <Ionicons name={service.icon} size={22} color={service.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{service.title}</Text>
              <Text style={styles.cardDesc}>{service.desc}</Text>
            </View>
          </View>
        ))}

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={styles.noteText}>
            Carmazium connects you with independent professionals and partners. Each service is
            provided by a third party — agreements and any costs are between you and that provider.
          </Text>
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
    gap: 14,
  },

  introTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.white,
  },
  introSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginTop: 6,
  },

  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 16,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
    marginBottom: 4,
  },
  cardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    lineHeight: 19,
  },

  noteCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.whiteAlpha04,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    padding: 14,
    marginTop: 4,
  },
  noteText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
