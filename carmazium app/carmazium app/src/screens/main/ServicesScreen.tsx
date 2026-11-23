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
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Elevation, Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─────────────────────────── data ──────────────────────────────────

interface ServiceItem {
  title: string;
  desc: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  path: string;
  cta: string;
  kind: string;
}

// These are the four active customer service journeys on the website.
// All CarMazium forms use native screens.
const SERVICES: ServiceItem[] = [
  {
    title: 'Vehicle Transport',
    desc: 'Post a vehicle transport or recovery job. Approved providers can send competing fixed-price quotes.',
    icon: 'car-outline',
    color: Colors.infoBlueLight,
    bg: Colors.infoBlueAlpha10,
    border: Colors.infoBlueAlpha20,
    path: '/services/delivery/new',
    cta: 'Get transport quotes',
    kind: 'Paid service job',
  },
  {
    title: 'Vehicle Inspections',
    desc: 'Arrange an independent pre-purchase inspection and choose from approved inspectors’ quotes.',
    icon: 'search-outline',
    color: Colors.lightGreen_34d399,
    bg: Colors.successAlpha10,
    border: Colors.successAlpha25,
    path: '/services/inspection/new',
    cta: 'Request an inspection',
    kind: 'Paid service job',
  },
  {
    title: 'Vehicle Finance',
    desc: 'Apply from a participating listing with an admin-selected finance provider. Finance providers: contact our team directly.',
    icon: 'cash-outline',
    color: Colors.lightOrange_fbbf24,
    bg: Colors.warningAlpha10,
    border: Colors.warningAlpha30,
    path: '/services/finance',
    cta: 'Explore finance',
    kind: 'Admin-managed service',
  },
  {
    title: 'Vehicle Warranty',
    desc: 'Choose warranty options, review a quote and track your order. Cover starts only after issuance.',
    icon: 'shield-checkmark-outline',
    color: Colors.palePurple_c084fc,
    bg: Colors.infoBlueAlpha10,
    border: Colors.borderHi,
    path: '/services/warranty',
    cta: 'Get a warranty quote',
    kind: 'Admin-managed service',
  },
];

// ═══════════════════════════ COMPONENT ════════════════════════════

export const ServicesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const openService = (path: string) => {
    if (path === '/services/delivery/new') navigation.navigate('CreateServiceJob', { serviceType: 'DELIVERY' });
    else if (path === '/services/inspection/new') navigation.navigate('CreateServiceJob', { serviceType: 'INSPECTION' });
    else navigation.navigate(path === '/services/finance' ? 'Finance' : 'Warranty');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha06, Colors.bgPrimary, Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>TradeXchange Services</Text>
        <HamburgerButton />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>TRADEXCHANGE</Text>
        <Text style={styles.introTitle}>Everything your vehicle needs. One marketplace.</Text>
        <Text style={styles.introSub}>
          Arrange vehicle delivery or inspection, explore finance and warranty cover,
          and manage your jobs with approved service partners.
        </Text>

        <Text style={styles.sectionHeading}>Choose a service</Text>
        {SERVICES.map(service => (
          <TouchableOpacity key={service.path} style={styles.card} activeOpacity={0.8}
            onPress={() => openService(service.path)} accessibilityRole="button" accessibilityLabel={service.cta}>
            <View style={styles.iconWrap}><Ionicons name={service.icon} size={22} color={Colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{service.title}</Text>
              <Text style={styles.cardDesc}>{service.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.customerJobsCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CustomerServiceJobs')}
        >
          <View style={styles.customerJobsIcon}>
            <Ionicons name="briefcase-outline" size={22} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.partnerTitle}>My service requests</Text>
            <Text style={styles.partnerText}>
              Track delivery and inspection requests, compare quotes, pay providers and manage completed work.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.partnerCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PartnerDashboard')}
        >
          <View style={styles.partnerIcon}>
            <Ionicons name="business-outline" size={22} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.partnerTitle}>Provide services with CarMazium</Text>
            <Text style={styles.partnerText}>
              Use one Partner Account for Delivery and Inspections. Contact our team about finance, warranty and insurance partnerships.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={styles.noteText}>
            Delivery and inspection are paid service jobs with competing provider quotes and CarMazium checkout. Warranty cover is quoted and ordered through CarMazium; cover begins after issuance. Finance applications continue externally with the provider selected by admin; prospective partners contact our team. CarMazium does not make lending decisions or guarantee approval.
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 2,
    ...Elevation.card,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 14,
  },

  eyebrow: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accent, letterSpacing: 1.2, marginBottom: -7 },
  sectionHeading: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white, marginTop: 10 },

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

  customerJobsCard: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    backgroundColor: Colors.bgCardSolid,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
    marginBottom: 12,
  },
  customerJobsIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    backgroundColor: Colors.accentAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  partnerCard: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    backgroundColor: Colors.bgCardSolid,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
    marginBottom: 12,
  },
  partnerIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    backgroundColor: Colors.accentAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  partnerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  partnerText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  card: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    backgroundColor: Colors.bgCardSolid,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
    marginBottom: 12,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    backgroundColor: Colors.accentAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  noteCard: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: Radius.inline,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
    ...Elevation.card,
  },
  noteText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
