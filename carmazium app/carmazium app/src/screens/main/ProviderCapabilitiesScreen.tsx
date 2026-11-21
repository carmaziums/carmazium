import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Button } from '../../components/Button';
import { DealerPageTabs } from '../../components/dealer/DealerPageTabs';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../lib/apiClient';
import { ContractorCapability, MyCapabilities, SERVICE_LABELS, ServiceType, applyPartnerCapability, createStripeConnectOnboarding, getMyCapabilities, getPartnerProfile } from '../../lib/servicesApi';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderCapabilities'>;
const TYPES: ServiceType[] = ['DELIVERY', 'INSPECTION'];
const statusLabel = { APPROVED: 'Approved', PENDING: 'Awaiting review', REJECTED: 'Not approved', SUSPENDED: 'Suspended' };

export const ProviderCapabilitiesScreen: React.FC<Props> = ({ navigation }) => {
  const accountRole = useAuthStore(s => s.accountRole);
  const isPartner = accountRole === 'dealer';
  const [data, setData] = useState<MyCapabilities | null>(null);
  const [business, setBusiness] = useState({ name: '', phone: '', area: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    try {
      const [next, profile] = await Promise.all([getMyCapabilities(), isPartner ? getPartnerProfile() : Promise.resolve(null)]);
      if (!Array.isArray(next?.capabilities) || !next.stripeConnect) throw Error('Service settings are unavailable.');
      if (request !== generation.current) return;
      setData(next);
      setBusiness({ name: next.profile?.businessName ?? profile?.dealerProfile?.companyName ?? '', phone: next.profile?.phone ?? profile?.dealerProfile?.phone ?? '', area: next.profile?.serviceArea ?? profile?.dealerProfile?.businessAddress ?? '' });
    } catch (err: any) { if (request === generation.current) setError(err?.message || 'Could not load service settings.'); }
    finally { if (request === generation.current) setLoading(false); }
  }, [isPartner]);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; }; }, [load]));

  const apply = async (type: ServiceType) => {
    setBusy(type); setError(null);
    try {
      const capability = isPartner ? await applyPartnerCapability(type) : (await apiClient<{ data: ContractorCapability }>('/services/capabilities', { method: 'POST', body: JSON.stringify({ serviceType: type, businessName: business.name.trim() || undefined, phone: business.phone.trim() || undefined, serviceArea: business.area.trim() || undefined }) })).data;
      if (!capability?.id || !/^[a-zA-Z0-9_-]+$/.test(capability.id) || capability.serviceType !== type) throw Error('Service setup is unavailable. Refresh and try again.');
      navigation.navigate('ProviderVerification', { capabilityId: capability.id });
    } catch (err: any) { setError(err?.message || 'Could not apply.'); }
    finally { setBusy(null); }
  };
  const connectStripe = async () => {
    setBusy('stripe');
    try { await Linking.openURL(await createStripeConnectOnboarding()); }
    catch (err: any) { Alert.alert('Payout setup', err?.message || 'Could not start Stripe Connect.'); }
    finally { setBusy(null); }
  };
  const byType = new Map((data?.capabilities ?? []).map(cap => [cap.serviceType, cap]));
  return <View style={s.screen}>
    <WebsiteTopBar />
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={s.title}>My services</Text>
      <Text style={s.body}>Add services to the same Partner Account. Adding one never replaces another.</Text>
      {isPartner && <Button label="Partner Dashboard" variant="outline" onPress={() => navigation.navigate('PartnerDashboard')} />}
      {loading && <ActivityIndicator color={Colors.accent} accessibilityLabel="Loading services" />}
      {error && <View style={s.card}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button label="Retry" disabled={loading} onPress={() => void load()} /></View>}
      {!loading && data && <>
        <View style={s.card}>
          <Text style={s.label}>Your business</Text>
          {([['name', 'Trading name'], ['phone', 'Business phone'], ['area', 'Area you cover']] as const).map(([key, label]) => <View key={key} style={{ gap: 8 }}>
            <Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} editable={!isPartner} value={business[key]} maxLength={key === 'phone' ? 30 : key === 'name' ? 120 : 200} onChangeText={value => setBusiness(previous => ({ ...previous, [key]: value }))} style={s.input} />
          </View>)}
          {isPartner && <><Text style={s.body}>Your business details are shown here for reference.</Text><Button label="Edit them in Account Settings" variant="outline" onPress={() => navigation.navigate('Settings', { section: 'business' })} /></>}
        </View>
        <View style={s.card}>
          <Text style={s.label}>Payments for job services</Text>
          <Text style={s.body}>For Delivery & Recovery and Vehicle Inspections, the customer pays through CarMazium. CarMazium keeps 9% and pays the 91% balance to the Partner business Stripe Connect account.</Text>
          {data.stripeConnect.complete ? <Text style={s.success}>Business payouts enabled</Text> : <Button variant="outline" label={data.stripeConnect.connected ? 'Finish Stripe setup' : 'Set up business payouts'} loading={busy === 'stripe'} disabled={!!busy} onPress={() => void connectStripe()} />}
        </View>
        <Text style={s.label}>Add services</Text>
        {TYPES.map(type => {
          const cap = byType.get(type);
          const canApply = !cap || cap.status === 'REJECTED' || cap.status === 'SUSPENDED';
          return <View key={type} style={s.card}>
            <Text style={s.heading}>{SERVICE_LABELS[type]}</Text>
            {cap && <Text style={cap.status === 'APPROVED' ? s.success : s.body}>{statusLabel[cap.status] ?? cap.status}</Text>}
            <Text style={s.body}>{type === 'DELIVERY' ? 'Quote on vehicle moves and recoveries.' : 'Quote on pre-purchase and trade vehicle inspections.'} CarMazium keeps 9%; your Partner business receives 91% after completion.</Text>
            {!data.stripeConnect.complete && <Text style={s.body}>Stripe Connect must be completed before admin can approve this paid-job service.</Text>}
            {cap?.reviewNote && (cap.status === 'REJECTED' || cap.status === 'SUSPENDED') && <Text style={s.error}>{cap.reviewNote}</Text>}
            {cap && <>
              <Button label={type === 'INSPECTION' ? 'Service declaration' : 'Service declaration and trade insurance'} variant="outline" onPress={() => navigation.navigate('ProviderVerification', { capabilityId: cap.id })} />
              <Button label="Matching settings" variant="outline" onPress={() => navigation.navigate('ProviderMatching', { capabilityId: cap.id })} />
              {!cap.jobNationwide && cap.jobPostcodeAreas.length === 0 && <Text style={s.body}>Configure job coverage before this service can see or quote open work.</Text>}
            </>}
            {canApply ? <Button label={cap ? 'Apply again' : 'Add service'} variant="outline" loading={busy === type} disabled={!!busy || !!error} onPress={() => void apply(type)} /> : cap?.status === 'APPROVED' ? <Button label="See jobs" variant="outline" onPress={() => navigation.navigate('ProviderJobs')} /> : null}
          </View>;
        })}
      </>}
    </ScrollView>
    {isPartner && <DealerPageTabs />}
  </View>;
};
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary }, content: { padding: 20, paddingBottom: 32, gap: 20 },
  title: { fontSize: 30, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  heading: { fontSize: 20, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  label: { fontSize: 14, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  body: { fontSize: 14, lineHeight: 22, color: Colors.textSecondary },
  card: { padding: 20, gap: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  input: { minHeight: 48, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgInput, color: Colors.textPrimary, fontSize: 14 },
  success: { fontSize: 14, fontFamily: FontFamily.bold, color: Colors.success }, error: { fontSize: 14, color: Colors.error },
});
