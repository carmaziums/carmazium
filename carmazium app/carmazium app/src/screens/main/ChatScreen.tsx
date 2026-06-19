import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Linking,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useChat } from '../../context/ChatContext';
import { useAuthStore } from '../../store/authStore';
import { getChatMessages, markMessagesAsRead, type ChatMessage, type ChatRoom, type ChatUser } from '../../lib/chatApi';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { GlobalToastContext } from '../../components/GlobalToastProvider';

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

export const ChatScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
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
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

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

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, otherUserTyping]);

  // Subscribe to real-time events
  useEffect(() => {
    const unsubscribe = onNewMessage((message) => {
      if (message.chatRoomId === threadId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        markAsRead(threadId);
        markMessagesAsRead(threadId).catch((err) => console.warn('Failed to mark read:', err));
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

  if (loading) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color="#DC1F26" />
        <Text style={[styles.errorText, { marginTop: 12 }]}>Loading conversation...</Text>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Conversation not found</Text>
        <TouchableOpacity style={styles.backBtnText} onPress={() => navigation.goBack()}>
          <Text style={{ color: '#DC1F26' }}>Go Back</Text>
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

  const handleSend = () => {
    if (!inputVal.trim()) return;
    const textToSend = inputVal.trim();
    setInputVal('');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    stopTyping(threadId);

    // Send using live socket.io connection
    emitSendMessage(threadId, textToSend);
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

  const handlePayDeposit = async () => {
    if (!room.listing) return;
    try {
      setIsProcessingCheckout(true);
      const res = await apiClient<{ success: boolean; data: { url: string } }>('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({
          listingId: room.listing.id,
          amount: 125,
          type: 'COMMISSION',
          currency: 'gbp',
        }),
      });

      if (res.data?.url) {
        Linking.openURL(res.data.url);
      } else {
        Alert.alert('Checkout Error', 'Unable to initiate Stripe checkout. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start payment. Please try again.');
    } finally {
      setIsProcessingCheckout(false);
    }
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

  const getAvatarBg = (val: string) => {
    if (val === 'KM') return '#2A3047';
    if (val === 'MA') return '#1A3330';
    if (val === 'GS') return '#302038';
    return '#3B2424';
  };

  const carPrice = room.listing?.price ? parseFloat(String(room.listing.price)) : 0;
  const isDealer = room.otherUser.role === 'DEALER';

  // Hide "Accept Offer" if this user already sent an acceptance message in this thread
  const offerAccepted = messages.some(
    (m) => m.senderId === user?.id && m.content.startsWith("I accept the counter-offer"),
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: getAvatarBg(initials) }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* Dealer name and status */}
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.dealerName} numberOfLines={1}>{displayName}</Text>
            {isDealer && (
              <Ionicons name="checkmark-circle" size={14} color="#0084FF" style={{ marginLeft: 4 }} />
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

        {/* Action button */}
        <TouchableOpacity 
          style={styles.callBtn} 
          activeOpacity={0.7}
          onPress={() => Alert.alert('Voice Call', `Initiating call to ${displayName}...`)}
        >
          <Ionicons name="call-outline" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Listing context banner */}
      {room.listing && (
        <TouchableOpacity 
          style={styles.listingBanner}
          activeOpacity={0.8}
          onPress={() => Alert.alert('Listing Details', `Redirecting to listing details for ${room.listing?.title}...`)}
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
          <Ionicons name="chevron-forward" size={16} color="#5C5C6B" />
        </TouchableOpacity>
      )}

      {/* Main chat body with conditional overlay blocking */}
      <View style={{ flex: 1, position: 'relative' }}>
        {/* Conversations scroll area */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatScroll}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <Text style={styles.dateSeparator}>No messages yet</Text>
          ) : (
            <Text style={styles.dateSeparator}>LIVE CHAT LOGS</Text>
          )}

          {messages.map((msg, idx) => {
            const isOwn = msg.senderId === user?.id;
            const parsedSpecial = parseSpecialMessage(msg.content);
            const isLastOwnMessage = isOwn && !messages.slice(idx + 1).some((m) => m.senderId === user?.id);
            const showSeenIndicator = isOwn && msg.isRead && isLastOwnMessage;

            if (parsedSpecial?.type === 'offer') {
              return (
                <View key={msg.id} style={isOwn ? styles.userBubbleWrapper : styles.dealerBubbleWrapper}>
                  <View style={styles.offerMessageBubble}>
                    <View style={styles.offerTagHeader}>
                      <Ionicons name="pricetag" size={12} color="#FFFFFF" />
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
                <View key={msg.id} style={isOwn ? styles.userBubbleWrapper : styles.dealerBubbleWrapper}>
                  <View style={styles.counterMessageCard}>
                    <View style={styles.counterHeader}>
                      <Ionicons name="pricetag" size={12} color="#A8A8B3" />
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
              <View key={msg.id} style={isOwn ? styles.userBubbleWrapper : styles.dealerBubbleWrapper}>
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
                          color={msg.isRead ? '#4FA8FF' : 'rgba(255,255,255,0.45)'}
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
          })}

          {/* Live typing indicator — animated bouncing dots, Instagram/WhatsApp-style */}
          {otherUserTyping && (
            <View style={styles.dealerBubbleWrapper}>
              <View style={[styles.bubble, styles.bubbleDealer, styles.typingBubble]}>
                <TypingDots />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Blocking Overlay for deposit check */}
        {shouldBlockChat && (
          <View style={styles.blockingOverlay}>
            <View style={styles.blockingCard}>
              <View style={styles.trophyIconWrap}>
                <Ionicons name="trophy" size={40} color="#F59E0B" />
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
                disabled={isProcessingCheckout}
                activeOpacity={0.8}
              >
                {isProcessingCheckout ? (
                  <ActivityIndicator size="small" color="#0A0A0C" />
                ) : (
                  <>
                    <Ionicons name="card" size={18} color="#0A0A0C" style={{ marginRight: 8 }} />
                    <Text style={styles.payOverlayBtnText}>PAY £125 VIA STRIPE</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.refreshOverlayBtn} 
                onPress={handleRefreshStatus}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={16} color="#A0A0AB" style={{ marginRight: 6 }} />
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
            <Ionicons name="pricetag-outline" size={13} color="#DC1F26" style={{ marginRight: 4 }} />
            <Text style={[styles.actionLabel, { color: '#DC1F26' }]}>Counter £{carPrice.toLocaleString('en-GB')}</Text>
          </TouchableOpacity>

          {!offerAccepted && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnGreen]}
              onPress={handleAcceptOffer}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.actionLabel}>Accept Offer</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Bottom Text bar (hide if blocked) */}
      {!shouldBlockChat && (
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={styles.attachBtn} activeOpacity={0.7}>
            <Ionicons name="attach" size={22} color="#A0A0AB" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.textInput}
            value={inputVal}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor="#5C5C6B"
            multiline
          />

          <TouchableOpacity 
            style={[styles.sendBtn, !inputVal.trim() && styles.sendBtnDisabled]} 
            onPress={handleSend}
            disabled={!inputVal.trim()}
            activeOpacity={0.7}
          >
            <Ionicons name="send" size={15} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#0D0D12',
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
    fontSize: 14,
    color: '#FFFFFF',
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
    color: '#FFFFFF',
  },
  onlineStatus: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: '#22C55E',
    marginTop: 1,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Listing Context banner
  listingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111115',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  carImg: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginRight: 12,
  },
  carMeta: {
    flex: 1,
  },
  carTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  carPrice: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs + 1,
    color: '#A0A0AB',
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
    color: '#5C5C6B',
    textAlign: 'center',
    marginVertical: 16,
    letterSpacing: 1,
  },
  dealerBubbleWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  userBubbleWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    maxWidth: '82%',
  },
  bubbleDealer: {
    backgroundColor: '#1C1D26',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: '#DC1F26',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  timeTextLeft: {
    fontFamily: FontFamily.regular,
    fontSize: 9,
    color: '#5C5C6B',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  timeTextRight: {
    fontFamily: FontFamily.regular,
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  // Bubble stack (bubble + Instagram-style "Seen" row underneath)
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
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  timeTextLeftInline: {
    fontFamily: FontFamily.regular,
    fontSize: 9,
    color: '#5C5C6B',
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
    fontSize: 8,
    color: '#FFFFFF',
  },
  seenText: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: '#5C5C6B',
  },
  // Custom Offer messaging bubble
  offerMessageBubble: {
    backgroundColor: '#DC1F26',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
    padding: 16,
    maxWidth: '82%',
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
    fontSize: 9,
    color: '#FFFFFF',
    marginLeft: 6,
    flex: 1,
    letterSpacing: 0.8,
  },
  offerTagAmount: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
  offerText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  // Custom Counter Card
  counterMessageCard: {
    backgroundColor: '#111115',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
    fontSize: 9,
    color: '#A0A0AB',
    marginLeft: 6,
    flex: 1,
    letterSpacing: 0.8,
  },
  counterAmount: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  // Typing state details
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  typingText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#8A8A93',
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
    backgroundColor: '#8A8A93',
  },
  // Sticky action CTA bar
  actionsBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0D0D12',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
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
    borderColor: '#DC1F26',
    backgroundColor: 'transparent',
  },
  actionBtnOutlineDark: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'transparent',
  },
  actionBtnGreen: {
    backgroundColor: '#10B981',
  },
  actionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
  },
  // Input row
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D12',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  attachBtn: {
    padding: 6,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#16161C',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A32',
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#FFFFFF',
    maxHeight: 80,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DC1F26',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#1E1E24',
    opacity: 0.6,
  },
  // General Errors
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0C',
  },
  errorText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
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
    backgroundColor: '#16161C',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  trophyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  blockingTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  blockingDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#A0A0AB',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  blockingSubDesc: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#F59E0B',
    lineHeight: 18,
    marginBottom: 24,
    width: '100%',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.1)',
  },
  payOverlayBtn: {
    backgroundColor: '#F59E0B',
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
    fontSize: 14,
    color: '#0A0A0C',
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  refreshOverlayBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#A0A0AB',
  },
});
