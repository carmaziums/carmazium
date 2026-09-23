import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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
import {
  ContractorCapability,
  SERVICE_LABELS,
  ServiceType,
  applyPartnerCapability,
  createStripeConnectOnboarding,
  getMyCapabilities,
} from '../../lib/servicesApi';
import { IconButton } from '../../components/IconButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderCapabilities'>;

const TYPES: ServiceType[] = ['DELIVERY', 'INSPECTION', 'FINANCE', 'WARRANTY'];

const statusColor = (status?: string) => {
  if (status === 'APPROVED') return Colors.accentGreen;
  if (status === 'REJECTED' || status === 'SUSPENDED') return Colors.accent;
  if (status === 'PENDING') return Colors.warning;
  return Colors.textMuted;
};

export const ProviderCapabilitiesScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [caps, setCaps] = useState<ContractorCapability[]>([]);
  const [stripe, setStripe] = useState({ connected: false, complete: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const data = await getMyCapabilities();
      setCaps(data.capabilities || []);
      setStripe(data.stripeConnect);
    } catch (err: any) {
      setError(err?.message || 'Could not load service add-ons.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const apply = async (type: ServiceType) => {
    setBusy(type);
    setError(null);
    try {
      await applyPartnerCapability(type);
      await load(true);
    } catch (err: any) {
      setError(err?.message || 'Could not add this service.');
    } finally {
      setBusy(null);
    }
  };

  const connectStripe = async () => {
    setBusy('stripe');
    try {
      const url = await createStripeConnectOnboarding();
      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert('Payout setup', err?.message || 'Could not start Stripe Connect.');
    } finally {
      setBusy(null);
    }
  };

  const byType = new Map(caps.map((cap) => [cap.serviceType, cap]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.header}>
        <IconButton style={styles.headerButton} icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>Service add-ons</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View> : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={Colors.accent} />}
        >
          <Text style={styles.title}>Partner services</Text>
          <Text style={styles.sub}>Apply once per service. Approval, verification and matching remain independent, while the business account and payouts stay shared.</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.payoutCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Paid-job payouts</Text>
              <Text style={styles.cardText}>Delivery and Inspection use a 9% CarMazium / 91% Partner payout split.</Text>
            </View>
            {stripe.complete ? (
              <Ionicons name="checkmark-circle" size={24} color={Colors.accentGreen} />
            ) : (
              <TouchableOpacity style={styles.smallButton} onPress={connectStripe} disabled={busy === 'stripe'}>
                {busy === 'stripe' ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.smallButtonText}>{stripe.connected ? 'FINISH' : 'SET UP'}</Text>}
              </TouchableOpacity>
            )}
          </View>

          {TYPES.map((type) => {
            const cap = byType.get(type);
            const canApply = !cap || cap.status === 'REJECTED';
            const coverageMissing = cap
              ? (type === 'FINANCE' || type === 'WARRANTY'
                  ? !cap.leadNationwide && cap.leadPostcodeAreas.length === 0
                  : !cap.jobNationwide && cap.jobPostcodeAreas.length === 0)
              : false;
            return (
              <View key={type} style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.icon}>
                    <Ionicons name={type === 'DELIVERY' ? 'car-outline' : type === 'INSPECTION' ? 'search-outline' : type === 'FINANCE' ? 'cash-outline' : 'shield-checkmark-outline'} size={21} color={statusColor(cap?.status)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{SERVICE_LABELS[type]}</Text>
                    <Text style={[styles.status, { color: statusColor(cap?.status) }]}>{cap?.status || 'NOT ACTIVATED'}</Text>
                  </View>
                  {canApply ? (
                    <TouchableOpacity style={styles.smallButton} onPress={() => apply(type)} disabled={busy === type}>
                      {busy === type ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.smallButtonText}>{cap ? 'REAPPLY' : 'ADD'}</Text>}
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={styles.cardText}>
                  {type === 'DELIVERY' ? 'Quote on vehicle transport and recovery jobs.' :
                   type === 'INSPECTION' ? 'Quote on independent vehicle inspection jobs.' :
                   type === 'FINANCE' ? 'Receive matched vehicle finance enquiries.' :
                   'Receive matched warranty enquiries.'}
                </Text>

                {cap?.reviewNote ? <Text style={styles.error}>{cap.reviewNote}</Text> : null}
                {coverageMissing ? <Text style={styles.warning}>Matching coverage is not configured yet.</Text> : null}

                {cap ? (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('ProviderVerification', { capabilityId: cap.id })}>
                      <Ionicons name="document-text-outline" size={15} color={Colors.white} />
                      <Text style={styles.actionText}>VERIFICATION</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('ProviderMatching', { capabilityId: cap.id })}>
                      <Ionicons name="options-outline" size={15} color={Colors.white} />
                      <Text style={styles.actionText}>MATCHING</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
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
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.white },
  sub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 21, color: Colors.textSecondary },
  payoutCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.warningAlpha30, backgroundColor: Colors.warningAlpha08, padding: 15 },
  card: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, padding: 15, gap: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white },
  cardText: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, lineHeight: 19, color: Colors.textSecondary },
  status: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, marginTop: 3 },
  smallButton: { minHeight: 36, minWidth: 66, borderRadius: 10, backgroundColor: Colors.accent, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, borderWidth: 1, borderColor: Colors.whiteAlpha10, borderRadius: 10, paddingHorizontal: 11, backgroundColor: Colors.whiteAlpha04 },
  actionText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10 },
  error: { fontFamily: FontFamily.regular, color: Colors.paleRed_fca5a5, fontSize: FontSize.size12, lineHeight: 18 },
  warning: { fontFamily: FontFamily.medium, color: Colors.warning, fontSize: FontSize.size11 },
});
