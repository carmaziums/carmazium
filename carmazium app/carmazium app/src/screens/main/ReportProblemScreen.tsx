import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { IconButton } from '../../components/IconButton';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/authStore';
import { ProblemCategory, appVersion, submitProblemReport } from '../../lib/appInsights';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { Elevation, Radius } from '../../constants/spacing';
import { FontFamily, FontSize } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'ReportProblem'>;

const CATEGORIES: { id: ProblemCategory; label: string; icon: string }[] = [
  { id: 'not_working', label: 'Something isn’t working', icon: 'bug-outline' },
  { id: 'sign_in', label: 'Signing in / account', icon: 'person-circle-outline' },
  { id: 'payments', label: 'Payments', icon: 'card-outline' },
  { id: 'listings', label: 'Listings / selling', icon: 'car-outline' },
  { id: 'auctions', label: 'Auctions / bids', icon: 'hammer-outline' },
  { id: 'messages', label: 'Messages / notifications', icon: 'chatbubbles-outline' },
  { id: 'other', label: 'Something else', icon: 'help-circle-outline' },
];

/**
 * Customer "Report a problem" — goes straight to the CarMazium admin team
 * (admin dashboard › Problem reports). Works signed in or as a guest; the app
 * adds app version and device automatically so the team can reproduce it.
 */
export const ReportProblemScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const userEmail = useAuthStore((s) => s.user?.email ?? '');
  const [category, setCategory] = useState<ProblemCategory | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(userEmail);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSend = !!category && message.trim().length >= 10 && !sending;

  const send = async () => {
    if (!category) { setError('Choose what the problem is about.'); return; }
    if (message.trim().length < 10) { setError('Please describe the problem in a little more detail.'); return; }
    setSending(true);
    setError(null);
    try {
      await submitProblemReport({ category, message: message.trim(), contactEmail: email, screen: route.params?.fromScreen });
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Could not send your report. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <IconButton
          style={styles.backBtn}
          icon={<Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text style={styles.title} accessibilityRole="header">Report a problem</Text>
      </View>

      {sent ? (
        <View style={styles.sentWrap}>
          <View style={styles.sentIcon}><Ionicons name="checkmark-circle" size={44} color={Colors.success} /></View>
          <Text style={styles.sentTitle}>Thank you — report sent</Text>
          <Text style={styles.sentText}>
            Our team has received your report and will look into it.
            {email.trim() ? ' We’ll reply by email if we need more details.' : ''}
          </Text>
          <Button label="Done" variant="primary" size="lg" fullWidth onPress={() => navigation.goBack()} style={{ marginTop: 24 }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>Tell us what went wrong and we’ll fix it. Your report goes straight to the CarMazium team.</Text>

          <Text style={styles.label}>What is it about?</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((c) => {
              const on = category === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.category, on && styles.categoryOn]}
                  onPress={() => { setCategory(c.id); setError(null); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  activeOpacity={0.8}
                >
                  <Ionicons name={c.icon} size={18} color={on ? Colors.accent : Colors.textSecondary} />
                  <Text style={[styles.categoryText, on && styles.categoryTextOn]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>What happened?</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={(t) => { setMessage(t); setError(null); }}
            placeholder="What were you doing, and what went wrong?"
            placeholderTextColor={Colors.inputPlaceholder}
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{message.trim().length}/2000</Text>

          <Text style={styles.label}>Your email (optional)</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="So we can reply to you"
            placeholderTextColor={Colors.inputPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.note}>We also send the app version ({appVersion()}) and your phone model so we can find the problem faster.</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button label={sending ? 'Sending…' : 'Send report'} variant="primary" size="lg" fullWidth onPress={send} disabled={!canSend} loading={sending} style={{ marginTop: 8 }} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 44, height: 44 },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textPrimary },
  content: { paddingHorizontal: 18, paddingTop: 6 },
  intro: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22, marginBottom: 18 },
  label: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 10, marginTop: 6 },
  categories: { gap: 8, marginBottom: 16 },
  category: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 14,
    borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, ...Elevation.card,
  },
  categoryOn: { borderColor: Colors.accent, backgroundColor: Colors.accentAlpha05 },
  categoryText: { flex: 1, fontFamily: FontFamily.semiBold, fontSize: FontSize.base, color: Colors.textPrimary },
  categoryTextOn: { color: Colors.accent },
  input: {
    minHeight: 50, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.inputBg,
    color: Colors.textPrimary, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.regular, fontSize: FontSize.base,
  },
  textArea: { minHeight: 130 },
  counter: { alignSelf: 'flex-end', fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4, marginBottom: 10 },
  note: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 19, marginTop: 12, marginBottom: 12 },
  error: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.error, marginBottom: 8 },
  sentWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  sentIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.successAlpha10, marginBottom: 18 },
  sentTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.textPrimary, textAlign: 'center' },
  sentText: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 10 },
});
