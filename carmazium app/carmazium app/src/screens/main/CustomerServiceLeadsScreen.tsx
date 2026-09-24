import React, { useCallback, useState } from 'react';
import {
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
import { getMyServiceLeadsPage, ServiceLead, SERVICE_LABELS } from '../../lib/servicesApi';

export const CustomerServiceLeadsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [leads, setLeads] = useState<ServiceLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const page = await getMyServiceLeadsPage(undefined, 50);
      setLeads(page.items);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load your enquiries.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={{ height: insets.top }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Finance & Warranty</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 50 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.accent} />}
      >
        <Text style={styles.eyebrow}>MY ENQUIRIES</Text>
        <Text style={styles.title}>Finance & warranty enquiries</Text>
        <Text style={styles.subtitle}>The same enquiries and provider responses you see on CarMazium.com appear here.</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={() => navigation?.navigate('ServiceLeadForm', { serviceType: 'FINANCE' })}>
            <Ionicons name="cash-outline" size={21} color={Colors.white} />
            <Text style={styles.actionText}>New finance enquiry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionSecondary} onPress={() => navigation?.navigate('ServiceLeadForm', { serviceType: 'WARRANTY' })}>
            <Ionicons name="shield-checkmark-outline" size={21} color={Colors.accent} />
            <Text style={styles.actionSecondaryText}>New warranty enquiry</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <Text style={styles.empty}>Loading enquiries…</Text> : null}
        {!loading && leads.length === 0 ? <Text style={styles.empty}>You have not submitted a finance or warranty enquiry yet.</Text> : null}

        {leads.map((lead) => {
          const name = [lead.vehicleRegistration, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(' · ') || 'Vehicle enquiry';
          const count = lead.responseCount ?? lead.responses?.length ?? 0;
          return (
            <TouchableOpacity key={lead.id} style={styles.card} onPress={() => navigation?.navigate('CustomerServiceLeadDetail', { leadId: lead.id })} activeOpacity={0.8}>
              <View style={styles.cardTop}>
                <Text style={styles.type}>{SERVICE_LABELS[lead.serviceType]}</Text>
                <Text style={styles.status}>{lead.status}</Text>
              </View>
              <Text style={styles.cardTitle}>{name}</Text>
              <Text style={styles.meta}>{lead.recipientCount ?? 0} matched provider{(lead.recipientCount ?? 0) === 1 ? '' : 's'} · {count} response{count === 1 ? '' : 's'}</Text>
              <View style={styles.openRow}><Text style={styles.openText}>Open enquiry</Text><Ionicons name="chevron-forward" size={16} color={Colors.accent} /></View>
            </TouchableOpacity>
          );
        })}
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
  eyebrow: { color: Colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: Colors.textPrimary, fontSize: 27, fontWeight: '900', marginTop: 6 },
  subtitle: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 18 },
  actions: { gap: 10, marginBottom: 20 },
  action: { minHeight: 50, borderRadius: 13, backgroundColor: Colors.accent, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  actionSecondary: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: Colors.accent, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  actionSecondaryText: { color: Colors.accent, fontWeight: '800', fontSize: 14 },
  error: { color: Colors.error, fontSize: 13, marginBottom: 14 },
  empty: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 28 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgSecondary, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  type: { color: Colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, flex: 1 },
  status: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  cardTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 10 },
  meta: { color: Colors.textMuted, fontSize: 12, marginTop: 7 },
  openRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  openText: { color: Colors.accent, fontSize: 12, fontWeight: '800' },
});
