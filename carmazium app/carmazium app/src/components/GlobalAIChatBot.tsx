import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Platform, Text,
  TextInput, ScrollView, Keyboard, Modal, Pressable, Animated, Alert,
  LayoutAnimation, UIManager, useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
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
  const { height: windowHeight } = useWindowDimensions();
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
  const [message, setMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<HistoryItem[]>([
    { id: '1', text: "Hi! I'm MaziuM, your CarMazium AI. Tell me what you're looking for and I'll help you find it!", isUser: false },
  ]);
  const [quickReplies] = useState(() => getDailyQuickReplies());
  const [hasAiConsent, setHasAiConsent] = useState<boolean | null>(null);
  const [reportedResponseIds, setReportedResponseIds] = useState<Set<string>>(new Set());
  const [aiReportTarget, setAiReportTarget] = useState<HistoryItem | null>(null);
  const [aiReportReason, setAiReportReason] = useState<AiReportReason | null>(null);
  const [aiReportDetails, setAiReportDetails] = useState('');
  const [aiReporting, setAiReporting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!aiConsentKey) {
      setHasAiConsent(false);
      return;
    }
    setHasAiConsent(null);
    AsyncStorage.getItem(aiConsentKey)
      .then((value) => setHasAiConsent(value === 'accepted'))
      .catch(() => setHasAiConsent(false));
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
            <ChatErrorBoundary onReset={() => setIsOpen(false)}>

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
                <View style={styles.chatHeaderActions}>
                  <IconButton
                    style={styles.closeBtn}
                    icon={<Ionicons name="shield-checkmark-outline" size={18} color={Colors.textSecondary} />}
                    onPress={showAiPrivacyOptions}
                    accessibilityLabel="MaziuM AI privacy options"
                  />
                  <IconButton style={styles.closeBtn} icon={<Ionicons name="close" size={20} color={Colors.white} />} onPress={() => setIsOpen(false)} accessibilityLabel="Close" />
                </View>
              </View>

              {/* Messages */}
              <ScrollView ref={scrollRef} style={styles.chatScroll} contentContainerStyle={styles.chatScrollContent} showsVerticalScrollIndicator={false}>

                {hasAiConsent === false && (
                  <View style={styles.aiConsentCard}>
                    <View style={styles.aiConsentTitleRow}>
                      <Ionicons name="shield-checkmark-outline" size={16} color={Colors.accent} />
                      <Text style={styles.aiConsentTitle}>Before you use MaziuM AI</Text>
                    </View>
                    <Text style={styles.aiConsentText}>
                      Your message and recent MaziuM chat context are sent to OpenAI to generate a response. AI can make mistakes, so verify important vehicle or finance information. Do not include passwords, payment credentials or unnecessary sensitive personal information.
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

                {/* Daily rotating quick replies — shown only before user sends anything */}
                {chatHistory.length === 1 && !isThinking && hasAiConsent === true && (
                  <View style={styles.quickPromptsWrap}>
                    {quickReplies.map((q) => (
                      <TouchableOpacity
                        key={q.label}
                        style={styles.quickPromptChip}
                        onPress={() => sendMessage(q.action)}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`Ask MaziuM: ${q.label}`}
                      >
                        <Text style={styles.quickPromptText}>{q.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

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
                  editable={!isThinking && hasAiConsent === true}
                  accessibilityLabel="Message MaziuM AI"
                  accessibilityHint="Enter a question about cars"
                />
                <IconButton style={[styles.sendBtn, (isThinking || !message.trim()) && { opacity: 0.4 }]} icon={<Ionicons name="send" size={16} color={Colors.white} />} onPress={() => sendMessage(message)} disabled={isThinking || hasAiConsent !== true || !message.trim()} accessibilityLabel="Send message" />
              </View>

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

      {/* Floating bot button */}
      <View style={[styles.container, { bottom: (insets.bottom || 16) + 70 }]} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setIsOpen((v) => !v)}
          style={[styles.botButton, isOpen ? styles.botButtonActive : styles.botButtonInactive]}
          accessibilityRole="button"
          accessibilityLabel={isOpen ? 'Close MaziuM AI assistant' : 'Open MaziuM AI assistant'}
          accessibilityState={{ expanded: isOpen }}
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
  chatHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closeBtn: { padding: 4 },

  chatScroll: { flex: 1, backgroundColor: Colors.bgPrimary },
  chatScrollContent: { padding: 14, gap: 10 },

  msgBubble: { maxWidth: '85%', padding: 10, borderRadius: 14 },
  msgAI: { alignSelf: 'flex-start', backgroundColor: Colors.deepBlue_1e1e28, borderBottomLeftRadius: 4 },
  msgUser: { alignSelf: 'flex-end', backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  msgText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 18 },
  msgTextAI: { color: Colors.paleNearWhite_e0e0e0 },
  msgTextUser: { color: Colors.white },

  aiConsentCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.deepBlue_1e1e28,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
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
    fontSize: FontSize.size10,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  aiConsentActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  aiConsentPrimary: {
    flex: 1,
    minHeight: 38,
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
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
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
