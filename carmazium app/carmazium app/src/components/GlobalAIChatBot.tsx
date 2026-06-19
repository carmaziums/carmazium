import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Platform, Text,
  TextInput, ScrollView, KeyboardAvoidingView, Modal, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { FontFamily } from '../constants/typography';
import { useAuthStore } from '../store/authStore';
import { sendAiChatMessage, AiChatMessage } from '../lib/aiApi';
import { navigationRef } from '../lib/navigationRef';

const QUICK_PROMPTS = [
  { label: 'Find cars under £15k', icon: 'pricetag-outline' },
  { label: 'Best electric cars?', icon: 'flash-outline' },
  { label: 'How does bidding work?', icon: 'hammer-outline' },
  { label: 'Help me sell my car', icon: 'car-outline' },
];

export const GlobalAIChatBot: React.FC = () => {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Track current route via module-level navigationRef — safe to call from
  // non-screen components unlike useNavigationState which requires a screen context.
  const [activeRoute, setActiveRoute] = useState('');
  useEffect(() => {
    const update = () => {
      try {
        if (navigationRef.isReady()) {
          setActiveRoute(navigationRef.getCurrentRoute()?.name ?? '');
        }
      } catch { /* navigation not ready */ }
    };
    // Initial read
    update();
    // Subscribe to future navigation state changes
    const unsub = navigationRef.addListener('state', update);
    return () => unsub();
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      id: '1',
      text: "Hi! I'm MaziuM, your CarMazium AI. Ask me about cars, finance options, or valuations!",
      isUser: false,
    },
  ]);

  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to the newest message
  useEffect(() => {
    if (chatHistory.length > 1) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
      return () => clearTimeout(t);
    }
  }, [chatHistory]);

  // Don't render on auction screens — the AI button overlaps the live bid console
  if (!isAuthenticated || activeRoute === 'LiveAuctionDetailed') return null;

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const newMsg = { id: Date.now().toString(), text: trimmed, isUser: true };
    const updated = [...chatHistory, newMsg];
    setChatHistory(updated);
    setMessage('');
    setIsSending(true);

    try {
      const conversation: AiChatMessage[] = updated.map((m) => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.text,
      }));
      const result = await sendAiChatMessage(conversation);
      setChatHistory((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), text: result.text, isUser: false },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: "I'm having a brief moment — please try again in a second!",
          isUser: false,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // Chat box height + margin above the tab-bar/button region
  const chatBottom = (insets.bottom || 16) + 82;

  return (
    <>
      {/* ── Chat modal — renders full-screen so outside tap closes the box ── */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Tapping this backdrop closes the chat */}
          <Pressable style={{ flex: 1 }} onPress={() => setIsOpen(false)}>
            {/* Stop propagation so taps inside the box don't close it */}
            <Pressable
              style={[styles.chatBox, { bottom: chatBottom }]}
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
                <TouchableOpacity
                  onPress={() => setIsOpen(false)}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Messages */}
              <ScrollView
                ref={scrollRef}
                style={styles.chatScroll}
                contentContainerStyle={styles.chatScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {chatHistory.map((msg) => (
                  <View
                    key={msg.id}
                    style={[styles.msgBubble, msg.isUser ? styles.msgUser : styles.msgAI]}
                  >
                    <Text style={[styles.msgText, msg.isUser ? styles.msgTextUser : styles.msgTextAI]}>
                      {msg.text}
                    </Text>
                  </View>
                ))}

                {/* Quick prompt chips — only before the user has typed anything */}
                {chatHistory.length === 1 && !isSending && (
                  <View style={styles.quickPromptsWrap}>
                    {QUICK_PROMPTS.map((p) => (
                      <TouchableOpacity
                        key={p.label}
                        style={styles.quickPromptChip}
                        onPress={() => sendMessage(p.label)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={p.icon as any} size={11} color="#DC1F26" />
                        <Text style={styles.quickPromptText}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {isSending && (
                  <View style={[styles.msgBubble, styles.msgAI]}>
                    <Text style={[styles.msgText, styles.msgTextAI]}>MaziuM is thinking…</Text>
                  </View>
                )}
              </ScrollView>

              {/* Input row */}
              <View style={styles.chatInputRow}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Ask anything..."
                  placeholderTextColor="#606070"
                  value={message}
                  onChangeText={setMessage}
                  onSubmitEditing={() => sendMessage(message)}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[styles.sendBtn, isSending && { opacity: 0.5 }]}
                  onPress={() => sendMessage(message)}
                  disabled={isSending}
                >
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Floating bot button ── */}
      <View
        style={[styles.container, { bottom: (insets.bottom || 16) + 70 }]}
        pointerEvents="box-none"
      >
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
  container: {
    position: 'absolute',
    right: 16,
    zIndex: 9999,
    alignItems: 'flex-end',
  },

  // Chat box (positioned inside the Modal, absolute from screen bottom)
  chatBox: {
    position: 'absolute',
    right: 16,
    width: 320,
    height: 400,
    backgroundColor: '#111116',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(220,31,38,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#1E1E28',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  chatAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DC1F26',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
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

  // Quick prompt chips
  quickPromptsWrap: { gap: 6, marginTop: 4 },
  quickPromptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(220,31,38,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(220,31,38,0.2)',
  },
  quickPromptText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#E0E0E0',
  },

  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#111116',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#1E1E28',
    borderRadius: 19,
    paddingHorizontal: 14,
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#FFFFFF',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DC1F26',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bot button
  botButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC1F26',
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(220,31,38,0.2)',
    overflow: 'visible',
  },
  botButtonActive: {
    opacity: 1,
    shadowOpacity: 0.8,
    shadowRadius: 16,
    transform: [{ scale: 1.05 }],
  },
  botButtonInactive: {
    opacity: 0.45,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  glowEffect: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(220,31,38,0.15)',
    zIndex: -1,
  },
  botImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    position: 'absolute',
    opacity: 0.2,
  },
  overlayDesign: {
    width: 48,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#DC1F26',
    alignItems: 'center',
    paddingTop: 2,
  },
  mockFace: { color: '#DC1F26', fontWeight: '900', fontSize: 14, lineHeight: 16 },
  mockSmileRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    marginTop: 2,
  },
  mockEye: {
    width: 8,
    height: 4,
    backgroundColor: '#000000',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  mockSmile: {
    width: 6,
    height: 3,
    backgroundColor: '#000000',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    marginBottom: 1,
  },
});
