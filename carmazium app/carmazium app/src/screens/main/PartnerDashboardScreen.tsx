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
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
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

  useEffect(() => { void load(); }, [load]);

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.header}>
        <IconButton
          style={styles.headerButton}
          icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text style={styles.headerTitle}>Partner Account</Text>
        <HamburgerButton />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>TRADEXCHANGE PARTNER</Text>
            <Text style={styles.title}>One business account</Text>
            <Text style={styles.sub}>
              Add Vehicle Dealer, Delivery & Recovery, Inspection, Finance and Warranty services without replacing the services you already use.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.accent} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!isPartnerRole ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Create a Partner Account</Text>
              <Text style={styles.cardText}>
                Your existing CarMazium login is kept. This changes the business shell so multiple trade services can live under one account.
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={createPartner} disabled={busy === 'partner'}>
                {busy === 'partner' ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>CREATE PARTNER ACCOUNT</Text>}
              </TouchableOpacity>
            </View>
          ) : !profile?.dealerProfile ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Set up your Partner business</Text>
              <Text style={styles.cardText}>Add these details once. CarMazium reuses them across every service you activate.</Text>
              <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder="Business or trading name" placeholderTextColor={Colors.textMuted} />
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Business phone" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
              <TextInput style={styles.input} value={businessAddress} onChangeText={setBusinessAddress} placeholder="Business address / service area" placeholderTextColor={Colors.textMuted} multiline />
              <TouchableOpacity style={styles.primaryButton} onPress={saveBusiness} disabled={busy === 'business'}>
                {busy === 'business' ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>SAVE PARTNER BUSINESS</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>PARTNER BUSINESS</Text>
                    <Text style={styles.cardTitle}>{profile.dealerProfile.companyName || team?.companyName || 'Partner business'}</Text>
                    {!!profile.dealerProfile.businessAddress && <Text style={styles.cardText}>{profile.dealerProfile.businessAddress}</Text>}
                  </View>
                  <Ionicons name="business-outline" size={28} color={Colors.warning} />
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Your add-ons</Text>
                  <Text style={styles.sectionSub}>Adding one service never removes another.</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('ProviderCapabilities')}>
                  <Text style={styles.linkText}>MANAGE</Text>
                </TouchableOpacity>
              </View>

              {SERVICE_ORDER.map((type) => {
                const cap = byType.get(type);
                const approved = cap?.status === 'APPROVED';
                return (
                  <View key={type} style={styles.serviceCard}>
                    <View style={styles.serviceIcon}>
                      <Ionicons
                        name={type === 'DELIVERY' ? 'car-outline' : type === 'INSPECTION' ? 'search-outline' : type === 'FINANCE' ? 'cash-outline' : 'shield-checkmark-outline'}
                        size={21}
                        color={approved ? Colors.accentGreen : Colors.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.serviceTitle}>{SERVICE_LABELS[type]}</Text>
                      <Text style={[styles.serviceStatus, approved && { color: Colors.accentGreen }]}>{statusText(cap?.status)}</Text>
                      {cap?.reviewNote ? <Text style={styles.reviewNote}>{cap.reviewNote}</Text> : null}
                    </View>
                    {!cap || cap.status === 'REJECTED' ? (
                      <TouchableOpacity style={styles.smallButton} onPress={() => applyService(type)} disabled={busy === type}>
                        {busy === type ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.smallButtonText}>{cap ? 'REAPPLY' : 'ADD'}</Text>}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.smallOutline} onPress={() => navigation.navigate('ProviderCapabilities')}>
                        <Text style={styles.smallOutlineText}>DETAILS</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Business payouts</Text>
                <Text style={styles.cardText}>
                  Delivery and Inspection customers pay through CarMazium. CarMazium deducts 9% and 91% is paid to the Partner business Stripe Connect account.
                </Text>
                {team?.stripeConnect.complete ? (
                  <View style={styles.successRow}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.accentGreen} />
                    <Text style={styles.successText}>Stripe payouts connected</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.secondaryButton} onPress={startStripe} disabled={busy === 'stripe'}>
                    {busy === 'stripe' ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.secondaryText}>{team?.stripeConnect.connected ? 'FINISH PAYOUT SETUP' : 'SET UP BUSINESS PAYOUTS'}</Text>}
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('DealerTeam')}>
                <Ionicons name="people-outline" size={17} color={Colors.white} />
                <Text style={styles.secondaryText}>MANAGE PARTNER TEAM</Text>
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
  eyebrow: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.size10, letterSpacing: 1.6 },
  title: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xl, marginTop: 6 },
  sub: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 21, marginTop: 8 },
  card: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, padding: 16, gap: 12 },
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
  serviceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, borderRadius: Radius.card, padding: 14 },
  serviceIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  serviceTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.sm },
  serviceStatus: { fontFamily: FontFamily.medium, color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 3 },
  reviewNote: { fontFamily: FontFamily.regular, color: Colors.paleRed_fca5a5, fontSize: FontSize.size10, marginTop: 3 },
  smallButton: { minWidth: 62, minHeight: 36, borderRadius: 10, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  smallButtonText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10 },
  smallOutline: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: Colors.whiteAlpha10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  smallOutlineText: { fontFamily: FontFamily.bold, color: Colors.textSecondary, fontSize: FontSize.size10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, letterSpacing: 1.2, marginBottom: 4 },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  successText: { fontFamily: FontFamily.bold, color: Colors.accentGreen, fontSize: FontSize.size12 },
  errorCard: { flexDirection: 'row', gap: 9, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10, padding: 12 },
  errorText: { flex: 1, fontFamily: FontFamily.regular, color: Colors.paleRed_fca5a5, fontSize: FontSize.size12, lineHeight: 18 },
});
