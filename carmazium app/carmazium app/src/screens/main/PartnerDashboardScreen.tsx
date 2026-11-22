import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  createStripeConnectOnboarding,
  elevateToPartner,
  getPartnerProfile,
  getPartnerTeam,
  savePartnerBusiness,
} from '../../lib/servicesApi';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';

type Props = NativeStackScreenProps<MainStackParamList, 'PartnerDashboard'>;

const SERVICE_ORDER: ServiceType[] = ['DELIVERY', 'INSPECTION'];

const statusText = (status?: string) => {
  switch (status) {
    case 'APPROVED': return 'Active';
    case 'PENDING': return 'Awaiting approval';
    case 'REJECTED': return 'Needs attention';
    case 'SUSPENDED': return 'Suspended';
    default: return 'Not activated';
  }
};

export const PartnerDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [team, setTeam] = useState<PartnerTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');

  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    setTeam(null);
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
      navigation.navigate('ProviderVerification', { capabilityId: capability.id });
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

  const isPartnerRole = profile?.role === 'DEALER';
  const byType = new Map((team?.capabilities ?? []).map((cap) => [cap.serviceType, cap]));

  return (
    <View style={styles.container}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
      <WebsiteTopBar />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>PARTNER ACCOUNT</Text>
            <Text style={styles.title}>Partner Dashboard</Text>
            <Text style={styles.sub}>
              One CarMazium business account. Add only the services your business provides and keep them all under the same login.
            </Text>
            {profile?.dealerProfile && <Button label="Manage Team" variant="outline" onPress={() => navigation.navigate('DealerTeam')} />}
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.accent} />
              <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><Button label="Retry" variant="outline" onPress={() => void load()} />
            </View>
          ) : null}

          {!isPartnerRole && profile?.role === 'CONTRACTOR' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>TradeXchange</Text>
              <Text style={styles.cardText}>Use your existing service-provider account. Your services, approvals and documents are retained. You do not need to become a dealer.</Text>
              <Button label="My services" onPress={() => navigation.navigate('ProviderCapabilities')} />
              <Button label="Find jobs" variant="outline" onPress={() => navigation.navigate('ProviderJobs', { initialTab: 'open' })} />
              <Button label="My work" variant="outline" onPress={() => navigation.navigate('ProviderJobs', { initialTab: 'assigned' })} />
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
              <TextInput style={styles.input} value={businessAddress} onChangeText={setBusinessAddress} placeholder="Business address / service area" placeholderTextColor={Colors.textMuted} multiline />
              <Button label="Save Partner business" loading={busy === 'business'} disabled={!!busy} onPress={() => void saveBusiness()} />
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>PARTNER BUSINESS</Text>
                    <Text style={styles.cardTitle}>{profile.dealerProfile.companyName || team?.companyName || 'Partner business'}</Text>

                  </View>
                  <Button label="Edit business details" variant="outline" onPress={() => navigation.navigate('Settings', { section: 'business' })} />
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <View><Text style={styles.sectionTitle}>Your add-ons</Text><Text style={styles.sectionSub}>Activate one service or several. Adding one never removes another.</Text></View>
              </View>
              <View style={styles.card}>
                <Text style={styles.serviceStatus}>{profile.dealerProfile.isVerified ? 'Active' : profile.dealerProfile.kyc?.status === 'PENDING' ? 'Awaiting verification' : 'Not activated'}</Text>
                <Text style={styles.cardTitle}>Vehicle Dealer</Text>
                <Text style={styles.cardText}>List retail stock, bid in auctions, manage inventory, CRM and dealer tools. Business KYC and the £1 verification payment are required before taking paid jobs.</Text>
                <Button label={profile.dealerProfile.isVerified ? 'Open dealer tools' : 'Continue verification'} variant="outline" onPress={() => profile.dealerProfile?.isVerified ? navigation.navigate('Tabs', { screen: 'DealerHome' }) : navigation.navigate('DealerKYC')} />
              </View>
              {SERVICE_ORDER.map((type) => {


                const cap = byType.get(type);
                const approved = cap?.status === 'APPROVED';
                return (
                  <View key={type} style={styles.card}>
                    <Text style={[styles.serviceStatus, approved && { color: Colors.success }]}>{!team ? 'Status unavailable' : statusText(cap?.status)}</Text>
                    <Text style={styles.cardTitle}>{type === 'DELIVERY' ? 'Delivery & Recovery' : 'Vehicle Inspection'}</Text>
                    <Text style={styles.cardText}>{type === 'DELIVERY' ? 'Quote on transport and recovery jobs on behalf of your Partner business.' : 'Quote on vehicle inspection jobs using the same Partner account and business payout details.'}</Text>
                    {cap?.reviewNote && <Text style={styles.reviewNote}>{cap.reviewNote}</Text>}
                    {approved ? <Button label="Open jobs" variant="outline" onPress={() => navigation.navigate('ProviderJobs')} />
                      : cap?.status === 'PENDING' ? <Button label="Continue setup" onPress={() => navigation.navigate('ProviderVerification', { capabilityId: cap.id })} />
                      : cap?.status === 'SUSPENDED' ? <Text style={styles.cardText}>Contact CarMazium to reactivate this service.</Text>
                      : <Button label="Complete setup" disabled={!team || !!busy} loading={busy === type} onPress={() => void applyService(type)} />}
                  </View>
                );
              })}

              <View style={styles.card}>
                  <Text style={styles.cardTitle}>TradeXchange payouts</Text>
                  <Text style={styles.cardText}>
                    For Delivery and Inspection, the job poster always pays through CarMazium. CarMazium deducts 9% and the remaining 91% is paid to the Partner business Stripe Connect account.
                  </Text>
                  {team?.stripeConnect.complete ? (
                    <View style={styles.successRow}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.accentGreen} />
                      <Text style={styles.successText}>Business payouts enabled</Text>
                    </View>
                  ) : (
                    <Button label="Set up business payouts" variant="outline" loading={busy === 'stripe'} disabled={!team || !!busy} onPress={() => void startStripe()} />
                  )}
                </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>One team, service permissions</Text>
                <Text style={styles.cardText}>Invite staff once, then decide who can quote, manage or complete Delivery and Inspection jobs on behalf of this business. Staff never receive the CarMazium payout personally.</Text>
                <Button label="Manage Partner team" variant="outline" onPress={() => navigation.navigate('DealerTeam')} />
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
