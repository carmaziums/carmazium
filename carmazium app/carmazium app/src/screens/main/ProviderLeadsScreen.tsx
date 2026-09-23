import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import {
  formatPence,
  getProviderLeadInboxPage,
  SERVICE_LABELS,
  ServiceLead,
} from '../../lib/servicesApi';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderLeads'>;
type Filter = '' | 'FINANCE' | 'WARRANTY';

function requirementSummary(lead: ServiceLead): string {
  if (lead.serviceType === 'FINANCE') {
    return [
      lead.depositPence != null ? `Deposit ${formatPence(lead.depositPence)}` : null,
      lead.termMonths != null ? `${lead.termMonths} months` : null,
      lead.monthlyBudgetPence != null ? `Budget ${formatPence(lead.monthlyBudgetPence)}/month` : null,
    ].filter(Boolean).join(' • ');
  }
  return [
    lead.warrantyMonths != null ? `${lead.warrantyMonths} months` : null,
    lead.warrantyLevel || null,
  ].filter(Boolean).join(' • ');
}

function vehicleLabel(lead: ServiceLead): string {
  return [lead.vehicleRegistration, lead.vehicleMake, lead.vehicleModel]
    .filter(Boolean)
    .join(' • ') || 'Vehicle enquiry';
}

export const ProviderLeadsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('');
  const [items, setItems] = useState<ServiceLead[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await getProviderLeadInboxPage(filter || undefined, cursor);
      setItems((current) => append ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (err: any) {
      setError(err?.message || 'Could not load matched enquiries.');
      if (!append) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const renderLead = ({ item: lead }: { item: ServiceLead }) => {
    const requirements = requirementSummary(lead);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.78}
        onPress={() => navigation.navigate('ProviderLeadDetail', { leadId: lead.id })}
      >
        <View style={styles.rowBetween}>
          <View style={[styles.chip, lead.serviceType === 'FINANCE' ? styles.financeChip : styles.warrantyChip]}>
            <Text style={styles.chipText}>{SERVICE_LABELS[lead.serviceType].toUpperCase()}</Text>
          </View>
          <View style={styles.statusChip}>
            <Text style={styles.statusText}>{lead.recipientStatus || 'NEW'}</Text>
          </View>
        </View>

        <Text style={styles.title}>{vehicleLabel(lead)}</Text>
        <Text style={styles.meta}>
          {lead.postcode ? `Postcode area ${lead.postcode}` : 'Nationwide / postcode not supplied'}
          {lead.vehicleValuePence != null ? ` • Vehicle value ${formatPence(lead.vehicleValuePence)}` : ''}
        </Text>

        {!!requirements && <Text style={styles.requirements}>{requirements}</Text>}
        {!!lead.summary && <Text style={styles.summary} numberOfLines={2}>{lead.summary}</Text>}

        <View style={styles.footer}>
          <View>
            <Text style={styles.footerLabel}>RECEIVED</Text>
            <Text style={styles.footerValue}>{new Date(lead.createdAt).toLocaleDateString('en-GB')}</Text>
          </View>
          <View style={styles.openButton}>
            <Text style={styles.openButtonText}>
              {lead.recipientStatus === 'RESPONDED' ? 'VIEW / UPDATE' : 'OPEN ENQUIRY'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.white} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgPrimary} />
      <View style={styles.header}>
        <IconButton
          style={styles.headerButton}
          icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text style={styles.headerTitle}>Provider Leads</Text>
        <HamburgerButton />
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>PROVIDER INBOX</Text>
        <Text style={styles.heroTitle}>Finance & warranty enquiries</Text>
        <Text style={styles.sub}>
          Review matched customer requirements and send a provider response directly from the Partner Account.
        </Text>
      </View>

      <View style={styles.filters}>
        {([
          ['', 'ALL'],
          ['FINANCE', 'FINANCE'],
          ['WARRANTY', 'WARRANTY'],
        ] as [Filter, string][]).map(([value, label]) => (
          <TouchableOpacity
            key={label}
            style={[styles.filterButton, filter === value && styles.filterButtonActive]}
            onPress={() => setFilter(value)}
          >
            <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={17} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => void load()} style={styles.retryButton}>
              <Text style={styles.retryText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.loadingText}>Loading matched enquiries…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderLead}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="mail-open-outline" size={34} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No open matched enquiries</Text>
              <Text style={styles.emptyText}>
                Finance and Warranty leads appear automatically when they match an approved capability and your matching settings.
              </Text>
            </View>
          }
          ListFooterComponent={
            nextCursor ? (
              <TouchableOpacity
                style={styles.loadMore}
                onPress={() => void load(nextCursor, true)}
                disabled={loadingMore}
              >
                {loadingMore ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.loadMoreText}>LOAD MORE</Text>}
              </TouchableOpacity>
            ) : <View style={{ height: 18 }} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  hero: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  eyebrow: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.size10, letterSpacing: 1.5 },
  heroTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size22, marginTop: 6 },
  sub: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size14, lineHeight: 20, marginTop: 7 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginBottom: 10 },
  filterButton: { flex: 1, minHeight: 38, borderRadius: 10, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.whiteAlpha08 },
  filterButtonActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, letterSpacing: 0.7 },
  filterTextActive: { color: Colors.white },
  list: { padding: 18, paddingTop: 8, gap: 12, flexGrow: 1 },
  card: { borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, borderRadius: Radius.card, padding: 15, gap: 9 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  financeChip: { backgroundColor: Colors.infoBlueAlpha10 },
  warrantyChip: { backgroundColor: Colors.accentGreenAlpha15 },
  chipText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10, letterSpacing: 0.7 },
  statusChip: { borderRadius: 8, backgroundColor: Colors.whiteAlpha06, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontFamily: FontFamily.bold, color: Colors.textSecondary, fontSize: FontSize.size10 },
  title: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.md },
  meta: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size12, lineHeight: 18 },
  requirements: { fontFamily: FontFamily.bold, color: Colors.textSecondary, fontSize: FontSize.size12, lineHeight: 18 },
  summary: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size12, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha08, paddingTop: 11, marginTop: 2 },
  footerLabel: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, letterSpacing: 0.8 },
  footerValue: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size12, marginTop: 2 },
  openButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, borderRadius: 10, backgroundColor: Colors.accent, paddingHorizontal: 11 },
  openButtonText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10 },
  errorCard: { flexDirection: 'row', gap: 9, marginHorizontal: 18, marginBottom: 8, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10, padding: 12 },
  errorText: { fontFamily: FontFamily.regular, color: Colors.white, fontSize: FontSize.size12, lineHeight: 18 },
  retryButton: { alignSelf: 'flex-start', marginTop: 7 },
  retryText: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.size10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size12 },
  empty: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.md, marginTop: 12 },
  emptyText: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size12, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  loadMore: { alignSelf: 'center', minWidth: 140, minHeight: 42, borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  loadMoreText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10, letterSpacing: 0.8 },
});
