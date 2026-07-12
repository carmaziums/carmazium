import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { mapApiListingToCarListing, ApiListing, BackendPaginatedResponse } from '../../lib/listingsApi';
import { Colors } from '../../constants/colors';
import {FontFamily, FontSize } from '../../constants/typography';

import { IconButton } from '../../components/IconButton';
// ─────────────────────────── interfaces ───────────────────────────

interface SellerProfileData {
  profile: {
    id: string;
    userId: string;
    reliabilityScore: number;
    totalSales: number;
    totalListings: number;
    responseRate: number;
    avgResponseHours: number | null;
    createdAt: string;
  };
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImage: string | null;
    role: string;
    createdAt: string;
  };
  reviewCount: number;
  averageRating: number;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImage: string | null;
  };
  listingId: string | null;
}

// ─────────────────────────── helpers ──────────────────────────────

const getName = (p: { firstName?: string | null; lastName?: string | null } | null | undefined): string => {
  if (!p) return 'Carmazium User';
  const parts = [p.firstName, p.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Carmazium User';
};

const getInitials = (p: { firstName?: string | null; lastName?: string | null } | null | undefined): string => {
  if (!p) return '?';
  const a = p.firstName?.[0] ?? '';
  const b = p.lastName?.[0] ?? '';
  return (a + b).toUpperCase() || '?';
};

const formatPrice = (price?: number): string =>
  price != null ? `£${price.toLocaleString('en-GB')}` : '—';

const memberSince = (iso?: string): string => {
  if (!iso) return '—';
  return new Date(iso).getFullYear().toString();
};

const timeAgo = (iso?: string): string => {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 1) return 'today';
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
};

const Stars: React.FC<{ rating: number; size?: number }> = ({ rating, size = 13 }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Ionicons
        key={i}
        name={rating >= i ? 'star' : rating >= i - 0.5 ? 'star-half' : 'star-outline'}
        size={size}
        color={Colors.warning}
      />
    ))}
  </View>
);

// ═══════════════════════════ COMPONENT ════════════════════════════

