import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Logo } from '../../components/Logo';

export const VerifyEmailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user, initializeAuth, logout } = useAuthStore();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notVerifiedYet, setNotVerifiedYet] = useState(false);
  // Matches web's onboarding/page.tsx 60s cooldown between resend taps to
  // prevent hammering Supabase's rate-limited /auth/v1/otp endpoint.
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setTimeout(() => setCooldownSec((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldownSec]);

  // ── Listen for Supabase SIGNED_IN event (fired when the user clicks the
  //    verification link and the deep-link hands control back to the app).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_IN') {
          setChecking(true);
          await initializeAuth();
          setChecking(false);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [initializeAuth]);

  const handleResend = async () => {
    if (!user?.email || resending || cooldownSec > 0) return;
    setResending(true);
    try {
      await supabase.auth.resend({ type: 'signup', email: user.email });
      setResent(true);
      setCooldownSec(60);
    } catch {
      // Silent — resend is best-effort
    } finally {
      setResending(false);
    }
  };

  const handleCheckNow = async () => {
    setNotVerifiedYet(false);
    setChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // No session — the user hasn't clicked the verification link yet
        setNotVerifiedYet(true);
        return;
      }
      await initializeAuth();
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Logo style={styles.logo} />

      <View style={styles.iconWrap}>
        <Ionicons name="mail" size={56} color={Colors.accent} />
      </View>

      <Text style={styles.title}>Check your inbox</Text>
      <Text style={styles.sub}>
        We sent a verification link to{'\n'}
        <Text style={styles.email}>{user?.email ?? 'your email'}</Text>
      </Text>
      <Text style={styles.hint}>
        Click the link in that email to activate your account, then come back here — the app will continue automatically.
      </Text>

      {checking && (
        <View style={styles.checkingRow}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.checkingText}>Checking…</Text>
        </View>
      )}

      {notVerifiedYet && !checking && (
        <View style={styles.notVerifiedRow}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.warning} />
          <Text style={styles.notVerifiedText}>
            Email not verified yet — click the link in your inbox first.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={handleCheckNow}
        disabled={checking}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryBtnText}>I've verified — continue</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryBtn, (resending || cooldownSec > 0) && styles.secondaryBtnDisabled]}
        onPress={handleResend}
        disabled={resending || cooldownSec > 0}
        activeOpacity={0.8}
      >
        {resending ? (
          <ActivityIndicator size="small" color={Colors.textSecondary} />
        ) : (
          <Text style={styles.secondaryBtnText}>
            {cooldownSec > 0
              ? `Resend in ${cooldownSec}s`
              : resent
              ? '✓ Email resent — tap again if you didn’t get it'
              : 'Resend verification email'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={logout} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={14} color={Colors.textMuted} style={{ marginRight: 4 }} />
        <Text style={styles.backBtnText}>Back to sign in</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    marginBottom: 40,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.accentAlpha12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  email: {
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },
  hint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 36,
  },
  checkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  checkingText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  notVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,170,0,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,170,0,0.2)',
  },
  notVerifiedText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.warning,
    lineHeight: 18,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  secondaryBtn: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 28,
  },
  secondaryBtnDisabled: {
    opacity: 0.5,
  },
  secondaryBtnText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtnText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
