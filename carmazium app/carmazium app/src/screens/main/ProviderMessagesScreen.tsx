import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { ChatRoom } from '../../lib/chatApi';
import { useChat } from '../../context/ChatContext';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderMessages'>;
type Tab = 'jobs' | 'all';

const displayName = (room: ChatRoom) => {
  const name = [room.otherUser?.firstName, room.otherUser?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || 'Customer';
};

const initials = (room: ChatRoom) =>
  displayName(room)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const formatTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const roomContext = (room: ChatRoom) => {
  if (room.context === 'SERVICE_JOB' && room.serviceJob) {
    const type = room.serviceJob.serviceType === 'INSPECTION'
      ? 'Inspection'
      : room.serviceJob.serviceType === 'DELIVERY'
        ? 'Delivery / Recovery'
        : room.serviceJob.serviceType;
    return `${type} · ${room.serviceJob.title}`;
  }
  if (room.listing?.title) return room.listing.title;
  if (room.context === 'SUPPORT') return 'CarMazium support';
  if (room.context === 'DISPUTE') return 'Dispute conversation';
  return 'CarMazium conversation';
};

export const ProviderMessagesScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const {
    rooms,
    refreshRooms,
    markAsRead,
    isLoading,
    onlineUserIds,
  } = useChat();

  const [tab, setTab] = useState<Tab>('jobs');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshRooms();
    }, [refreshRooms]),
  );

  const serviceRooms = useMemo(
    () => rooms.filter((room) => room.context === 'SERVICE_JOB'),
    [rooms],
  );

  const visibleRooms = useMemo(() => {
    const source = tab === 'jobs' ? serviceRooms : rooms;
    const query = search.trim().toLowerCase();
    if (!query) return source;

    return source.filter((room) => {
      const haystack = [
        displayName(room),
        roomContext(room),
        room.lastMessage?.content || '',
        room.serviceJob?.status || '',
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [rooms, serviceRooms, search, tab]);

  const serviceUnread = useMemo(
    () => serviceRooms.reduce((total, room) => total + (room.unreadCount || 0), 0),
    [serviceRooms],
  );

  const allUnread = useMemo(
    () => rooms.reduce((total, room) => total + (room.unreadCount || 0), 0),
    [rooms],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshRooms();
    } finally {
      setRefreshing(false);
    }
  }, [refreshRooms]);

  const openRoom = useCallback((room: ChatRoom) => {
    markAsRead(room.id);
    navigation.navigate('ChatScreen', { threadId: room.id });
  }, [markAsRead, navigation]);

  const renderRoom = ({ item: room }: { item: ChatRoom }) => {
    const unread = room.unreadCount > 0;
    const isJob = room.context === 'SERVICE_JOB' && !!room.serviceJob;

    return (
      <TouchableOpacity
        style={[styles.card, unread && styles.cardUnread]}
        activeOpacity={0.82}
        onPress={() => openRoom(room)}
      >
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(room)}</Text>
          </View>
          {room.otherUser?.id && onlineUserIds.has(room.otherUser.id) ? (
            <View style={styles.onlineDot} />
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
              {displayName(room)}
            </Text>
            <Text style={styles.time}>{formatTime(room.lastMessage?.createdAt)}</Text>
          </View>

          <View style={styles.contextRow}>
            {isJob ? (
              <Ionicons name="construct-outline" size={12} color={Colors.accent} />
            ) : (
              <Ionicons name="chatbubble-outline" size={12} color={Colors.textMuted} />
            )}
            <Text
              style={[styles.contextText, isJob && { color: Colors.accent }]}
              numberOfLines={1}
            >
              {roomContext(room)}
            </Text>
          </View>

          {isJob && room.serviceJob ? (
            <View style={styles.jobMeta}>
              <Text style={styles.jobStatus}>{room.serviceJob.status.replace(/_/g, ' ')}</Text>
              {room.serviceJob.payment?.status ? (
                <Text style={styles.jobPayment}>Payment: {room.serviceJob.payment.status}</Text>
              ) : null}
            </View>
          ) : null}

          <Text
            style={[styles.preview, unread && styles.previewUnread]}
            numberOfLines={1}
          >
            {room.lastMessage?.attachmentPath
              ? room.lastMessage.content
                ? `Photo · ${room.lastMessage.content}`
                : 'Photo'
              : room.lastMessage?.content || 'No messages yet'}
          </Text>
        </View>

        {unread ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{room.unreadCount}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        )}
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
          <Text style={styles.headerTitle}>Partner Messages</Text>
          <Text style={styles.headerSub}>Customer and service-job conversations</Text>
        </View>
        <HamburgerButton />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'jobs' && styles.tabActive]}
          onPress={() => setTab('jobs')}
        >
          <Text style={[styles.tabText, tab === 'jobs' && styles.tabTextActive]}>
            JOBS {serviceRooms.length}
          </Text>
          {serviceUnread > 0 ? <View style={styles.tabDot} /> : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'all' && styles.tabActive]}
          onPress={() => setTab('all')}
        >
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>
            ALL {rooms.length}
          </Text>
          {allUnread > 0 ? <View style={styles.tabDot} /> : null}
        </TouchableOpacity>
      </View>

      <View style={styles.search}>
        <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search customer, job or message"
          placeholderTextColor={Colors.inputPlaceholder}
          autoCapitalize="none"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading && rooms.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={visibleRooms}
          keyExtractor={(room) => room.id}
          renderItem={renderRoom}
          contentContainerStyle={visibleRooms.length ? styles.list : styles.emptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name={tab === 'jobs' ? 'construct-outline' : 'chatbubbles-outline'}
                size={36}
                color={Colors.textMuted}
              />
              <Text style={styles.emptyTitle}>
                {search
                  ? 'No matching conversations'
                  : tab === 'jobs'
                    ? 'No service-job conversations yet'
                    : 'No messages yet'}
              </Text>
              <Text style={styles.emptyText}>
                {search
                  ? 'Try another customer name, job title or message.'
                  : tab === 'jobs'
                    ? 'Once an assigned paid job can be messaged, its customer conversation appears here automatically.'
                    : 'Your authorized CarMazium conversations will appear here.'}
              </Text>
              {tab === 'jobs' && !search ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => navigation.navigate('ProviderJobs')}
                >
                  <Text style={styles.primaryText}>OPEN PARTNER JOBS</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.size10, color: Colors.textMuted, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 18,
    borderRadius: Radius.inline,
    backgroundColor: Colors.bgSecondary,
    padding: 4,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  tabActive: { backgroundColor: Colors.accent },
  tabText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textMuted, letterSpacing: 0.6 },
  tabTextActive: { color: Colors.white },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.white },
  search: {
    height: 46,
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    borderRadius: Radius.inline,
    backgroundColor: Colors.bgSecondary,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: {
    flex: 1,
    color: Colors.white,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 18, gap: 11, paddingBottom: 36 },
  emptyList: { flexGrow: 1, padding: 18, justifyContent: 'center' },
  card: {
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardUnread: { borderColor: Colors.accentAlpha25 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.brandSlate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white },
  onlineDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  nameUnread: { fontFamily: FontFamily.bold, color: Colors.white },
  time: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  contextText: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textMuted },
  jobMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  jobStatus: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.accentGreen, textTransform: 'uppercase' },
  jobPayment: { fontFamily: FontFamily.medium, fontSize: FontSize.size10, color: Colors.textMuted },
  preview: { marginTop: 4, fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textMuted },
  previewUnread: { fontFamily: FontFamily.medium, color: Colors.white },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.white },
  empty: { alignItems: 'center', gap: 10, padding: 24 },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white, textAlign: 'center' },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textMuted, lineHeight: 19, textAlign: 'center', maxWidth: 340 },
  primaryButton: { marginTop: 5, minHeight: 44, borderRadius: Radius.inline, backgroundColor: Colors.accent, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white, letterSpacing: 0.7 },
});
