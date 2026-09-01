import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { useChat } from '../../context/ChatContext';
import { ChatRoom, ChatUser } from '../../lib/chatApi';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

import { IconButton } from '../../components/IconButton';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

// Helper format functions for chat data mapping
const formatMessageTime = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const getDisplayName = (user?: ChatUser) => {
  if (!user) return 'Deleted User';
  if (user.firstName) {
    return `${user.firstName} ${user.lastName || ''}`.trim();
  }
  return 'Anonymous User';
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Avatar background colors
const getAvatarBg = (initials: string) => {
  if (initials === 'KM') return Colors.darkBlue_2a3047;
  if (initials === 'MA') return Colors.darkTeal;
  if (initials === 'GS') return Colors.darkPurple;
  return Colors.darkRed_3b2424;
};

interface ThreadRowProps {
  room: ChatRoom;
  onPress: (roomId: string) => void;
  /** Passed as a primitive, not the whole online set: handing the row a Set
   *  would give it a new prop identity on every presence change and defeat
   *  the React.memo this row exists for. */
  isOnline: boolean;
}

// Hoisted + memoized so FlatList only re-renders the thread row whose props
// actually changed, instead of recreating this JSX inline in renderItem on
// every parent re-render (mobile-audit.md P3/P4).
const ThreadRow: React.FC<ThreadRowProps> = React.memo(({ room, onPress, isOnline }) => {
  const isUnread = room.unreadCount > 0;
  const displayName = getDisplayName(room.otherUser);
  const initials = getInitials(displayName);
  const lastMsgContent = room.lastMessage?.content || 'No messages yet';
  const hasOfferCounter = lastMsgContent.startsWith('Counter-offer');
  const isDealer = room.otherUser.role === 'DEALER';

  return (
    <TouchableOpacity
      style={[
        styles.threadCard,
        styles.threadCardSpacing,
        isUnread && styles.threadCardUnread,
      ]}
      onPress={() => onPress(room.id)}
      activeOpacity={0.85}
    >
      {/* Left avatar with badge */}
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: getAvatarBg(initials) }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        {isDealer && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.lightBlue_0084ff} />
          </View>
        )}
        {/* Presence (DASH-023). Only ever shown when we positively know the
            partner is online — absence means "unknown or offline", never a
            claim either way. */}
        {isOnline && (
          <View style={styles.onlineDot} accessibilityLabel="Online" />
        )}
      </View>

      {/* Middle texts */}
      <View style={styles.metaContainer}>
        <View style={styles.metaTitleRow}>
          <Text style={[styles.dealerName, isUnread && styles.textBold]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.timeText}>{formatMessageTime(room.lastMessage?.createdAt)}</Text>
        </View>

        <Text style={styles.carModelText} numberOfLines={1}>
          {room.listing?.title || 'General Inquiry'}
        </Text>

        {hasOfferCounter ? (
          <View style={styles.offerTagRow}>
            <Ionicons name="pricetag" size={12} color={Colors.accent} style={{ marginRight: 4 }} />
            <Text style={styles.offerTagText}>{lastMsgContent}</Text>
          </View>
        ) : (
          <Text
            style={[
              styles.lastMessageText,
              isUnread && styles.lastMessageTextUnread
            ]}
            numberOfLines={1}
          >
            {lastMsgContent}
          </Text>
        )}
      </View>

      {/* Right indicators */}
      {isUnread && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{room.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

const renderSkeletonRows = () => (
  <View style={styles.skeletonList}>
    {Array.from({ length: 5 }).map((_, i) => (
      <View key={`sk-${i}`} style={[styles.threadCard, styles.threadCardSpacing, styles.skeletonRow]}>
        <Skeleton w={48} h={48} r={14} />
        <View style={styles.skeletonMeta}>
          <View style={styles.skeletonTitleRow}>
            <Skeleton w={140} h={14} r={6} />
            <Skeleton w={36} h={10} r={5} />
          </View>
          <Skeleton w={100} h={12} r={5} />
          <Skeleton w={180} h={12} r={5} />
        </View>
      </View>
    ))}
  </View>
);

export const MessagesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { rooms, unreadCount, markAsRead, refreshRooms, isLoading, onlineUserIds } = useChat();

  const [activeTab, setActiveTab] = useState<'all' | 'offers' | 'archived'>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Re-fetch rooms when focusing the messages tab
  useEffect(() => {
    refreshRooms();
  }, [refreshRooms]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshRooms();
    } finally {
      setRefreshing(false);
    }
  };

  // Tab filtering logic
  const filteredRooms = rooms.filter((r) => {
    // 1. Tab check
    if (activeTab === 'offers' && !r.listing) return false;
    if (activeTab === 'archived') return false; // Archive not supported on mobile initially

    // 2. Search check
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = getDisplayName(r.otherUser).toLowerCase();
      const model = r.listing?.title.toLowerCase() || 'general inquiry';
      const lastMsg = r.lastMessage?.content.toLowerCase() || '';
      return name.includes(q) || model.includes(q) || lastMsg.includes(q);
    }
    return true;
  });

  const getTabCount = (tab: 'all' | 'offers' | 'archived') => {
    if (tab === 'all') return rooms.length;
    if (tab === 'offers') return rooms.filter((r) => r.listing !== null).length;
    return 0;
  };

  const handleThreadPress = useCallback((roomId: string) => {
    markAsRead(roomId);
    navigation.navigate('ChatScreen', { threadId: roomId });
  }, [markAsRead, navigation]);

  const renderThreadRow = useCallback(
    ({ item: room }: { item: ChatRoom }) => (
      <ThreadRow
        room={room}
        onPress={handleThreadPress}
        isOnline={!!room.otherUser?.id && onlineUserIds.has(room.otherUser.id)}
      />
    ),
    [handleThreadPress, onlineUserIds],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top red-blue glow backdrop */}
      <LinearGradient
        colors={[Colors.accentAlpha03, Colors.infoBlueAlpha03, Colors.bgPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      {isLoading && rooms.length === 0 ? renderSkeletonRows() : null}
    <FlatList
        data={isLoading && rooms.length === 0 ? [] : filteredRooms}
        keyExtractor={(room) => room.id}
        // Virtualized list — only mounts rows near the viewport, which keeps
        // scrolling smooth as a user's conversation history grows over time
        // (unlike the previous ScrollView+.map() that rendered every row upfront).
        renderItem={renderThreadRow}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          <>
            {/* Header navigation bar */}
            <View style={styles.header}>
              <View>
                <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
                <Text style={styles.unreadTag}>{unreadCount} UNREAD</Text>
                <Text style={styles.title}>Messages</Text>
              </View>

              <IconButton style={styles.searchIconBtn} icon={<Ionicons name="search-outline" size={20} color={Colors.white} />} onPress={() => setSearchOpen(!searchOpen)} accessibilityLabel={searchOpen ? 'Hide search' : 'Search conversations'} />
            </View>

            {/* Toggleable search bar */}
            {searchOpen && (
              <View style={styles.searchWrapper}>
                <View style={styles.searchBar}>
                  <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search messages..."
                    placeholderTextColor={Colors.inputPlaceholder}
                    autoFocus
                    autoCapitalize="none"
                  />
                  {searchQuery.length > 0 && (
                    <IconButton icon={<Ionicons name="close-circle" size={16} color={Colors.textMuted} />} onPress={() => setSearchQuery('')} accessibilityLabel="Clear" />
                  )}
                </View>
              </View>
            )}

            {/* Tab Pills */}
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[styles.tabPill, activeTab === 'all' && styles.tabPillActive]}
                onPress={() => setActiveTab('all')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabLabel, activeTab === 'all' && styles.tabLabelActive]}>
                  All <Text style={styles.tabCount}>{getTabCount('all')}</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabPill, activeTab === 'offers' && styles.tabPillActive]}
                onPress={() => setActiveTab('offers')}
                activeOpacity={0.8}
              >
                <View style={styles.tabPillContent}>
                  {rooms.some((r) => r.listing !== null && r.unreadCount > 0) && (
                    <View style={styles.tabDot} />
                  )}
                  <Text style={[styles.tabLabel, activeTab === 'offers' && styles.tabLabelActive]}>
                    Offers <Text style={styles.tabCount}>{getTabCount('offers')}</Text>
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabPill, activeTab === 'archived' && styles.tabPillActive]}
                onPress={() => setActiveTab('archived')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabLabel, activeTab === 'archived' && styles.tabLabelActive]}>
                  Archived <Text style={styles.tabCount}>{getTabCount('archived')}</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="chatbubbles-outline"
              title="No messages yet"
              subtitle={searchQuery ? 'Try adjusting your search query.' : 'Your conversations with buyers and sellers will appear here.'}
            />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scroll: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  backBtn: {
    marginBottom: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  unreadTag: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.textFaint,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['3xl'] - 2,
    color: Colors.white,
    letterSpacing: -0.6,
  },
  searchIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  searchWrapper: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: Radius.inline,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.white,
    height: '100%',
  },
  // Tabs
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 20,
  },
  tabPill: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha05,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabPillActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.white,
  },
  tabCount: {
    fontFamily: FontFamily.regular,
    opacity: 0.6,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.white,
  },
  // Thread list
  threadCardSpacing: {
    marginHorizontal: 24,
  },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha05,
    borderRadius: Radius.card,
    padding: 18,
  },
  threadCardUnread: {
    borderColor: Colors.accentAlpha25,
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.white,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 8,
    padding: 1,
  },
  metaContainer: {
    flex: 1,
  },
  metaTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  dealerName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  textBold: {
    fontFamily: FontFamily.bold,
    color: Colors.white,
  },
  timeText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  carModelText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  lastMessageText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  lastMessageTextUnread: {
    fontFamily: FontFamily.medium,
    color: Colors.white,
  },
  offerTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentAlpha08,
    borderWidth: 1,
    borderColor: Colors.accentAlpha15,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  offerTagText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.accent,
  },
  unreadBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  unreadBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.white,
  },
  // Skeleton
  skeletonList: {
    paddingTop: 8,
  },
  skeletonRow: {
    gap: 16,
  },
  skeletonMeta: {
    flex: 1,
    gap: 6,
  },
  skeletonTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
