import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Platform, Text,
  TextInput, ScrollView, Keyboard, Modal, Pressable, Animated, Alert,
  LayoutAnimation, UIManager, useWindowDimensions, ActivityIndicator, AppState,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import {FontFamily, FontSize } from '../constants/typography';
import { useAuthStore } from '../store/authStore';
import { sendAiChatMessage, reportAiResponse, AiChatMessage, type AiReportReason } from '../lib/aiApi';
import { navigationRef } from '../lib/navigationRef';
import { CommonActions } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { IconButton } from './IconButton';
import { useReduceMotionPreference } from '../hooks/useReduceMotionPreference';
import { getBottomTabBarHeight } from '../lib/nativeLayoutParity';

// Bundle the exact approved transparent mascot used by the website widget.
// This avoids a network-dependent icon or any visual placeholder.
const MAZIUM_MASCOT = require('../../assets/images/mazium-bot-3d.png');
const MAZIUM_TRIGGER_SIZE = 64;
const MAZIUM_TAB_CLEARANCE = 96;
const MAZIUM_CHAT_GAP = 12;
const MAZIUM_GREETING_INTERVAL_MS = 20_000;
const MAZIUM_GREETING_STORAGE_PREFIX = 'mazium_greeting_dismissed:';

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
  prompt?: string;
  reportable?: boolean;
  filterCard?: FilterCard | null;
}

// ─── Rotating quick replies — same pool as web app ───────────────────────────

const ALL_QUICK_REPLIES = [
  { label: 'Show SUVs',       action: 'Show me SUVs'                },
  { label: 'Under £15k',      action: 'Cars under £15,000'          },
  { label: 'Diesel only',     action: 'Diesel cars'                 },
  { label: 'Electric',        action: 'Electric vehicles'           },
  { label: '2020+',           action: 'Cars from 2020 onwards'      },
  { label: 'ULEZ',            action: 'ULEZ compliant cars'        },
  { label: 'Hatchbacks',      action: 'Show me hot hatchbacks'      },
  { label: 'Sports Cars',     action: 'Show me sports cars'         },
  { label: 'Family Cars',     action: 'Spacious family cars'        },
  { label: 'First Cars',      action: 'Good cars for new drivers'   },
  { label: 'Low CO2',         action: 'Cars with low CO2 emissions' },
  { label: 'Executive',       action: 'Executive saloons'           },
];

function getDailyQuickReplies() {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const start = (dayIndex * 4) % ALL_QUICK_REPLIES.length;
  return Array.from({ length: 4 }, (_, i) => ALL_QUICK_REPLIES[(start + i) % ALL_QUICK_REPLIES.length]);
}

// ─── Typing dots ──────────────────────────────────────────────────────────────

