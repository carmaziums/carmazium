import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';

// Canonical web layout: src/app/dashboard/dealer/page.tsx.
// Keep the same API and range query as FlexiblePeriodControl and do not
// mislabel /dealers/analytics?range=7d as current dashboard-period data.
type RangeUnit = 'days' | 'months' | 'years';
type Range = { allTime: boolean; value: number; unit: RangeUnit; compare: boolean };
export type DealerHomeDestination =
  | 'add-vehicle' | 'customers' | 'buy-and-bid'
  | 'partner-services' | 'performance' | 'stock';

interface Comparison {
  previous: number;
  percentChange: number | null;
}
interface DashboardSummary {
  isVerified?: boolean;
  activeListings?: number;
  totalViews?: number;
  activeLeads?: number;
  soldListings?: number;
  accountCreatedAt?: string | null;
  range?: { label?: string };
  comparison?: {
    available?: boolean;
    totalViews?: Comparison;
    soldListings?: Comparison;
  };
}
interface Props {
  userName: string;
  canManageInventory: boolean;
  canManageCrm: boolean;
  canViewTrade: boolean;
  canViewAnalytics: boolean;
  onNavigate: (destination: DealerHomeDestination) => void;
  refreshToken?: number;
}

const PRESETS: ReadonlyArray<{ label: string; value?: number; unit?: RangeUnit; allTime?: boolean }> = [
  { label: '7D', value: 7, unit: 'days' },
  { label: '30D', value: 30, unit: 'days' },
  { label: '3M', value: 3, unit: 'months' },
  { label: '1Y', value: 1, unit: 'years' },
  { label: 'All', allTime: true },
];
const initialRange: Range = { allTime: false, value: 30, unit: 'days', compare: false };
const valueLabel = (value: number | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-GB') : '—';

const comparisonLabel = (comparison: Comparison | undefined, enabled: boolean): string | null => {
  if (!enabled) return null;
  if (!comparison) return 'No earlier account data available';
  if (comparison.percentChange === null) return `${valueLabel(comparison.previous)} in previous period`;
  return `${comparison.percentChange > 0 ? '+' : ''}${comparison.percentChange}% vs previous period`;
};

export const DealerWebParityOverview: React.FC<Props> = ({
  userName, canManageInventory, canManageCrm, canViewTrade, canViewAnalytics,
  onNavigate, refreshToken = 0,
}) => {
  const [range, setRange] = useState<Range>(initialRange);
  const [draftAmount, setDraftAmount] = useState('30');
  const [draftUnit, setDraftUnit] = useState<RangeUnit>('days');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (range.allTime) params.set('range', 'all');
    else {
      params.set('rangeValue', String(range.value));
      params.set('rangeUnit', range.unit);
    }
    if (range.compare) params.set('compare', '1');
    return params.toString();
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    // Same authenticated read-only endpoint as the website's dealer Home.
    apiClient<{ data?: DashboardSummary }>(`/dashboard/dealer?${query}`)
      .then(result => {
        if (cancelled) return;
        if (!result?.data || typeof result.data !== 'object') {
          throw new Error('Dashboard response unavailable');
        }
        setSummary(result.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
        // Keep previously loaded numbers, visibly marked stale, rather than
        // inventing zeros on network errors (matches website error semantics).
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [query, refreshToken]);

  const rangeLabel = summary?.range?.label ?? (
    range.allTime ? 'All time' : `Last ${range.value} ${range.unit}`
  );
  const displayMetric = (value: number | undefined) => {
    if (!summary) return '—';
    return valueLabel(value);
  };
  const applyCustom = () => {
    const raw = Number(draftAmount);
    const normalized = Math.min(10000, Math.max(1, Math.floor(Number.isFinite(raw) ? raw : 1)));
    setDraftAmount(String(normalized));
    setRange(current => ({ ...current, allTime: false, value: normalized, unit: draftUnit }));
  };

  const metricItems: {
    title: string; value?: number; icon: string; color: string;
    status: string; detail: string; comparison?: string | null;
    destination?: DealerHomeDestination;
  }[] = [
    { title: 'Active Stock', value: summary?.activeListings, icon: 'car-outline',
      color: Colors.accent, status: 'Current', detail: 'Live stock now', destination: 'stock' },
    { title: 'Vehicle Views', value: summary?.totalViews, icon: 'eye-outline',
      color: Colors.infoBlueLight, status: 'Tracked', detail: rangeLabel,
      comparison: comparisonLabel(summary?.comparison?.available ? summary.comparison.totalViews : undefined, range.compare) },
    ...(canManageCrm ? [{ title: 'Active Leads', value: summary?.activeLeads,
      icon: 'people-outline', color: Colors.warning, status: 'Current', detail: 'Open pipeline',
      destination: 'customers' as DealerHomeDestination }] : []),
    { title: 'Vehicles Sold', value: summary?.soldListings, icon: 'trending-up-outline',
      color: Colors.success, status: 'Period', detail: rangeLabel, destination: 'stock',
      comparison: comparisonLabel(summary?.comparison?.available ? summary.comparison.soldListings : undefined, range.compare) },
  ];

  const actions: { title: string; description: string; icon: string; destination: DealerHomeDestination; show: boolean }[] = [
    { title: 'Add vehicle', description: 'Create one new retail or auction listing.',
      icon: 'add-circle-outline', destination: 'add-vehicle', show: canManageInventory },
    { title: 'Customers', description: 'Enquiries, offers and follow-up in one sales workflow.',
      icon: 'people-outline', destination: 'customers', show: canManageCrm },
    { title: 'Buy & bid', description: 'Live auctions, your bids and completed purchases.',
      icon: 'hammer-outline', destination: 'buy-and-bid', show: canViewTrade },
    { title: 'Partner services', description: 'Delivery, inspections, finance and warranty services.',
      icon: 'business-outline', destination: 'partner-services', show: true },
    { title: 'Performance', description: 'Real dealership analytics, sales and revenue.',
      icon: 'bar-chart-outline', destination: 'performance', show: canViewAnalytics },
  ];

  return (
    <View style={styles.main}>
      <View style={styles.hero}>
        <View style={styles.heroHeading}>
          <View style={styles.heroIcon}>
            <Ionicons name="business-outline" size={24} color={Colors.textPrimary} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>DEALER COMMAND CENTRE</Text>
            <Text style={styles.heroSubtitle}>RUN YOUR DEALERSHIP FROM ONE PLACE, {userName}</Text>
            {summary?.isVerified === true && (
              <View style={styles.verifiedLine}>
                <Ionicons name="shield-checkmark-outline" size={14} color={Colors.warning} />
                <Text style={styles.verifiedText}>Verified Dealer</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.sectionIntro}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <Text style={styles.sectionHint}>
          Choose days, months or years, or view everything since this dealer account was created.
          Compare with the immediately preceding period.
        </Text>
      </View>

      <View style={styles.rangePanel}>
        <View style={styles.presetRow}>
          {PRESETS.map(preset => {
            const active = preset.allTime ? range.allTime
              : !range.allTime && range.value === preset.value && range.unit === preset.unit;
            return (
              <TouchableOpacity
                key={preset.label}
                style={[styles.preset, active && styles.presetSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={preset.allTime ? 'All time' : preset.label}
                onPress={() => setRange(previous => ({
                  ...previous, allTime: Boolean(preset.allTime),
                  value: preset.value ?? previous.value, unit: preset.unit ?? previous.unit,
                }))}
              >
                <Text style={[styles.presetText, active && styles.presetTextSelected]}>{preset.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.customRow}>
          <TextInput
            style={styles.amountInput}
            value={draftAmount}
            onChangeText={setDraftAmount}
            onSubmitEditing={applyCustom}
            keyboardType="number-pad"
            accessibilityLabel="Custom reporting range amount"
            maxLength={5}
          />
          {(['days', 'months', 'years'] as const).map(unit => (
            <TouchableOpacity
              key={unit}
              onPress={() => setDraftUnit(unit)}
              accessibilityRole="button"
              accessibilityState={{ selected: draftUnit === unit }}
              style={[styles.unitButton, draftUnit === unit && styles.unitSelected]}
            >
              <Text style={[styles.unitText, draftUnit === unit && styles.unitTextSelected]}>
                {unit === 'days' ? 'Days' : unit === 'months' ? 'Months' : 'Years'}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={applyCustom} style={styles.applyButton} accessibilityRole="button">
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          accessibilityRole="switch"
          accessibilityState={{ checked: range.compare }}
          accessibilityLabel="Compare previous period"
          style={styles.compareRow}
          onPress={() => setRange(previous => ({ ...previous, compare: !previous.compare }))}
        >
          <Ionicons name={range.compare ? 'checkbox' : 'square-outline'} size={21}
            color={range.compare ? Colors.accent : Colors.textMuted} />
          <Text style={styles.compareText}>Compare previous</Text>
        </TouchableOpacity>
        {range.allTime && summary?.accountCreatedAt && (
          <Text style={styles.accountSince}>
            All available data since {new Date(summary.accountCreatedAt).toLocaleDateString('en-GB')}
          </Text>
        )}
      </View>

      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          Dashboard statistics could not be refreshed. {summary
            ? 'Previously loaded values are shown below.'
            : 'Values are hidden until data is available.'}
        </Text>
      )}
      {loading && !summary && (
        <View style={styles.loadingLine}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.loadingText}>Loading your dashboard…</Text>
        </View>
      )}
      <View style={styles.metrics}>
        {metricItems.map(item => {
          const content = (
            <>
              <View style={styles.metricTop}>
                <Ionicons name={item.icon as any} size={19} color={item.color} />
                <Text style={styles.metricStatus}>{item.status}</Text>
              </View>
              <Text style={styles.metricValue}>{displayMetric(item.value)}</Text>
              <Text style={styles.metricTitle}>{item.title}</Text>
              <Text style={styles.metricDetail}>{item.detail}</Text>
              {!!item.comparison && <Text style={styles.comparison}>{item.comparison}</Text>}
            </>
          );
          return item.destination ? (
            <TouchableOpacity
              key={item.title} style={styles.metricCard}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}: ${displayMetric(item.value)}. Open ${item.destination}`}
              onPress={() => onNavigate(item.destination!)}
              activeOpacity={0.8}
            >{content}</TouchableOpacity>
          ) : (
            <View key={item.title} style={styles.metricCard}>{content}</View>
          );
        })}
      </View>

      <View style={styles.actionSection}>
        <Text style={styles.actionsTitle}>Main actions</Text>
        <Text style={styles.sectionHint}>
          One entry point for each job. Related tools live inside that area.
        </Text>
        {actions.filter(action => action.show).map(action => (
          <TouchableOpacity
            key={action.destination}
            style={styles.actionCard}
            onPress={() => onNavigate(action.destination)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={action.title}
          >
            <View style={styles.actionIcon}>
              <Ionicons name={action.icon as any} size={22} color={Colors.accent} />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionDescription}>{action.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  main: { paddingHorizontal: 20, paddingTop: 12, gap: 18 },
  hero: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 16, padding: 20, overflow: 'hidden' },
  heroHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroIcon: { width: 46, height: 46, backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { fontFamily: FontFamily.extraBold, fontSize: 22,
    lineHeight: 27, letterSpacing: -0.6, color: Colors.textPrimary },
  heroSubtitle: { fontFamily: FontFamily.bold, fontSize: 10, letterSpacing: 1.1,
    lineHeight: 17, color: Colors.textMuted, marginTop: 4 },
  verifiedLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  verifiedText: { fontFamily: FontFamily.bold, fontSize: 11, color: Colors.warning },
  sectionIntro: { gap: 5 },
  sectionTitle: { fontFamily: FontFamily.extraBold, fontSize: 24,
    color: Colors.textPrimary, letterSpacing: -0.5 },
  sectionHint: { color: Colors.textMuted, fontFamily: FontFamily.regular,
    fontSize: 12, lineHeight: 19 },
  rangePanel: { borderRadius: 16, borderColor: Colors.borderSubtle, borderWidth: 1,
    backgroundColor: Colors.bgCard, padding: 10, gap: 10 },
  presetRow: { flexDirection: 'row', gap: 5 },
  preset: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 9, backgroundColor: Colors.bgElevated },
  presetSelected: { backgroundColor: Colors.accent },
  presetText: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: 11 },
  presetTextSelected: { color: Colors.white },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  amountInput: { minWidth: 55, width: 60, height: 42, borderRadius: 8,
    backgroundColor: Colors.bgElevated, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.borderSubtle, paddingHorizontal: 8,
    fontFamily: FontFamily.bold, fontSize: 13 },
  unitButton: { height: 42, paddingHorizontal: 7, backgroundColor: Colors.bgElevated,
    borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  unitSelected: { borderWidth: 1, borderColor: Colors.accent },
  unitText: { color: Colors.textMuted, fontFamily: FontFamily.medium, fontSize: 11 },
  unitTextSelected: { color: Colors.textPrimary },
  applyButton: { backgroundColor: Colors.accentAlpha15, borderRadius: 8, height: 42,
    justifyContent: 'center', paddingHorizontal: 11 },
  applyText: { color: Colors.accent, fontFamily: FontFamily.bold, fontSize: 12 },
  compareRow: { flexDirection: 'row', gap: 8, alignItems: 'center',
    alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 8 },
  compareText: { fontFamily: FontFamily.medium, fontSize: 12, color: Colors.textSecondary },
  accountSince: { color: Colors.textMuted, fontFamily: FontFamily.medium, fontSize: 11 },
  error: { color: Colors.warning, backgroundColor: Colors.warningAlpha12, padding: 12,
    borderWidth: 1, borderColor: Colors.warningAlpha30, borderRadius: 12,
    fontFamily: FontFamily.semiBold, fontSize: 12 },
  loadingLine: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  loadingText: { fontFamily: FontFamily.medium, color: Colors.textSecondary, fontSize: 12 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { width: '48%', flexGrow: 1, minHeight: 145, padding: 14,
    backgroundColor: Colors.bgCard, borderRadius: 16,
    borderColor: Colors.borderSubtle, borderWidth: 1 },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricStatus: { fontFamily: FontFamily.medium, fontSize: 10, color: Colors.textMuted },
  metricValue: { fontFamily: FontFamily.extraBold, fontSize: 25,
    color: Colors.textPrimary, marginTop: 13 },
  metricTitle: { fontFamily: FontFamily.bold, color: Colors.textPrimary,
    fontSize: 12, marginTop: 6 },
  metricDetail: { fontFamily: FontFamily.regular, fontSize: 11,
    color: Colors.textMuted, marginTop: 4 },
  comparison: { fontFamily: FontFamily.medium, fontSize: 10,
    color: Colors.textSecondary, marginTop: 5 },
  actionSection: { gap: 10 },
  actionsTitle: { fontFamily: FontFamily.extraBold, fontSize: 19,
    color: Colors.textPrimary, textTransform: 'uppercase' },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 13,
    minHeight: 82, padding: 16, borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 16, backgroundColor: Colors.bgCard },
  actionIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.accentAlpha15,
    backgroundColor: Colors.accentAlpha10, borderRadius: 12 },
  actionText: { flex: 1, gap: 4 },
  actionTitle: { fontFamily: FontFamily.bold, color: Colors.textPrimary, fontSize: 14 },
  actionDescription: { fontFamily: FontFamily.regular, color: Colors.textMuted,
    fontSize: 12, lineHeight: 18 },
});
