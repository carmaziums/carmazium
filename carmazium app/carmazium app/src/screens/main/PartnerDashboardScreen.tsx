import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  ScrollView,
  StatusBar,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Button } from '../../components/Button';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { useAuthStore } from '../../store/authStore';
import {
  ServiceType,
  PartnerProfile,
  PartnerTeam,
  applyPartnerCapability,
  elevateToPartner,
  getPartnerProfile,
  getPartnerTeam,
  getMyCapabilities,
  savePartnerBusiness,
  updatePartnerServicePreference,
} from '../../lib/servicesApi';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { ProviderDocumentsSection } from '../../components/tradexchange/ProviderDocumentsSection';
import { ContractorServicesInline } from '../../components/tradexchange/ContractorServicesInline';
import { ProviderBusinessPaymentsSection, ProviderJobPreferencesSection } from '../../components/tradexchange/ProviderSettingsSections';
import type { ContractorCapability } from '../../lib/servicesApi';

type Props = NativeStackScreenProps<MainStackParamList, 'PartnerDashboard'>;

const SERVICE_ORDER: ServiceType[] = ['DELIVERY', 'INSPECTION'];

export const PartnerDashboardScreen: React.FC<Props> = ({ navigation, route }) => {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [team, setTeam] = useState<PartnerTeam | null>(null);
  const [legacyCapabilities, setLegacyCapabilities] = useState<ContractorCapability[]>([]);
  const [legacyProfile, setLegacyProfile] = useState<{ businessName: string|null; phone: string|null; serviceArea: string|null }|null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [servicesExpanded, setServicesExpanded] = useState(true);
  const [businessOpenRequest, setBusinessOpenRequest] = useState(0);
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string | undefined>(route?.params?.capabilityId);
  const [preferencesOpenRequest, setPreferencesOpenRequest] = useState(0);
  const [legacyPayoutComplete, setLegacyPayoutComplete] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const businessY = useRef(0);
  const preferencesY = useRef(0);
  const openBusiness = (capabilityId?: string) => { setSelectedCapabilityId(capabilityId); setBusinessOpenRequest(v => v + 1); };
  const openPreferences = (capabilityId?: string) => { setSelectedCapabilityId(capabilityId); setPreferencesOpenRequest(v => v + 1); };
  useEffect(() => {
    const section=route?.params?.openSection;
    if (section === 'business') openBusiness(route?.params?.capabilityId);
    else if (section === 'preferences') openPreferences(route?.params?.capabilityId);
    else if (section === 'services') setServicesExpanded(true);
  }, [route?.params?.openSection, route?.params?.capabilityId]);
  useEffect(() => {
    if (!loading && businessOpenRequest > 0) scrollRef.current?.scrollTo({ y: Math.max(0, businessY.current - 20), animated: true });
  }, [loading, businessOpenRequest]);
  useEffect(() => {
    if (!loading && preferencesOpenRequest > 0) scrollRef.current?.scrollTo({ y: Math.max(0, preferencesY.current - 20), animated: true });
  }, [loading, preferencesOpenRequest]);

  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    setTeam(null);
    setLegacyCapabilities([]);
    setLegacyProfile(null);
    try {
      const nextProfile = await getPartnerProfile();
      if (request !== generation.current) return;
      setProfile(nextProfile);
      setCompanyName(nextProfile.dealerProfile?.companyName || '');
      setPhone(nextProfile.dealerProfile?.phone || '');
      setBusinessAddress(nextProfile.dealerProfile?.businessAddress || '');

      if (nextProfile.role === 'DEALER' && nextProfile.dealerProfile) {
        try {
          const nextTeam = await getPartnerTeam();
          if (request === generation.current) setTeam(nextTeam);
        } catch (err: any) {
          if (request !== generation.current) return;
          setTeam(null);
          setError(err?.message || 'Could not load Partner services.');
        }
      } else {
        if (nextProfile.role === 'CONTRACTOR') {
          const mine = await getMyCapabilities();
          if (request === generation.current) { setLegacyCapabilities(mine.capabilities); setLegacyProfile(mine.profile); setLegacyPayoutComplete(mine.stripeConnect.complete); }
        }
        setTeam(null);
      }
    } catch (err: any) {
      if (request === generation.current) setError(err?.message || 'Could not load Partner Account.');
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);

  // Show updates to verification, matching and quotes when returning to the hub.
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; }; }, [load]));

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
      const capability = await applyPartnerCapability(serviceType);
      if (!capability?.id || !/^[a-zA-Z0-9_-]+$/.test(capability.id) || capability.serviceType !== serviceType) throw Error('Service setup is unavailable. Refresh and try again.');
      await load();
      openBusiness(capability.id);
    } catch (err: any) {
      setError(err?.message || 'Could not add this service.');
    } finally {
      setBusy(null);
    }
  };

  const toggleService = async (type: ServiceType, enabled: boolean) => {
    const key = type === 'DELIVERY' ? 'deliveryServicesEnabled' : 'inspectionServicesEnabled';
    setBusy(key);
    setError(null);
    try {
      await updatePartnerServicePreference(key, enabled);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not update your service preference.');
    } finally {
      setBusy(null);
    }
  };

  const isPartnerRole = profile?.role === 'DEALER';
  const byType = new Map((team?.capabilities ?? []).map((cap) => [cap.serviceType, cap]));

  return (
    <View style={styles.container}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
      <WebsiteTopBar />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>TRADEXCHANGE</Text>
            <Text style={styles.title}>Service Setup</Text>
            <Text style={styles.sub}>
              One CarMazium business account. Choose one or multiple services, including collection, delivery & recovery and vehicle inspections, under the same login. Each has its own insurance checks.
            </Text>
          </View>

          {(isPartnerRole || profile?.role === 'CONTRACTOR') && <Button label="Provider Dashboard" variant="outline" onPress={() => navigation.navigate('ProviderOverview')} />}

          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.accent} />
              <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><Button label="Retry" variant="outline" onPress={() => void load()} />
            </View>
          ) : null}

          {!isPartnerRole && profile?.role === 'CONTRACTOR' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Service Setup</Text>
              <Text style={styles.cardText}>Use your existing service-provider account. Your services, approvals and documents are retained. You do not need to become a dealer.</Text>
              <ContractorServicesInline capabilities={legacyCapabilities} profile={legacyProfile} onUpdated={async () => { await load(); openBusiness(); }} openRequest={route?.params?.openSection === 'services' ? 1 : 0} />
              <Button label="Find jobs" variant="outline" onPress={() => navigation.navigate('ProviderJobs', { initialTab: 'open' })} />
              <Button label="My work" variant="outline" onPress={() => navigation.navigate('ProviderJobs', { initialTab: 'assigned' })} />
              <ProviderBusinessPaymentsSection capabilities={legacyCapabilities} stripeComplete={legacyPayoutComplete} openRequest={businessOpenRequest} selectedCapabilityId={selectedCapabilityId} />
              <ProviderDocumentsSection capabilities={legacyCapabilities} />
              <ProviderJobPreferencesSection capabilities={legacyCapabilities} openRequest={preferencesOpenRequest} selectedCapabilityId={selectedCapabilityId} />
            </View>
          ) : !isPartnerRole ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{profile?.dealerProfile ? 'Continue your existing business setup' : 'Create a Partner Account'}</Text>
              <Text style={styles.cardText}>
                One business account lets you add Vehicle Dealer, Delivery & Recovery and Vehicle Inspection services. Finance and warranty partnerships are managed by the CarMazium team.
              </Text>
              <Button label={profile?.dealerProfile ? 'Continue setup' : 'Create Partner Account'} loading={busy === 'partner'} disabled={!!busy} onPress={() => void createPartner()} />
            </View>
          ) : !profile?.dealerProfile ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Set up your Partner business</Text>
              <Text style={styles.cardText}>Add these details once. CarMazium reuses them across every service you activate.</Text>
              <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder="Business or trading name" placeholderTextColor={Colors.textMuted} />
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Business phone" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
              <TextInput style={styles.input} value={businessAddress} onChangeText={setBusinessAddress} placeholder="Registered business address" placeholderTextColor={Colors.textMuted} multiline />
              <Button label="Save Partner business" loading={busy === 'business'} disabled={!!busy} onPress={() => void saveBusiness()} />
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="My Services" accessibilityState={{ expanded: servicesExpanded }} onPress={() => setServicesExpanded(value => !value)}>
                  <View style={[styles.rowBetween, { flexDirection: 'row', alignItems: 'center' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>My Services</Text>
                      <Text style={styles.cardText}>Switch services on or off here. Your approval and documents stay saved.</Text>
                    </View>
                    <Ionicons name={servicesExpanded ? 'chevron-up' : 'chevron-down'} size={21} color={Colors.textSecondary} />
                  </View>
                </TouchableOpacity>
                {servicesExpanded && SERVICE_ORDER.map(type => {
                  const cap = byType.get(type);
                  const key = type === 'DELIVERY' ? 'deliveryServicesEnabled' : 'inspectionServicesEnabled';
                  const enabled = profile.dealerProfile?.[key] !== false;
                  const expires = cap?.verificationExpiresAt ? new Date(cap.verificationExpiresAt).getTime() : 0;
                  const verified = cap?.verificationStatus === 'VERIFIED' && expires > Date.now();
                  const coverage = !!cap?.jobNationwide || (cap?.jobPostcodeAreas?.length ?? 0) > 0;
                  const status = !team ? 'Status unavailable' : !enabled ? 'Paused' : !cap ? 'Not set up'
                    : cap.status === 'SUSPENDED' ? 'Suspended'
                    : cap.status === 'REJECTED' ? 'Needs attention'
                    : cap.status === 'PENDING' ? 'Awaiting approval'
                    : !verified ? 'Verification required'
                    : !profile.dealerProfile?.isVerified ? 'Dealer verification required'
                    : !team.stripeConnect.complete ? 'Payout setup required'
                    : !coverage ? 'Set working areas'
                    : 'Approved';
                  return <View key={type} style={styles.serviceRow}>
                    <View style={[styles.rowBetween, { flexDirection: 'row', alignItems: 'center' }]}>
                      <View style={{ flex: 1, gap: 5 }}>
                        <Text style={styles.cardTitle}>{type === 'DELIVERY' ? 'Collection, delivery & recovery' : 'Vehicle inspection'}</Text>
                        <Text style={styles.cardText}>{type === 'DELIVERY' ? 'Vehicle movements and recovery work.' : 'Vehicle and pre-purchase inspections.'}</Text>
                      </View>
                      <View style={{ alignItems: 'center', gap: 3 }}>
                        <Switch accessibilityLabel={type === 'DELIVERY' ? 'Offer collection, delivery and recovery' : 'Offer vehicle inspection'} value={enabled} disabled={!!busy || loading || !team} onValueChange={value => { void toggleService(type, value); }} />
                        <Text style={styles.serviceStatus}>{enabled ? 'On' : 'Off'}</Text>
                      </View>
                    </View>
                    <Text style={styles.serviceStatus}>{status}</Text>
                    {cap?.reviewNote && (cap.status === 'REJECTED' || cap.status === 'SUSPENDED') && <Text style={styles.reviewNote}>{cap.reviewNote}</Text>}
                    {!enabled && <View style={{ gap: 8 }}><Text style={styles.cardText}>No new jobs while paused. Existing jobs, approvals and documents remain saved.</Text><Button label="View existing work" variant="outline" onPress={() => navigation.navigate('ProviderJobs', { initialTab: 'assigned' })} /></View>}
                    {enabled && team && (
                      !cap || cap.status === 'REJECTED'
                        ? <Button label={cap ? 'Reapply' : 'Apply for service'} loading={busy === type} disabled={!!busy} onPress={() => void applyService(type)} />
                        : cap.status === 'PENDING' || (cap.status === 'APPROVED' && !verified)
                          ? <Button label={cap.status === 'PENDING' ? 'Continue setup' : 'Review verification'} onPress={() => openBusiness(cap.id)} />
                          : cap.status === 'SUSPENDED'
                            ? <Text style={styles.cardText}>Contact CarMazium to reactivate this service.</Text>
                            : <View style={{ gap: 8 }}>
                                <Button label="View jobs" variant="outline" onPress={() => navigation.navigate('ProviderJobs')} />
                                {!coverage && <Button label="Set working areas" variant="outline" onPress={() => openPreferences(cap.id)} />}
                              </View>
                    )}
                  </View>;
                })}
                {servicesExpanded && <Text style={styles.cardText}>Turning a service on does not approve it. CarMazium still checks verification, working areas, payout setup and account eligibility before new work.</Text>}
              </View>

              <View onLayout={event => { businessY.current = event.nativeEvent.layout.y; }}>
                <ProviderBusinessPaymentsSection capabilities={team?.capabilities ?? []} dealer={profile.dealerProfile} stripeComplete={team?.stripeConnect.complete}
                  onSaved={load} openRequest={businessOpenRequest} selectedCapabilityId={selectedCapabilityId} onVerifyDealer={() => navigation.navigate("DealerKYC")} />
              </View>
              <ProviderDocumentsSection capabilities={team?.capabilities ?? []} />
              <View onLayout={event => { preferencesY.current = event.nativeEvent.layout.y; }}>
                <ProviderJobPreferencesSection capabilities={team?.capabilities ?? []} openRequest={preferencesOpenRequest} selectedCapabilityId={selectedCapabilityId} />
              </View>

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
  content: { padding: 20, gap: 24, paddingBottom: 40 }, hero: { gap: 12 },
  eyebrow: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: 12, letterSpacing: 1.6 },
  title: { fontFamily: FontFamily.bold, color: Colors.textPrimary, fontSize: 36 },
  sub: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24 },
  card: { borderRadius: 16, borderWidth: 1, padding: 24, gap: 16, backgroundColor: Colors.bgCard, borderColor: Colors.border },
  serviceRow: { borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 12 },
  cardTitle: { fontFamily: FontFamily.bold, color: Colors.textPrimary, fontSize: 20 },
  cardText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
  input: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgTertiary, borderRadius: 12, padding: 14, color: Colors.textPrimary, fontSize: 16 },
  rowBetween: { gap: 16 }, label: { fontSize: 12, fontFamily: FontFamily.bold, color: Colors.textMuted },
  sectionHeader: { gap: 8 }, sectionTitle: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  sectionSub: { fontSize: 14, lineHeight: 22, color: Colors.textSecondary },
  serviceStatus: { fontFamily: FontFamily.bold, fontSize: 12, color: Colors.textSecondary },
  reviewNote: { color: Colors.error, fontSize: 14, lineHeight: 22 },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, successText: { fontSize: 14, fontFamily: FontFamily.bold, color: Colors.success },
  errorCard: { gap: 12, padding: 16, borderWidth: 1, borderColor: Colors.error, borderRadius: 12 }, errorText: { color: Colors.error, fontSize: 14 },
});
