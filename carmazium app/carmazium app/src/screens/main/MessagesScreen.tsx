import React, { useState, useCallback } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { useChat } from '../../context/ChatContext';
import { ChatRoom, ChatUser } from '../../lib/chatApi';
import { Colors } from '../../constants/colors';
import { useNativeAppearance } from '../../theme/NativeAppearanceProvider';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
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
  const { palette } = useNativeAppearance();
  const themed = useMessagesThemeStyles();
  const isUnread = room.unreadCount > 0;
  const displayName = getDisplayName(room.otherUser);
  const initials = getInitials(displayName);
  const lastMsgContent = room.lastMessage
    ? room.lastMessage.attachmentPath
      ? (room.lastMessage.content ? `Photo · ${room.lastMessage.content}` : 'Photo')
      : (room.lastMessage.content || 'No messages yet')
    : 'No messages yet';
  const hasOfferCounter = lastMsgContent.startsWith('Counter-offer');

  return (
    <TouchableOpacity
      style={[
        themed.threadCard,
        styles.threadCardSpacing,
        isUnread && themed.threadCardUnread,
      ]}
      onPress={() => onPress(room.id)}
      activeOpacity={0.85}
    >
      {/* Left avatar with badge */}
      <View style={themed.avatarContainer}>
        <View style={[themed.avatar, { backgroundColor: getAvatarBg(initials) }]}>
          <Text style={themed.avatarText}>{initials}</Text>
        </View>
        {/* Presence (DASH-023). Only ever shown when we positively know the
            partner is online — absence means "unknown or offline", never a
            claim either way. */}
        {isOnline && (
          <View style={themed.onlineDot} accessibilityLabel="Online" />
        )}
      </View>

      {/* Middle texts */}
      <View style={themed.metaContainer}>
        <View style={themed.metaTitleRow}>
          <Text style={[themed.dealerName, isUnread && styles.textBold]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={themed.timeText}>{formatMessageTime(room.lastMessage?.createdAt)}</Text>
        </View>

        <Text style={themed.carModelText} numberOfLines={1}>
          {room.listing?.title || 'General Inquiry'}
        </Text>

        {hasOfferCounter ? (
          <View style={themed.offerTagRow}>
            <Ionicons name="pricetag" size={12} color={Colors.accent} style={{ marginRight: 4 }} />
            <Text style={themed.offerTagText}>{lastMsgContent}</Text>
          </View>
        ) : (
          <Text
            style={[
              themed.lastMessageText,
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
        <View style={themed.unreadBadge}>
          <Text style={themed.unreadBadgeText}>{room.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

const renderSkeletonRows = (themed: ReturnType<typeof useMessagesThemeStyles>) => (
  <View style={themed.skeletonList}>
    {Array.from({ length: 5 }).map((_, i) => (
      <View key={`sk-${i}`} style={[themed.threadCard, styles.threadCardSpacing, styles.skeletonRow]}>
        <Skeleton w={48} h={48} r={14} />
        <View style={themed.skeletonMeta}>
          <View style={themed.skeletonTitleRow}>
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
  const { palette, resolvedAppearance } = useNativeAppearance();
  const themed = useMessagesThemeStyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { rooms, unreadCount, markAsRead, refreshRooms, isLoading, onlineUserIds } = useChat();

  const [activeTab, setActiveTab] = useState<'all' | 'vehicle'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Reconcile conversations when returning from another chat or device.
  useFocusEffect(useCallback(() => {
    void refreshRooms();
  }, [refreshRooms]));

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
    if (activeTab === 'vehicle' && !r.listing) return false;

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

  const getTabCount = (tab: 'all' | 'vehicle') =>
    tab === 'all' ? rooms.length : rooms.filter(r => Boolean(r.listing)).length;

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
    <View style={themed.container}>
      <StatusBar barStyle={resolvedAppearance === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor={palette.bgBody} />

      {/* Top red-blue glow backdrop */}
      <LinearGradient
        colors={[Colors.accentAlpha03, Colors.infoBlueAlpha03, Colors.bgPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <WebsiteTopBar />
      {isLoading && rooms.length === 0 ? renderSkeletonRows(themed) : null}
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
            <View style={themed.header}>
              <View>
                <IconButton style={themed.backBtn} icon={<Ionicons name="chevron-back" size={20} color={palette.textPrimary} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
                <Text style={themed.unreadTag}>{unreadCount > 0 ? `${unreadCount} UNREAD` : 'ALL CAUGHT UP'}</Text>
                <Text style={themed.title}>Messages</Text>
              </View>

              <IconButton style={themed.searchIconBtn} icon={<Ionicons name="refresh-outline" size={20} color={palette.textPrimary} />} onPress={() => void handleRefresh()} accessibilityLabel="Refresh conversations" />
            </View>

            {/* Website-style search is always visible and usable. */}
              <View style={themed.searchWrapper}>
                <View style={themed.searchBar}>
                  <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
                  <TextInput
                    style={themed.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search messages..."
                    placeholderTextColor={Colors.inputPlaceholder}
                    autoCapitalize="none"
                  />
                  {searchQuery.length > 0 && (
                    <IconButton icon={<Ionicons name="close-circle" size={16} color={Colors.textMuted} />} onPress={() => setSearchQuery('')} accessibilityLabel="Clear" />
                  )}
                </View>
              </View>

            {/* Tab Pills */}
            <View style={themed.tabsRow}>
              <TouchableOpacity
                style={[themed.tabPill, activeTab === 'all' && styles.tabPillActive]}
                onPress={() => setActiveTab('all')}
                activeOpacity={0.8}
              >
                <Text style={[themed.tabLabel, activeTab === 'all' && styles.tabLabelActive]}>
                  All <Text style={themed.tabCount}>{getTabCount('all')}</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[themed.tabPill, activeTab === 'vehicle' && styles.tabPillActive]}
                onPress={() => setActiveTab('vehicle')}
                activeOpacity={0.8}
              >
                <View style={themed.tabPillContent}>
                  {rooms.some((r) => Boolean(r.listing) && r.unreadCount > 0) && (
                    <View style={themed.tabDot} />
                  )}
                  <Text style={[themed.tabLabel, activeTab === 'vehicle' && styles.tabLabelActive]}>
                    Vehicle chats <Text style={themed.tabCount}>{getTabCount('vehicle')}</Text>
                  </Text>
                </View>
              </TouchableOpacity>

            </View>
          </>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="chatbubbles-outline"
              title={searchQuery ? 'No matching conversations' : activeTab === 'vehicle' ? 'No vehicle conversations yet' : 'No messages yet'}
              subtitle={searchQuery ? 'Try another name, vehicle or message.' : activeTab === 'vehicle' ? 'Conversations linked to a vehicle will appear here.' : 'Messages from people you contact about cars, or from CarMazium support, will appear here.'}
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
        contentContainerStyle={[themed.scroll, { paddingTop: 16, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
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
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 52,
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
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 16,
  },
  tabPill: {
    paddingHorizontal: 16,
    minHeight: 44,
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
    marginHorizontal: 18,
  },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCardSolid,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.card,
    padding: 16,
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

function useMessagesThemeStyles() {
  const { palette } = useNativeAppearance();
  return React.useMemo(() => ({
    ...styles,
    container: [styles.container, { backgroundColor: palette.bgBody }],
    header: [styles.header, { backgroundColor: palette.bgBody, borderBottomColor: palette.borderDefault }],
    backBtn: [styles.backBtn, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    unreadTag: [styles.unreadTag, { color: palette.textSecondary }],
    title: [styles.title, { color: palette.textPrimary }],
    searchIconBtn: [styles.searchIconBtn, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    searchBar: [styles.searchBar, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    searchInput: [styles.searchInput, { color: palette.textPrimary }],
    tabsRow: [styles.tabsRow, { backgroundColor: palette.bgBody }],
    tabPill: [styles.tabPill, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    tabLabel: [styles.tabLabel, { color: palette.textSecondary }],
    tabCount: [styles.tabCount, { color: palette.textMuted }],
    threadCard: [styles.threadCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    threadCardUnread: [styles.threadCardUnread, { borderColor: palette.accent }],
    dealerName: [styles.dealerName, { color: palette.textPrimary }],
    timeText: [styles.timeText, { color: palette.textMuted }],
    carModelText: [styles.carModelText, { color: palette.textSecondary }],
    lastMessageText: [styles.lastMessageText, { color: palette.textMuted }],
    offerTagRow: [styles.offerTagRow, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    offerTagText: [styles.offerTagText, { color: palette.textPrimary }],
    avatarContainer: [styles.avatarContainer, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    skeletonRow: [styles.skeletonRow, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    skeletonMeta: [styles.skeletonMeta, { backgroundColor: palette.bgInput }],
  }), [palette]);
}
