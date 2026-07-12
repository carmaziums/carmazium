import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Platform, Text,
  TextInput, ScrollView, Keyboard, Modal, Pressable, Animated,
  LayoutAnimation, UIManager, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import {FontFamily, FontSize } from '../constants/typography';
import { useAuthStore } from '../store/authStore';
import { sendAiChatMessage, AiChatMessage } from '../lib/aiApi';
import { navigationRef } from '../lib/navigationRef';
import { CommonActions } from '@react-navigation/native';
import { Colors } from '../constants/colors';

import { IconButton } from './IconButton';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilterCard {
  label: string;
  params: Record<string, string>;
}

interface HistoryItem {
  id: string;
  text: string;
  isUser: boolean;
  filterCard?: FilterCard | null;
}

// ─── Rotating quick replies — same pool as web app ───────────────────────────

const ALL_QUICK_REPLIES = [
  { label: 'Show SUVs',       action: 'Show me SUVs'                },
  { label: 'Under £15k',      action: 'Cars under £15,000'          },
  { label: 'Diesel only',     action: 'Diesel cars'                 },
  { label: 'Electric',        action: 'Electric vehicles'           },
  { label: '2020+',           action: 'Cars from 2020 onwards'      },
  { label: 'Hatchbacks',      action: 'Show me hot hatchbacks'      },
  { label: 'Sports Cars',     action: 'Show me sports cars'         },
  { label: 'Family Cars',     action: 'Spacious family cars'        },
  { label: 'First Cars',      action: 'Good cars for new drivers'   },
  { label: 'Low CO2',         action: 'Cars with low CO2 emissions' },
  { label: 'Executive',       action: 'Executive saloons'           },
  { label: 'Best value',      action: 'Best value cars on CarMazium'},
];

function getDailyQuickReplies() {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const start = (dayIndex * 4) % ALL_QUICK_REPLIES.length;
  return Array.from({ length: 4 }, (_, i) => ALL_QUICK_REPLIES[(start + i) % ALL_QUICK_REPLIES.length]);
}

// ─── Typing dots ──────────────────────────────────────────────────────────────

