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
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { useChat } from '../../context/ChatContext';
import { ChatRoom } from '../../lib/chatApi';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderMessages'>;

const formatMessageTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  const days = Math.ceil(Math.abs(now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const otherPartyName = (room: ChatRoom) =>
  [room.otherUser?.firstName, room.otherUser?.lastName].filter(Boolean).join(' ').trim()
  || 'Customer';

const serviceLabel = (room: ChatRoom) => {
  const type = room.serviceJob?.serviceType;
  if (type === 'INSPECTION') return 'INSPECTION';
  if (type === 'DELIVERY') return 'DELIVERY / RECOVERY';
  return type || 'SERVICE JOB';
};

export const ProviderMessagesScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { rooms, refreshRooms, markAsRead, isLoading } = useChat();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshRooms();
    }, [refreshRooms]),
  );

  const providerRooms = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rooms
      .filter((room) => room.context === 'SERVICE_JOB' && room.serviceJob)
      .filter((room) => {
        if (!q) return true;
        const haystack = [
          otherPartyName(room),
          room.serviceJob?.title,
          room.serviceJob?.serviceType,
          room.serviceJob?.status,
          room.lastMessage?.content,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [rooms, search]);

  const unreadCount = useMemo(
    () => providerRooms.reduce((total, room) => total + (room.unreadCount || 0), 0),
    [providerRooms],
  );

  const openRoom = useCallback(async (room: ChatRoom) => {
    if (room.unreadCount > 0) {
      await markAsRead(room.id);
    }
    navigation.navigate('ChatScreen', { threadId: room.id });
  }, [markAsRead, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshRooms();
    } finally {
      setRefreshing(false);
    }
  }, [refreshRooms]);

  const renderRoom = ({ item: room }: { item: ChatRoom }) => {
    const unread = room.unreadCount > 0;
    const job = room.serviceJob!;
    const lastMessage = room.lastMessage?.attachmentPath
      ? room.lastMessage.content
        ? `Photo · ${room.lastMessage.content}`
        : 'Photo'
      : room.lastMessage?.content || 'No messages yet';

    return (
      <TouchableOpacity
        style={[styles.card, unread && styles.cardUnread]}
        activeOpacity={0.8}
        onPress={() => void openRoom(room)}
      >
        <View style={styles.rowBetween}>
          <View style={styles.serviceChip}>
            <Text style={styles.serviceChipText}>{serviceLabel(room)}</Text>
          </View>
          <Text style={styles.time}>{formatMessageTime(room.lastMessage?.createdAt || room.updatedAt)}</Text>
        </View>

        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.customerName, unread && styles.unreadText]} numberOfLines={1}>
              {otherPartyName(room)}
            </Text>
            <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
          </View>
          {unread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{room.unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>JOB {job.status.replace(/_/g, ' ')}</Text>
          {job.payment?.status ? <Text style={styles.paymentLabel}>PAYMENT {job.payment.status}</Text> : null}
        </View>

        <Text style={[styles.lastMessage, unread && styles.unreadText]} numberOfLines={2}>
          {lastMessage}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgPrimary} />

      <View style={styles.header}>
        <IconButton
          style={styles.headerButton}
          icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Provider Messages</Text>
          <Text style={styles.headerMeta}>{unreadCount} unread</Text>
        </View>
        <HamburgerButton />
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>SERVICE JOB CHAT</Text>
        <Text style={styles.title}>Customer conversations</Text>
        <Text style={styles.sub}>
          Delivery, Recovery and Inspection conversations tied to your Partner jobs. Other CarMazium messages stay in the main Messages screen.
        </Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search job, customer or message"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading && rooms.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.muted}>Loading service conversations…</Text>
        </View>
      ) : (
        <FlatList
          data={providerRooms}
          keyExtractor={(room) => room.id}
          renderItem={renderRoom}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {search ? 'No matching service conversations' : 'No service-job messages yet'}
              </Text>
              <Text style={styles.emptyText}>
                {search
                  ? 'Try another customer, job title or message search.'
                  : 'A service-job conversation appears here after an assigned paid job unlocks customer contact and chat.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  headerMeta: { fontFamily: FontFamily.medium, color: Colors.textMuted, fontSize: FontSize.size10, marginTop: 1 },
  hero: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  eyebrow: { fontFamily: FontFamily.bold, color: Colors.accent, fontSize: FontSize.size10, letterSpacing: 1.5 },
  title: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size22, marginTop: 6 },
  sub: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size14, lineHeight: 20, marginTop: 7 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginBottom: 8, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, borderRadius: Radius.inline, paddingHorizontal: 12, minHeight: 44 },
  searchInput: { flex: 1, color: Colors.white, fontFamily: FontFamily.regular, fontSize: FontSize.size12 },
  list: { padding: 18, paddingTop: 8, gap: 12, flexGrow: 1 },
  card: { borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, borderRadius: Radius.card, padding: 15, gap: 9 },
  cardUnread: { borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha04 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  serviceChip: { borderRadius: 8, backgroundColor: Colors.infoBlueAlpha10, paddingHorizontal: 8, paddingVertical: 5 },
  serviceChipText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10, letterSpacing: 0.7 },
  time: { fontFamily: FontFamily.medium, color: Colors.textMuted, fontSize: FontSize.size10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customerName: { fontFamily: FontFamily.medium, color: Colors.white, fontSize: FontSize.base },
  jobTitle: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size12, marginTop: 2 },
  unreadText: { fontFamily: FontFamily.bold, color: Colors.white },
  unreadBadge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadBadgeText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusLabel: { fontFamily: FontFamily.bold, color: Colors.accentGreen, fontSize: FontSize.size10 },
  paymentLabel: { fontFamily: FontFamily.bold, color: Colors.warning, fontSize: FontSize.size10 },
  lastMessage: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.size12, lineHeight: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size12 },
  empty: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.base, marginTop: 12, textAlign: 'center' },
  emptyText: { fontFamily: FontFamily.regular, color: Colors.textMuted, fontSize: FontSize.size12, textAlign: 'center', lineHeight: 19, marginTop: 6 },
});
