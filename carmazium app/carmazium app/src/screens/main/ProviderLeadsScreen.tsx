import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import {
  ServiceLead,
  formatPence,
  getProviderLeadInboxPage,
} from '../../lib/servicesApi';
import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderLeads'>;
type Filter = 'ALL' | 'FINANCE' | 'WARRANTY';

const FILTERS: Filter[] = ['ALL', 'FINANCE', 'WARRANTY'];

const vehicleText = (lead: ServiceLead) =>
  [lead.vehicleRegistration, lead.vehicleMake, lead.vehicleModel]
    .filter(Boolean)
    .join(' · ') || 'Vehicle enquiry';

const requirementText = (lead: ServiceLead) => {
  if (lead.serviceType === 'FINANCE') {
    return [
      lead.depositPence != null ? `Deposit ${formatPence(lead.depositPence)}` : null,
      lead.termMonths != null ? `${lead.termMonths} months` : null,
      lead.monthlyBudgetPence != null ? `Budget ${formatPence(lead.monthlyBudgetPence)}/mo` : null,
    ].filter(Boolean).join(' · ') || 'Finance requirements';
  }

  return [
    lead.warrantyMonths != null ? `${lead.warrantyMonths} months` : null,
    lead.warrantyLevel || null,
  ].filter(Boolean).join(' · ') || 'Warranty requirements';
};

