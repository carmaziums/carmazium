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
    color: '#60A5FA',
    bg: 'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.22)',
  },
  {
    title: 'Car Inspection',
    desc: 'Connect with certified inspectors who carry out detailed, independent vehicle evaluations before you commit to a purchase.',
    icon: 'search-outline',
    color: '#34D399',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.22)',
  },
  {
    title: 'Warranty Coverage',
    desc: 'Extended third-party warranty options give you protection against unexpected mechanical or electrical failures after purchase.',
    icon: 'ribbon-outline',
    color: '#C084FC',
    bg: 'rgba(168,85,247,0.10)',
    border: 'rgba(168,85,247,0.22)',
  },
  {
    title: 'Vehicle Financing',
    desc: 'Get matched with finance providers offering structured payment plans and pre-approvals tailored to your budget.',
    icon: 'cash-outline',
    color: '#FBBF24',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.22)',
  },
  {
    title: 'Maintenance',
    desc: 'Find trusted garages and mobile mechanics for routine servicing, repairs, and specialist maintenance work near you.',
    icon: 'build-outline',
    color: Colors.accent,
    bg: 'rgba(220,31,38,0.10)',
    border: 'rgba(220,31,38,0.22)',
  },
  {
    title: 'Insurance',
    desc: 'Compare comprehensive vehicle insurance options from trusted providers, with coverage levels to suit every driver.',
    icon: 'umbrella-outline',
    color: '#22D3EE',
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
        colors={['rgba(34,211,238,0.05)', 'rgba(10,10,12,0)', '#0A0A0C']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.75}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>
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
          <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    backgroundColor: '#111115',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 19,
  },

  noteCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    marginTop: 4,
  },
  noteText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
