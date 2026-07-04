import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';

// The backend keeps a single Offer row per negotiation, not one row per
// round. So a full round-by-round ledger isn't derivable — we can only
// show three anchor points:
//   1. The buyer's initial offer (amount, createdAt)
//   2. The seller's LATEST counter (sellerCounterAmount, if any)
//   3. The buyer's LATEST counter-back (buyerCounterAmount, if any)
// counterAttemptsBuyer / counterAttemptsSeller are shown as "×N" badges
// when either side has iterated more than once. lastCounteredBy tells us
// which row to mark as the current "you're waiting on the other side".

export interface LedgerOffer {
  amount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  status?: string;
  sellerCounterAmount?: number | null;
  buyerCounterAmount?: number | null;
  /** Legacy single-field counter. Fall back to this if the structured pair is unset. */
  counterAmount?: number | null;
  counterAttemptsBuyer?: number | null;
  counterAttemptsSeller?: number | null;
  lastCounteredBy?: 'BUYER' | 'SELLER' | null;
  counterExpiresAt?: string | null;
  buyerName?: string;
  sellerName?: string;
}

interface Props {
  offer: LedgerOffer;
  /** Whether the current viewer is the seller (affects "You"/"Buyer" wording). */
  viewerRole?: 'BUYER' | 'SELLER';
}

const fmtPrice = (n: number) => `£${n.toLocaleString('en-GB')}`;

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtExpiry(iso?: string | null): { text: string; tone: 'muted' | 'warning' | 'error' } | null {
  if (!iso) return null;
  const msLeft = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(msLeft)) return null;
  if (msLeft <= 0) return { text: 'Counter expired', tone: 'error' };
  const mins = Math.floor(msLeft / 60_000);
  if (mins < 60) return { text: `Expires in ${mins}m`, tone: 'warning' };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { text: `Expires in ${hrs}h`, tone: 'warning' };
  const days = Math.floor(hrs / 24);
  return { text: `Expires in ${days}d`, tone: 'muted' };
}

interface Row {
  label: string;
  amount: number;
  timestamp?: string | null;
  attemptCount?: number;
  isLastMove: boolean;
  side: 'BUYER' | 'SELLER';
}

export const CounterLedger: React.FC<Props> = ({ offer, viewerRole = 'BUYER' }) => {
  const rows: Row[] = [];

  const buyerLabel = viewerRole === 'BUYER' ? 'You offered' : 'Buyer offered';
  const buyerCounterLabel = viewerRole === 'BUYER' ? 'You countered' : 'Buyer countered';
  const sellerCounterLabel = viewerRole === 'SELLER' ? 'You countered' : 'Seller countered';

  rows.push({
    label: buyerLabel,
    amount: offer.amount,
    timestamp: offer.createdAt,
    isLastMove: false,
    side: 'BUYER',
  });

  const sellerCounter = offer.sellerCounterAmount ?? offer.counterAmount ?? null;
  const buyerCounter = offer.buyerCounterAmount ?? null;

  if (sellerCounter != null) {
    rows.push({
      label: sellerCounterLabel,
      amount: sellerCounter,
      // We don't have per-round timestamps — updatedAt is a reasonable proxy
      // when the seller was the last to move. Otherwise leave it blank.
      timestamp: offer.lastCounteredBy === 'SELLER' ? offer.updatedAt : null,
      attemptCount: offer.counterAttemptsSeller ?? undefined,
      isLastMove: offer.lastCounteredBy === 'SELLER',
      side: 'SELLER',
    });
  }

  if (buyerCounter != null) {
    rows.push({
      label: buyerCounterLabel,
      amount: buyerCounter,
      timestamp: offer.lastCounteredBy === 'BUYER' ? offer.updatedAt : null,
      attemptCount: offer.counterAttemptsBuyer ?? undefined,
      isLastMove: offer.lastCounteredBy === 'BUYER',
      side: 'BUYER',
    });
  }

  // Mark the first row as the last move if there are no counters and the
  // status is PENDING — the initial offer is still the latest event.
  if (rows.length === 1 && (offer.status === 'PENDING' || !offer.status)) {
    rows[0].isLastMove = true;
  }

  const expiry = offer.status === 'COUNTERED' ? fmtExpiry(offer.counterExpiresAt) : null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="git-network-outline" size={12} color={Colors.textMuted} />
        <Text style={styles.headerLabel}>NEGOTIATION HISTORY</Text>
        {expiry && (
          <View
            style={[
              styles.expiryChip,
              expiry.tone === 'warning' && styles.expiryChipWarning,
              expiry.tone === 'error' && styles.expiryChipError,
            ]}
          >
            <Ionicons
              name="time-outline"
              size={10}
              color={
                expiry.tone === 'error'
                  ? Colors.error
                  : expiry.tone === 'warning'
                    ? Colors.warning
                    : Colors.textMuted
              }
            />
            <Text
              style={[
                styles.expiryChipText,
                expiry.tone === 'warning' && { color: Colors.warning },
                expiry.tone === 'error' && { color: Colors.error },
              ]}
            >
              {expiry.text}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.timeline}>
        {rows.map((row, i) => (
          <View key={`${row.side}-${i}`} style={styles.timelineRow}>
            <View style={styles.gutter}>
              <View
                style={[
                  styles.dot,
                  row.side === 'SELLER' && styles.dotSeller,
                  row.isLastMove && styles.dotLastMove,
                ]}
              />
              {i < rows.length - 1 && <View style={styles.connector} />}
            </View>
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                {row.attemptCount != null && row.attemptCount > 1 && (
                  <Text style={styles.attemptCount}>×{row.attemptCount}</Text>
                )}
                {row.isLastMove && (
                  <View style={styles.currentPill}>
                    <Text style={styles.currentPillText}>CURRENT</Text>
                  </View>
                )}
              </View>
              <View style={styles.rowBottom}>
                <Text style={styles.rowAmount}>{fmtPrice(row.amount)}</Text>
                {row.timestamp && (
                  <Text style={styles.rowTimestamp}>· {fmtDate(row.timestamp)}</Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 1,
    flex: 1,
  },
  expiryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  expiryChipWarning: {
    borderColor: 'rgba(245,158,11,0.28)',
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  expiryChipError: {
    borderColor: 'rgba(239,68,68,0.32)',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  expiryChipText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gutter: {
    width: 10,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
    marginTop: 5,
  },
  dotSeller: {
    backgroundColor: Colors.warning,
  },
  dotLastMove: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  connector: {
    flex: 1,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 2,
    marginBottom: 2,
  },
  rowBody: {
    flex: 1,
    paddingVertical: 2,
    paddingBottom: 8,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  attemptCount: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  currentPill: {
    backgroundColor: 'rgba(220,31,38,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(220,31,38,0.32)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  currentPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 8,
    color: Colors.accent,
    letterSpacing: 0.6,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  rowAmount: {
    fontFamily: FontFamily.mono,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  rowTimestamp: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.textMuted,
  },
});
