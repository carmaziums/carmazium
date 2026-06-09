import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';

// ─────────────────────────── interfaces ───────────────────────────

type TransactionType = 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION' | 'REFUND' | 'HPI_REPORT' | 'LISTING_FEE' | 'BOOST';
type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

interface TransactionListing {
  id: string;
  title: string;
  slug: string;
  images: string[];
  make: string;
  model: string;
  year: number;
}

interface Transaction {
  id: string;
  listingId: string | null;
  userId: string;
  amount: number | string;
  type: TransactionType;
  status: TransactionStatus;
  stripePaymentId: string | null;
  description: string | null;
  createdAt: string;
  listing: TransactionListing | null;
}

// ─────────────────────────── helpers ──────────────────────────────

const formatPrice = (amount: number | string): string => {
  const n = Number(amount);
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const TYPE_LABELS: Record<TransactionType, string> = {
  DEPOSIT: 'Deposit',
  FULL_PAYMENT: 'Full Payment',
  COMMISSION: 'Commission',
  REFUND: 'Refund',
  HPI_REPORT: 'HPI Report',
  LISTING_FEE: 'Listing Fee',
  BOOST: 'Listing Boost',
};

const TYPE_ICONS: Record<TransactionType, string> = {
  DEPOSIT: 'wallet-outline',
  FULL_PAYMENT: 'card-outline',
  COMMISSION: 'briefcase-outline',
  REFUND: 'arrow-undo-outline',
  HPI_REPORT: 'document-text-outline',
  LISTING_FEE: 'pricetag-outline',
  BOOST: 'rocket-outline',
};

const STATUS_STYLE: Record<TransactionStatus, { color: string; bg: string; label: string }> = {
  PENDING: { color: Colors.warning, bg: 'rgba(245,158,11,0.12)', label: 'Pending' },
  COMPLETED: { color: Colors.success, bg: 'rgba(34,197,94,0.12)', label: 'Completed' },
  FAILED: { color: Colors.error, bg: 'rgba(239,68,68,0.12)', label: 'Failed' },
  REFUNDED: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Refunded' },
};

const FILTERS: { key: 'ALL' | TransactionStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'REFUNDED', label: 'Refunded' },
  { key: 'FAILED', label: 'Failed' },
];

// ═══════════════════════════ COMPONENT ════════════════════════════

export const PaymentHistoryScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | TransactionStatus>('ALL');

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient<{ success: boolean; data: Transaction[] }>('/payments/history');
      if (res?.success && Array.isArray(res.data)) {
        setTransactions(res.data);
      }
    } catch {
      // silently fail — empty state covers it
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = filter === 'ALL' ? transactions : transactions.filter((t) => t.status === filter);

  const totalSpent = transactions
    .filter((t) => t.status === 'COMPLETED' && t.type !== 'REFUND')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const renderSkeleton = () => (
    <View style={{ paddingHorizontal: 20, gap: 10 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.txCard, styles.skeletonBlock, { height: 76 }]} />
      ))}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyWrap}>
      <Ionicons name="receipt-outline" size={40} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>
        {filter === 'ALL' ? 'No transactions yet' : `No ${STATUS_STYLE[filter as TransactionStatus]?.label.toLowerCase()} transactions`}
      </Text>
      <Text style={styles.emptySub}>Your payments, deposits and fees will show up here.</Text>
    </View>
  );

  const renderTxCard = (t: Transaction) => {
    const statusStyle = STATUS_STYLE[t.status];
    const thumbnail = t.listing?.images?.[0];

    return (
      <View style={styles.txCard}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.txThumb} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.txThumb, styles.txIconWrap]}>
            <Ionicons name={TYPE_ICONS[t.type]} size={18} color={Colors.textSecondary} />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.txTitle} numberOfLines={1}>
            {t.listing?.title || t.description || TYPE_LABELS[t.type]}
          </Text>
          <View style={styles.txMetaRow}>
            <Text style={styles.txMeta}>{TYPE_LABELS[t.type]}</Text>
            <Text style={styles.txMetaDot}>·</Text>
            <Text style={styles.txMeta}>{formatDate(t.createdAt)}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.txAmount, t.type === 'REFUND' && { color: Colors.success }]}>
            {t.type === 'REFUND' ? '+' : ''}{formatPrice(t.amount)}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusPillText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.06)', 'rgba(10,10,12,0)', '#0A0A0C']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ height: insets.top }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.75} onPress={() => navigation?.goBack()}>
          <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment History</Text>
        <View style={{ width: 36 }} />
      </View>

      {!loading && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL SPENT</Text>
          <Text style={styles.summaryValue}>{formatPrice(totalSpent)}</Text>
          <Text style={styles.summarySub}>{transactions.length} transaction{transactions.length === 1 ? '' : 's'}</Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={{ flexGrow: 0 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            activeOpacity={0.8}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
        >
          {renderSkeleton()}
        </ScrollView>
      ) : (
        // Virtualized — a long-lived account can accumulate hundreds of
        // transactions, so we only mount rows near the viewport.
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => renderTxCard(item)}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[
            { paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 32 },
            filtered.length === 0 && { flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

// ═══════════════════════════ STYLES ═══════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },

  summaryCard: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: 26,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
    marginTop: 6,
  },
  summarySub: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.semiBold,
  },

  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  txThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.bgTertiary,
  },
  txIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 5,
  },
  txMeta: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  txMetaDot: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  txAmount: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  statusPill: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 9,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.3,
  },

  skeletonBlock: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
