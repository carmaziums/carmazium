import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@/components/BrandIcon';
import { HamburgerButton } from '../../components/HamburgerButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Colors } from '../../constants/colors';
import { useAppearanceStore } from '../../store/appearanceStore';
import { adaptLegacyLightStyles } from '../../theme/appearancePalette';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import {
  FinancePartnerApplication,
  InsurancePartnerQuote,
  LegacyPartnerItem,
  LegacyPartnerKind,
  LegacyPartnerSettings,
  LegacyPartnerStats,
  formatPartnerCurrency,
  getLegacyPartnerItems,
  getLegacyPartnerSettings,
  getLegacyPartnerStats,
  regenerateLegacyPartnerKey,
  saveLegacyPartnerSettings,
  updateFinancePartnerApplication,
  updateInsurancePartnerQuote,
} from '../../lib/legacyPartnerApi';
import { useAuthStore } from '../../store/authStore';

const PAGE_SIZE = 20;

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

const applicantName = (item: LegacyPartnerItem) => {
  const name = [item.user?.firstName, item.user?.lastName].filter(Boolean).join(' ').trim();
  return name || item.user?.email || 'Customer';
};

export const LegacyPartnerDashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? adaptLegacyLightStyles(styles) : styles;
  const insets = useSafeAreaInsets();
  const accountRole = useAuthStore((s) => s.accountRole);
  const kind: LegacyPartnerKind =
    accountRole === 'insurance_partner' ? 'insurance' : 'finance';

  const [stats, setStats] = useState<LegacyPartnerStats | null>(null);
  const [items, setItems] = useState<LegacyPartnerItem[]>([]);
  const [settings, setSettings] = useState<LegacyPartnerSettings | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [revealedKey, setRevealedKey] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionItem, setActionItem] = useState<LegacyPartnerItem | null>(null);
  const [amountDraft, setAmountDraft] = useState('');
  const [coverageDraft, setCoverageDraft] = useState('Comprehensive');

  const labels = useMemo(
    () =>
      kind === 'finance'
        ? {
            title: 'Finance Partner',
            eyebrow: 'FINANCE APPLICATIONS',
            itemLabel: 'application',
            activeLabel: 'Approved',
          }
        : {
            title: 'Insurance Partner',
            eyebrow: 'INSURANCE QUOTES',
            itemLabel: 'quote request',
            activeLabel: 'Quoted',
          },
    [kind],
  );

  const applySettings = useCallback((next: LegacyPartnerSettings) => {
    setSettings(next);
    setCompanyName(next.companyName || '');
    setCallbackUrl(next.callbackUrl || '');
  }, []);

  const loadInitial = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const [nextStats, nextItems, nextSettings] = await Promise.all([
        getLegacyPartnerStats(kind),
        getLegacyPartnerItems(kind, 1, PAGE_SIZE),
        getLegacyPartnerSettings(kind),
      ]);
      setStats(nextStats);
      setItems(nextItems.data ?? []);
      setTotal(nextItems.total ?? 0);
      setPage(1);
      applySettings(nextSettings);
    } catch (err: any) {
      setError(err?.message || `Could not load ${labels.title} dashboard.`);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [applySettings, kind, labels.title]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const refresh = async () => {
    setRefreshing(true);
    await loadInitial(false);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const result = await getLegacyPartnerItems(kind, nextPage, PAGE_SIZE);
      setItems((current) => [...current, ...(result.data ?? [])]);
      setTotal(result.total ?? total);
      setPage(nextPage);
    } catch (err: any) {
      setError(err?.message || 'Could not load more records.');
    } finally {
      setLoadingMore(false);
    }
  };

  const replaceItem = (next: LegacyPartnerItem) => {
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  };

  const refreshStats = async () => {
    try {
      setStats(await getLegacyPartnerStats(kind));
    } catch {
      // The mutation succeeded; a stale summary is safer than pretending it failed.
    }
  };

  const rejectItem = (item: LegacyPartnerItem) => {
    Alert.alert(
      kind === 'finance' ? 'Reject application?' : 'Reject quote request?',
      'This updates the same partner record used by the website.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setBusyId(item.id);
            setError(null);
            try {
              const updated =
                kind === 'finance'
                  ? await updateFinancePartnerApplication(item.id, 'REJECTED')
                  : await updateInsurancePartnerQuote(item.id, 'REJECTED');
              replaceItem(updated);
              await refreshStats();
            } catch (err: any) {
              setError(err?.message || 'Could not update this record.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const completeFinanceApplication = async (item: LegacyPartnerItem) => {
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await updateFinancePartnerApplication(item.id, 'COMPLETED');
      replaceItem(updated);
      await refreshStats();
    } catch (err: any) {
      setError(err?.message || 'Could not complete this finance application.');
    } finally {
      setBusyId(null);
    }
  };

  const openPrimaryAction = (item: LegacyPartnerItem) => {
    setActionItem(item);
    setAmountDraft('');
    setCoverageDraft('Comprehensive');
  };

  const submitPrimaryAction = async () => {
    if (!actionItem) return;
    const amount = Number(amountDraft);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(
        kind === 'finance' ? 'Monthly payment required' : 'Annual premium required',
        'Enter a valid amount greater than £0.',
      );
      return;
    }
    if (kind === 'insurance' && coverageDraft.trim().length < 2) {
      Alert.alert('Coverage type required', 'Enter the cover you are offering.');
      return;
    }

    const itemId = actionItem.id;
    setBusyId(itemId);
    setError(null);
    try {
      const updated =
        kind === 'finance'
          ? await updateFinancePartnerApplication(itemId, 'APPROVED', amount)
          : await updateInsurancePartnerQuote(itemId, 'QUOTED', amount, coverageDraft.trim());
      replaceItem(updated);
      setActionItem(null);
      await refreshStats();
    } catch (err: any) {
      setError(err?.message || 'Could not update this record.');
    } finally {
      setBusyId(null);
    }
  };

  const saveSettings = async () => {
    if (companyName.trim().length < 2) {
      Alert.alert('Company name required', 'Enter your company or trading name.');
      return;
    }
    setSavingSettings(true);
    setError(null);
    try {
      const next = await saveLegacyPartnerSettings(kind, {
        companyName: companyName.trim(),
        callbackUrl: callbackUrl.trim() || null,
      });
      applySettings(next);
      Alert.alert('Saved', 'Partner settings have been updated.');
    } catch (err: any) {
      setError(err?.message || 'Could not save partner settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const regenerateKey = () => {
    if (!settings?.isConfigured) {
      Alert.alert('Save settings first', 'Save your company settings before generating an integration key.');
      return;
    }
    Alert.alert(
      'Generate a new integration key?',
      'Any previously issued key will stop working. The full new key is shown only now.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setRegeneratingKey(true);
            setError(null);
            try {
              const next = await regenerateLegacyPartnerKey(kind);
              setRevealedKey(next.apiKey);
              setSettings((current) =>
                current ? { ...current, apiKeyHint: next.apiKeyHint } : current,
              );
            } catch (err: any) {
              setError(err?.message || 'Could not generate a new integration key.');
            } finally {
              setRegeneratingKey(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[ts.container, ts.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={ts.loadingText}>Loading {labels.title}…</Text>
      </View>
    );
  }

  return (
    <View style={[ts.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={ts.header}>
        <View>
          <Text style={ts.eyebrow}>{labels.eyebrow}</Text>
          <Text style={ts.title}>{labels.title}</Text>
        </View>
        <HamburgerButton />
      </View>

      <ScrollView
        contentContainerStyle={[ts.content, { paddingBottom: insets.bottom + 120 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? <ErrorBanner message={error} onRetry={() => void loadInitial()} /> : null}

        <View style={ts.statsGrid}>
          <StatCard label="Pending" value={stats?.pending ?? 0} icon="time-outline" />
          <StatCard
            label={labels.activeLabel}
            value={stats?.approved ?? 0}
            icon="checkmark-circle-outline"
          />
          <StatCard label="Rejected" value={stats?.rejected ?? 0} icon="close-circle-outline" />
          <StatCard
            label="Total value"
            value={formatPartnerCurrency(stats?.totalValue ?? 0)}
            icon="cash-outline"
          />
        </View>

        <View style={ts.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={ts.sectionTitle}>
              {kind === 'finance' ? 'Applications' : 'Quote requests'}
            </Text>
            <Text style={ts.sectionSub}>
              Live records from the same partner API used by CarMazium web.
            </Text>
          </View>
          <Text style={ts.countText}>{total}</Text>
        </View>

        {items.length === 0 ? (
          <EmptyState
            icon={kind === 'finance' ? 'document-text-outline' : 'shield-outline'}
            title={kind === 'finance' ? 'No finance applications yet' : 'No insurance quote requests yet'}
            subtitle="New customer requests will appear here automatically."
          />
        ) : (
          items.map((item) => (
            <PartnerRecordCard
              key={item.id}
              kind={kind}
              item={item}
              busy={busyId === item.id}
              onPrimary={() => openPrimaryAction(item)}
              onReject={() => rejectItem(item)}
              onComplete={() => void completeFinanceApplication(item)}
            />
          ))
        )}

        {items.length < total ? (
          <TouchableOpacity
            style={ts.loadMoreButton}
            onPress={loadMore}
            disabled={loadingMore}
            accessibilityRole="button"
          >
            {loadingMore ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={ts.loadMoreText}>LOAD MORE</Text>
            )}
          </TouchableOpacity>
        ) : null}

        <View style={ts.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={ts.sectionTitle}>Partner settings</Text>
            <Text style={ts.sectionSub}>Company and integration settings stay synced with web.</Text>
          </View>
        </View>

        <View style={ts.settingsCard}>
          <Text style={ts.fieldLabel}>COMPANY / TRADING NAME</Text>
          <TextInput
            style={ts.input}
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="Company name"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={ts.fieldLabel}>CALLBACK URL</Text>
          <TextInput
            style={ts.input}
            value={callbackUrl}
            onChangeText={setCallbackUrl}
            placeholder="https://your-api.example.com/webhook"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            keyboardType="url"
          />

          <TouchableOpacity
            style={ts.primaryButton}
            onPress={saveSettings}
            disabled={savingSettings}
            accessibilityRole="button"
          >
            {savingSettings ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={ts.primaryButtonText}>SAVE PARTNER SETTINGS</Text>
            )}
          </TouchableOpacity>

          <View style={ts.keyDivider} />
          <Text style={ts.fieldLabel}>INTEGRATION KEY</Text>
          <Text selectable style={ts.keyText}>
            {revealedKey || settings?.apiKeyHint || 'No key generated'}
          </Text>
          {revealedKey ? (
            <Text style={ts.keyWarning}>
              Copy this key now. The full value is not returned again after leaving this screen.
            </Text>
          ) : null}

          <TouchableOpacity
            style={ts.secondaryButton}
            onPress={regenerateKey}
            disabled={regeneratingKey || !settings?.isConfigured}
            accessibilityRole="button"
          >
            {regeneratingKey ? (
              <ActivityIndicator color={Colors.textPrimary} />
            ) : (
              <Text style={ts.secondaryButtonText}>REGENERATE INTEGRATION KEY</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={ts.footerActions}>
          <TouchableOpacity
            style={ts.footerButton}
            onPress={() => navigation?.navigate('Messages')}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubbles-outline" size={17} color={Colors.textPrimary} />
            <Text style={ts.footerButtonText}>Messages</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={ts.footerButton}
            onPress={() => navigation?.navigate('Settings')}
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={17} color={Colors.textPrimary} />
            <Text style={ts.footerButtonText}>Account Settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={!!actionItem}
        transparent
        animationType="fade"
        onRequestClose={() => setActionItem(null)}
      >
        <View style={ts.modalBackdrop}>
          <View style={ts.modalCard}>
            <Text style={ts.modalTitle}>
              {kind === 'finance' ? 'Approve finance application' : 'Provide insurance quote'}
            </Text>
            <Text style={ts.modalSub}>
              {actionItem ? applicantName(actionItem) : ''}
            </Text>

            <Text style={ts.fieldLabel}>
              {kind === 'finance' ? 'MONTHLY PAYMENT (£)' : 'ANNUAL PREMIUM (£)'}
            </Text>
            <TextInput
              style={ts.input}
              value={amountDraft}
              onChangeText={setAmountDraft}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
            />

            {kind === 'insurance' ? (
              <>
                <Text style={ts.fieldLabel}>COVERAGE TYPE</Text>
                <TextInput
                  style={ts.input}
                  value={coverageDraft}
                  onChangeText={setCoverageDraft}
                  placeholder="Comprehensive"
                  placeholderTextColor={Colors.textMuted}
                />
              </>
            ) : null}

            <TouchableOpacity
              style={ts.primaryButton}
              onPress={submitPrimaryAction}
              disabled={!!busyId}
              accessibilityRole="button"
            >
              {busyId ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={ts.primaryButtonText}>
                  {kind === 'finance' ? 'APPROVE APPLICATION' : 'SEND QUOTE'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={ts.modalCancel}
              onPress={() => setActionItem(null)}
              disabled={!!busyId}
              accessibilityRole="button"
            >
              <Text style={ts.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const StatCard = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) => (
  <View style={ts.statCard}>
    <Ionicons name={icon as any} size={17} color={Colors.accent} />
    <Text style={ts.statValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    <Text style={ts.statLabel}>{label}</Text>
  </View>
);

const PartnerRecordCard = ({
  kind,
  item,
  busy,
  onPrimary,
  onReject,
  onComplete,
}: {
  kind: LegacyPartnerKind;
  item: LegacyPartnerItem;
  busy: boolean;
  onPrimary: () => void;
  onReject: () => void;
  onComplete: () => void;
}) => {
  const finance = item as FinancePartnerApplication;
  const insurance = item as InsurancePartnerQuote;
  const pending = item.status === 'PENDING';

  return (
    <View style={ts.recordCard}>
      <View style={ts.recordTop}>
        <View style={{ flex: 1 }}>
          <Text style={ts.recordTitle}>{applicantName(item)}</Text>
          <Text style={ts.recordSub}>{item.user?.email || 'No email shown'}</Text>
        </View>
        <View style={ts.statusPill}>
          <Text style={ts.statusText}>{item.status}</Text>
        </View>
      </View>

      <Text style={ts.vehicleTitle}>{item.listing?.title || 'Vehicle unavailable'}</Text>
      <Text style={ts.recordMeta}>
        {formatPartnerCurrency(item.listing?.price ?? 0)} · {formatDate(item.createdAt)}
      </Text>

      {kind === 'finance' ? (
        <Text style={ts.recordMeta}>
          Deposit {formatPartnerCurrency(finance.depositAmount)} · {finance.termMonths} months
          {finance.monthlyPayment ? ` · ${formatPartnerCurrency(finance.monthlyPayment)}/mo` : ''}
        </Text>
      ) : (
        <Text style={ts.recordMeta}>
          Age {insurance.driverAge} · NCB {insurance.ncbYears} yr
          {insurance.quotedPrice ? ` · ${formatPartnerCurrency(insurance.quotedPrice)}/yr` : ''}
          {insurance.coverageType ? ` · ${insurance.coverageType}` : ''}
        </Text>
      )}

      {pending ? (
        <View style={ts.recordActions}>
          <TouchableOpacity
            style={ts.recordPrimary}
            onPress={onPrimary}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={ts.recordPrimaryText}>
                {kind === 'finance' ? 'APPROVE' : 'PROVIDE QUOTE'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={ts.recordReject}
            onPress={onReject}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={ts.recordRejectText}>REJECT</Text>
          </TouchableOpacity>
        </View>
      ) : kind === 'finance' && item.status === 'APPROVED' ? (
        <TouchableOpacity
          style={[ts.recordPrimary, { marginTop: 8 }]}
          onPress={onComplete}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={ts.recordPrimaryText}>MARK COMPLETED</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: {
    marginTop: 12,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.accent,
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 3,
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '48%',
    minHeight: 106,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgSecondary,
    padding: 14,
  },
  statValue: {
    marginTop: 10,
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  statLabel: {
    marginTop: 3,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  sectionHeader: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  sectionSub: {
    marginTop: 4,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  countText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.accent,
  },
  recordCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgSecondary,
    padding: 16,
    gap: 8,
  },
  recordTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  recordTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  recordSub: {
    marginTop: 2,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  vehicleTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  recordMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  recordActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  recordPrimary: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.inline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
  },
  recordPrimaryText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.white,
  },
  recordReject: {
    minWidth: 92,
    minHeight: 42,
    borderRadius: Radius.inline,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  recordRejectText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  loadMoreButton: {
    minHeight: 46,
    borderRadius: Radius.inline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
  },
  loadMoreText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.white,
    letterSpacing: 0.8,
  },
  settingsCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgSecondary,
    padding: 16,
    gap: 10,
  },
  fieldLabel: {
    marginTop: 4,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 48,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgPrimary,
    color: Colors.textPrimary,
    paddingHorizontal: 14,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: Radius.inline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    marginTop: 4,
  },
  primaryButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: Radius.inline,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  secondaryButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  keyDivider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginVertical: 6,
  },
  keyText: {
    borderRadius: Radius.inline,
    backgroundColor: Colors.bgPrimary,
    padding: 12,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  keyWarning: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  footerActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  footerButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgSecondary,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgSecondary,
    padding: 20,
    gap: 11,
  },
  modalTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  modalSub: {
    marginBottom: 4,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  modalCancel: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
