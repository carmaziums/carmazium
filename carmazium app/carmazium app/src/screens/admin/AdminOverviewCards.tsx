import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { Card } from '../../components/ui/Card';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Colors } from '../../constants/colors';
import { TextPresets, Type } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';
import { getPendingHandovers, type AdminStats } from '../../lib/adminApi';
import { adminStyles, formatPrice, openAdminWeb } from './adminShared';

const cards = [
  { id: 'users', label: 'Users', path: '/dashboard/admin/users', description: 'All platform accounts' },
  { id: 'listings', label: 'Listings', path: '/dashboard/admin/listings', description: 'All marketplace listings' },
  { id: 'activeListings', label: 'Active listings', path: '/dashboard/admin/listings', description: 'Vehicles currently live' },
  { id: 'sold', label: 'Sold', path: '/dashboard/admin/listings', description: 'Completed vehicle sales' },
  { id: 'auctions', label: 'Auctions', path: '/dashboard/admin/auctions', description: 'All auction records' },
  { id: 'activeAuctions', label: 'Active auctions', path: '/dashboard/admin/auctions', description: 'Auctions running now' },
  { id: 'endedAuctions', label: 'Ended auctions', path: '/dashboard/admin/auctions', description: 'Completed auction runs' },
  { id: 'bids', label: 'Bids', path: '/dashboard/admin/auctions', description: 'All auction bid activity' },
  { id: 'revenue', label: 'Revenue', path: '/dashboard/admin/transactions', description: 'Retained platform revenue' },
  { id: 'pendingHandovers', label: 'Handovers', path: '/dashboard/admin/handovers', description: 'Proofs awaiting admin review' },
  { id: 'transactions', label: 'Transactions', path: '/dashboard/admin/transactions', description: 'Payments, fees and refunds' },
  { id: 'hpi', label: 'Vehicle history reports', path: '/dashboard/admin/hpi', description: 'Prepare and upload reports' },
  { id: 'dealerKyc', label: 'Dealer KYC', path: '/dashboard/admin/dealer-verification', description: 'Review dealer verification' },
  { id: 'messages', label: 'Messages', path: '/dashboard/admin/messages', description: 'Admin support and conversations' },
  { id: 'analytics', label: 'Analytics', path: '/dashboard/admin/analytics', description: 'Platform and valuation insights' },
  { id: 'services', label: 'Trade services', path: '/dashboard/admin/services', description: 'Providers, jobs and leads' },
  { id: 'cancellations', label: 'Cancellations', path: '/dashboard/admin/cancellations', description: 'Review sale cancellations' },
  { id: 'blog', label: 'Blog', path: '/dashboard/admin/blog', description: 'Manage CarMazium articles' },
] as const;
type CardId = typeof cards[number]['id'];
const defaults: CardId[] = ['users', 'listings', 'sold', 'auctions', 'bids', 'revenue'];

function savedCards(value: unknown): CardId[] {
  if (!Array.isArray(value)) return defaults;
  return [...new Set(value.filter((id): id is CardId => cards.some(card => card.id === id)))];
}

const statKeys: Partial<Record<CardId, keyof AdminStats>> = {
  users: 'totalUsers', listings: 'totalListings', activeListings: 'activeListings', sold: 'soldListings',
  auctions: 'totalAuctions', activeAuctions: 'activeAuctions', endedAuctions: 'endedAuctions', bids: 'totalBids',
};

export function AdminOverviewCards({ stats }: { stats: AdminStats | null }) {
  const [visible, setVisible] = useState<CardId[]>(defaults);
  const [draft, setDraft] = useState<CardId[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [handovers, setHandovers] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoaded(false);
    setError('');
    setDraft(null);
    apiClient<{ data: { preferences?: { adminDashboardCardIds?: unknown } } }>('/users/me')
      .then(({ data }) => {
        if (active) {
          setVisible(savedCards(data.preferences?.adminDashboardCardIds));
          setLoaded(true);
        }
      })
      .catch(() => { if (active) setError('Could not load your dashboard card settings.'); });
    return () => { active = false; };
  }, [retry]));

  const showHandovers = visible.includes('pendingHandovers');
  useFocusEffect(useCallback(() => {
    if (!showHandovers) return;
    let active = true;
    setHandovers(null);
    getPendingHandovers().then(rows => { if (active) setHandovers(rows.length); })
      .catch(() => { if (active) setHandovers(null); });
    return () => { active = false; };
  }, [showHandovers, stats]));

  async function save() {
    if (!loaded || !draft || saving) return;
    setSaving(true);
    setError('');
    try {
      await apiClient('/users/me', {
        method: 'PATCH', body: JSON.stringify({ preferences: { adminDashboardCardIds: draft } }),
      });
      setVisible(draft);
      setDraft(null);
    } catch {
      setError('Could not save dashboard cards. Your choices are ready to retry.');
    } finally {
      setSaving(false);
    }
  }

  function value(id: CardId): string {
    if (id === 'pendingHandovers') return handovers?.toLocaleString('en-GB') ?? '—';
    if (id === 'revenue') return stats ? formatPrice(stats.totalRevenue) : '—';
    const key = statKeys[id];
    return key ? stats?.[key]?.toLocaleString('en-GB') ?? '—' : 'Open';
  }

  return (
    <View style={styles.section}>
      <Text style={adminStyles.sectionLabel}>Overview</Text>
      {error ? <ErrorBanner message={error} onRetry={draft ? save : () => setRetry(n => n + 1)} /> : null}
      {draft ? (
        <Card padded>
          {cards.map(card => (
            <TouchableOpacity key={card.id} accessibilityRole="checkbox" accessibilityLabel={card.label}
              accessibilityState={{ checked: draft.includes(card.id), disabled: saving }} disabled={saving}
              style={styles.choice} onPress={() => setDraft(ids => {
                if (!ids) return ids;
                return ids.includes(card.id) ? ids.filter(id => id !== card.id) : [...ids, card.id];
              })}>
              <Text style={adminStyles.body}>{draft.includes(card.id) ? '☑' : '☐'}  {card.label}</Text>
            </TouchableOpacity>
          ))}
          <Button label="Reset to defaults" variant="outline" disabled={saving} onPress={() => setDraft(defaults)} />
          <Button label="Save cards" loading={saving} disabled={saving} onPress={save} />
          <Button label="Cancel" variant="outline" disabled={saving} onPress={() => { setDraft(null); setError(''); }} />
        </Card>
      ) : (
        <>
          <Button label="Customize cards" variant="outline" size="sm" disabled={!loaded} onPress={() => setDraft(visible)} />
          {!visible.length && <Text style={adminStyles.body}>No cards selected</Text>}
          <View style={styles.grid}>
            {visible.map(id => {
              const card = cards.find(item => item.id === id)!;
              return (
                <TouchableOpacity key={id} style={styles.tile} accessibilityRole="button"
                  accessibilityLabel={`Open ${card.label} admin page`} onPress={() => void openAdminWeb(card.path)}>
                  <Card style={styles.surface} padded>
                    <Text style={adminStyles.fieldLabel}>{card.label}</Text>
                    <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value(id)}</Text>
                    <Text style={adminStyles.meta} numberOfLines={1}>{card.description}</Text>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1 },
  surface: { flex: 1 },
  choice: { justifyContent: 'center', minHeight: 44 },
  value: { ...TextPresets.monoFigure, fontSize: Type.h4, color: Colors.textPrimary, marginVertical: 6 },
});
