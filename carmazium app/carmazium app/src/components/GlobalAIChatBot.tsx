import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Platform, Text,
  TextInput, ScrollView, KeyboardAvoidingView, Modal, Pressable, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { FontFamily } from '../constants/typography';
import { useAuthStore } from '../store/authStore';
import { sendAiChatMessage, AiChatMessage } from '../lib/aiApi';
import { navigationRef } from '../lib/navigationRef';

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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

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

  useEffect(() => {
    if (chatHistory.length > 1) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
      return () => clearTimeout(t);
    }
  }, [chatHistory, isThinking]);

  if (!isAuthenticated || activeRoute === 'LiveAuctionDetailed') return null;

  // ── Navigate to Search with filterCard params ─────────────────────────────
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
        (navigationRef as any).navigate('Main', {
          screen: 'Tabs',
          params: { screen: 'Search', params: navParams },
        });
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

  return (
    <>
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsOpen(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={{ flex: 1 }} onPress={() => setIsOpen(false)}>
            <Pressable style={[styles.chatBox, { bottom: chatBottom }]} onPress={() => {}}>

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
                <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
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
                          <Ionicons name="search-outline" size={13} color="#DC1F26" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.filterCardLabel}>APPLY FILTERS</Text>
                          <Text style={styles.filterCardTitle}>{msg.filterCard.label}</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={13} color="#DC1F26" />
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
                  placeholderTextColor="#606070"
                  value={message}
                  onChangeText={setMessage}
                  onSubmitEditing={() => sendMessage(message)}
                  returnKeyType="send"
                  editable={!isThinking}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (isThinking || !message.trim()) && { opacity: 0.4 }]}
                  onPress={() => sendMessage(message)}
                  disabled={isThinking || !message.trim()}
                >
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
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
    position: 'absolute', right: 16, width: 320, height: 420,
    backgroundColor: '#111116', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(220,31,38,0.3)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 20, overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, backgroundColor: '#1E1E28',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  chatAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#DC1F26',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  chatAvatarText: { fontFamily: FontFamily.black, fontSize: 15, color: '#FFFFFF' },
  chatTitle: { fontFamily: FontFamily.bold, fontSize: 14, color: '#FFFFFF' },
  chatStatus: { fontFamily: FontFamily.medium, fontSize: 10, color: '#10B981' },
  closeBtn: { padding: 4 },

  chatScroll: { flex: 1, backgroundColor: '#0A0A0C' },
  chatScrollContent: { padding: 14, gap: 10 },

  msgBubble: { maxWidth: '85%', padding: 10, borderRadius: 14 },
  msgAI: { alignSelf: 'flex-start', backgroundColor: '#1E1E28', borderBottomLeftRadius: 4 },
  msgUser: { alignSelf: 'flex-end', backgroundColor: '#DC1F26', borderBottomRightRadius: 4 },
  msgText: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  msgTextAI: { color: '#E0E0E0' },
  msgTextUser: { color: '#FFFFFF' },

  // Filter card
  filterCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 6, padding: 12, borderRadius: 12,
    backgroundColor: '#1A1A24', borderWidth: 1, borderColor: 'rgba(220,31,38,0.25)',
    alignSelf: 'flex-start', maxWidth: '90%',
  },
  filterCardIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(220,31,38,0.10)', alignItems: 'center', justifyContent: 'center',
  },
  filterCardLabel: { fontFamily: FontFamily.bold, fontSize: 8, color: '#606070', letterSpacing: 1 },
  filterCardTitle: { fontFamily: FontFamily.bold, fontSize: 12, color: '#FFFFFF', marginTop: 1 },

  // Quick reply chips
  quickPromptsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  quickPromptChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
    backgroundColor: 'rgba(220,31,38,0.08)', borderWidth: 1, borderColor: 'rgba(220,31,38,0.2)',
  },
  quickPromptText: { fontFamily: FontFamily.medium, fontSize: 12, color: '#E0E0E0' },

  // Typing dots
  dotsRow: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A0A0AB' },

  // Input row
  chatInputRow: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    backgroundColor: '#111116', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', gap: 8,
  },
  chatInput: {
    flex: 1, height: 38, backgroundColor: '#1E1E28', borderRadius: 19,
    paddingHorizontal: 14, fontFamily: FontFamily.regular, fontSize: 13, color: '#FFFFFF',
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#DC1F26',
    alignItems: 'center', justifyContent: 'center',
  },

  // Bot button
  botButton: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#000000',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#DC1F26', shadowOffset: { width: 0, height: 4 },
    elevation: 8, borderWidth: 1, borderColor: 'rgba(220,31,38,0.2)', overflow: 'visible',
  },
  botButtonActive: { opacity: 1, shadowOpacity: 0.8, shadowRadius: 16, transform: [{ scale: 1.05 }] },
  botButtonInactive: { opacity: 0.45, shadowOpacity: 0, shadowRadius: 0 },
  glowEffect: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(220,31,38,0.15)', zIndex: -1 },
  botImage: { width: 60, height: 60, borderRadius: 30, position: 'absolute', opacity: 0.2 },
  overlayDesign: {
    width: 48, height: 38, backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 3, borderColor: '#DC1F26', alignItems: 'center', paddingTop: 2,
  },
  mockFace: { color: '#DC1F26', fontWeight: '900', fontSize: 14, lineHeight: 16 },
  mockSmileRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginTop: 2 },
  mockEye: { width: 8, height: 4, backgroundColor: '#000000', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  mockSmile: { width: 6, height: 3, backgroundColor: '#000000', borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginBottom: 1 },
});