const TypingDots: React.FC = () => {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - i * 150),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.dotsRow}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { opacity: dot, transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]}
        />
      ))}
    </View>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const GlobalAIChatBot: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Track the keyboard directly instead of wrapping the panel in a
  // KeyboardAvoidingView. The panel is a fixed-size, absolutely-positioned
  // box anchored via `bottom: chatBottom` — KeyboardAvoidingView's automatic
  // resize/padding of its flex container compounds with that fixed offset
  // and shoots the whole panel upward by more than the keyboard height,
  // often off the top of the screen. Instead, anchor the panel just above
  // the keyboard and shrink its height so it always stays fully on screen.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt, (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const [activeRoute, setActiveRoute] = useState('');
  useEffect(() => {
    const update = () => {
      try {
        if (navigationRef.isReady()) setActiveRoute(navigationRef.getCurrentRoute()?.name ?? '');
      } catch { /* not ready */ }
    };
    update();
    const unsub = navigationRef.addListener('state', update);
    return () => unsub();
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<HistoryItem[]>([
    { id: '1', text: "Hi! I'm MaziuM, your CarMazium AI. Tell me what you're looking for and I'll help you find it!", isUser: false },
  ]);
  const [quickReplies] = useState(() => getDailyQuickReplies());
  const scrollRef = useRef<ScrollView>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatHistory.length > 1) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
      return () => clearTimeout(t);
    }
  }, [chatHistory, isThinking]);

  // Scroll to bottom when chat is reopened (history already exists)
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 150);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!isAuthenticated || activeRoute === 'LiveAuctionDetailed') return null;

  // ── Navigate to Search with filterCard params ─────────────────────────────
  // CommonActions.navigate searches the full navigator tree — more reliable than
  // nested screen params when navigating from outside the navigator hierarchy.
  const applyFilterCard = (params: Record<string, string>) => {
    setIsOpen(false);
    setTimeout(() => {
      try {
        const navParams: Record<string, any> = { _t: Date.now() };
        if (params.fuelType) navParams.fuelType = params.fuelType;
        if (params.bodyType) navParams.bodyType = params.bodyType;
        if (params.maxPrice) navParams.maxPrice = Number(params.maxPrice);
        if (params.minPrice) navParams.minPrice = Number(params.minPrice);
        if (params.make) navParams.make = params.make;
        if (params.sortBy) navParams.sortBy = params.sortBy;
        navigationRef.dispatch(CommonActions.navigate({ name: 'Search', params: navParams }));
      } catch { /* nav not ready */ }
    }, 220);
  };

  const navigateFromChat = (nav?: 'Search' | 'Live' | 'SellCarFlow', navParams?: Record<string, any>) => {
    if (!nav) return;
    setIsOpen(false);
    setTimeout(() => {
      try {
        if (nav === 'SellCarFlow') {
          (navigationRef as any).navigate('Main', { screen: 'SellCarFlow' });
        } else if (nav === 'Live') {
          (navigationRef as any).navigate('Main', { screen: 'Tabs', params: { screen: 'Live' } });
        } else {
          (navigationRef as any).navigate('Main', {
            screen: 'Tabs',
            params: { screen: 'Search', params: { ...navParams, _t: Date.now() } },
          });
        }
      } catch { /* nav not ready */ }
    }, 220);
  };

  // ── Send a message ────────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    const userItem: HistoryItem = { id: Date.now().toString(), text: trimmed, isUser: true };
    const updated = [...chatHistory, userItem];
    setChatHistory(updated);
    setMessage('');
    setIsThinking(true);

    try {
      // Build last-10-message history with proper role mapping (web app pattern)
      const history: AiChatMessage[] = updated.slice(-10).map((m) => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.text,
      }));

      const result = await sendAiChatMessage(history);

      const botItem: HistoryItem = {
        id: (Date.now() + 1).toString(),
        text: result.text,
        isUser: false,
        filterCard: result.filterCard ?? null,
      };
      setChatHistory((prev) => [...prev, botItem]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), text: "I'm having a brief moment — please try again in a second!", isUser: false },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  // Chat box sits above the floating button (button at insets.bottom + 70, height 64px)
  const chatBottom = (insets.bottom || 16) + 145;
  const isKeyboardVisible = keyboardHeight > 0;
  const dynamicBottom = isKeyboardVisible ? keyboardHeight + 8 : chatBottom;
  const maxBoxHeight = windowHeight - insets.top - dynamicBottom - 24;
  const dynamicHeight = isKeyboardVisible ? Math.min(420, maxBoxHeight) : 420;

  return (
    <>
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setIsOpen(false)}>
          <Pressable
            style={[styles.chatBox, { bottom: dynamicBottom, height: dynamicHeight }]}
            onPress={() => {}}
          >

              {/* Header */}
              <View style={styles.chatHeader}>
                <View style={styles.chatHeaderLeft}>
                  <View style={styles.chatAvatar}>
                    <Text style={styles.chatAvatarText}>M</Text>
                  </View>
                  <View>
                    <Text style={styles.chatTitle}>MaziuM AI</Text>
                    <Text style={styles.chatStatus}>Always online</Text>
                  </View>
                </View>
                <IconButton style={styles.closeBtn} icon={<Ionicons name="close" size={20} color={Colors.white} />} onPress={() => setIsOpen(false)} accessibilityLabel="Close" />
              </View>

              {/* Messages */}
              <ScrollView ref={scrollRef} style={styles.chatScroll} contentContainerStyle={styles.chatScrollContent} showsVerticalScrollIndicator={false}>

                {chatHistory.map((msg) => (
                  <View key={msg.id}>
                    <View style={[styles.msgBubble, msg.isUser ? styles.msgUser : styles.msgAI]}>
                      <Text style={[styles.msgText, msg.isUser ? styles.msgTextUser : styles.msgTextAI]}>
                        {msg.text}
                      </Text>
                    </View>

                    {/* Filter card — tapping navigates to Search with the AI-suggested filters */}
                    {!msg.isUser && msg.filterCard && (
                      <TouchableOpacity
                        style={styles.filterCard}
                        activeOpacity={0.8}
                        onPress={() => applyFilterCard(msg.filterCard!.params)}
                      >
                        <View style={styles.filterCardIcon}>
                          <Ionicons name="search-outline" size={13} color={Colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.filterCardLabel}>APPLY FILTERS</Text>
                          <Text style={styles.filterCardTitle}>{msg.filterCard.label}</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={13} color={Colors.accent} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {/* Daily rotating quick replies — shown only before user sends anything */}
                {chatHistory.length === 1 && !isThinking && (
                  <View style={styles.quickPromptsWrap}>
                    {quickReplies.map((q) => (
                      <TouchableOpacity
                        key={q.label}
                        style={styles.quickPromptChip}
                        onPress={() => sendMessage(q.action)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.quickPromptText}>{q.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Animated typing indicator */}
                {isThinking && (
                  <View style={[styles.msgBubble, styles.msgAI]}>
                    <TypingDots />
                  </View>
                )}
              </ScrollView>

              {/* Input row */}
              <View style={styles.chatInputRow}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Ask anything about cars..."
                  placeholderTextColor={Colors.iconMuted}
                  value={message}
                  onChangeText={setMessage}
                  onSubmitEditing={() => sendMessage(message)}
                  returnKeyType="send"
                  editable={!isThinking}
                />
                <IconButton style={[styles.sendBtn, (isThinking || !message.trim()) && { opacity: 0.4 }]} icon={<Ionicons name="send" size={16} color={Colors.white} />} onPress={() => sendMessage(message)} disabled={isThinking || !message.trim()} accessibilityLabel="Send message" />
              </View>

          </Pressable>
        </Pressable>
      </Modal>

      {/* Floating bot button */}
      <View style={[styles.container, { bottom: (insets.bottom || 16) + 70 }]} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setIsOpen((v) => !v)}
          style={[styles.botButton, isOpen ? styles.botButtonActive : styles.botButtonInactive]}
        >
          {isOpen && <View style={styles.glowEffect} />}
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=200&q=80' }}
            style={styles.botImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View style={styles.overlayDesign}>
            <Text style={styles.mockFace}>M</Text>
            <View style={styles.mockSmileRow}>
              <View style={styles.mockEye} />
              <View style={styles.mockSmile} />
              <View style={styles.mockEye} />
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', right: 16, zIndex: 9999, alignItems: 'flex-end' },

  chatBox: {
    position: 'absolute', right: 16, width: 320,
    backgroundColor: Colors.bgSecondaryAlt, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.accentAlpha30,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 20, overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, backgroundColor: Colors.deepBlue_1e1e28,
    borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha05,
  },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  chatAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  chatAvatarText: { fontFamily: FontFamily.black, fontSize: FontSize.base, color: Colors.white },
  chatTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.white },
  chatStatus: { fontFamily: FontFamily.medium, fontSize: FontSize.size10, color: Colors.accentGreen },
  closeBtn: { padding: 4 },

  chatScroll: { flex: 1, backgroundColor: Colors.bgPrimary },
  chatScrollContent: { padding: 14, gap: 10 },

  msgBubble: { maxWidth: '85%', padding: 10, borderRadius: 14 },
  msgAI: { alignSelf: 'flex-start', backgroundColor: Colors.deepBlue_1e1e28, borderBottomLeftRadius: 4 },
  msgUser: { alignSelf: 'flex-end', backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  msgText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 18 },
  msgTextAI: { color: Colors.paleNearWhite_e0e0e0 },
  msgTextUser: { color: Colors.white },

  // Filter card
  filterCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 6, padding: 12, borderRadius: 12,
    backgroundColor: Colors.deepBlue_1a1a24, borderWidth: 1, borderColor: Colors.accentAlpha25,
    alignSelf: 'flex-start', maxWidth: '90%',
  },
  filterCardIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.accentAlpha10, alignItems: 'center', justifyContent: 'center',
  },
  filterCardLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size8, color: Colors.iconMuted, letterSpacing: 1 },
  filterCardTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.white, marginTop: 1 },

  // Quick reply chips
  quickPromptsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  quickPromptChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
    backgroundColor: Colors.accentAlpha08, borderWidth: 1, borderColor: Colors.accentAlpha20,
  },
  quickPromptText: { fontFamily: FontFamily.medium, fontSize: FontSize.size12, color: Colors.paleNearWhite_e0e0e0 },

  // Typing dots
  dotsRow: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.textSecondary },

  // Input row
  chatInputRow: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    backgroundColor: Colors.bgSecondaryAlt, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha05, gap: 8,
  },
  chatInput: {
    flex: 1, height: 38, backgroundColor: Colors.deepBlue_1e1e28, borderRadius: 19,
    paddingHorizontal: 14, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.white,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  // Bot button
  botButton: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.black,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    elevation: 8, borderWidth: 1, borderColor: Colors.accentAlpha20, overflow: 'visible',
  },
  botButtonActive: { opacity: 1, shadowOpacity: 0.8, shadowRadius: 16, transform: [{ scale: 1.05 }] },
  botButtonInactive: { opacity: 0.45, shadowOpacity: 0, shadowRadius: 0 },
  glowEffect: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accentAlpha15, zIndex: -1 },
  botImage: { width: 60, height: 60, borderRadius: 30, position: 'absolute', opacity: 0.2 },
  overlayDesign: {
    width: 48, height: 38, backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 3, borderColor: Colors.accent, alignItems: 'center', paddingTop: 2,
  },
  mockFace: { color: Colors.accent, fontWeight: '900', fontSize: FontSize.size14, lineHeight: 16 },
  mockSmileRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginTop: 2 },
  mockEye: { width: 8, height: 4, backgroundColor: Colors.black, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  mockSmile: { width: 6, height: 3, backgroundColor: Colors.black, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginBottom: 1 },
});
