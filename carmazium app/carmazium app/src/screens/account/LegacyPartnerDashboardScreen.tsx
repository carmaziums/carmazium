import React, { useCallback, useMemo, useState } from 'react';
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
import {
  FinanceApplication,
  InsuranceQuote,
  getFinancePartnerApplications,
  getInsurancePartnerQuotes,
  updateFinancePartnerApplication,
  updateInsurancePartnerQuote,
} from '../../lib/legacyPartnerApi';

type PartnerKind = 'finance' | 'insurance';

const money = (value?: string | number | null) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
};

const PartnerDashboard: React.FC<{ navigation?: any; kind: PartnerKind }> = ({ navigation, kind }) => {
  const insets = useSafeAreaInsets();
  const isFinance = kind === 'finance';
  const [financeRows, setFinanceRows] = useState<FinanceApplication[]>([]);
  const [insuranceRows, setInsuranceRows] = useState<InsuranceQuote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      if (isFinance) {
        const res = await getFinancePartnerApplications(1, 50);
        setFinanceRows(res.data || []);
        setTotal(res.total || 0);
      } else {
        const res = await getInsurancePartnerQuotes(1, 50);
        setInsuranceRows(res.data || []);
        setTotal(res.total || 0);
      }
      setError(null);
    } catch (e: any) {
      setError(e?.message || `Could not load ${isFinance ? 'finance applications' : 'insurance quotes'}.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isFinance]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const stats = useMemo(() => {
    if (isFinance) {
      return {
        pending: financeRows.filter((row) => row.status === 'PENDING').length,
        progressed: financeRows.filter((row) => row.status === 'APPROVED' || row.status === 'COMPLETED').length,
        rejected: financeRows.filter((row) => row.status === 'REJECTED').length,
      };
    }
    return {
      pending: insuranceRows.filter((row) => row.status === 'PENDING').length,
      progressed: insuranceRows.filter((row) => row.status === 'QUOTED' || row.status === 'ACCEPTED').length,
      rejected: insuranceRows.filter((row) => row.status === 'REJECTED').length,
    };
  }, [financeRows, insuranceRows, isFinance]);

  const financeAction = async (row: FinanceApplication, status: FinanceApplication['status']) => {
    setUpdating(row.id);
    try {
      const updated = await updateFinancePartnerApplication(row.id, status);
      setFinanceRows((current) => current.map((item) => item.id === row.id ? updated : item));
    } catch (e: any) {
      Alert.alert('Could not update application', e?.message || 'Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  const insuranceAction = async (row: InsuranceQuote, status: InsuranceQuote['status']) => {
    setUpdating(row.id);
    try {
      const updated = await updateInsurancePartnerQuote(row.id, status);
      setInsuranceRows((current) => current.map((item) => item.id === row.id ? updated : item));
    } catch (e: any) {
      Alert.alert('Could not update quote', e?.message || 'Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={{ height: insets.top }} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isFinance ? 'Finance Partner' : 'Insurance Partner'}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation?.navigate('Messages')} accessibilityRole="button" accessibilityLabel="Messages">
            <Ionicons name="chatbubbles-outline" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation?.navigate('Settings')} accessibilityRole="button" accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.accent} />}
      >
        <Text style={styles.eyebrow}>PARTNER DASHBOARD</Text>
        <Text style={styles.title}>{isFinance ? 'Finance applications' : 'Insurance quotes'}</Text>
        <Text style={styles.subtitle}>This uses the same partner records and status actions as the CarMazium website.</Text>

        <View style={styles.stats}>
          <Stat label="Pending" value={stats.pending} />
          <Stat label={isFinance ? 'Approved' : 'Quoted'} value={stats.progressed} />
          <Stat label="Rejected" value={stats.rejected} />
          <Stat label="Total" value={total} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <Text style={styles.empty}>Loading…</Text> : null}

        {isFinance ? financeRows.map((row) => (
          <View key={row.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{row.listing?.title || 'Vehicle finance application'}</Text>
              <Text style={styles.status}>{row.status}</Text>
            </View>
            <Text style={styles.meta}>{[row.user?.firstName, row.user?.lastName].filter(Boolean).join(' ') || row.user?.email || 'Applicant'} · Deposit {money(row.depositAmount)} · {row.termMonths} months</Text>
            {row.monthlyPayment ? <Text style={styles.meta}>Monthly payment: {money(row.monthlyPayment)}</Text> : null}
            {updating === row.id ? <Text style={styles.working}>Updating…</Text> : (
              <View style={styles.actions}>
                {row.status === 'PENDING' ? (
                  <>
                    <Action label="Approve" onPress={() => financeAction(row, 'APPROVED')} primary />
                    <Action label="Reject" onPress={() => financeAction(row, 'REJECTED')} />
                  </>
                ) : row.status === 'APPROVED' ? (
                  <Action label="Complete" onPress={() => financeAction(row, 'COMPLETED')} primary />
                ) : null}
              </View>
            )}
          </View>
        )) : insuranceRows.map((row) => (
          <View key={row.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{row.listing?.title || 'Vehicle insurance quote'}</Text>
              <Text style={styles.status}>{row.status}</Text>
            </View>
            <Text style={styles.meta}>{[row.user?.firstName, row.user?.lastName].filter(Boolean).join(' ') || row.user?.email || 'Customer'} · Driver age {row.driverAge} · NCB {row.ncbYears} years</Text>
            {row.coverageType ? <Text style={styles.meta}>{row.coverageType}{row.quotedPrice ? ` · ${money(row.quotedPrice)}` : ''}</Text> : null}
            {updating === row.id ? <Text style={styles.working}>Updating…</Text> : row.status === 'PENDING' ? (
              <View style={styles.actions}>
                <Action label="Mark quoted" onPress={() => insuranceAction(row, 'QUOTED')} primary />
                <Action label="Reject" onPress={() => insuranceAction(row, 'REJECTED')} />
              </View>
            ) : null}
          </View>
        ))}

        {!loading && ((isFinance && financeRows.length === 0) || (!isFinance && insuranceRows.length === 0)) ? (
          <Text style={styles.empty}>No {isFinance ? 'finance applications' : 'insurance quotes'} yet.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>
);

const Action = ({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) => (
  <TouchableOpacity style={[styles.action, primary && styles.actionPrimary]} onPress={onPress} activeOpacity={0.8}>
    <Text style={[styles.actionText, primary && styles.actionPrimaryText]}>{label}</Text>
  </TouchableOpacity>
);

export const FinancePartnerDashboardScreen: React.FC<{ navigation?: any }> = (props) => <PartnerDashboard {...props} kind="finance" />;
export const InsurancePartnerDashboardScreen: React.FC<{ navigation?: any }> = (props) => <PartnerDashboard {...props} kind="insurance" />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { minHeight: 62, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '900' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 18 },
  eyebrow: { color: Colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: Colors.textPrimary, fontSize: 28, fontWeight: '900', marginTop: 6 },
  subtitle: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 18 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  stat: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgSecondary, paddingVertical: 13, alignItems: 'center' },
  statValue: { color: Colors.textPrimary, fontSize: 20, fontWeight: '900' },
  statLabel: { color: Colors.textMuted, fontSize: 9.5, marginTop: 3 },
  error: { color: Colors.error, fontSize: 13, marginBottom: 12 },
  empty: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 30 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgSecondary, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', flex: 1 },
  status: { color: Colors.textMuted, fontSize: 9.5, fontWeight: '900', borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  meta: { color: Colors.textMuted, fontSize: 11.5, lineHeight: 17, marginTop: 7 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  action: { flex: 1, minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  actionPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  actionText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  actionPrimaryText: { color: Colors.white },
  working: { color: Colors.accent, fontSize: 12, fontWeight: '700', marginTop: 13 },
});
