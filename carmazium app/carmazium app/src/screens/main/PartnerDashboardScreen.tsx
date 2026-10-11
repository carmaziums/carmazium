import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { useNativeAppearance } from '../../theme/NativeAppearanceProvider';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { useAuthStore } from '../../store/authStore';
import {
  SERVICE_LABELS,
  ServiceType,
  PartnerProfile,
  PartnerTeam,
  applyPartnerCapability,
  createStripeConnectOnboarding,
  elevateToPartner,
  getPartnerProfile,
  getPartnerTeam,
  savePartnerBusiness,
} from '../../lib/servicesApi';
import { HamburgerButton } from '../../components/HamburgerButton';
import { IconButton } from '../../components/IconButton';

type Props = NativeStackScreenProps<MainStackParamList, 'PartnerDashboard'>;

const SERVICE_ORDER: ServiceType[] = ['DELIVERY', 'INSPECTION', 'FINANCE', 'WARRANTY'];

const statusText = (status?: string) => {
  switch (status) {
    case 'APPROVED': return 'Approved';
    case 'PENDING': return 'Awaiting approval';
    case 'REJECTED': return 'Rejected';
    case 'SUSPENDED': return 'Suspended';
    default: return 'Not activated';
  }
};

export const PartnerDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { palette, resolvedAppearance } = useNativeAppearance();
  const themed = usePartnerDashboardScreenPalette();
  const insets = useSafeAreaInsets();
  const accountRole = useAuthStore((s) => s.accountRole);
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [team, setTeam] = useState<PartnerTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextProfile = await getPartnerProfile();
      setProfile(nextProfile);
      setCompanyName(nextProfile.dealerProfile?.companyName || '');
      setPhone(nextProfile.dealerProfile?.phone || '');
      setBusinessAddress(nextProfile.dealerProfile?.businessAddress || '');

      if (nextProfile.role === 'DEALER' && nextProfile.dealerProfile) {
        try {
          setTeam(await getPartnerTeam());
        } catch (err: any) {
          setTeam(null);
          setError(err?.message || 'Could not load Partner services.');
        }
      } else {
        setTeam(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load Partner Account.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Show updates to verification, matching and quotes when returning to the hub.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

  const createPartner = async () => {
    setBusy('partner');
    setError(null);
    try {
      await elevateToPartner();
      await initializeAuth();
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not create your Partner Account.');
    } finally {
      setBusy(null);
    }
  };

  const saveBusiness = async () => {
    if (!companyName.trim()) {
      Alert.alert('Business name required', 'Enter your business or trading name first.');
      return;
    }
    setBusy('business');
    setError(null);
    try {
      await savePartnerBusiness({
        companyName: companyName.trim(),
        phone: phone.trim() || undefined,
        businessAddress: businessAddress.trim() || undefined,
      });
      await initializeAuth();
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not save Partner business details.');
    } finally {
      setBusy(null);
    }
  };

  const applyService = async (serviceType: ServiceType) => {
    if (!profile?.dealerProfile) {
      Alert.alert('Business details required', 'Save your Partner business details before adding services.');
      return;
    }
    setBusy(serviceType);
    setError(null);
    try {
      await applyPartnerCapability(serviceType);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not add this service.');
    } finally {
      setBusy(null);
    }
  };

  const startStripe = async () => {
    setBusy('stripe');
    setError(null);
    try {
      const url = await createStripeConnectOnboarding();
      await Linking.openURL(url);
    } catch (err: any) {
      setError(err?.message || 'Could not start Stripe payout setup.');
    } finally {
      setBusy(null);
    }
  };

  const isPartnerRole = profile?.role === 'DEALER' || accountRole === 'dealer';
  const byType = new Map((team?.capabilities ?? []).map((cap) => [cap.serviceType, cap]));
  const hasPaidJobCapability = Boolean(byType.get('DELIVERY') || byType.get('INSPECTION'));
  const hasApprovedJobCapability =
    byType.get('DELIVERY')?.status === 'APPROVED'
    || byType.get('INSPECTION')?.status === 'APPROVED';

  return (
    <View style={[themed.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={resolvedAppearance === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor={palette.bgBody} />
      <View style={themed.header}>
        <IconButton
          style={themed.headerButton}
          icon={<Ionicons name="chevron-back" size={19} color={palette.textPrimary} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text style={themed.headerTitle}>Partner Account</Text>
        <HamburgerButton />
      </View>

      {loading ? (
        <View style={themed.center}><ActivityIndicator color={Colors.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={themed.content} showsVerticalScrollIndicator={false}>
          <View style={themed.hero}>
            <Text style={themed.eyebrow}>TRADEXCHANGE PARTNER</Text>
            <Text style={themed.title}>One business account</Text>
            <Text style={themed.sub}>
              Add Vehicle Dealer, Delivery & Recovery, Inspection, Finance and Warranty services without replacing the services you already use.
            </Text>
          </View>

          {error ? (
            <View style={themed.errorCard}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.accent} />
              <Text style={themed.errorText}>{error}</Text>
            </View>
          ) : null}

          {!isPartnerRole ? (
            <View style={themed.card}>
              <Text style={themed.cardTitle}>Create a Partner Account</Text>
              <Text style={themed.cardText}>
                Your existing CarMazium login is kept. This changes the business shell so multiple trade services can live under one account.
              </Text>
              <TouchableOpacity style={themed.primaryButton} onPress={createPartner} disabled={busy === 'partner'}>
                {busy === 'partner' ? <ActivityIndicator color={Colors.white} /> : <Text style={themed.primaryText}>CREATE PARTNER ACCOUNT</Text>}
              </TouchableOpacity>
            </View>
          ) : !profile?.dealerProfile ? (
            <View style={themed.card}>
              <Text style={themed.cardTitle}>Set up your Partner business</Text>
              <Text style={themed.cardText}>Add these details once. CarMazium reuses them across every service you activate.</Text>
              <TextInput style={themed.input} value={companyName} onChangeText={setCompanyName} placeholder="Business or trading name" placeholderTextColor={palette.textMuted} />
              <TextInput style={themed.input} value={phone} onChangeText={setPhone} placeholder="Business phone" placeholderTextColor={palette.textMuted} keyboardType="phone-pad" />
              <TextInput style={themed.input} value={businessAddress} onChangeText={setBusinessAddress} placeholder="Business address / service area" placeholderTextColor={palette.textMuted} multiline />
              <TouchableOpacity style={themed.primaryButton} onPress={saveBusiness} disabled={busy === 'business'}>
                {busy === 'business' ? <ActivityIndicator color={Colors.white} /> : <Text style={themed.primaryText}>SAVE PARTNER BUSINESS</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={themed.card}>
                <View style={themed.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={themed.label}>PARTNER BUSINESS</Text>
                    <Text style={themed.cardTitle}>{profile.dealerProfile.companyName || team?.companyName || 'Partner business'}</Text>
                    {!!profile.dealerProfile.businessAddress && <Text style={themed.cardText}>{profile.dealerProfile.businessAddress}</Text>}
                  </View>
                  <Ionicons name="business-outline" size={28} color={Colors.warning} />
                </View>
              </View>

              <View style={themed.quickTasks}>
                <Text style={themed.sectionTitle}>Your workspace</Text>
                <View style={themed.quickTaskGrid}>
                  <TouchableOpacity style={themed.quickTask} onPress={() => navigation.navigate('ProviderJobs')} accessibilityRole="button" accessibilityLabel="See available delivery and inspection jobs" activeOpacity={0.8}>
                    <Ionicons name="briefcase-outline" size={21} color={Colors.accent} />
                    <Text style={themed.quickTaskText}>Available jobs</Text>
                    <Ionicons name="arrow-forward-outline" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={themed.quickTask} onPress={() => navigation.navigate('ProviderLeads')} accessibilityRole="button" accessibilityLabel="See matched finance and warranty enquiries" activeOpacity={0.8}>
                    <Ionicons name="document-text-outline" size={21} color={Colors.accent} />
                    <Text style={themed.quickTaskText}>Enquiries</Text>
                    <Ionicons name="arrow-forward-outline" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={themed.quickTask} onPress={() => navigation.navigate('ProviderCapabilities')} accessibilityRole="button" accessibilityLabel="Manage services and matching areas" activeOpacity={0.8}>
                    <Ionicons name="options-outline" size={21} color={Colors.accent} />
                    <Text style={themed.quickTaskText}>Service areas</Text>
                    <Ionicons name="arrow-forward-outline" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  {hasApprovedJobCapability && (
                    <TouchableOpacity style={themed.quickTask} onPress={() => navigation.navigate('ProviderMessages')} accessibilityRole="button" accessibilityLabel="Read service job messages" activeOpacity={0.8}>
                      <Ionicons name="chatbubble-outline" size={21} color={Colors.accent} />
                      <Text style={themed.quickTaskText}>Job messages</Text>
                      <Ionicons name="arrow-forward-outline" size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <View style={themed.sectionHeader}>
                <View>
                  <Text style={themed.sectionTitle}>Your services</Text>
                  <Text style={themed.sectionSub}>Adding one service never removes another.</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('ProviderCapabilities')}>
                  <Text style={themed.linkText}>MANAGE</Text>
                </TouchableOpacity>
              </View>

              {SERVICE_ORDER.map((type) => {
                const cap = byType.get(type);
                const approved = cap?.status === 'APPROVED';
                return (
                  <View key={type} style={themed.serviceCard}>
                    <View style={themed.serviceIcon}>
                      <Ionicons
                        name={type === 'DELIVERY' ? 'car-outline' : type === 'INSPECTION' ? 'search-outline' : type === 'FINANCE' ? 'cash-outline' : 'shield-checkmark-outline'}
                        size={21}
                        color={approved ? Colors.accentGreen : Colors.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={themed.serviceTitle}>{SERVICE_LABELS[type]}</Text>
                      <Text style={[themed.serviceStatus, approved && { color: Colors.accentGreen }]}>{statusText(cap?.status)}</Text>
                      {cap?.reviewNote ? <Text style={themed.reviewNote}>{cap.reviewNote}</Text> : null}
                    </View>
                    {!cap || cap.status === 'REJECTED' ? (
                      <TouchableOpacity style={themed.smallButton} onPress={() => applyService(type)} disabled={busy === type}>
                        {busy === type ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={themed.smallButtonText}>{cap ? 'REAPPLY' : 'ADD'}</Text>}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={themed.smallOutline} onPress={() => navigation.navigate('ProviderCapabilities')}>
                        <Text style={themed.smallOutlineText}>DETAILS</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              <View style={themed.card}>
                <View style={themed.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={themed.cardTitle}>Service Jobs</Text>
                    <Text style={themed.cardText}>
                      Quote on matching Delivery, Recovery and Inspection work. Accepted jobs stay here through payment, chat, start and completion.
                    </Text>
                  </View>
                  <Ionicons name="briefcase-outline" size={26} color={Colors.accent} />
                </View>
                <TouchableOpacity
                  style={themed.secondaryButton}
                  onPress={() => navigation.navigate('ProviderJobs')}
                >
                  <Ionicons name="construct-outline" size={17} color={Colors.white} />
                  <Text style={themed.secondaryText}>OPEN SERVICE JOBS</Text>
                </TouchableOpacity>
              </View>

              <View style={themed.card}>
                <View style={themed.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={themed.cardTitle}>Finance & Warranty Enquiries</Text>
                    <Text style={themed.cardText}>
                      Review Finance and Warranty enquiries matched to your approved services, then send or update your response from the app.
                    </Text>
                  </View>
                  <Ionicons name="mail-unread-outline" size={26} color={Colors.infoBlueLight} />
                </View>
                <TouchableOpacity
                  style={themed.secondaryButton}
                  onPress={() => navigation.navigate('ProviderLeads')}
                >
                  <Ionicons name="document-text-outline" size={17} color={Colors.white} />
                  <Text style={themed.secondaryText}>OPEN ENQUIRIES</Text>
                </TouchableOpacity>
              </View>

              {hasApprovedJobCapability && (
                <View style={themed.card}>
                  <View style={themed.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={themed.cardTitle}>Service job messages</Text>
                      <Text style={themed.cardText}>
                        Keep Delivery, Recovery and Inspection customer conversations separate from your general CarMazium inbox.
                      </Text>
                    </View>
                    <Ionicons name="chatbubbles-outline" size={26} color={Colors.accentGreen} />
                  </View>
                  <TouchableOpacity
                    style={themed.secondaryButton}
                    onPress={() => navigation.navigate('ProviderMessages')}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={17} color={Colors.white} />
                    <Text style={themed.secondaryText}>OPEN JOB MESSAGES</Text>
                  </TouchableOpacity>
                </View>
              )}

              {hasPaidJobCapability ? (
                <View style={themed.card}>
                  <Text style={themed.cardTitle}>Business payouts</Text>
                  <Text style={themed.cardText}>
                    Delivery and Inspection customers pay through CarMazium. CarMazium deducts 9% and 91% is paid to the Partner business Stripe Connect account.
                  </Text>
                  {team?.stripeConnect.complete ? (
                    <View style={themed.successRow}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.accentGreen} />
                      <Text style={themed.successText}>Stripe payouts connected</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={themed.secondaryButton} onPress={startStripe} disabled={busy === 'stripe'}>
                      {busy === 'stripe' ? <ActivityIndicator color={Colors.white} /> : <Text style={themed.secondaryText}>{team?.stripeConnect.connected ? 'FINISH PAYOUT SETUP' : 'SET UP BUSINESS PAYOUTS'}</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={themed.card}>
                  <Text style={themed.cardTitle}>Finance & Warranty payouts</Text>
                  <Text style={themed.cardText}>
                    No Stripe payout account is required for Finance or Warranty enquiries because CarMazium does not collect those provider payments.
                  </Text>
                </View>
              )}

              <TouchableOpacity style={themed.secondaryButton} onPress={() => navigation.navigate('DealerTeam')}>
                <Ionicons name="people-outline" size={17} color={Colors.white} />
                <Text style={themed.secondaryText}>MANAGE PARTNER TEAM</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 48 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  content: { padding: 18, gap: 14 },
  hero: { paddingVertical: 8 },
  quickTasks: { gap: 12, marginTop: 4 },
  quickTaskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  quickTask: { flexBasis: '47%', flexGrow: 1, minHeight: 70, borderRadius: Radius.inline, backgroundColor: Colors.bgCardSolid, borderWidth: 1, borderColor: Colors.borderHi, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12 },
  quickTaskText: { flex: 1, minWidth: 64, fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white },
  eyebrow: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.size10, letterSpacing: 1.6 },
  title: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xl, marginTop: 6 },
  sub: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 21, marginTop: 8 },
  card: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgCardSolid, padding: 16, gap: 12 },
  cardTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.base },
  cardText: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size12, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.bgTertiary, borderRadius: Radius.inline, paddingHorizontal: 13, paddingVertical: 12, color: Colors.white, fontFamily: FontFamily.regular, fontSize: FontSize.sm },
  primaryButton: { minHeight: 46, borderRadius: Radius.inline, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size12, letterSpacing: 0.7 },
  secondaryButton: { minHeight: 46, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flexDirection: 'row', gap: 8 },
  secondaryText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 },
  sectionTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.lg },
  sectionSub: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size12, marginTop: 3 },
  linkText: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.xs },
  serviceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgCardSolid, borderRadius: Radius.card, padding: 14 },
  serviceIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  serviceTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.sm },
  serviceStatus: { fontFamily: FontFamily.medium, color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 3 },
  reviewNote: { fontFamily: FontFamily.regular, color: Colors.paleRed_fca5a5, fontSize: FontSize.size10, marginTop: 3 },
  smallButton: { minWidth: 72, minHeight: 44, borderRadius: 10, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  smallButtonText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10 },
  smallOutline: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderHi, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  smallOutlineText: { fontFamily: FontFamily.bold, color: Colors.textSecondary, fontSize: FontSize.size10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, letterSpacing: 1.2, marginBottom: 4 },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  successText: { fontFamily: FontFamily.bold, color: Colors.accentGreen, fontSize: FontSize.size12 },
  errorCard: { flexDirection: 'row', gap: 9, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10, padding: 12 },
  errorText: { flex: 1, fontFamily: FontFamily.regular, color: Colors.paleRed_fca5a5, fontSize: FontSize.size12, lineHeight: 18 },
});

function usePartnerDashboardScreenPalette() {
  const { palette } = useNativeAppearance();
  return React.useMemo(() => ({
    ...styles,
    container: [styles.container, { backgroundColor: palette.bgBody }],
    header: [styles.header, { backgroundColor: palette.bgHeader, borderBottomColor: palette.borderDefault }],
    headerButton: [styles.headerButton, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    headerTitle: [styles.headerTitle, { color: palette.textPrimary }],
    hero: [styles.hero, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    title: [styles.title, { color: palette.textPrimary }],
    sub: [styles.sub, { color: palette.textSecondary }],
    card: [styles.card, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    cardTitle: [styles.cardTitle, { color: palette.textPrimary }],
    cardText: [styles.cardText, { color: palette.textSecondary }],
    input: [styles.input, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault, color: palette.textPrimary }],
    quickTask: [styles.quickTask, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    quickTaskText: [styles.quickTaskText, { color: palette.textPrimary }],
    sectionTitle: [styles.sectionTitle, { color: palette.textPrimary }],
    sectionSub: [styles.sectionSub, { color: palette.textSecondary }],
    serviceCard: [styles.serviceCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    serviceIcon: [styles.serviceIcon, { backgroundColor: palette.bgInput }],
    serviceTitle: [styles.serviceTitle, { color: palette.textPrimary }],
    serviceStatus: [styles.serviceStatus, { color: palette.textSecondary }],
    reviewNote: [styles.reviewNote, { color: palette.textMuted }],
    secondaryButton: [styles.secondaryButton, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    secondaryText: [styles.secondaryText, { color: palette.textPrimary }],
    label: [styles.label, { color: palette.textMuted }],
    smallOutline: [styles.smallOutline, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    smallOutlineText: [styles.smallOutlineText, { color: palette.textSecondary }],
    errorCard: [styles.errorCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
  }), [palette]);
}
