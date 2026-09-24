import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { closeServiceLead, formatPence, getServiceLead, ServiceLead, SERVICE_LABELS } from '../../lib/servicesApi';
import { subscribeProductSync } from '../../lib/productSync';

export const CustomerServiceLeadDetailScreen: React.FC<{ navigation?: any; route?: any }> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const leadId = String(route?.params?.leadId || '');
  const [lead, setLead] = useState<ServiceLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!leadId) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      setLead(await getServiceLead(leadId));
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load this enquiry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leadId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => subscribeProductSync(['services'], () => {
    void load(true);
  }), [load]);

  const close = () => Alert.alert(
    'Close enquiry?',
    'Matched providers will no longer be able to respond to this enquiry.',
    [
      { text: 'Keep open', style: 'cancel' },
      {
        text: 'Close enquiry',
        style: 'destructive',
        onPress: async () => {
          setClosing(true);
          try { await closeServiceLead(leadId); await load(); }
          catch (e: any) { Alert.alert('Could not close enquiry', e?.message || 'Please try again.'); }
          finally { setClosing(false); }
        },
      },
    ],
  );

  const info = (label: string, value?: string | null) => value ? (
    <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>
  ) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={{ height: insets.top }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Enquiry</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 50 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.accent} />}
      >
        {loading && !lead ? <Text style={styles.empty}>Loading enquiry…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {lead ? (
          <>
            <Text style={styles.eyebrow}>{SERVICE_LABELS[lead.serviceType]}</Text>
            <Text style={styles.title}>{[lead.vehicleRegistration, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(' · ') || 'Vehicle enquiry'}</Text>
            <Text style={styles.subtitle}>Status: {lead.status} · Shared with {lead.recipientCount ?? 0} matched provider{(lead.recipientCount ?? 0) === 1 ? '' : 's'}</Text>

            {lead.status === 'OPEN' ? (
              <TouchableOpacity style={styles.closeButton} disabled={closing} onPress={close}>
                <Text style={styles.closeText}>{closing ? 'Closing…' : 'Close enquiry'}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Your request</Text>
              {info('Mileage', lead.vehicleMileage != null ? `${lead.vehicleMileage.toLocaleString()} miles` : null)}
              {info('Vehicle value', lead.vehicleValuePence != null ? formatPence(lead.vehicleValuePence) : null)}
              {info('Deposit', lead.depositPence != null ? formatPence(lead.depositPence) : null)}
              {info('Monthly budget', lead.monthlyBudgetPence != null ? formatPence(lead.monthlyBudgetPence) : null)}
              {info('Finance term', lead.termMonths != null ? `${lead.termMonths} months` : null)}
              {info('Warranty term', lead.warrantyMonths != null ? `${lead.warrantyMonths} months` : null)}
              {info('Warranty level', lead.warrantyLevel)}
              {lead.summary ? <Text style={styles.summary}>{lead.summary}</Text> : null}
            </View>

            <Text style={styles.responsesTitle}>Provider responses</Text>
            {!lead.responses?.length ? (
              <View style={styles.emptyCard}><Text style={styles.emptyText}>{(lead.recipientCount ?? 0) === 0 ? 'No approved matching provider is available yet. CarMazium can keep matching while this enquiry remains open.' : 'No matched provider has replied yet.'}</Text></View>
            ) : lead.responses.map((response, index) => (
              <View key={response.id || String(index)} style={styles.card}>
                <View style={styles.responseTop}>
                  <Text style={styles.provider}>{response.businessName || 'Approved provider'}</Text>
                  {response.indicativePricePence != null ? <Text style={styles.price}>{formatPence(response.indicativePricePence)}</Text> : null}
                </View>
                {response.headline ? <Text style={styles.headline}>{response.headline}</Text> : null}
                {response.productName ? <Text style={styles.body}>Product: {response.productName}</Text> : null}
                {response.message ? <Text style={styles.body}>{response.message}</Text> : null}
                <View style={styles.responseMeta}>
                  {response.representativeApr != null ? <Text style={styles.meta}>Representative APR: {response.representativeApr}%</Text> : null}
                  {response.termMonths != null ? <Text style={styles.meta}>Term: {response.termMonths} months</Text> : null}
                  {response.serviceArea ? <Text style={styles.meta}>Area: {response.serviceArea}</Text> : null}
                </View>
              </View>
            ))}

            <Text style={styles.disclaimer}>Provider responses are supplied by the provider. Review finance eligibility and regulated disclosures or warranty wording, exclusions and claim limits before entering an agreement.</Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { minHeight: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  eyebrow: { color: Colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: Colors.textPrimary, fontSize: 25, fontWeight: '900', marginTop: 6 },
  subtitle: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  closeButton: { alignSelf: 'flex-start', marginTop: 14, borderRadius: 11, borderWidth: 1, borderColor: Colors.error, paddingHorizontal: 14, paddingVertical: 10 },
  closeText: { color: Colors.error, fontSize: 12, fontWeight: '800' },
  card: { marginTop: 16, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgSecondary, padding: 16 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle },
  infoLabel: { color: Colors.textMuted, fontSize: 12 },
  infoValue: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700', textAlign: 'right', flex: 1 },
  summary: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 14 },
  responsesTitle: { color: Colors.textPrimary, fontSize: 19, fontWeight: '900', marginTop: 26, marginBottom: 2 },
  emptyCard: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16 },
  emptyText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
  responseTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  provider: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', flex: 1 },
  price: { color: Colors.accent, fontSize: 16, fontWeight: '900' },
  headline: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 12 },
  body: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 7 },
  responseMeta: { gap: 4, marginTop: 12 },
  meta: { color: Colors.textMuted, fontSize: 11 },
  disclaimer: { color: Colors.textMuted, fontSize: 11.5, lineHeight: 17, marginTop: 24, textAlign: 'center' },
  error: { color: Colors.error, fontSize: 13, marginBottom: 12 },
  empty: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 30 },
});