export const SellerProfileScreen: React.FC<{ navigation?: any; route?: any }> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const sellerId: string | undefined = route?.params?.sellerId;

  const [profile, setProfile] = useState<SellerProfileData | null>(null);
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchData = useCallback(async () => {
    if (!sellerId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      const profileRes = await apiClient<{ success: boolean; data: SellerProfileData }>(`/sellers/${sellerId}`);
      if (!profileRes?.success || !profileRes.data) {
        setNotFound(true);
        return;
      }
      const data = profileRes.data;
      setProfile(data);

      const [listingsRes, reviewsRes] = await Promise.allSettled([
        apiClient<BackendPaginatedResponse<ApiListing>>(`/sellers/${sellerId}/listings?limit=6`),
        apiClient<BackendPaginatedResponse<ReviewItem>>(`/sellers/${data.profile.id}/reviews?limit=5`),
      ]);

      if (listingsRes.status === 'fulfilled' && Array.isArray(listingsRes.value?.data)) {
        setListings(listingsRes.value.data);
      }
      if (reviewsRes.status === 'fulfilled' && Array.isArray(reviewsRes.value?.data)) {
        setReviews(reviewsRes.value.data);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openListing = (listing: ApiListing) => {
    navigation?.navigate('VehicleDetail', { listing: mapApiListingToCarListing(listing) });
  };

  // ─────────────── render ───────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.centerFill]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <View style={[styles.container, styles.centerFill]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={{ height: insets.top }} />
        <IconButton style={[styles.backBtn, { position: 'absolute', top: insets.top + 10, left: 16 }]} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />
        <Ionicons name="person-circle-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>Seller not found</Text>
        <Text style={styles.emptySub}>This profile may have been removed.</Text>
      </View>
    );
  }

  const { user, profile: stats, reviewCount, averageRating } = profile;
  const isDealer = user.role === 'DEALER';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha06, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ height: insets.top }} />

      {/* Header */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>Seller Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          {user.profileImage ? (
            <Image source={{ uri: user.profileImage }} style={styles.avatarImg} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <LinearGradient colors={[Colors.darkBlue_2d3c63, Colors.darkBlue_1a2238]} style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(user)}</Text>
            </LinearGradient>
          )}
          <View style={styles.heroNameRow}>
            <Text style={styles.heroName}>{getName(user)}</Text>
            {isDealer && <Ionicons name="checkmark-circle" size={16} color={Colors.infoBlue} style={{ marginLeft: 6 }} />}
          </View>
          <Text style={styles.heroSub}>
            {isDealer ? 'Verified Dealer' : 'Private Seller'} · Member since {memberSince(user.createdAt)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
            <Stars rating={averageRating} />
            <Text style={styles.ratingText}>
              {averageRating.toFixed(1)} ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
            </Text>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalSales}</Text>
            <Text style={styles.statLabel}>TOTAL SALES</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalListings}</Text>
            <Text style={styles.statLabel}>LISTINGS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{Math.round(stats.responseRate)}%</Text>
            <Text style={styles.statLabel}>RESPONSE RATE</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{Math.round(stats.reliabilityScore)}</Text>
            <Text style={styles.statLabel}>RELIABILITY</Text>
          </View>
        </View>

        {/* Listings */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>LISTINGS</Text>
        </View>
        {listings.length === 0 ? (
          <Text style={styles.sectionEmptyText}>No active listings right now.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {listings.map((l) => (
              <TouchableOpacity key={l.id} style={styles.listingCard} activeOpacity={0.85} onPress={() => openListing(l)}>
                <Image
                  source={{ uri: l.images?.[0] || 'https://placehold.co/400x260/16161b/5C5C6B?text=No+Image' }}
                  style={styles.listingImg}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
                <View style={{ padding: 10 }}>
                  <Text style={styles.listingTitle} numberOfLines={1}>{l.title}</Text>
                  <Text style={styles.listingPrice}>{formatPrice(l.price)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Reviews */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>REVIEWS</Text>
        </View>
        {reviews.length === 0 ? (
          <Text style={[styles.sectionEmptyText, { paddingHorizontal: 20 }]}>No reviews yet.</Text>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {reviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewTopRow}>
                  <LinearGradient colors={[Colors.textDisabled, Colors.darkBlue_26262e]} style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>{getInitials(r.reviewer)}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.reviewerName} numberOfLines={1}>{getName(r.reviewer)}</Text>
                    <Stars rating={r.rating} size={11} />
                  </View>
                  <Text style={styles.reviewTime}>{timeAgo(r.createdAt)}</Text>
                </View>
                {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════ STYLES ═══════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  centerFill: { alignItems: 'center', justifyContent: 'center', gap: 12 },

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
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },

  heroCard: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarImg: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginBottom: 12,
    backgroundColor: Colors.bgTertiary,
  },
  avatarText: {
    fontSize: FontSize.size26,
    fontFamily: FontFamily.bold,
    color: Colors.white,
  },
  heroNameRow: { flexDirection: 'row', alignItems: 'center' },
  heroName: {
    fontSize: FontSize.size19,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  heroSub: {
    fontSize: FontSize.size12,
    fontFamily: FontFamily.regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  ratingText: {
    fontSize: FontSize.size12,
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 8,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: FontSize.size9,
    fontFamily: FontFamily.semiBold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 4,
  },

  sectionHeaderRow: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  sectionEmptyText: {
    fontSize: FontSize.size12,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    paddingHorizontal: 20,
  },

  listingCard: {
    width: 180,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  listingImg: {
    width: '100%',
    height: 110,
    backgroundColor: Colors.bgTertiary,
  },
  listingTitle: {
    fontSize: FontSize.size12,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },
  listingPrice: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bold,
    color: Colors.accent,
    marginTop: 2,
  },

  reviewCard: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  reviewTopRow: { flexDirection: 'row', alignItems: 'center' },
  reviewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    fontSize: FontSize.size12,
    fontFamily: FontFamily.bold,
    color: Colors.white,
  },
  reviewerName: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },
  reviewTime: {
    fontSize: FontSize.size10,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  reviewComment: {
    fontSize: FontSize.size12,
    fontFamily: FontFamily.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 10,
  },

  emptyTitle: {
    fontSize: FontSize.size14,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: FontSize.size12,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
});
