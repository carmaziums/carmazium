import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { Button } from '../../components/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Colors } from '../../constants/colors';
import { FontFamily, Type } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import { getAdminUsers } from '../../lib/adminApi';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';
import { AdminHeader, AdminListSkeleton, adminStyles, openAdminWeb } from './adminShared';
import { accountStatus } from './adminAccountStatus';

type Props = NativeStackScreenProps<MainStackParamList, 'AdminAccounts'>;

// Same page size as web (src/app/dashboard/admin/users/page.tsx `limit = 20`).
const LIMIT = 20;

const keyExtractor = (item: any) => String(item.id);

export const AdminAccountsScreen: React.FC<Props> = ({ navigation }) => {
  const bottomPad = useTabBarClearance();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await getAdminUsers(page, LIMIT, search || undefined);
      setUsers(result.data || []);
      setTotal(result.pagination?.total ?? 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const submitSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput('');
    setPage(1);
    setSearch('');
  };

  const renderItem = useCallback(({ item: u }: { item: any }) => {
    const status = accountStatus(u);
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('AdminAccountDetail', { userId: u.id })}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${u.role}`}
        activeOpacity={0.8}
      >
        <Card padded>
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{String(u.firstName?.[0] || u.email?.[0] || '?').toUpperCase()}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={adminStyles.title} numberOfLines={1}>{name}</Text>
              <Text style={adminStyles.meta} numberOfLines={1}>{u.email}</Text>
              <View style={styles.badges}>
                <Badge kind="neutral">{u.role}</Badge>
                {u.role === 'DEALER' ? (
                  <Badge kind={u.dealerProfile?.isVerified ? 'verified' : 'featured'}>
                    {u.dealerProfile?.isVerified ? 'Verified dealer' : 'Unverified dealer'}
                  </Badge>
                ) : null}
                {status ? <Badge kind="dark">{status}</Badge> : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
          </View>
        </Card>
      </TouchableOpacity>
    );
  }, [navigation]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <View style={adminStyles.screen}>
      <AdminHeader title="Accounts" subtitle={`${total.toLocaleString()} total users`} onBack={() => navigation.goBack()} />
      <FlatList
        data={loading ? [] : users}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[adminStyles.listContent, { paddingBottom: bottomPad }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={searchInput}
                onChangeText={setSearchInput}
                onSubmitEditing={submitSearch}
                placeholder="Search by name or email"
                placeholderTextColor={Colors.inputPlaceholder}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search ? (
                <TouchableOpacity onPress={clearSearch} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Ionicons name="close" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={adminStyles.meta}>
              Read-only here. Role changes, bans, locks and verification are managed on the website.
            </Text>
            <Button label="Manage on website" variant="outline" size="sm"
              onPress={() => void openAdminWeb('/dashboard/admin/users')} />
            {error ? <ErrorBanner message={error} onRetry={() => void load(false)} /> : null}
            {loading ? <AdminListSkeleton count={4} height={84} /> : null}
          </View>
        }
        ListEmptyComponent={
          loading || error ? null : (
            <EmptyState icon="people-outline" title="No users found" subtitle={search ? `No accounts match “${search}”.` : undefined} />
          )
        }
        ListFooterComponent={
          total > 0 ? (
            <View style={styles.pager}>
              <Text style={adminStyles.meta}>
                {`Showing ${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} of ${total.toLocaleString()}`}
              </Text>
              <View style={adminStyles.actions}>
                <Button label="Previous" variant="outline" size="sm" style={adminStyles.actionBtn}
                  disabled={page === 1 || loading} onPress={() => setPage((p) => Math.max(1, p - 1))} />
                <Text style={[adminStyles.meta, styles.pageLabel]}>{`pg ${page} / ${totalPages}`}</Text>
                <Button label="Next" variant="outline" size="sm" style={adminStyles.actionBtn}
                  disabled={page * LIMIT >= total || loading} onPress={() => setPage((p) => p + 1)} />
              </View>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: { gap: 10 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accentAlpha15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: FontFamily.bold, fontSize: Type.body, color: Colors.accent },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBg,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontFamily: FontFamily.regular, fontSize: Type.body, paddingVertical: 10 },
  pager: { marginTop: 8, gap: 4 },
  pageLabel: { alignSelf: 'center' },
});
