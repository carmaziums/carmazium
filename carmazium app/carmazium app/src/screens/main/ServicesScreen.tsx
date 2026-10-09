import React from 'react';
import {
  ScrollView,
  StatusBar,
  Linking,
  Alert,
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
// Native service-request forms do not yet exist, so use the real web form
// instead of displaying decorative cards with no way to continue.
const SERVICES: ServiceItem[] = [
  {
    title: 'Delivery & Recovery',
    desc: 'Post a vehicle transport or recovery job. Approved providers can send competing fixed-price quotes.',
    icon: 'car-outline',
    color: Colors.infoBlueLight,
    bg: Colors.infoBlueAlpha10,
    border: Colors.infoBlueAlpha20,
    path: '/services/delivery/new',
    cta: 'Post delivery job',
    kind: 'Paid service job',
  },
  {
    title: 'Vehicle Inspection',
    desc: 'Arrange an independent pre-purchase inspection and choose from approved inspectors’ quotes.',
    icon: 'search-outline',
    color: Colors.lightGreen_34d399,
    bg: Colors.successAlpha10,
    border: Colors.successAlpha25,
    path: '/services/inspection/new',
    cta: 'Request inspection',
    kind: 'Paid service job',
  },
  {
    title: 'Vehicle Finance',
    desc: 'Send one enquiry to approved finance providers, who respond with their own eligibility and terms.',
    icon: 'cash-outline',
    color: Colors.lightOrange_fbbf24,
    bg: Colors.warningAlpha10,
    border: Colors.warningAlpha30,
    path: '/services/finance',
    cta: 'Request finance options',
    kind: 'Matched enquiry',
  },
  {
    title: 'Vehicle Warranty',
    desc: 'Request warranty options and compare providers’ cover levels, exclusions and indicative costs.',
    icon: 'shield-checkmark-outline',
    color: Colors.palePurple_c084fc,
    bg: Colors.infoBlueAlpha10,
    border: Colors.borderHi,
    path: '/services/warranty',
    cta: 'Request warranty options',
    kind: 'Matched enquiry',
  },
];

// ═══════════════════════════ COMPONENT ════════════════════════════

export const ServicesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const continueOnWeb = async (path: string) => {
    // Native create-job and lead forms are not implemented. Preserve the
    // website's real request/consent flow, including service kill-switches.
    try {
      await Linking.openURL(`https://www.carmazium.com${path}`);
    } catch {
      Alert.alert('Could not open CarMazium', 'Please visit www.carmazium.com/services and choose your service.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
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
        <Text style={styles.introTitle}>Post work or compete for it</Text>
        <Text style={styles.introSub}>
          Book vehicle delivery or inspection, request finance or warranty options,
          and manage your jobs with approved service partners.
        </Text>
        <TouchableOpacity
          style={styles.postJobButton}
          activeOpacity={0.8}
          onPress={() => void continueOnWeb('/services/jobs/new')}
          accessibilityRole="button"
          accessibilityLabel="Post a service job on the CarMazium website"
          accessibilityHint="Opens the CarMazium website to complete the request"
        >
          <Ionicons name="add-circle-outline" size={22} color={Colors.white} />
          <View style={{ flex: 1 }}>
            <Text style={styles.postJobTitle}>Post a delivery or inspection job</Text>
            <Text style={styles.postJobHint}>Continue on CarMazium website</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={Colors.white} />
        </TouchableOpacity>

        <View style={{ height: 8 }} />

        <TouchableOpacity
          style={styles.customerJobsCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CustomerServiceJobs')}
        >
          <View style={styles.customerJobsIcon}>
            <Ionicons name="briefcase-outline" size={22} color={Colors.infoBlueLight} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.partnerTitle}>My service jobs</Text>
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
            <Ionicons name="business-outline" size={22} color={Colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.partnerTitle}>Provide services with CarMazium</Text>
            <Text style={styles.partnerText}>
              Use one Partner Account for Delivery & Recovery, Inspections, Vehicle Finance and Warranty services.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.sectionHeading}>Choose a service</Text>
        {SERVICES.map((service) => (
          <TouchableOpacity
            key={service.title}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => void continueOnWeb(service.path)}
            accessibilityRole="button"
            accessibilityLabel={`${service.cta} on the CarMazium website`}
            accessibilityHint="Opens the service form on CarMazium website"
          >
            <View style={[styles.iconWrap, { backgroundColor: service.bg, borderColor: service.border }]}>
              <Ionicons name={service.icon} size={22} color={service.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardKind}>{service.kind}</Text>
              <Text style={styles.cardTitle}>{service.title}</Text>
              <Text style={styles.cardDesc}>{service.desc}</Text>
              <View style={styles.cardAction}>
                <Text style={styles.cardActionText}>{service.cta}</Text>
                <Ionicons name="arrow-forward-outline" size={17} color={Colors.accent} />
              </View>
              <Text style={styles.cardWebHint}>Continues on website</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={styles.noteText}>
            Delivery and inspection are paid service jobs with competing provider quotes and CarMazium checkout. Finance and warranty are matched enquiries handled directly with providers. CarMazium does not make lending decisions or guarantee approval.
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

  eyebrow: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accent, letterSpacing: 1.2, marginBottom: -7 },
  sectionHeading: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white, marginTop: 10 },
  postJobButton: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 75, backgroundColor: Colors.accent, borderRadius: Radius.card, marginBottom: 3 },
  postJobTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white },
  postJobHint: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.white, opacity: 0.9, marginTop: 4 },
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
    gap: 13,
    alignItems: 'center',
    backgroundColor: Colors.infoBlueAlpha10,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
    padding: 16,
  },
  customerJobsIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.infoBlueAlpha10,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
  },
  partnerCard: {
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
    backgroundColor: Colors.warningAlpha08,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
    padding: 16,
  },
  partnerIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.inline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.warningAlpha10,
  },
  partnerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
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
    backgroundColor: Colors.bgCardSolid,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
    alignItems: 'flex-start',
    minHeight: 130,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.inline,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardKind: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accent, letterSpacing: 0.4, marginBottom: 5 },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  cardActionText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.accent },
  cardWebHint: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
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
    borderRadius: Radius.inline,
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
