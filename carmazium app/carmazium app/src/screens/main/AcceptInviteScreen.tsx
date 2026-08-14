import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardStickyView } from '../../components/KeyboardStickyView';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import { IconButton } from '../../components/IconButton';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

// Web's dealer team invite email links to a plain https:// page
// (/auth/accept-invite?token=...) that mobile has no way to intercept —
// no Universal Links / App Links are configured for this app. Rather than
// standing up that infra, this screen lets an invited user paste the link
// (or just the token) they received by email and accept it directly.
const extractToken = (raw: string): string => {
  const trimmed = raw.trim();
  const match = trimmed.match(/[?&]token=([^&\s]+)/);
  if (match) {
    try { return decodeURIComponent(match[1]); } catch { return match[1]; }
  }
  return trimmed;
};

export const AcceptInviteScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { initializeAuth } = useAuthStore();

  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAccept = async () => {
    const token = extractToken(input);
    setError(null);
    if (!token) {
      setError('Paste the invite link or code from your email.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient<{ success: boolean; data: { message: string } }>(
        '/dealers/invites/accept',
        { method: 'POST', body: JSON.stringify({ token }) }
      );
      await initializeAuth();
      setSuccessMessage(res?.data?.message || "You've joined the dealership.");
    } catch (err: any) {
      setError(err?.message || 'Could not accept this invitation. Check the link and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardStickyView style={styles.container} behavior="padding">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha03, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 14 }]}>
        <View style={styles.header}>
          <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
          <View style={styles.headerCenter}>
            <Text style={styles.headerSubRed}>DEALER TEAM</Text>
            <Text style={styles.headerTitle}>Accept invitation</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {successMessage ? (
          <View style={styles.successWrap}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
            </View>
            <Text style={styles.successText}>{successMessage}</Text>
            <View style={{ marginTop: 24, width: '100%' }}>
              <Button label="GO TO DASHBOARD" onPress={() => navigation.navigate('SellerDashboard')} size="lg" fullWidth />
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.subtitle}>
              Paste the invite link — or just the code — from the email a dealership sent you.
            </Text>

            {error ? (
              <View style={{ marginBottom: 16 }}>
                <ErrorBanner message={error} />
              </View>
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>INVITE LINK OR CODE</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="link-outline" size={18} color={Colors.iconMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={input}
                  onChangeText={(v) => { setInput(v); if (error) setError(null); }}
                  placeholder="Paste here"
                  placeholderTextColor={Colors.iconMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                />
              </View>
            </View>

            <View style={styles.bottomCTA}>
              <Button
                label="ACCEPT INVITATION"
                onPress={handleAccept}
                loading={submitting}
                size="lg"
                fullWidth
                icon={<Ionicons name="checkmark" size={18} color={Colors.white} />}
              />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardStickyView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scrollContent: { paddingBottom: 60, flexGrow: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, marginBottom: 24,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.whiteAlpha05, borderWidth: 1, borderColor: Colors.whiteAlpha08,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSubRed: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.accent, letterSpacing: 1.8, marginBottom: 4 },
  headerTitle: { fontFamily: FontFamily.extraBold, fontSize: FontSize.xl, color: Colors.white, letterSpacing: -0.5 },
  subtitle: {
    fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary,
    lineHeight: 20, marginHorizontal: 24, marginBottom: 24,
  },
  formGroup: { marginHorizontal: 24, marginBottom: 16 },
  inputLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.iconMuted, letterSpacing: 1.2, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'flex-start', minHeight: 50, borderRadius: Radius.inline,
    backgroundColor: Colors.whiteAlpha03, borderWidth: 1, borderColor: Colors.whiteAlpha06,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  inputIcon: { marginRight: 10, marginTop: 2 },
  textInput: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.size14, color: Colors.white },
  bottomCTA: { paddingHorizontal: 24, marginTop: 8 },
  successWrap: { alignItems: 'center', paddingHorizontal: 24, marginTop: 40 },
  successIconWrap: { marginBottom: 16 },
  successText: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.white, textAlign: 'center', lineHeight: 22 },
});
