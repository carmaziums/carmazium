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
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useChat } from '../../context/ChatContext';
import { useAuthStore } from '../../store/authStore';
import { getChatMessages, markMessagesAsRead, type ChatMessage, type ChatRoom, type ChatUser } from '../../lib/chatApi';
import { getListingById } from '../../lib/listingsApi';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { GlobalToastContext } from '../../components/GlobalToastProvider';

import { IconButton } from '../../components/IconButton';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

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
}

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ msg, isOwn, isLastOwnMessage, initials }) => {
  const parsedSpecial = parseSpecialMessage(msg.content);
  const showSeenIndicator = isOwn && msg.isRead && isLastOwnMessage;

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
            {isOwn && msg.isRead && ' ✓✓'}
          </Text>
        </View>
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
            {isOwn && msg.isRead && ' ✓✓'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={isOwn ? styles.userBubbleWrapper : styles.dealerBubbleWrapper}>
      <View style={isOwn ? styles.bubbleStackRight : styles.bubbleStackLeft}>
        <View style={[styles.bubble, isOwn ? styles.bubbleUser : styles.bubbleDealer]}>
          <Text style={styles.bubbleText}>{msg.content}</Text>
          <View style={[styles.msgFooter, isOwn ? styles.msgFooterRight : styles.msgFooterLeft]}>
            <Text style={isOwn ? styles.timeTextRightInline : styles.timeTextLeftInline}>
              {formatMessageTime(msg.createdAt)}
            </Text>
            {isOwn && (
              <Ionicons
                name={msg.isRead ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={msg.isRead ? Colors.lightBlue_4fa8ff : 'rgba(255,255,255,0.45)'}
                style={styles.readTick}
              />
            )}
          </View>
        </View>

        {/* Instagram-style "Seen" indicator beneath the last read bubble */}
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputVal, setInputVal] = useState('');
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  // Must live here, not after the `if (!room) return` guard below — a hook
  // called only on some renders (e.g. once `loading`/`room` resolve) violates
  // the Rules of Hooks and crashes the screen to blank on the next render.
  const [openingListing, setOpeningListing] = useState(false);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial messages and mark as read
  useEffect(() => {
    async function loadMessages() {
      try {
        setLoading(true);
        const res = await getChatMessages(threadId);
        setMessages(res.data);
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

  // Subscribe to real-time events
  useEffect(() => {
    const unsubscribe = onNewMessage((message) => {
      if (message.chatRoomId === threadId) {
        setMessages((prev) => {
          // Skip exact duplicate IDs
          if (prev.some((m) => m.id === message.id)) return prev;
          // Remove optimistic placeholder for our own messages (matched by content+sender)
          const withoutOptimistic = prev.filter(
            (m) => !(m.id.startsWith('opt-') && m.senderId === message.senderId && m.content === message.content)
          );
          return [...withoutOptimistic, message];
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

  const renderMessageItem = useCallback(({ item }: { item: ChatMessage }) => (
    <MessageBubble
      msg={item}
      isOwn={item.senderId === user?.id}
      isLastOwnMessage={item.id === lastOwnMessageId}
      initials={initialsForBubbles}
    />
  ), [user?.id, lastOwnMessageId, initialsForBubbles]);

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

  const handleSend = () => {
    if (!inputVal.trim()) return;
    const textToSend = inputVal.trim();
    setInputVal('');

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    stopTyping(threadId);

    // Optimistically show the sent message immediately so the user sees it
    // without waiting for socket confirmation.
    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg = {
      id: optimisticId,
      chatRoomId: threadId,
      senderId: user?.id ?? '',
      content: textToSend,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isRead: false,
      sender: { id: user?.id ?? '', firstName: user?.firstName ?? null, lastName: user?.lastName ?? null, profileImage: user?.profileImage ?? null },
    } as ChatMessage;
    setMessages((prev) => [...prev, optimisticMsg]);

    // Send via socket; onNewMessage will replace the optimistic entry when
    // the server echoes it back (matched by content + sender).
    emitSendMessage(threadId, textToSend);

    // Refresh rooms list so MessagesScreen shows the latest message preview.
    refreshRooms().catch(() => {});
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

  const handleAcceptOffer = () => {
    const text = "I accept the counter-offer. Let's finalize the paperwork.";
    emitSendMessage(threadId, text);
    showToast('Accepted!', 'success');
  };

  const handleCounterOffer = () => {
    const text = `Counter-offer: £${carPrice.toLocaleString('en-GB')}`;
    emitSendMessage(threadId, text);
    showToast('Counter-offer sent!', 'info');
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
            <Text style={styles.dateSeparator}>
              {messages.length === 0 ? 'No messages yet' : 'LIVE CHAT LOGS'}
            </Text>
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
      {!shouldBlockChat && room.listing && (
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
      {!shouldBlockChat && (
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {/* Chat has no file-attachment support in the DTO/socket protocol
              (ChatMessage is content-only) — removed the dead attach button
              rather than faking it (mobile-ui-ux-audit.md §C13 precedent). */}
          <TextInput
            style={styles.textInput}
            value={inputVal}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />

          <IconButton style={[styles.sendBtn, !inputVal.trim() && styles.sendBtnDisabled]} icon={<Ionicons name="send" size={15} color={Colors.white} />} onPress={handleSend} disabled={!inputVal.trim()} accessibilityLabel="Send message" />
        </View>
      )}
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
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    maxWidth: '82%',
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
    maxWidth: '82%',
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
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '82%',
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
    borderRadius: 18,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.warningAlpha10,
  },
  payOverlayBtn: {
    backgroundColor: Colors.warning,
    height: 50,
    borderRadius: 12,
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
    borderRadius: 12,
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
