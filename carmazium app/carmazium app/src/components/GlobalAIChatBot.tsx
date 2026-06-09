import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Text, TextInput, ScrollView, Animated, KeyboardAvoidingView } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { FontFamily } from '../constants/typography';
import { useAuthStore } from '../store/authStore';
import { sendAiChatMessage, AiChatMessage } from '../lib/aiApi';

export const GlobalAIChatBot: React.FC = () => {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');

  const [chatHistory, setChatHistory] = useState([
     { id: '1', text: "Hi! I'm your CarMazium AI assistant. I can help you find cars, explain finance options, or give you instant valuations. How can I help today?", isUser: false }
  ]);
  const [isSending, setIsSending] = useState(false);

  // Hide the bot if the user is not authenticated (i.e. on login, signup, onboarding)
  if (!isAuthenticated) return null;

  const handlePress = () => {
     setIsOpen(!isOpen);
     setIsHovered(false);
  };

  const handleSend = async () => {
     const text = message.trim();
     if (!text || isSending) return;

     const newMsg = { id: Date.now().toString(), text, isUser: true };
     const updatedHistory = [...chatHistory, newMsg];
     setChatHistory(updatedHistory);
     setMessage('');
     setIsSending(true);

     try {
        const conversation: AiChatMessage[] = updatedHistory.map((m) => ({
           role: m.isUser ? 'user' : 'assistant',
           content: m.text,
        }));
        const result = await sendAiChatMessage(conversation);
        setChatHistory(prev => [...prev, {
           id: (Date.now() + 1).toString(),
           text: result.text,
           isUser: false,
        }]);
     } catch {
        setChatHistory(prev => [...prev, {
           id: (Date.now() + 1).toString(),
           text: "I'm having a brief moment — please try again in a second! 🔄",
           isUser: false,
        }]);
     } finally {
        setIsSending(false);
     }
  };

  const renderChatBox = () => {
     if (!isOpen) return null;
     return (
        <KeyboardAvoidingView 
           behavior={Platform.OS === 'ios' ? 'padding' : undefined}
           style={[styles.chatBoxContainer, { bottom: (insets.bottom || 20) + 150 }]}
        >
           {/* Header */}
           <View style={styles.chatHeader}>
              <View style={styles.chatHeaderLeft}>
                 <View style={styles.chatAvatar}>
                    <Text style={styles.chatAvatarText}>C</Text>
                 </View>
                 <View>
                    <Text style={styles.chatTitle}>CarMazium AI</Text>
                    <Text style={styles.chatStatus}>Always online</Text>
                 </View>
              </View>
              <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeBtn}>
                 <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
           </View>

           {/* Messages */}
           <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatScrollContent}>
              {chatHistory.map(msg => (
                 <View key={msg.id} style={[styles.msgBubble, msg.isUser ? styles.msgUser : styles.msgAI]}>
                    <Text style={[styles.msgText, msg.isUser ? styles.msgTextUser : styles.msgTextAI]}>
                       {msg.text}
                    </Text>
                 </View>
              ))}
              {isSending && (
                 <View style={[styles.msgBubble, styles.msgAI]}>
                    <Text style={[styles.msgText, styles.msgTextAI]}>Mazium AI is typing…</Text>
                 </View>
              )}
           </ScrollView>

           {/* Input */}
           <View style={styles.chatInputRow}>
              <TextInput 
                 style={styles.chatInput}
                 placeholder="Ask anything..."
                 placeholderTextColor="#606070"
                 value={message}
                 onChangeText={setMessage}
                 onSubmitEditing={handleSend}
              />
              <TouchableOpacity style={[styles.sendBtn, isSending && { opacity: 0.5 }]} onPress={handleSend} disabled={isSending}>
                 <Ionicons name="send" size={16} color="#FFFFFF" />
              </TouchableOpacity>
           </View>
        </KeyboardAvoidingView>
     );
  };

  return (
    <View style={[
       styles.container, 
       { bottom: (insets.bottom || 20) + 70 } // Sit above bottom tabs
    ]} pointerEvents="box-none">
      
      {renderChatBox()}

      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        onPressIn={() => setIsHovered(true)}
        onPressOut={() => setIsHovered(false)}
        // @ts-ignore - RN Web hover support
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={[
           styles.botButton,
           (isHovered || isOpen) ? styles.botButtonActive : styles.botButtonInactive
        ]}
      >
        {(isHovered || isOpen) && <View style={styles.glowEffect} />}
        <Image
           source={{ uri: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=200&q=80' }}
           style={styles.botImage}
           contentFit="cover"
           cachePolicy="memory-disk"
        />
        <View style={styles.overlayDesign}>
           <Text style={styles.mockFace}>C</Text>
           <View style={styles.mockSmileRow}>
              <View style={styles.mockEye} />
              <View style={styles.mockSmile} />
              <View style={styles.mockEye} />
           </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    zIndex: 9999, // Ensure it's above everything
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  
  // Chat Box Styles
  chatBoxContainer: {
     position: 'absolute',
     right: 0,
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
     elevation: 10,
     overflow: 'hidden',
  },
  chatHeader: {
     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
     padding: 16, backgroundColor: '#1E1E28', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)'
  },
  chatHeaderLeft: {
     flexDirection: 'row', alignItems: 'center'
  },
  chatAvatar: {
     width: 32, height: 32, borderRadius: 16, backgroundColor: '#DC1F26', alignItems: 'center', justifyContent: 'center', marginRight: 12
  },
  chatAvatarText: {
     fontFamily: FontFamily.black, fontSize: 16, color: '#FFFFFF'
  },
  chatTitle: {
     fontFamily: FontFamily.bold, fontSize: 14, color: '#FFFFFF'
  },
  chatStatus: {
     fontFamily: FontFamily.medium, fontSize: 10, color: '#10B981'
  },
  closeBtn: {
     padding: 4
  },
  chatScroll: {
     flex: 1, backgroundColor: '#0A0A0C'
  },
  chatScrollContent: {
     padding: 16, gap: 12
  },
  msgBubble: {
     maxWidth: '85%', padding: 12, borderRadius: 16
  },
  msgAI: {
     alignSelf: 'flex-start', backgroundColor: '#1E1E28', borderBottomLeftRadius: 4
  },
  msgUser: {
     alignSelf: 'flex-end', backgroundColor: '#DC1F26', borderBottomRightRadius: 4
  },
  msgText: {
     fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18
  },
  msgTextAI: {
     color: '#E0E0E0'
  },
  msgTextUser: {
     color: '#FFFFFF'
  },
  chatInputRow: {
     flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#111116', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)'
  },
  chatInput: {
     flex: 1, height: 40, backgroundColor: '#1E1E28', borderRadius: 20, paddingHorizontal: 16, fontFamily: FontFamily.regular, fontSize: 13, color: '#FFFFFF'
  },
  sendBtn: {
     width: 40, height: 40, borderRadius: 20, backgroundColor: '#DC1F26', alignItems: 'center', justifyContent: 'center', marginLeft: 8
  },

  // Bot Button Styles
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
    opacity: 0.4, // "just like the second image"
    shadowOpacity: 0,
    shadowRadius: 0,
    transform: [{ scale: 1 }],
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
    opacity: 0.2, // dim background
  },
  // CSS Mock of the bot face for perfection without asset dependencies
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
  mockFace: {
    color: '#DC1F26',
    fontWeight: '900',
    fontSize: 14,
    lineHeight: 16,
  },
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
  }
});