export const ProviderLeadsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [leads, setLeads] = useState<ServiceLead[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serviceFilter = useMemo<'FINANCE' | 'WARRANTY' | undefined>(
    () => filter === 'ALL' ? undefined : filter,
    [filter],
  );

  const load = useCallback(async (mode: 'reset' | 'more' = 'reset') => {
    if (mode === 'more' && !nextCursor) return;

    mode === 'more' ? setLoadingMore(true) : setLoading(true);
    setError(null);

    try {
      const page = await getProviderLeadInboxPage(
        serviceFilter,
        mode === 'more' ? nextCursor ?? undefined : undefined,
      );
      setLeads((prev) => mode === 'more' ? [...prev, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (err: any) {
      setError(err?.message || 'Could not load matched enquiries.');
      if (mode === 'reset') setLeads([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [serviceFilter, nextCursor]);

  useEffect(() => {
    setLeads([]);
    setNextCursor(null);
    void load('reset');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceFilter]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNextCursor(null);
    void load('reset');
  }, [load]);

  const renderLead = ({ item: lead }: { item: ServiceLead }) => {
    const status = lead.recipientStatus || 'NEW';
    const expires = new Date(lead.expiresAt);
    const expired = expires.getTime() <= Date.now() || lead.status === 'EXPIRED';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('ProviderLeadDetail', { leadId: lead.id })}
      >
        <View style={styles.cardTop}>
          <View style={styles.typeRow}>
            <View style={styles.iconBox}>
              <Ionicons
                name={lead.serviceType === 'FINANCE' ? 'cash-outline' : 'shield-checkmark-outline'}
                size={19}
                color={lead.serviceType === 'FINANCE' ? Colors.infoBlueLight : Colors.warning}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeText}>
                {lead.serviceType === 'FINANCE' ? 'Vehicle Finance' : 'Warranty'}
              </Text>
              <Text style={styles.title} numberOfLines={2}>{vehicleText(lead)}</Text>
            </View>
          </View>
          <View style={[
            styles.statusPill,
            status === 'RESPONDED' && styles.respondedPill,
            expired && styles.expiredPill,
          ]}>
            <Text style={[
              styles.statusText,
              status === 'RESPONDED' && styles.respondedText,
              expired && styles.expiredText,
            ]}>
              {expired ? 'EXPIRED' : status}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.metaText}>
            {lead.postcode ? `Postcode ${lead.postcode}` : 'Nationwide / postcode not supplied'}
          </Text>
        </View>

        {lead.vehicleValuePence != null ? (
          <View style={styles.metaRow}>
            <Ionicons name="car-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>Vehicle value {formatPence(lead.vehicleValuePence)}</Text>
          </View>
        ) : null}

        <View style={styles.requirementBox}>
          <Text style={styles.requirementText}>{requirementText(lead)}</Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.receivedText}>
            Received {new Date(lead.createdAt).toLocaleDateString('en-GB')}
          </Text>
          <View style={styles.openRow}>
            <Text style={styles.openText}>{status === 'RESPONDED' ? 'VIEW / UPDATE' : 'OPEN LEAD'}</Text>
            <Ionicons name="chevron-forward" size={15} color={Colors.accent} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.header}>
        <IconButton
          style={styles.headerButton}
          icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Finance & Warranty Enquiries</Text>
          <Text style={styles.headerSub}>Matched customer enquiries</Text>
        </View>
        <HamburgerButton />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.filter, filter === item && styles.filterActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
              {item === 'ALL' ? 'All' : item === 'FINANCE' ? 'Finance' : 'Warranty'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && leads.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>
      ) : error && leads.length === 0 ? (
        <View style={styles.centerCard}>
          <Ionicons name="alert-circle-outline" size={34} color={Colors.accent} />
          <Text style={styles.emptyTitle}>Could not load enquiries</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void load('reset')}>
            <Text style={styles.primaryText}>TRY AGAIN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('ProviderCapabilities')}
          >
            <Text style={styles.secondaryText}>CHECK SERVICE APPROVAL</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => item.id}
          renderItem={renderLead}
          contentContainerStyle={leads.length ? styles.list : styles.emptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerCard}>
              <Ionicons name="mail-unread-outline" size={34} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No matched enquiries</Text>
              <Text style={styles.emptyText}>
                New Finance and Warranty enquiries appear automatically when they match your approved service and matching settings.
              </Text>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('ProviderCapabilities')}
              >
                <Text style={styles.secondaryText}>MANAGE MATCHING</Text>
              </TouchableOpacity>
            </View>
          }
          onEndReached={() => {
            if (nextCursor && !loadingMore) void load('more');
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={Colors.accent} style={{ marginVertical: 18 }} /> : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12 },
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.size10, color: Colors.textMuted, marginTop: 2 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingVertical: 10 },
  filter: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.whiteAlpha06 },
  filterActive: { borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10 },
  filterText: { fontFamily: FontFamily.medium, fontSize: FontSize.size10, color: Colors.textMuted },
  filterTextActive: { color: Colors.accent },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 18, gap: 12, paddingBottom: 36 },
  emptyList: { flexGrow: 1, padding: 18, justifyContent: 'center' },
  card: { borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, padding: 15, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  typeRow: { flex: 1, flexDirection: 'row', gap: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  typeText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, marginTop: 3 },
  statusPill: { borderRadius: 999, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: Colors.whiteAlpha08, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textSecondary },
  respondedPill: { borderColor: Colors.successAlpha25, backgroundColor: Colors.successAlpha10 },
  respondedText: { color: Colors.accentGreen },
  expiredPill: { borderColor: Colors.errorAlpha25, backgroundColor: Colors.errorAlpha10 },
  expiredText: { color: Colors.errorLight },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textSecondary },
  requirementBox: { borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha06, padding: 10 },
  requirementText: { fontFamily: FontFamily.medium, fontSize: FontSize.size10, color: Colors.textSecondary, lineHeight: 17 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.whiteAlpha08, paddingTop: 11 },
  receivedText: { fontFamily: FontFamily.regular, fontSize: FontSize.size10, color: Colors.textMuted },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  openText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.accent, letterSpacing: 0.5 },
  centerCard: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white, textAlign: 'center' },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textMuted, textAlign: 'center', lineHeight: 19, maxWidth: 340 },
  primaryButton: { marginTop: 5, minHeight: 44, borderRadius: Radius.inline, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white, letterSpacing: 0.7 },
  secondaryButton: { minHeight: 42, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
});
