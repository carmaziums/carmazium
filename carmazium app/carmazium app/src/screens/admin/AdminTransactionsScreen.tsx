import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';
import {
  getNativeAdminTransactions, paymentAmount, paymentStatusLabel,
  paymentTypeLabel, personName, type AdminTransactionFilters, type AdminTransactionRecord,
} from '../../lib/nativeAdminRecords';

type Nav = NativeStackNavigationProp<MainStackParamList>;
const limit = 20;
const EMPTY: AdminTransactionFilters = { q: '', type: '', status: '', from: '', to: '' };
const STATUSES = ['', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];
const TYPES = ['', 'DEPOSIT', 'FULL_PAYMENT', 'COMMISSION', 'REFUND', 'HPI_REPORT', 'HPI_REPORT_EMAIL', 'LISTING_FEE', 'BOOST', 'KYC_VERIFICATION'];

function dateLabel(date?: string | null) {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-GB');
}
function validDate(date?: string) {
  if (!date) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(date + 'T00:00:00Z').getTime());
}

export const AdminTransactionsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const clearance = useTabBarClearance();
  const [draft, setDraft] = useState<AdminTransactionFilters>(EMPTY);
  const [filters, setFilters] = useState<AdminTransactionFilters>(EMPTY);
  const [rows, setRows] = useState<AdminTransactionRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await getNativeAdminTransactions(page, limit, filters);
      setRows(Array.isArray(result.data) ? result.data : []);
      setTotal(result.pagination?.total ?? null);
    } catch (err: any) {
      setError(err?.message || 'Could not load transaction ledger.');
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, filters]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const apply = () => {
    if (!validDate(draft.from) || !validDate(draft.to) || (draft.from && draft.to && draft.from > draft.to)) {
      setFilterError('Enter valid UTC dates (YYYY-MM-DD), with From not after To.');
      return;
    }
    setFilterError(null);
    setPage(1);
    setFilters({ ...draft, q: draft.q?.trim() });
  };

  const input = (label: string, value: string, onChange: (next: string) => void, placeholder: string) => (
    <TextInput
      accessibilityLabel={label} value={value} onChangeText={onChange}
      placeholder={placeholder} placeholderTextColor={Colors.textMuted}
      autoCapitalize="none" style={styles.input}
    />
  );

  const row = ({ item }: { item: AdminTransactionRecord }) => {
    const isRefund = item.type === 'REFUND';
    const opened = expanded === item.id;
    const isPaid = item.status === 'COMPLETED';
    const report = item.listing?.hpiReport;
    const hpiEligible = isPaid && (['HPI_REPORT', 'HPI_REPORT_EMAIL'].includes(item.type) ||
      (item.type === 'LISTING_FEE' && [10, 25].includes(Number(item.amount))));
    return <View style={styles.record}>
      <View style={styles.row}>
        <TouchableOpacity accessibilityRole="button" disabled={!item.user?.id}
          style={styles.flex} onPress={() => item.user?.id && navigation.navigate('AdminAccountDetail', { userId: item.user.id })}>
          <Text style={styles.name}>{personName(item.user)}</Text>
          <Text style={styles.secondary} numberOfLines={1}>{item.user?.email || 'No email recorded'}</Text>
        </TouchableOpacity>
        <Text style={[styles.amount, isRefund && { color: Colors.error }]}>{paymentAmount(item.amount, isRefund)}</Text>
      </View>
      <View style={styles.pills}>
        <Text style={styles.type}>{paymentTypeLabel(item.type)}</Text>
        <Text style={[styles.status, { color: item.status === 'COMPLETED' ? Colors.success : item.status === 'FAILED' ? Colors.error : Colors.textSecondary }]}>{paymentStatusLabel(item)}</Text>
        <Text style={styles.secondary}>{dateLabel(item.createdAt)}</Text>
      </View>
      {item.listing && <Text style={styles.secondary} numberOfLines={2}>{item.listing.title}</Text>}
      {item.type === 'LISTING_FEE' && item.status === 'PENDING' && <Text style={styles.warning}>Payment not confirmed by Stripe — do not count as received.</Text>}
      {hpiEligible && item.listing && <View style={styles.hpi}>
        <Ionicons name={report?.status === 'COMPLETED' ? 'shield-checkmark-outline' : 'time-outline'} color={report?.status === 'COMPLETED' ? Colors.success : Colors.accent} size={19} />
        <Text style={styles.hpiText}>{!report ? 'No report record for this payment' : report.status === 'COMPLETED' ? `Report ${report.pdfUploadedAt ? 'uploaded' : 'prepared'} · ${report.isClear ? 'all checks passed' : 'adverse history'}` : 'Report outstanding — buyer is still owed one'}</Text>
      </View>}
      <TouchableOpacity onPress={() => setExpanded(opened ? null : item.id)} accessibilityRole="button"
        accessibilityState={{ expanded: opened }} style={styles.expand}>
        <Text style={styles.expandText}>{opened ? 'Hide details' : 'Show payment details'}</Text>
        <Ionicons name={opened ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
      </TouchableOpacity>
      {opened && <View style={styles.detail}>
        <Text style={styles.secondary}>Transaction ID: {item.id}</Text>
        <Text style={styles.secondary}>Stripe reference: {item.stripePaymentId || '—'}</Text>
        <Text style={styles.secondary}>Description: {item.description || '—'}</Text>
        {hpiEligible && <Text style={styles.warning}>Report upload and preparation actions remain pending in the native admin editor. This screen never modifies payments or reports.</Text>}
      </View>}
    </View>;
  };

  const header = <View>
    <WebsiteTopBar />
    <View style={styles.header}>
      <TouchableOpacity accessibilityRole="button" style={styles.back} onPress={() => navigation.navigate('AdminDashboard')}>
        <Ionicons name="arrow-back" color={Colors.textMuted} size={18} />
        <Text style={styles.secondary}>Back to Overview</Text>
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header">Transaction Ledger</Text>
      <Text style={styles.uppercase}>{total == null ? 'Loading records…' : `${total} transaction records, including unpaid checkout attempts · only Completed payments are received`}</Text>
    </View>
    <View style={styles.filters}>
      {input('Search transactions', draft.q || '', text => setDraft(value => ({ ...value, q: text })), 'Registration, customer, payment reference')}
      <Text style={styles.fieldLabel}>Payment status</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUSES.map(status => <TouchableOpacity key={status || 'all'} accessibilityRole="button"
          accessibilityState={{ selected: draft.status === status }}
          style={[styles.chip, draft.status === status && styles.selected]}
          onPress={() => setDraft(value => ({ ...value, status }))}>
          <Text style={[styles.chipText, draft.status === status && styles.selectedText]}>{status || 'All statuses'}</Text>
        </TouchableOpacity>)}
      </ScrollView>
      <Text style={styles.fieldLabel}>Payment type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {TYPES.map(type => <TouchableOpacity key={type || 'all'} accessibilityRole="button"
          accessibilityState={{ selected: draft.type === type }}
          style={[styles.chip, draft.type === type && styles.selected]}
          onPress={() => setDraft(value => ({ ...value, type }))}>
          <Text style={[styles.chipText, draft.type === type && styles.selectedText]}>{type ? paymentTypeLabel(type) : 'All types'}</Text>
        </TouchableOpacity>)}
      </ScrollView>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.fieldLabel}>From (UTC)</Text>
          {input('From date UTC', draft.from || '', text => setDraft(value => ({ ...value, from: text })), 'YYYY-MM-DD')}
        </View>
        <View style={styles.flex}>
          <Text style={styles.fieldLabel}>To (UTC)</Text>
          {input('To date UTC', draft.to || '', text => setDraft(value => ({ ...value, to: text })), 'YYYY-MM-DD')}
        </View>
      </View>
      {filterError && <Text style={styles.warning}>{filterError}</Text>}
      <View style={styles.actions}>
        <TouchableOpacity onPress={apply} accessibilityRole="button" style={styles.apply}><Text style={styles.applyText}>Apply filters</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => { setDraft(EMPTY); setFilters(EMPTY); setPage(1); setFilterError(null); }} accessibilityRole="button" style={styles.clear}><Text style={styles.clearText}>Clear</Text></TouchableOpacity>
      </View>
    </View>
    {error && <ErrorBanner message={error} onRetry={() => void load(true)} />}
  </View>;

  return <View style={styles.screen}>
    <FlatList data={rows} keyExtractor={record => record.id} renderItem={row}
      ListHeaderComponent={header}
      ListEmptyComponent={loading ? <ActivityIndicator color={Colors.accent} style={styles.loading} /> : <Text style={styles.noRows}>No transactions match these filters.</Text>}
      ListFooterComponent={<View style={styles.pager}>
        <TouchableOpacity accessibilityRole="button" disabled={page <= 1 || loading} onPress={() => setPage(p => Math.max(1, p - 1))} style={styles.pageButton}><Text style={styles.clearText}>Previous</Text></TouchableOpacity>
        <Text style={styles.secondary}>Page {page}{total == null ? '' : ` of ${Math.max(1, Math.ceil(total / limit))}`}</Text>
        <TouchableOpacity accessibilityRole="button" disabled={loading || (total != null && page * limit >= total)} onPress={() => setPage(p => p + 1)} style={styles.pageButton}><Text style={styles.clearText}>Next</Text></TouchableOpacity>
      </View>}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={Colors.accent} />}
      keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10, paddingBottom: clearance + 20 }} />
  </View>;
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  header: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 22, gap: 11 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  title: { color: Colors.textPrimary, fontFamily: FontFamily.extraBold, fontSize: FontSize.xl },
  uppercase: { color: Colors.textMuted, fontFamily: FontFamily.bold, fontSize: FontSize.sm, textTransform: 'uppercase', letterSpacing: 1 },
  filters: { marginHorizontal: 16, padding: 14, gap: 10, backgroundColor: Colors.bgCard, borderRadius: 15, borderWidth: 1, borderColor: Colors.border },
  fieldLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, fontFamily: FontFamily.semiBold },
  input: { backgroundColor: Colors.bgSecondary, borderRadius: 11, minHeight: 48, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary, fontSize: FontSize.base, paddingHorizontal: 12 },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: { borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgSecondary, paddingHorizontal: 12, paddingVertical: 9 },
  selected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontFamily: FontFamily.medium },
  selectedText: { color: Colors.onAccent },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  apply: { backgroundColor: Colors.accent, paddingHorizontal: 17, paddingVertical: 14, borderRadius: 11 },
  applyText: { color: Colors.onAccent, fontFamily: FontFamily.bold, fontSize: FontSize.base },
  clear: { backgroundColor: Colors.bgSecondary, borderColor: Colors.border, borderWidth: 1, paddingHorizontal: 17, paddingVertical: 14, borderRadius: 11 },
  clearText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontFamily: FontFamily.semiBold },
  record: { marginHorizontal: 16, backgroundColor: Colors.bgCard, padding: 15, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, gap: 10 },
  name: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.base },
  amount: { color: Colors.textPrimary, fontFamily: FontFamily.extraBold, fontSize: FontSize.base },
  secondary: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 19 },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  type: { color: Colors.textSecondary, fontSize: FontSize.sm, fontFamily: FontFamily.bold, padding: 6, borderRadius: 7, backgroundColor: Colors.bgSecondary },
  status: { fontSize: FontSize.xs, fontFamily: FontFamily.extraBold, padding: 6 },
  warning: { fontSize: FontSize.sm, color: Colors.warning, lineHeight: 19 },
  hpi: { borderRadius: 13, backgroundColor: Colors.successAlpha10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  hpiText: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm, fontFamily: FontFamily.medium },
  expand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: Colors.border, paddingTop: 10 },
  expandText: { color: Colors.accent, fontSize: FontSize.sm, fontFamily: FontFamily.semiBold },
  detail: { gap: 8, padding: 8, backgroundColor: Colors.bgSecondary, borderRadius: 9 },
  noRows: { padding: 25, color: Colors.textSecondary, textAlign: 'center' },
  loading: { margin: 22 },
  pager: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 20 },
  pageButton: { backgroundColor: Colors.bgCard, borderColor: Colors.border, borderWidth: 1, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 12 },
});