const TypingDots: React.FC = () => {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const reduceMotion = useReduceMotionPreference();

  useEffect(() => {
    if (reduceMotion) {
      dots.forEach((dot) => dot.setValue(0));
      return;
    }

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
  }, [reduceMotion]);

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

// ─── Error boundary ───────────────────────────────────────────────────────────
// The chat panel is a `transparent` Modal — if anything inside throws during
// render with no boundary, React unmounts the failing subtree and leaves only
// the Modal's dim backdrop visible, which reads as "the screen went black."
// This catches that case and shows a recoverable fallback instead.
class ChatErrorBoundary extends React.Component<
  { onReset: () => void; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { onReset: () => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    if (__DEV__) console.warn('[GlobalAIChatBot] chat panel crashed:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorFallback}>
          <Ionicons name="alert-circle-outline" size={28} color={Colors.accent} />
          <Text style={styles.errorFallbackText}>Something went wrong with chat.</Text>
          <TouchableOpacity
            style={styles.errorFallbackBtn}
            activeOpacity={0.8}
            onPress={() => {
              this.setState({ hasError: false });
              this.props.onReset();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close MaziuM AI"
          >
            <Text style={styles.errorFallbackBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export const GlobalAIChatBot: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth, fontScale } = useWindowDimensions();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authUserId = useAuthStore((s) => s.user?.id || '');
  const aiConsentKey = authUserId ? `mazium_ai_consent_v1:${authUserId}` : '';

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
  const [isForeground, setIsForeground] = useState(AppState.currentState === 'active');
  const [showGreeting, setShowGreeting] = useState(false);
  // Each signed-in account has its own opt-out. Do not reuse a previous
  // account's async read while the shared widget switches users.
  const [greetingState, setGreetingState] = useState<{ userId: string; dismissed: boolean } | null>(null);
  const greetingStorageKey = authUserId ? MAZIUM_GREETING_STORAGE_PREFIX + authUserId : '';

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setIsForeground(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setShowGreeting(false);
    setGreetingState(null);
    if (!authUserId || !greetingStorageKey) return;
    AsyncStorage.getItem(greetingStorageKey)
      .then((value) => {
        if (!cancelled) setGreetingState({ userId: authUserId, dismissed: value === 'true' });
      })
      .catch(() => {
        // A failed preference read must not trigger repeated unsolicited popups.
        if (!cancelled) setGreetingState({ userId: authUserId, dismissed: true });
      });
    return () => { cancelled = true; };
  }, [authUserId, greetingStorageKey]);

  // Match the website's initial greeting and 20s visible/hidden cadence.
  // Do not run a timer when backgrounded or after permanent dismissal.
  useEffect(() => {
    const eligible = isAuthenticated && Boolean(authUserId) && isForeground &&
      greetingState?.userId === authUserId && greetingState.dismissed === false;
    if (!eligible) {
      setShowGreeting(false);
      return;
    }
    setShowGreeting(true);
    const timer = setInterval(() => setShowGreeting((visible) => !visible), MAZIUM_GREETING_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isAuthenticated, authUserId, greetingState, isForeground]);

  const dismissGreeting = () => {
    if (!authUserId || !greetingStorageKey) return;
    setShowGreeting(false);
    setGreetingState({ userId: authUserId, dismissed: true });
    void AsyncStorage.setItem(greetingStorageKey, 'true').catch(() => {
      // Still suppress for this session; never claim persistence on write failure.
    });
  };
  const [message, setMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<HistoryItem[]>([
    { id: '1', text: "Hi! I'm Mazium, your AI car-buying assistant. Tell me what you're looking for and I'll find it!", isUser: false },
  ]);
  const [quickReplies] = useState(() => getDailyQuickReplies());
  const [hasAiConsent, setHasAiConsent] = useState<boolean | null>(null);
  const [reportedResponseIds, setReportedResponseIds] = useState<Set<string>>(new Set());
  const [aiReportTarget, setAiReportTarget] = useState<HistoryItem | null>(null);
  const [aiReportReason, setAiReportReason] = useState<AiReportReason | null>(null);
  const [aiReportDetails, setAiReportDetails] = useState('');
  const [aiReporting, setAiReporting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // The native widget lives across account changes. Never show a prior user's
  // prompts or report details after logout, login or a switch of dealer account.
  useEffect(() => {
    setIsOpen(false);
    setMessage('');
    setIsThinking(false);
    setChatHistory([
      { id: '1', text: "Hi! I'm Mazium, your AI car-buying assistant. Tell me what you're looking for and I'll find it!", isUser: false },
    ]);
    setReportedResponseIds(new Set());
    setAiReportTarget(null);
    setAiReportReason(null);
    setAiReportDetails('');
    setAiReporting(false);
  }, [authUserId]);

  useEffect(() => {
    let cancelled = false;
    if (!aiConsentKey) {
      setHasAiConsent(false);
      return;
    }
    setHasAiConsent(null);
    AsyncStorage.getItem(aiConsentKey)
      .then((value) => { if (!cancelled) setHasAiConsent(value === 'accepted'); })
      .catch(() => { if (!cancelled) setHasAiConsent(false); });
    return () => { cancelled = true; };
  }, [aiConsentKey]);

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
    if (!trimmed || isThinking || hasAiConsent !== true) return;
    const senderId = authUserId;
    const sameSignedInUser = () => useAuthStore.getState().user?.id === senderId;

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
        prompt: trimmed,
        reportable: true,
        filterCard: result.filterCard ?? null,
      };
      if (sameSignedInUser()) setChatHistory((prev) => [...prev, botItem]);
    } catch {
      if (sameSignedInUser()) setChatHistory((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), text: 'Something went wrong. Please try again!', isUser: false },
      ]);
    } finally {
      if (sameSignedInUser()) setIsThinking(false);
    }
  };

  const acceptAiConsent = async () => {
    try {
      if (!aiConsentKey) return;
      await AsyncStorage.setItem(aiConsentKey, 'accepted');
      setHasAiConsent(true);
    } catch {
      setHasAiConsent(false);
    }
  };

  const openAiPrivacy = () => {
    setIsOpen(false);
    setTimeout(() => {
      try {
        (navigationRef as any).navigate('Main', { screen: 'PrivacyPolicy' });
      } catch {
        // Navigation may still be hydrating; the privacy policy remains
        // available from the signed-in drawer as a fallback.
      }
    }, 180);
  };

  const withdrawAiConsent = async () => {
    try {
      if (aiConsentKey) await AsyncStorage.removeItem(aiConsentKey);
    } finally {
      setHasAiConsent(false);
      setMessage('');
    }
  };

  const showAiPrivacyOptions = () => {
    Alert.alert(
      'MaziuM AI privacy',
      'You can view the privacy policy or stop sending prompts to OpenAI. You can opt in again later.',
      [
        { text: 'View privacy', onPress: openAiPrivacy },
        { text: 'Stop AI sharing', style: 'destructive', onPress: () => void withdrawAiConsent() },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const closeAiReport = () => {
    if (aiReporting) return;
    setAiReportTarget(null);
    setAiReportReason(null);
    setAiReportDetails('');
  };

  const submitAiReport = async () => {
    if (!aiReportTarget || !aiReportReason || aiReporting) return;
    try {
      setAiReporting(true);
      await reportAiResponse({
        prompt: aiReportTarget.prompt,
        response: aiReportTarget.text,
        reason: aiReportReason,
        details: aiReportDetails.trim() || undefined,
      });
      setReportedResponseIds((prev) => {
        const next = new Set(prev);
        next.add(aiReportTarget.id);
        return next;
      });
      setAiReportTarget(null);
      setAiReportReason(null);
      setAiReportDetails('');
      Alert.alert('Report sent', 'CarMazium will review this AI response.');
    } catch (error) {
      Alert.alert(
        'Could not send report',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setAiReporting(false);
    }
  };

  const openAiReport = (item: HistoryItem) => {
    if (reportedResponseIds.has(item.id)) return;
    setAiReportTarget(item);
    setAiReportReason(null);
    setAiReportDetails('');
  };

  // Reuse the same large-text bottom bar geometry as dealer More; the AI
  // launcher must stay above the expanded tabs at 200% system font size.
  // On the normal scale retain the established trigger position.
  const tabClearance = Math.max(MAZIUM_TAB_CLEARANCE, getBottomTabBarHeight(fontScale) + 8);
  const floatingBottom = Math.max(insets.bottom, 16) + tabClearance;
  const chatBottom = floatingBottom + MAZIUM_TRIGGER_SIZE + MAZIUM_CHAT_GAP;
  const isKeyboardVisible = keyboardHeight > 0;
  const dynamicBottom = isKeyboardVisible ? keyboardHeight + 8 : chatBottom;
  const maxBoxHeight = windowHeight - insets.top - dynamicBottom - 24;
  // Match the web assistant's roomy conversation panel while respecting
  // small-screen safe areas and the Android/iOS keyboard.
  const dynamicHeight = Math.max(0, Math.min(540, maxBoxHeight));
  const chatWidth = Math.max(0, Math.min(340, windowWidth - 24));

  return (
    <>
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.chatBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable
            style={[styles.chatBox, { bottom: dynamicBottom, height: dynamicHeight, width: chatWidth }]}
            onPress={() => {}}
          >
            <ChatErrorBoundary onReset={() => setIsOpen(false)}>

              {/* Header */}
              <LinearGradient colors={[Colors.bgBody, Colors.bgElevated]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chatHeader}>
                <View style={styles.chatHeaderLeft}>
                  <View style={styles.chatAvatar}>
                    <Image source={MAZIUM_MASCOT} style={styles.chatAvatarImage} contentFit="contain" />
                    <View style={styles.botAccentDot} />
                  </View>
                  <View>
                    <Text style={styles.chatTitle}>Mazium AI</Text>
                    <Text style={styles.chatStatus}>Car-buying assistant</Text>
                  </View>
                </View>
                <View style={styles.chatHeaderActions}>
                  <IconButton
                    style={styles.closeBtn}
                    icon={<Ionicons name="shield-checkmark-outline" size={18} color={Colors.textSecondary} />}
                    onPress={showAiPrivacyOptions}
                    accessibilityLabel="MaziuM AI privacy options"
                  />
                  <IconButton style={styles.closeBtn} icon={<Ionicons name="close" size={20} color={Colors.white} />} onPress={() => setIsOpen(false)} accessibilityLabel="Close MaziuM AI assistant" />
                </View>
              </LinearGradient>

              {/* Messages */}
              <ScrollView ref={scrollRef} style={styles.chatScroll} contentContainerStyle={styles.chatScrollContent} showsVerticalScrollIndicator={false}>

                {hasAiConsent === false && (
                  <View style={styles.aiConsentCard}>
                    <View style={styles.aiConsentTitleRow}>
                      <Ionicons name="shield-checkmark-outline" size={16} color={Colors.accent} />
                      <Text style={styles.aiConsentTitle}>Before you use Mazium AI</Text>
                    </View>
                    <Text style={styles.aiConsentText}>
                      Your message and recent Mazium chat context are sent to OpenAI to generate a response. AI can make mistakes, so verify important vehicle or finance information. Do not include passwords, payment credentials or unnecessary sensitive personal information.
                    </Text>
                    <View style={styles.aiConsentActions}>
                      <TouchableOpacity
                        style={styles.aiConsentPrimary}
                        onPress={() => void acceptAiConsent()}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Accept MaziuM AI data sharing and continue"
                      >
                        <Text style={styles.aiConsentPrimaryText}>I understand & continue</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.aiConsentSecondary}
                        onPress={openAiPrivacy}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="View MaziuM AI privacy policy"
                      >
                        <Text style={styles.aiConsentSecondaryText}>Privacy</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {chatHistory.map((msg) => (
                  <View key={msg.id}>
                    <View style={[styles.msgBubble, msg.isUser ? styles.msgUser : styles.msgAI]}>
                      <Text style={[styles.msgText, msg.isUser ? styles.msgTextUser : styles.msgTextAI]}>
                        {msg.text}
                      </Text>
                    </View>

                    {!msg.isUser && msg.reportable && (
                      <TouchableOpacity
                        style={styles.aiReportButton}
                        onPress={() => openAiReport(msg)}
                        disabled={reportedResponseIds.has(msg.id)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Report AI response"
                      >
                        <Ionicons
                          name="flag-outline"
                          size={12}
                          color={reportedResponseIds.has(msg.id) ? Colors.success : Colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.aiReportText,
                            reportedResponseIds.has(msg.id) && styles.aiReportTextDone,
                          ]}
                        >
                          {reportedResponseIds.has(msg.id) ? 'Reported' : 'Report AI response'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Filter card — tapping navigates to Search with the AI-suggested filters */}
                    {!msg.isUser && msg.filterCard && (
                      <TouchableOpacity
                        style={styles.filterCard}
                        activeOpacity={0.8}
                        onPress={() => applyFilterCard(msg.filterCard!.params)}
                        accessibilityRole="button"
                        accessibilityLabel={`Apply filters: ${msg.filterCard.label}`}
                        accessibilityHint="Opens Search with these suggested filters"
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

                {/* Animated typing indicator */}
                {isThinking && (
                  <View
                    style={[styles.msgBubble, styles.msgAI]}
                    accessibilityLiveRegion="polite"
                    accessibilityLabel="MaziuM is thinking"
                  >
                    <TypingDots />
                  </View>
                )}
              </ScrollView>

              {/* Website-equivalent persistent daily quick replies, horizontally scrollable. */}
              <View style={styles.quickRepliesRail}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="always" contentContainerStyle={styles.quickPromptsWrap}>
                  {quickReplies.map((q) => (
                    <TouchableOpacity
                      key={q.label}
                      style={styles.quickPromptChip}
                      onPress={() => void sendMessage(q.action)}
                      disabled={isThinking || hasAiConsent !== true}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Ask MaziuM: ${q.label}`}
                      accessibilityState={{ disabled: isThinking || hasAiConsent !== true }}
                    >
                      <Text style={styles.quickPromptText}>{q.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Input row */}
              <View style={styles.chatInputRow}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="e.g. Show me BMWs under £20k..."
                  placeholderTextColor={Colors.iconMuted}
                  value={message}
                  onChangeText={setMessage}
                  onSubmitEditing={() => sendMessage(message)}
                  returnKeyType="send"
                  editable={!isThinking && hasAiConsent === true}
                  accessibilityLabel="Message MaziuM AI"
                  accessibilityHint="Enter a question about cars"
                />
                <IconButton style={[styles.sendBtn, (isThinking || !message.trim()) && { opacity: 0.4 }]} icon={<Ionicons name="send" size={16} color={Colors.white} />} onPress={() => sendMessage(message)} disabled={isThinking || hasAiConsent !== true || !message.trim()} accessibilityLabel="Send message" />
              </View>

              {hasAiConsent === true && (
                <View style={styles.aiPrivacyFooter}>
                  <TouchableOpacity onPress={openAiPrivacy} accessibilityRole="button" accessibilityLabel="AI privacy">
                    <Text style={styles.aiPrivacyFooterText}>AI privacy</Text>
                  </TouchableOpacity>
                  <Text style={styles.aiPrivacyFooterDot}>·</Text>
                  <TouchableOpacity onPress={() => void withdrawAiConsent()} accessibilityRole="button" accessibilityLabel="Stop AI sharing">
                    <Text style={styles.aiPrivacyFooterText}>Stop AI sharing</Text>
                  </TouchableOpacity>
                </View>
              )}

            </ChatErrorBoundary>
          </Pressable>

        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(aiReportTarget)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeAiReport}
      >
        <View style={styles.aiReportBackdrop}>
          <View style={styles.aiReportCard}>
            <View style={styles.aiReportHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiReportEyebrow}>MaziuM AI safety</Text>
                <Text style={styles.aiReportTitle}>Report AI response</Text>
              </View>
              <IconButton
                style={styles.aiReportClose}
                icon={<Ionicons name="close" size={20} color={Colors.white} />}
                onPress={closeAiReport}
                disabled={aiReporting}
                accessibilityLabel="Close AI report"
              />
            </View>

            <Text style={styles.aiReportHelp}>
              Tell CarMazium why this response needs review. The reported AI response and its related prompt will be sent to the moderation queue.
            </Text>

            {aiReportTarget && (
              <View style={styles.aiReportPreview}>
                <Text style={styles.aiReportPreviewText} numberOfLines={5}>
                  {aiReportTarget.text}
                </Text>
              </View>
            )}

            <Text style={styles.aiReportSectionLabel}>Reason</Text>
            <View style={styles.aiReportReasonWrap}>
              {([
                ['UNSAFE_OFFENSIVE', 'Unsafe or offensive'],
                ['INACCURATE_MISLEADING', 'Inaccurate or misleading'],
                ['SCAM_DISHONEST', 'Scam or dishonest guidance'],
                ['OTHER', 'Other'],
              ] as Array<[AiReportReason, string]>).map(([value, label]) => {
                const selected = aiReportReason === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.aiReportReasonChip, selected && styles.aiReportReasonChipSelected]}
                    onPress={() => setAiReportReason(value)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: selected }}
                  >
                    <Text style={[styles.aiReportReasonText, selected && styles.aiReportReasonTextSelected]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.aiReportSectionLabel}>Additional details (optional)</Text>
            <TextInput
              style={styles.aiReportDetailsInput}
              value={aiReportDetails}
              onChangeText={(value) => setAiReportDetails(value.slice(0, 1000))}
              placeholder="What was wrong with this response?"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={1000}
            />

            <View style={styles.aiReportActions}>
              <TouchableOpacity
                style={styles.aiReportCancel}
                onPress={closeAiReport}
                disabled={aiReporting}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Cancel AI response report"
                accessibilityState={{ disabled: aiReporting }}
              >
                <Text style={styles.aiReportCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.aiReportSubmit,
                  (!aiReportReason || aiReporting) && styles.aiReportSubmitDisabled,
                ]}
                onPress={() => void submitAiReport()}
                disabled={!aiReportReason || aiReporting}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Submit AI response report"
                accessibilityState={{ disabled: !aiReportReason || aiReporting, busy: aiReporting }}
              >
                {aiReporting
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Ionicons name="flag-outline" size={15} color={Colors.white} />}
                <Text style={styles.aiReportSubmitText}>Submit report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* The same standalone 3D PNG used by the website. */}
      {!isOpen && (
        <View style={[styles.container, { bottom: floatingBottom }]} pointerEvents="box-none">
          {isForeground && !isKeyboardVisible && activeRoute !== 'LiveAuctionDetailed' &&
            greetingState?.userId === authUserId && showGreeting && (
            <View
              style={[styles.greetingBubble, { width: Math.min(260, windowWidth - 32) }]}
              accessibilityLabel="Mazium greeting. How can I help you today?"
            >
              <View style={styles.greetingAvatar}>
                <Image source={MAZIUM_MASCOT} style={styles.greetingAvatarImage} contentFit="contain" accessible={false} />
                <View style={styles.greetingOnlineDot} />
              </View>
              <View style={styles.greetingCopy}>
                <Text style={styles.greetingTitle}>Hi, I'm Mazium! 👋</Text>
                <Text style={styles.greetingSubtitle}>How can I help you today?</Text>
              </View>
              <TouchableOpacity
                style={styles.greetingClose}
                onPress={dismissGreeting}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Permanently dismiss Mazium greeting"
                hitSlop={10}
              >
                <Ionicons name="close" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
              <View style={styles.greetingArrow} pointerEvents="none" />
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => { setIsOpen(true); setShowGreeting(false); }}
            style={styles.botButton}
            accessibilityRole="button"
            accessibilityLabel="Open MaziuM AI assistant"
            accessibilityHint="Opens the CarMazium car-buying assistant"
            accessibilityState={{ expanded: false }}
          >
            <Image
              source={MAZIUM_MASCOT}
              style={styles.botImage}
              contentFit="contain"
              cachePolicy="memory-disk"
              accessible={false}
            />
          </TouchableOpacity>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', right: 16, zIndex: 9999, alignItems: 'flex-end' },
  // Matches the website's compact, dismissible speech bubble above the 3D mascot.
  greetingBubble: {
    position: 'absolute', bottom: MAZIUM_TRIGGER_SIZE + 16, right: 0,
    minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 9,
    shadowColor: Colors.black, shadowOpacity: 0.22, shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 }, elevation: 12,
  },
  greetingAvatar: { width: 32, height: 32 },
  greetingAvatarImage: { width: 32, height: 32 },
  greetingOnlineDot: {
    position: 'absolute', top: -3, right: -3, width: 9, height: 9,
    borderRadius: 5, backgroundColor: Colors.success, borderWidth: 1, borderColor: Colors.bgElevated,
  },
  greetingCopy: { flex: 1, minWidth: 0 },
  greetingTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary },
  greetingSubtitle: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  greetingClose: { minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  greetingArrow: {
    position: 'absolute', bottom: -6, right: 24, height: 12, width: 12,
    transform: [{ rotate: '45deg' }], backgroundColor: Colors.bgElevated,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.borderSubtle,
  },
  chatBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' },
  chatBox: {
    position: 'absolute', right: 12, width: 400,
    backgroundColor: Colors.bgElevated, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.borderHi,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 20, overflow: 'hidden',
  },
  errorFallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 24,
  },
  errorFallbackText: {
    fontFamily: FontFamily.medium, fontSize: FontSize.sm,
    color: Colors.textSecondary, textAlign: 'center',
  },
  errorFallbackBtn: {
    marginTop: 6, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, backgroundColor: Colors.accent,
  },
  errorFallbackBtnText: {
    fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white,
  },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  chatAvatar: {
    width: 40, height: 40, marginRight: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarImage: { width: 40, height: 40 },
  botAccentDot: {
    position: 'absolute', right: 0, bottom: 0, width: 11, height: 11,
    borderRadius: 6, backgroundColor: Colors.success,
    borderWidth: 2, borderColor: Colors.bgElevated,
  },
  chatTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white },
  chatStatus: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  chatHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  chatScroll: { flex: 1, backgroundColor: Colors.bgPrimary },
  chatScrollContent: { padding: 16, gap: 14 },

  msgBubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16 },
  msgAI: { alignSelf: 'flex-start', backgroundColor: Colors.bgCardSolid, borderWidth: 1, borderColor: Colors.borderSubtle, borderBottomLeftRadius: 4 },
  msgUser: { alignSelf: 'flex-end', backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  msgText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 21 },
  msgTextAI: { color: Colors.textPrimary },
  msgTextUser: { color: Colors.white },

  aiConsentCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.bgCardSolid,
    borderWidth: 1,
    borderColor: Colors.borderHi,
  },
  aiConsentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 7,
  },
  aiConsentTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
  },
  aiConsentText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  aiConsentActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  aiConsentPrimary: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
  },
  aiConsentPrimaryText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.white,
    textAlign: 'center',
  },
  aiConsentSecondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderHi,
    paddingHorizontal: 12,
  },
  aiConsentSecondaryText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.textSecondary,
  },
  aiReportButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingVertical: 4,
  },
  aiReportText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
  },
  aiReportTextDone: {
    color: Colors.success,
  },
  aiReportBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.74)',
  },
  aiReportCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    backgroundColor: Colors.deepBlue_16161c,
    padding: 20,
  },
  aiReportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiReportEyebrow: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  aiReportTitle: {
    marginTop: 2,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.white,
  },
  aiReportClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha06,
  },
  aiReportHelp: {
    marginTop: 12,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  aiReportPreview: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha05,
  },
  aiReportPreviewText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    lineHeight: 18,
    color: Colors.white,
  },
  aiReportSectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  aiReportReasonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  aiReportReasonChip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    backgroundColor: Colors.bgSecondary,
  },
  aiReportReasonChipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.darkRed_3b2424,
  },
  aiReportReasonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.textSecondary,
  },
  aiReportReasonTextSelected: {
    color: Colors.white,
  },
  aiReportDetailsInput: {
    minHeight: 88,
    maxHeight: 130,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    backgroundColor: Colors.bgSecondary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    lineHeight: 18,
    color: Colors.white,
    textAlignVertical: 'top',
  },
  aiReportActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  aiReportCancel: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
  },
  aiReportCancelText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
  },
  aiReportSubmit: {
    flex: 1.4,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 12,
    backgroundColor: Colors.accent,
  },
  aiReportSubmitDisabled: {
    opacity: 0.45,
  },
  aiReportSubmitText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
  },

  // Filter card
  filterCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 6, padding: 12, borderRadius: 12,
    backgroundColor: Colors.bgCardSolid, borderWidth: 1, borderColor: Colors.borderHi,
    alignSelf: 'flex-start', maxWidth: '90%',
  },
  filterCardIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.accentAlpha10, alignItems: 'center', justifyContent: 'center',
  },
  filterCardLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size8, color: Colors.iconMuted, letterSpacing: 1 },
  filterCardTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.white, marginTop: 1 },

  // Match the website's horizontal, always-visible daily quick-reply rail.
  quickRepliesRail: { borderTopWidth: 1, borderTopColor: Colors.borderSubtle, backgroundColor: Colors.bgElevated },
  quickPromptsWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  quickPromptChip: {
    minHeight: 44, justifyContent: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  quickPromptText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },

  // Typing dots
  dotsRow: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.textSecondary },

  // Input row
  chatInputRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    backgroundColor: Colors.bgElevated, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, gap: 10,
  },
  chatInput: {
    flex: 1, minHeight: 46, backgroundColor: Colors.bgCardSolid, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.borderHi,
    paddingHorizontal: 14, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.white,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  aiPrivacyFooter: {
    minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle, backgroundColor: Colors.bgElevated,
  },
  aiPrivacyFooterText: { fontFamily: FontFamily.medium, fontSize: FontSize.size10, color: Colors.textMuted },
  aiPrivacyFooterDot: { fontFamily: FontFamily.regular, fontSize: FontSize.size10, color: Colors.textMuted },

  botButton: {
    width: MAZIUM_TRIGGER_SIZE, height: MAZIUM_TRIGGER_SIZE,
    backgroundColor: 'transparent', borderWidth: 0,
    alignItems: 'center', justifyContent: 'center', overflow: 'visible',
  },
  botImage: { width: MAZIUM_TRIGGER_SIZE, height: MAZIUM_TRIGGER_SIZE },

});
