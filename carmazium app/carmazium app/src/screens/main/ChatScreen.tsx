import React, { useState, useRef, useEffect, useContext, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useChat } from '../../context/ChatContext';
import { useAuthStore } from '../../store/authStore';
import {
  blockChatRoom,
  createChatAttachmentUpload,
  getChatMessages,
  markMessagesAsRead,
  reportChatMessage,
  sendChatAttachment,
  sendChatMessage,
  unblockChatRoom,
  type ChatHistoryCursor,
  type ChatMessage,
  type ChatReportReason,
  type ChatRoom,
  type ChatUser,
} from '../../lib/chatApi';
import { getListingById } from '../../lib/listingsApi';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { GlobalToastContext } from '../../components/GlobalToastProvider';
import { convertAndCompress, uploadToSignedStorage } from '../../lib/storageHelper';

import { IconButton } from '../../components/IconButton';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

// Message bubbles cap their width off this instead of a percentage string —
// see the note on the `bubble` style below for why.
const MAX_BUBBLE_WIDTH = Dimensions.get('window').width * 0.82;

const REPORT_REASONS: Array<{ value: ChatReportReason; label: string }> = [
  { value: 'HARASSMENT', label: 'Harassment or threats' },
  { value: 'SCAM_FRAUD', label: 'Scam or fraud' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { value: 'OTHER', label: 'Other' },
];

const createClientMessageId = (): string => {
  const bytes = new Uint8Array(16);
  const cryptoApi = (globalThis as any).crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const parseSpecialMessage = (content: string) => {
  const counterMatch = content.match(/Counter-offer:\s*£([\d,]+)/i);
  if (counterMatch) {
    const amount = parseInt(counterMatch[1].replace(/,/g, ''), 10);
    return { type: 'counter' as const, amount };
  }
  const offerMatch = content.match(/Offer:\s*£([\d,]+)/i);
  if (offerMatch) {
    const amount = parseInt(offerMatch[1].replace(/,/g, ''), 10);
    return { type: 'offer' as const, amount };
  }
  return null;
};

const formatMessageTime = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (e) {
    return '';
  }
};

const getAvatarBg = (val: string) => {
  if (val === 'KM') return Colors.darkBlue_2a3047;
  if (val === 'MA') return Colors.darkTeal;
  if (val === 'GS') return Colors.darkPurple;
  return Colors.darkRed_3b2424;
};

// ─── Animated typing indicator (Instagram/WhatsApp-style bouncing dots) ──────
const TypingDots: React.FC = () => {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(dot, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 140),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View style={styles.typingDotsRow}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
};

// ─── Message bubble — hoisted to module scope + memoized so FlatList only
// re-renders the row whose own props actually changed (mobile-audit.md P2). ──
interface MessageBubbleProps {
  msg: ChatMessage;
  isOwn: boolean;
  isLastOwnMessage: boolean;
  initials: string;
  onRetry: (message: ChatMessage) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({
  msg,
  isOwn,
  isLastOwnMessage,
  initials,
  onRetry,
}) => {
  const parsedSpecial = parseSpecialMessage(msg.content);
  const showSeenIndicator = isOwn && !msg.deliveryStatus && msg.isRead && isLastOwnMessage;

  const deliveryState = isOwn && msg.deliveryStatus ? (
    <TouchableOpacity
      disabled={msg.deliveryStatus !== 'failed'}
      onPress={() => onRetry(msg)}
      activeOpacity={0.7}
      style={styles.deliveryStateRow}
    >
      <Text
        style={[
          styles.deliveryStateText,
          msg.deliveryStatus === 'failed' && styles.deliveryStateFailed,
        ]}
      >
        {msg.deliveryStatus === 'failed' ? 'Not sent · Tap to retry' : 'Sending…'}
      </Text>
    </TouchableOpacity>
  ) : null;

  if (msg.attachmentPath) {
    return (
      <View style={isOwn ? styles.userBubbleWrapper : styles.dealerBubbleWrapper}>
        <View style={isOwn ? styles.bubbleStackRight : styles.bubbleStackLeft}>
          <View
            style={[
              styles.photoMessageBubble,
              isOwn ? styles.bubbleUser : styles.bubbleDealer,
              msg.deliveryStatus === 'failed' && styles.bubbleFailed,
            ]}
          >
            {msg.attachmentUrl ? (
              <Image
                source={{ uri: msg.attachmentUrl }}
                style={styles.chatPhoto}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={styles.chatPhotoUnavailable}>
                <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
                <Text style={styles.chatPhotoUnavailableText}>
                  Private photo unavailable. Reopen the conversation to refresh access.
                </Text>
              </View>
            )}
            {!!msg.content && <Text style={[styles.bubbleText, styles.photoCaption]}>{msg.content}</Text>}
            <View style={[styles.msgFooter, isOwn ? styles.msgFooterRight : styles.msgFooterLeft]}>
              <Text style={isOwn ? styles.timeTextRightInline : styles.timeTextLeftInline}>
                {formatMessageTime(msg.createdAt)}
              </Text>
              {isOwn && !msg.deliveryStatus && (
                <Ionicons
                  name={msg.isRead ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={msg.isRead ? Colors.lightBlue_4fa8ff : 'rgba(255,255,255,0.45)'}
                  style={styles.readTick}
                />
              )}
            </View>
          </View>
          {deliveryState}
          {showSeenIndicator && (
            <View style={styles.seenRow}>
              <View style={[styles.seenAvatar, { backgroundColor: getAvatarBg(initials) }]}>
                <Text style={styles.seenAvatarText}>{initials.slice(0, 1)}</Text>
              </View>
              <Text style={styles.seenText}>Seen {formatMessageTime(msg.updatedAt)}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (parsedSpecial?.type === 'offer') {
    return (
      <View style={isOwn ? styles.userBubbleWrapper : styles.dealerBubbleWrapper}>
        <View style={styles.offerMessageBubble}>
          <View style={styles.offerTagHeader}>
            <Ionicons name="pricetag" size={12} color={Colors.white} />
            <Text style={styles.offerTagTitle}>{isOwn ? 'YOUR OFFER' : 'OFFER'}</Text>
            <Text style={styles.offerTagAmount}>£{parsedSpecial.amount.toLocaleString('en-GB')}</Text>
          </View>
          <Text style={styles.offerText}>{msg.content}</Text>
          <Text style={styles.timeTextRight}>
            {formatMessageTime(msg.createdAt)}
            {isOwn && !msg.deliveryStatus && msg.isRead && ' ✓✓'}
          </Text>
        </View>
        {deliveryState}
      </View>
    );
  }

  if (parsedSpecial?.type === 'counter') {
    return (
      <View style={isOwn ? styles.userBubbleWrapper : styles.dealerBubbleWrapper}>
        <View style={styles.counterMessageCard}>
          <View style={styles.counterHeader}>
            <Ionicons name="pricetag" size={12} color={Colors.lightGrey} />
            <Text style={styles.counterTitle}>{isOwn ? 'YOUR COUNTER OFFER' : 'COUNTER OFFER'}</Text>
            <Text style={styles.counterAmount}>£{parsedSpecial.amount.toLocaleString('en-GB')}</Text>
          </View>
          <Text style={isOwn ? styles.timeTextRight : styles.timeTextLeft}>
            {formatMessageTime(msg.createdAt)}
            {isOwn && !msg.deliveryStatus && msg.isRead && ' ✓✓'}
          </Text>
        </View>
        {deliveryState}
      </View>
    );
  }

  return (
    <View style={isOwn ? styles.userBubbleWrapper : styles.dealerBubbleWrapper}>
      <View style={isOwn ? styles.bubbleStackRight : styles.bubbleStackLeft}>
        <View
          style={[
            styles.bubble,
            isOwn ? styles.bubbleUser : styles.bubbleDealer,
            msg.deliveryStatus === 'failed' && styles.bubbleFailed,
          ]}
        >
          <Text style={styles.bubbleText}>{msg.content}</Text>
          <View style={[styles.msgFooter, isOwn ? styles.msgFooterRight : styles.msgFooterLeft]}>
            <Text style={isOwn ? styles.timeTextRightInline : styles.timeTextLeftInline}>
              {formatMessageTime(msg.createdAt)}
            </Text>
            {isOwn && !msg.deliveryStatus && (
              <Ionicons
                name={msg.isRead ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={msg.isRead ? Colors.lightBlue_4fa8ff : 'rgba(255,255,255,0.45)'}
                style={styles.readTick}
              />
            )}
          </View>
        </View>

        {deliveryState}

        {showSeenIndicator && (
          <View style={styles.seenRow}>
            <View style={[styles.seenAvatar, { backgroundColor: getAvatarBg(initials) }]}>
              <Text style={styles.seenAvatarText}>{initials.slice(0, 1)}</Text>
            </View>
            <Text style={styles.seenText}>Seen {formatMessageTime(msg.updatedAt)}</Text>
          </View>
        )}
      </View>
    </View>
  );
});

export const ChatScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  // See useKeyboardHeight.ts — Android-only; iOS keeps the native
  // KeyboardAvoidingView path below, which already works reliably there.
  const androidKeyboardHeight = useKeyboardHeight();
  const route = useRoute<any>();
  const navigation = useNavigation<NavProp>();
  const { threadId } = route.params;
  const { showToast } = useContext(GlobalToastContext);

  const { 
    rooms,
    isConnected,
    sendMessage: emitSendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    onNewMessage,
    onTyping,
    onMessagesRead,
    refreshRooms,
  } = useChat();

  const { user } = useAuthStore();
  const room = rooms.find((r) => r.id === threadId);
  const roomRefreshAttemptRef = useRef<string | null>(null);

  // A room can be created immediately before navigation (service jobs,
  // notification taps, support) while ChatContext still has its previous room
  // snapshot. Hydrate once for this thread before treating room metadata as
  // unavailable.
  useEffect(() => {
    if (room) {
      roomRefreshAttemptRef.current = null;
      return;
    }
    if (!threadId || roomRefreshAttemptRef.current === threadId) return;

    roomRefreshAttemptRef.current = threadId;
    refreshRooms().catch(() => {});
  }, [room, threadId, refreshRooms]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<ChatHistoryCursor | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  // Must live here, not after the `if (!room) return` guard below — a hook
  // called only on some renders (e.g. once `loading`/`room` resolve) violates
  // the Rules of Hooks and crashes the screen to blank on the next render.
  const [openingListing, setOpeningListing] = useState(false);
  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState<ChatReportReason | null>(null);
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportedMessageIds, setReportedMessageIds] = useState<Set<string>>(new Set());
  const [changingBlock, setChangingBlock] = useState(false);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch newest messages first. Older history uses a stable cursor so new
  // realtime messages cannot shift page offsets while the user is scrolling.
  useEffect(() => {
    setHistoryCursor(null);
    setHasMore(false);

    async function loadMessages() {
      try {
        setLoading(true);
        const res = await getChatMessages(threadId);
        setMessages(res.data);
        setHasMore(Boolean(res.pagination.hasMore));
        setHistoryCursor(
          res.pagination.nextCursor ??
          (res.data[0]
            ? { createdAt: res.data[0].createdAt, id: res.data[0].id }
            : null)
        );
        await markMessagesAsRead(threadId);
        markAsRead(threadId);
      } catch (error) {
        console.error('Failed to load chat messages:', error);
      } finally {
        setLoading(false);
      }
    }
    loadMessages();
  }, [threadId]);

  // Subscribe to real-time events. clientMessageId identifies the exact
  // optimistic bubble and avoids content-based matching when two messages are equal.
  useEffect(() => {
    const unsubscribe = onNewMessage((message) => {
      if (message.chatRoomId === threadId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;

          if (message.clientMessageId) {
            const optimisticIndex = prev.findIndex(
              (m) => m.clientMessageId === message.clientMessageId
            );
            if (optimisticIndex !== -1) {
              const next = [...prev];
              next[optimisticIndex] = message;
              return next;
            }
          }

          return [...prev, message];
        });
        markAsRead(threadId);
        markMessagesAsRead(threadId).catch(() => {});
      }
    });
    return unsubscribe;
  }, [threadId, onNewMessage, markAsRead]);

  useEffect(() => {
    if (!room) return;
    const unsubscribe = onTyping((data) => {
      if (data.roomId === threadId && data.userId === room.otherUser.id) {
        setOtherUserTyping(data.isTyping);
      }
    });
    return unsubscribe;
  }, [threadId, room?.otherUser.id, onTyping]);

  useEffect(() => {
    if (!room) return;
    const unsubscribe = onMessagesRead((data) => {
      if (data.roomId === threadId && data.readBy === room.otherUser.id) {
        const readAt = new Date().toISOString();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.senderId === user?.id && !msg.isRead
              ? { ...msg, isRead: true, updatedAt: readAt }
              : msg
          )
        );
      }
    });
    return unsubscribe;
  }, [threadId, room?.otherUser.id, onMessagesRead, user?.id]);

  // Clean up typing timeouts
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      stopTyping(threadId);
    };
  }, [threadId]);

  const deliverMessage = useCallback(async (
    content: string,
    clientMessageId: string,
  ): Promise<ChatMessage> => {
    if (isConnected) {
      try {
        return await emitSendMessage(threadId, content, clientMessageId);
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code !== 'CHAT_ACK_TIMEOUT' && code !== 'SOCKET_UNAVAILABLE') {
          throw error;
        }
      }
    }

    return sendChatMessage(threadId, content, clientMessageId);
  }, [isConnected, emitSendMessage, threadId]);

  const confirmLocalMessage = useCallback((
    clientMessageId: string,
    confirmed: ChatMessage,
  ) => {
    setMessages((prev) => {
      const index = prev.findIndex(
        (message) =>
          message.id === confirmed.id ||
          message.clientMessageId === clientMessageId
      );
      if (index === -1) return [...prev, confirmed];

      const next = [...prev];
      next[index] = confirmed;
      return next;
    });
  }, []);

  const queueMessage = useCallback(async (content: string): Promise<boolean> => {
    const clientMessageId = createClientMessageId();
    const now = new Date().toISOString();
    const optimistic: ChatMessage = {
      id: `opt-${clientMessageId}`,
      chatRoomId: threadId,
      senderId: user?.id ?? '',
      clientMessageId,
      content,
      createdAt: now,
      updatedAt: now,
      isRead: false,
      sender: {
        id: user?.id ?? '',
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        profileImage: user?.profileImage ?? null,
      },
      deliveryStatus: 'sending',
    };

    setMessages((prev) => [...prev, optimistic]);

    try {
      const confirmed = await deliverMessage(content, clientMessageId);
      confirmLocalMessage(clientMessageId, confirmed);
      refreshRooms().catch(() => {});
      return true;
    } catch (error) {
      console.error('Failed to send chat message:', error);
      setMessages((prev) => prev.map((message) =>
        message.clientMessageId === clientMessageId
          ? { ...message, deliveryStatus: 'failed' }
          : message
      ));
      return false;
    }
  }, [
    threadId,
    user?.id,
    user?.firstName,
    user?.lastName,
    user?.profileImage,
    deliverMessage,
    confirmLocalMessage,
    refreshRooms,
  ]);

  const handleRetry = useCallback(async (message: ChatMessage) => {
    if (!message.clientMessageId || message.deliveryStatus !== 'failed') return;

    const clientMessageId = message.clientMessageId;
    setMessages((prev) => prev.map((item) =>
      item.clientMessageId === clientMessageId
        ? { ...item, deliveryStatus: 'sending' }
        : item
    ));

    try {
      const confirmed = await deliverMessage(message.content, clientMessageId);
      confirmLocalMessage(clientMessageId, confirmed);
      refreshRooms().catch(() => {});
    } catch (error) {
      console.error('Failed to retry chat message:', error);
      setMessages((prev) => prev.map((item) =>
        item.clientMessageId === clientMessageId
          ? { ...item, deliveryStatus: 'failed' }
          : item
      ));
    }
  }, [deliverMessage, confirmLocalMessage, refreshRooms]);

  const loadOlderMessages = useCallback(async () => {
    if (!historyCursor || !hasMore || loadingOlder) return;

    try {
      setLoadingOlder(true);
      const res = await getChatMessages(threadId, 1, 50, historyCursor);
      setMessages((prev) => {
        const existingIds = new Set(prev.map((message) => message.id));
        const older = res.data.filter((message) => !existingIds.has(message.id));
        return [...older, ...prev];
      });
      setHasMore(Boolean(res.pagination.hasMore));
      setHistoryCursor(
        res.pagination.nextCursor ??
        (res.data[0]
          ? { createdAt: res.data[0].createdAt, id: res.data[0].id }
          : null)
      );
    } catch (error) {
      console.error('Failed to load earlier chat messages:', error);
    } finally {
      setLoadingOlder(false);
    }
  }, [threadId, historyCursor, hasMore, loadingOlder]);

  // Derived values used by the message list — computed before the early returns
  // below so these hooks always run in the same order (Rules of Hooks).
  const displayNameForBubbles = room?.otherUser.firstName
    ? `${room.otherUser.firstName} ${room.otherUser.lastName || ''}`.trim()
    : 'Anonymous User';
  const initialsForBubbles = displayNameForBubbles
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Single backward pass instead of a `.slice(idx + 1).some(...)` per message
  // (that was O(n²) over the whole thread on every render — mobile-audit.md P2).
  const lastOwnMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === user?.id) return messages[i].id;
    }
    return null;
  }, [messages, user?.id]);

  // FlatList `inverted` expects newest-first data so it can stay pinned to the
  // bottom as new messages are appended, without any manual scrollToEnd() hack.
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const openReport = useCallback((message: ChatMessage) => {
    if (message.senderId === user?.id || message.deliveryStatus) return;
    setReportTarget(message);
    setReportReason(null);
    setReportDetails('');
  }, [user?.id]);

  const closeReport = useCallback(() => {
    if (reporting) return;
    setReportTarget(null);
    setReportReason(null);
    setReportDetails('');
  }, [reporting]);

  const submitReport = useCallback(async () => {
    if (!reportTarget || !reportReason || reporting) return;

    try {
      setReporting(true);
      await reportChatMessage(
        reportTarget.id,
        reportReason,
        reportDetails.trim() || undefined,
      );
      setReportedMessageIds((prev) => {
        const next = new Set(prev);
        next.add(reportTarget.id);
        return next;
      });
      setReportTarget(null);
      setReportReason(null);
      setReportDetails('');
      showToast('Report sent to CarMazium moderation.', 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Could not submit this report.',
        'info',
      );
    } finally {
      setReporting(false);
    }
  }, [reportTarget, reportReason, reporting, reportDetails, showToast]);

  const renderMessageItem = useCallback(({ item }: { item: ChatMessage }) => (
    <View>
      <MessageBubble
        msg={item}
        isOwn={item.senderId === user?.id}
        isLastOwnMessage={item.id === lastOwnMessageId}
        initials={initialsForBubbles}
        onRetry={handleRetry}
      />
      {item.senderId !== user?.id &&
        !item.deliveryStatus &&
        room?.context !== 'SUPPORT' &&
        item.sender.role !== 'ADMIN' && (
          <View style={styles.messageSafetyRow}>
            {reportedMessageIds.has(item.id) ? (
              <Text style={styles.messageReportedText}>Reported</Text>
            ) : (
              <TouchableOpacity
                onPress={() => openReport(item)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Report this message"
              >
                <Text style={styles.messageReportText}>Report</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
    </View>
  ), [
    user?.id,
    lastOwnMessageId,
    initialsForBubbles,
    handleRetry,
    room?.context,
    reportedMessageIds,
    openReport,
  ]);

  if (loading) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={[styles.errorText, { marginTop: 12 }]}>Loading conversation...</Text>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Conversation not found</Text>
        <TouchableOpacity style={styles.backBtnText} onPress={() => navigation.goBack()}>
          <Text style={{ color: Colors.accent }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = room.otherUser.firstName
    ? `${room.otherUser.firstName} ${room.otherUser.lastName || ''}`.trim()
    : 'Anonymous User';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isAuction = room.listing?.type === 'AUCTION';
  const isWinner = room.listing?.auction?.winnerId === user?.id;
  const depositPaid = room.listing?.auction?.buyerFeePaid === true;
  const shouldBlockChat = isAuction && isWinner && !depositPaid;

  // Listing banner used to be alert-only ("Redirecting to listing details for...")
  // with no real navigation (mobile-ui-ux-audit.md §C13). VehicleDetail needs a
  // full CarListing, and the chat room only carries a partial ChatListing, so
  // fetch the real listing before navigating rather than faking the missing fields.
  // (openingListing/setOpeningListing declared above, before the loading/room
  // early returns — see comment there.)
  const handleOpenListing = async () => {
    if (!room?.listing?.id || openingListing) return;
    setOpeningListing(true);
    try {
      const listing = await getListingById(room.listing.id);
      if (listing) navigation.navigate('VehicleDetail', { listing });
    } finally {
      setOpeningListing(false);
    }
  };

  const handlePickPhoto = async () => {
    if (uploadingPhoto) return;

    try {
      setUploadingPhoto(true);

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('Photo access is required to send a picture.', 'info');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const compressedUri = await convertAndCompress(asset.uri);
      const info = await FileSystem.getInfoAsync(compressedUri);
      const size = Number((info as any).size ?? 0);
      if (!size || size > 10 * 1024 * 1024) {
        throw new Error('Photo must be 10 MB or smaller.');
      }

      const name = `chat-photo-${Date.now()}.jpg`;
      const mime = 'image/jpeg';
      const clientMessageId = createClientMessageId();
      const caption = inputVal.trim();

      const ticket = await createChatAttachmentUpload(threadId, {
        name,
        type: mime,
        size,
      });

      await uploadToSignedStorage(
        compressedUri,
        ticket.bucket,
        ticket.path,
        ticket.token,
        mime,
      );

      const confirmed = await sendChatAttachment(threadId, {
        path: ticket.path,
        name,
        mime,
        size,
        caption: caption || undefined,
        clientMessageId,
      });

      if (caption) setInputVal('');
      confirmLocalMessage(clientMessageId, confirmed);
      refreshRooms().catch(() => {});
    } catch (error) {
      console.error('Failed to send private chat photo:', error);
      showToast(
        error instanceof Error ? error.message : 'Photo could not be sent.',
        'info',
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSend = () => {
    if (!inputVal.trim()) return;
    const textToSend = inputVal.trim();
    setInputVal('');

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    stopTyping(threadId);

    void queueMessage(textToSend);
  };

  const handleTextChange = (text: string) => {
    setInputVal(text);
    startTyping(threadId);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(threadId);
    }, 2000);
  };

  const handleAcceptOffer = async () => {
    const text = "I accept the counter-offer. Let's finalize the paperwork.";
    const sent = await queueMessage(text);
    showToast(
      sent ? 'Accepted!' : 'Message not sent. Tap it to retry.',
      sent ? 'success' : 'info',
    );
  };

  const handleCounterOffer = async () => {
    const text = `Counter-offer: £${carPrice.toLocaleString('en-GB')}`;
    const sent = await queueMessage(text);
    showToast(
      sent ? 'Counter-offer sent!' : 'Message not sent. Tap it to retry.',
      'info',
    );
  };

  const handlePayDeposit = () => {
    if (!room.listing) return;
    navigation.navigate('PurchaseFlow', {
      listingId: room.listing.id,
      salePrice: 0,
      buyerFee: 125,
      listingTitle: room.listing.title,
      listingImage: room.listing.images?.[0],
      sellerName: displayName,
      paymentType: 'COMMISSION',
      auctionId: room.listing.auction?.id,
    });
  };

  const handleRefreshStatus = async () => {
    try {
      setLoading(true);
      await refreshRooms();
      showToast('Status checked!', 'info');
    } catch (e) {
      console.warn('Failed to refresh status:', e);
    } finally {
      setLoading(false);
    }
  };


  const performBlockChange = async (shouldBlock: boolean) => {
    if (changingBlock) return;
    try {
      setChangingBlock(true);
      if (shouldBlock) {
        await blockChatRoom(room.id);
        showToast('Conversation blocked. Messaging is paused for both sides.', 'success');
      } else {
        await unblockChatRoom(room.id);
        showToast('Conversation unblocked.', 'success');
      }
      await refreshRooms();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Could not update this conversation.',
        'info',
      );
    } finally {
      setChangingBlock(false);
    }
  };

  const handleBlockToggle = () => {
    const unblocking = Boolean(room.blockedByMe);
    Alert.alert(
      unblocking ? 'Unblock conversation?' : 'Block conversation?',
      unblocking
        ? 'Messaging will be available again if the other participant has not also blocked the conversation.'
        : 'Messaging will stop for both sides. Existing messages stay available as evidence and can still be reported.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: unblocking ? 'Unblock' : 'Block',
          style: unblocking ? 'default' : 'destructive',
          onPress: () => void performBlockChange(!unblocking),
        },
      ],
    );
  };

  const carPrice = room.listing?.price ? parseFloat(String(room.listing.price)) : 0;
  const isDealer = room.otherUser.role === 'DEALER';

  // Hide "Accept Offer" if this user already sent an acceptance message in this thread
  const offerAccepted = messages.some(
    (m) => m.senderId === user?.id && m.content.startsWith("I accept the counter-offer"),
  );

  // iOS keeps the native KeyboardAvoidingView path, which already works
  // reliably there. Android drives its shift from androidKeyboardHeight
  // (see useKeyboardHeight.ts) instead — same component reference every
  // render since Platform.OS never changes at runtime.
  const ScreenWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const screenWrapperProps = Platform.OS === 'ios'
    ? { style: styles.container, behavior: 'padding' as const }
    : { style: [styles.container, { marginBottom: androidKeyboardHeight }] };

  return (
    <ScreenWrapper {...screenWrapperProps}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />

        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: getAvatarBg(initials) }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* Dealer name and status */}
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.dealerName} numberOfLines={1}>{displayName}</Text>
            {isDealer && (
              <Ionicons name="checkmark-circle" size={14} color={Colors.lightBlue_0084ff} style={{ marginLeft: 4 }} />
            )}
          </View>
          {otherUserTyping ? (
            <Text style={[styles.onlineStatus, { color: Colors.accent }]}>typing…</Text>
          ) : (
            <Text style={styles.onlineStatus}>
              {isConnected ? '● Active now' : '○ Active recently'}
            </Text>
          )}
        </View>

        {(room.canBlockChat || room.canUnblockChat) && (
          <IconButton
            style={styles.safetyHeaderButton}
            icon={
              changingBlock
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Ionicons
                    name={room.blockedByMe ? 'lock-open-outline' : 'ban-outline'}
                    size={19}
                    color={room.blockedByMe ? Colors.success : Colors.textSecondary}
                  />
            }
            onPress={handleBlockToggle}
            disabled={changingBlock}
            accessibilityLabel={room.blockedByMe ? 'Unblock conversation' : 'Block conversation'}
          />
        )}

      </View>

      {/* Listing context banner */}
      {room.listing && (
        <TouchableOpacity
          style={styles.listingBanner}
          activeOpacity={0.8}
          onPress={handleOpenListing}
          disabled={openingListing}
        >
          <Image
            source={{ uri: room.listing.images?.[0] || 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=900&q=80' }}
            style={styles.carImg}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
          <View style={styles.carMeta}>
            <Text style={styles.carTitle} numberOfLines={1}>{room.listing.title}</Text>
            <Text style={styles.carPrice}>
              {isAuction && room.listing.auction?.winningBidAmount 
                ? `Winning Bid: £${parseFloat(String(room.listing.auction.winningBidAmount)).toLocaleString('en-GB')}`
                : `Price: £${carPrice.toLocaleString('en-GB')}`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        </TouchableOpacity>
      )}

      {room.chatBlocked && !shouldBlockChat && (
        <View style={styles.chatBlockedBanner}>
          <Ionicons name="ban-outline" size={16} color={Colors.warning} />
          <View style={styles.chatBlockedCopy}>
            <Text style={styles.chatBlockedTitle}>Messaging blocked</Text>
            <Text style={styles.chatBlockedText}>
              {room.blockedByMe
                ? 'You blocked this conversation. The transcript remains available and messages can still be reported.'
                : 'Messaging is paused because this conversation has been blocked. The transcript remains available.'}
            </Text>
          </View>
          {room.blockedByMe && (
            <TouchableOpacity
              onPress={handleBlockToggle}
              disabled={changingBlock}
              style={styles.unblockInlineButton}
              activeOpacity={0.75}
            >
              <Text style={styles.unblockInlineText}>Unblock</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main chat body with conditional overlay blocking */}
      <View style={{ flex: 1, position: 'relative' }}>
        {/* Conversations list — FlatList inverted so it virtualizes long threads and
            stays pinned to the bottom as new messages are appended, with no manual
            scrollToEnd() timing hack (mobile-audit.md P2). Inverted flips header/footer:
            ListHeaderComponent renders at the visual bottom, ListFooterComponent at the top. */}
        <FlatList
          style={styles.chatArea}
          contentContainerStyle={styles.chatScroll}
          showsVerticalScrollIndicator={false}
          inverted
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          data={reversedMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          ListHeaderComponent={
            otherUserTyping ? (
              <View style={styles.dealerBubbleWrapper}>
                <View style={[styles.bubble, styles.bubbleDealer, styles.typingBubble]}>
                  <TypingDots />
                </View>
              </View>
            ) : null
          }
          ListFooterComponent={
            <View>
              {hasMore && (
                <TouchableOpacity
                  style={styles.loadEarlierButton}
                  onPress={loadOlderMessages}
                  disabled={loadingOlder}
                  activeOpacity={0.75}
                >
                  {loadingOlder ? (
                    <ActivityIndicator size="small" color={Colors.textSecondary} />
                  ) : (
                    <Text style={styles.loadEarlierText}>Load earlier messages</Text>
                  )}
                </TouchableOpacity>
              )}
              <Text style={styles.dateSeparator}>
                {messages.length === 0 ? 'No messages yet' : 'LIVE CHAT LOGS'}
              </Text>
            </View>
          }
        />

        {/* Blocking Overlay for deposit check */}
        {shouldBlockChat && (
          <View style={styles.blockingOverlay}>
            <View style={styles.blockingCard}>
              <View style={styles.trophyIconWrap}>
                <Ionicons name="trophy" size={40} color={Colors.warning} />
              </View>
              <Text style={styles.blockingTitle}>£125 Buyer Fee Due</Text>
              <Text style={styles.blockingDesc}>
                You won this auction! To unlock chat with the seller and secure the vehicle, you must pay the £125 buyer fee.
              </Text>
              <Text style={styles.blockingSubDesc}>
                • £100 is released to the seller as a completion bonus.{"\n"}
                • £25 covers the Carmazium platform fee.{"\n"}
                • The buyer fee is non-refundable; the agreed hammer price is settled directly with the seller at handover.
              </Text>

              <TouchableOpacity
                style={styles.payOverlayBtn}
                onPress={handlePayDeposit}
                activeOpacity={0.8}
              >
                <Ionicons name="card" size={18} color={Colors.bgPrimary} style={{ marginRight: 8 }} />
                <Text style={styles.payOverlayBtnText}>PAY £125 VIA STRIPE</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.refreshOverlayBtn} 
                onPress={handleRefreshStatus}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={styles.refreshOverlayBtnText}>I've paid, refresh chat</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Sticky action CTAs bar (hide if blocked) */}
      {!shouldBlockChat && !room.chatBlocked && room.listing && (
        <View style={styles.actionsBar}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutlineRed]}
            onPress={handleCounterOffer}
            activeOpacity={0.7}
          >
            <Ionicons name="pricetag-outline" size={13} color={Colors.accent} style={{ marginRight: 4 }} />
            <Text style={[styles.actionLabel, { color: Colors.accent }]}>Counter £{carPrice.toLocaleString('en-GB')}</Text>
          </TouchableOpacity>

          {!offerAccepted && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnGreen]}
              onPress={handleAcceptOffer}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle-outline" size={13} color={Colors.white} style={{ marginRight: 4 }} />
              <Text style={styles.actionLabel}>Accept Offer</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Bottom Text bar (hide if blocked) */}
      {!shouldBlockChat && !room.chatBlocked && (
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <IconButton
            style={styles.attachBtn}
            icon={
              uploadingPhoto
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Ionicons name="image-outline" size={18} color={Colors.white} />
            }
            onPress={handlePickPhoto}
            disabled={uploadingPhoto}
            accessibilityLabel="Send photo"
          />
          <TextInput
            style={styles.textInput}
            value={inputVal}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />

          <IconButton style={[styles.sendBtn, (!inputVal.trim() || uploadingPhoto) && styles.sendBtnDisabled]} icon={<Ionicons name="send" size={15} color={Colors.white} />} onPress={handleSend} disabled={!inputVal.trim() || uploadingPhoto} accessibilityLabel="Send message" />
        </View>
      )}

      <Modal
        visible={Boolean(reportTarget)}
        transparent
        animationType="fade"
        onRequestClose={closeReport}
      >
        <View style={styles.reportModalBackdrop}>
          <View style={styles.reportModalCard}>
            <View style={styles.reportModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportModalEyebrow}>Safety</Text>
                <Text style={styles.reportModalTitle}>Report message</Text>
              </View>
              <IconButton
                style={styles.reportModalClose}
                icon={<Ionicons name="close" size={20} color={Colors.white} />}
                onPress={closeReport}
                disabled={reporting}
                accessibilityLabel="Close report"
              />
            </View>

            <Text style={styles.reportModalHelp}>
              CarMazium moderators receive only the reported message and its attachment evidence, not your surrounding private conversation.
            </Text>

            {reportTarget && (
              <View style={styles.reportPreview}>
                <Text style={styles.reportPreviewText} numberOfLines={4}>
                  {reportTarget.content || (reportTarget.attachmentPath ? 'Photo message' : 'Message')}
                </Text>
              </View>
            )}

            <Text style={styles.reportSectionLabel}>Reason</Text>
            <View style={styles.reportReasonWrap}>
              {REPORT_REASONS.map((reason) => {
                const selected = reportReason === reason.value;
                return (
                  <TouchableOpacity
                    key={reason.value}
                    style={[
                      styles.reportReasonChip,
                      selected && styles.reportReasonChipSelected,
                    ]}
                    onPress={() => setReportReason(reason.value)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.reportReasonText,
                        selected && styles.reportReasonTextSelected,
                      ]}
                    >
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.reportSectionLabel}>Additional details (optional)</Text>
            <TextInput
              style={styles.reportDetailsInput}
              value={reportDetails}
              onChangeText={(value) => setReportDetails(value.slice(0, 1000))}
              placeholder="Tell the moderator what happened"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={1000}
            />

            <View style={styles.reportModalActions}>
              <TouchableOpacity
                style={styles.reportCancelButton}
                onPress={closeReport}
                disabled={reporting}
                activeOpacity={0.75}
              >
                <Text style={styles.reportCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.reportSubmitButton,
                  (!reportReason || reporting) && styles.reportSubmitDisabled,
                ]}
                onPress={() => void submitReport()}
                disabled={!reportReason || reporting}
                activeOpacity={0.8}
              >
                {reporting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Ionicons name="flag-outline" size={16} color={Colors.white} />
                )}
                <Text style={styles.reportSubmitText}>Submit report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.whiteAlpha05,
    backgroundColor: Colors.deepBlue_0d0d12,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
    marginLeft: -6,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dealerName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  onlineStatus: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.success,
    marginTop: 1,
  },
  // Listing Context banner
  listingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.whiteAlpha05,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  carImg: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.whiteAlpha02,
    marginRight: 12,
  },
  carMeta: {
    flex: 1,
  },
  carTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
    marginBottom: 2,
  },
  carPrice: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs + 1,
    color: Colors.textSecondary,
  },
  // Chat logs view
  chatArea: {
    flex: 1,
  },
  chatScroll: {
    padding: 18,
    paddingBottom: 26,
  },
  loadEarlierButton: {
    alignSelf: 'center',
    minWidth: 170,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  loadEarlierText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  dateSeparator: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs - 2,
    color: Colors.textMuted,
    textAlign: 'center',
    marginVertical: 16,
    letterSpacing: 1,
  },
  dealerBubbleWrapper: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  userBubbleWrapper: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  // maxWidth as an absolute px value (MAX_BUBBLE_WIDTH), not a '82%' string —
  // this View sits 3 levels deep (row > column(alignItems) > this), and a
  // percentage maxWidth has to be resolved back through that whole chain
  // before Yoga knows the real number. On Android that resolution can lag
  // behind the Text's own line-break measurement pass, so the text wraps
  // against a too-small guessed width and never re-flows once the container's
  // real (correct, much wider) size resolves — a single unbreakable word then
  // has nowhere to go but mid-word, and even "Hn kya scene hai?" wrapped after
  // just two words instead of using anywhere near the real available width.
  // A plain number needs no such resolution — it's known on the first pass.
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    maxWidth: MAX_BUBBLE_WIDTH,
    flexShrink: 1,
  },
  bubbleDealer: {
    backgroundColor: Colors.deepBlue_1c1d26,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: Colors.accent,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleFailed: {
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  bubbleText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.white,
    lineHeight: 20,
  },
  timeTextLeft: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  timeTextRight: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size9,
    color: Colors.whiteAlpha50,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  // Bubble stack (bubble + Instagram-style "Seen" row underneath)
  // No flexShrink here — `bubble` below already caps itself at maxWidth 82%
  // and owns the shrink. Stacking a second flexShrink:1 on this wrapper (as
  // it had before) double-applies Yoga's shrink pass with no flexBasis to
  // anchor it: single unbreakable "words" (no space to naturally wrap on)
  // got measured against an under-computed intermediate width and force-broke
  // mid-word, while a real conversation whose most common short messages are
  // more than one word masked it. offerMessageBubble/counterMessageCard below
  // never had this second wrapper and never showed the bug.
  bubbleStackRight: {
    alignItems: 'flex-end',
  },
  bubbleStackLeft: {
    alignItems: 'flex-start',
  },
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  msgFooterRight: {
    justifyContent: 'flex-end',
  },
  msgFooterLeft: {
    justifyContent: 'flex-start',
  },
  timeTextRightInline: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size9,
    color: Colors.whiteAlpha50,
  },
  timeTextLeftInline: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
  },
  readTick: {
    marginLeft: 4,
  },
  deliveryStateRow: {
    marginTop: 5,
    paddingHorizontal: 2,
  },
  deliveryStateText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
  },
  deliveryStateFailed: {
    color: Colors.warning,
    textDecorationLine: 'underline',
  },
  // "Seen" indicator (Instagram-style: tiny avatar + label under last read bubble)
  seenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
    paddingRight: 2,
  },
  seenAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seenAvatarText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.white,
  },
  seenText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
  },
  // Custom Offer messaging bubble
  offerMessageBubble: {
    backgroundColor: Colors.accent,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
    padding: 16,
    maxWidth: MAX_BUBBLE_WIDTH,
    flexShrink: 1,
  },
  offerTagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  offerTagTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.white,
    marginLeft: 6,
    flex: 1,
    letterSpacing: 0.8,
  },
  offerTagAmount: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  offerText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.white,
    lineHeight: 20,
  },
  // Custom Counter Card
  counterMessageCard: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha05,
    borderRadius: Radius.inline,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: MAX_BUBBLE_WIDTH,
  },
  counterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textSecondary,
    marginLeft: 6,
    flex: 1,
    letterSpacing: 0.8,
  },
  counterAmount: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  // Typing state details
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  typingText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.textFaint,
  },
  typingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.textFaint,
  },
  // Sticky action CTA bar
  actionsBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.deepBlue_0d0d12,
    borderTopWidth: 1,
    borderTopColor: Colors.whiteAlpha05,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 10,
  },
  actionBtnOutlineRed: {
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: 'transparent',
  },
  actionBtnOutlineDark: {
    borderWidth: 1,
    borderColor: Colors.whiteAlpha15,
    backgroundColor: 'transparent',
  },
  actionBtnGreen: {
    backgroundColor: Colors.accentGreen,
  },
  actionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.white,
  },
  photoMessageBubble: {
    padding: 8,
    borderRadius: 16,
    maxWidth: MAX_BUBBLE_WIDTH,
    overflow: 'hidden',
  },
  chatPhoto: {
    width: Math.min(MAX_BUBBLE_WIDTH - 16, 300),
    height: 220,
    borderRadius: 12,
    backgroundColor: Colors.deepBlue_16161c,
  },
  chatPhotoUnavailable: {
    width: Math.min(MAX_BUBBLE_WIDTH - 16, 300),
    minHeight: 150,
    borderRadius: 12,
    backgroundColor: Colors.deepBlue_16161c,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  chatPhotoUnavailableText: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    lineHeight: 15,
  },
  photoCaption: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  // Input row
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.deepBlue_0d0d12,
    borderTopWidth: 1,
    borderTopColor: Colors.whiteAlpha05,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  // minHeight + explicit lineHeight matter here: with only a maxHeight cap,
  // a short first message ("Hi") has this multiline Android EditText grow
  // from an unset/near-zero initial measurement, and its wrap width isn't
  // always settled by the time those first few characters paint — they
  // render stacked instead of side-by-side. A longer message forces a real
  // multi-line wrap, which triggers a full relayout against the correct
  // (by-then-settled) width and self-corrects. Giving it a fixed floor
  // height from the very first frame means there's no "grow into it" step
  // for short text to race against.
  textInput: {
    flex: 1,
    minHeight: 40,
    backgroundColor: Colors.deepBlue_16161c,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    lineHeight: 20,
    color: Colors.white,
    maxHeight: 80,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.deepBlue_1e1e24,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.deepBlue_1e1e24,
    opacity: 0.6,
  },
  // General Errors
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgPrimary,
  },
  errorText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.white,
    marginBottom: 10,
  },
  backBtnText: {
    padding: 10,
  },
  // Blocking Overlay
  blockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 12, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },
  blockingCard: {
    backgroundColor: Colors.deepBlue_16161c,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.warningAlpha20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: Colors.warning,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  trophyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.warningAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.warningAlpha25,
  },
  blockingTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  blockingDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  blockingSubDesc: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.warning,
    lineHeight: 18,
    marginBottom: 24,
    width: '100%',
    backgroundColor: Colors.warningAlpha05,
    padding: 16,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.warningAlpha10,
  },
  payOverlayBtn: {
    backgroundColor: Colors.warning,
    height: 50,
    borderRadius: Radius.inline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
  },
  payOverlayBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.bgPrimary,
    letterSpacing: 1,
  },
  refreshOverlayBtn: {
    height: 44,
    borderRadius: Radius.inline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
  },
  refreshOverlayBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
