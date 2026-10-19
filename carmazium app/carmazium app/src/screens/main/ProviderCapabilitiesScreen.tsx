import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { useAppearanceStore } from '../../store/appearanceStore';
import { adaptLegacyLightStyles, mergeAppearanceStyles, appearancePalette, lightReadableText } from '../../theme/appearancePalette';
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
import { useAppearance } from '../../theme/useAppearance';
import { ThemedStatusBar } from '../../components/ThemedStatusBar';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderCapabilities'>;

const TYPES: ServiceType[] = ['DELIVERY', 'INSPECTION', 'FINANCE', 'WARRANTY'];

const statusColor = (status?: string) => {
  if (status === 'APPROVED') return Colors.accentGreen;
  if (status === 'REJECTED' || status === 'SUSPENDED') return Colors.accent;
  if (status === 'PENDING') return Colors.warning;
  return Colors.textMuted;
};

export const ProviderCapabilitiesScreen: React.FC<Props> = ({ navigation }) => {
  const { tc } = useAppearance();
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? mergeAppearanceStyles(adaptLegacyLightStyles(styles), lightContrastStyles) : styles;
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

  // Returning from verification/matching should refresh capability status.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

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
    <View style={[ts.container, { paddingTop: insets.top }]}>
      <ThemedStatusBar />
      <View style={ts.header}>
        <IconButton style={ts.headerButton} icon={<Ionicons name="chevron-back" size={19} color={tc(Colors.white)} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={ts.headerTitle}>Service add-ons</Text>
        <View style={ts.headerButton} />
      </View>

      {loading ? <View style={ts.center}><ActivityIndicator color={Colors.accent} /></View> : (
        <ScrollView
          contentContainerStyle={ts.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={Colors.accent} />}
        >
          <Text style={ts.title}>Manage your services</Text>
          <Text style={ts.sub}>Activate each service independently. Complete verification and set your coverage before matched jobs or enquiries can reach you.</Text>
          <View style={ts.quickActions}>
            <TouchableOpacity style={ts.quickAction} onPress={() => navigation.navigate('ProviderJobs')} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Open available delivery and inspection jobs">
              <Ionicons name="briefcase-outline" size={19} color={Colors.accent} />
              <Text style={ts.quickActionText}>Service jobs</Text>
              <Ionicons name="chevron-forward" size={17} color={tc(Colors.textSecondary)} />
            </TouchableOpacity>
            <TouchableOpacity style={ts.quickAction} onPress={() => navigation.navigate('ProviderLeads')} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Open matched finance and warranty enquiries">
              <Ionicons name="mail-outline" size={19} color={Colors.accent} />
              <Text style={ts.quickActionText}>Enquiries</Text>
              <Ionicons name="chevron-forward" size={17} color={tc(Colors.textSecondary)} />
            </TouchableOpacity>
          </View>

          {error ? <Text style={ts.error}>{error}</Text> : null}

          <View style={ts.payoutCard}>
            <View style={{ flex: 1 }}>
              <Text style={ts.cardTitle}>Paid-job payouts</Text>
              <Text style={ts.cardText}>Delivery and Inspection use a 9% CarMazium / 91% Partner payout split.</Text>
            </View>
            {stripe.complete ? (
              <Ionicons name="checkmark-circle" size={24} color={tc(Colors.accentGreen)} />
            ) : (
              <TouchableOpacity style={ts.smallButton} onPress={connectStripe} disabled={busy === 'stripe'}>
                {busy === 'stripe' ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={ts.smallButtonText}>{stripe.connected ? 'FINISH' : 'SET UP'}</Text>}
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
              <View key={type} style={ts.card}>
                <View style={ts.row}>
                  <View style={ts.icon}>
                    <Ionicons name={type === 'DELIVERY' ? 'car-outline' : type === 'INSPECTION' ? 'search-outline' : type === 'FINANCE' ? 'cash-outline' : 'shield-checkmark-outline'} size={21} color={statusColor(cap?.status)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ts.cardTitle}>{SERVICE_LABELS[type]}</Text>
                    <Text style={[ts.status, { color: statusColor(cap?.status) }]}>{cap?.status || 'NOT ACTIVATED'}</Text>
                  </View>
                  {canApply ? (
                    <TouchableOpacity style={ts.smallButton} onPress={() => apply(type)} disabled={busy === type} accessibilityRole="button" accessibilityLabel={`${cap ? 'Reapply for' : 'Add'} ${SERVICE_LABELS[type]} service`}>
                      {busy === type ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={ts.smallButtonText}>{cap ? 'REAPPLY' : 'ADD'}</Text>}
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={ts.cardText}>
                  {type === 'DELIVERY' ? 'Quote on vehicle transport and recovery jobs.' :
                   type === 'INSPECTION' ? 'Quote on independent vehicle inspection jobs.' :
                   type === 'FINANCE' ? 'Receive matched vehicle finance enquiries.' :
                   'Receive matched warranty enquiries.'}
                </Text>

                {cap?.reviewNote ? <Text style={ts.error}>{cap.reviewNote}</Text> : null}
                {coverageMissing ? <Text style={ts.warning}>Matching coverage is not configured yet.</Text> : null}

                {cap ? (
                  <View style={ts.actions}>
                    <TouchableOpacity style={ts.actionButton} onPress={() => navigation.navigate('ProviderVerification', { capabilityId: cap.id })} accessibilityRole="button" accessibilityLabel={`View verification for ${SERVICE_LABELS[type]}`}>
                      <Ionicons name="document-text-outline" size={15} color={tc(Colors.white)} />
                      <Text style={ts.actionText}>VERIFICATION</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={ts.actionButton} onPress={() => navigation.navigate('ProviderMatching', { capabilityId: cap.id })} accessibilityRole="button" accessibilityLabel={`Set matching coverage for ${SERVICE_LABELS[type]}`}>
                      <Ionicons name="options-outline" size={15} color={tc(Colors.white)} />
                      <Text style={ts.actionText}>MATCHING</Text>
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
  quickActions: { gap: 9, marginTop: 4 },
  quickAction: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.borderHi, backgroundColor: Colors.bgCardSolid, paddingHorizontal: 13 },
  quickActionText: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white },
  sub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 21, color: Colors.textSecondary },
  payoutCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.warningAlpha30, backgroundColor: Colors.warningAlpha08, padding: 15 },
  card: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgCardSolid, padding: 15, gap: 11 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white },
  cardText: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, lineHeight: 19, color: Colors.textSecondary },
  status: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, marginTop: 3 },
  smallButton: { minHeight: 44, minWidth: 80, borderRadius: 10, backgroundColor: Colors.accent, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, borderWidth: 1, borderColor: Colors.borderHi, borderRadius: 10, paddingHorizontal: 11, backgroundColor: Colors.bgElevated },
  actionText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10 },
  error: { fontFamily: FontFamily.regular, color: Colors.paleRed_fca5a5, fontSize: FontSize.size12, lineHeight: 18 },
  warning: { fontFamily: FontFamily.medium, color: Colors.warning, fontSize: FontSize.xs },
});

const LIGHT_PALETTE = appearancePalette('light');

// Light-mode text colours for keys the screen's light map did not cover.
// Generated from the contrast audit (scripts/theme-audit); dark mode is untouched.
const lightContrastStyles = StyleSheet.create({
  sub: { color: LIGHT_PALETTE.secondary },
  error: { color: lightReadableText.error },
  warning: { color: lightReadableText.warning },
  actionButton: { backgroundColor: LIGHT_PALETTE.card },
});
