import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@/components/BrandIcon';
import { Logo } from '../../components/Logo';
import { HamburgerButton } from '../../components/HamburgerButton';
import { useAuthStore, AccountRole } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import { useNativeAppearance } from '../../theme/NativeAppearanceProvider';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';

const ACCOUNT_COPY: Record<
  Extract<AccountRole, 'contractor' | 'finance_partner' | 'insurance_partner' | 'admin'>,
  { title: string; eyebrow: string; description: string; icon: string }
> = {
  contractor: {
    title: 'Partner Account',
    eyebrow: 'BUSINESS ACCOUNT',
    description:
      'Your CarMazium Partner identity is active. Provider jobs, capabilities and verification use this same account and backend.',
    icon: 'briefcase-outline',
  },
  finance_partner: {
    title: 'Finance Partner',
    eyebrow: 'PARTNER ACCOUNT',
    description:
      'Your finance-partner identity is active and remains separate from a personal Buyer account.',
    icon: 'cash-outline',
  },
  insurance_partner: {
    title: 'Insurance Partner',
    eyebrow: 'PARTNER ACCOUNT',
    description:
      'Your insurance-partner identity is active and remains separate from a personal Buyer account.',
    icon: 'shield-checkmark-outline',
  },
  admin: {
    title: 'Admin Account',
    eyebrow: 'PLATFORM ACCOUNT',
    description:
      'You are signed in with your CarMazium administrator identity. This app will not downgrade it to a Buyer account.',
    icon: 'settings-outline',
  },
};

export const AccountRoleHomeScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { palette, resolvedAppearance } = useNativeAppearance();
  const themed = useAccountRoleHomeScreenPalette();
  const insets = useSafeAreaInsets();
  const { user, accountRole } = useAuthStore();

  const supportedRole =
    accountRole === 'contractor' ||
    accountRole === 'finance_partner' ||
    accountRole === 'insurance_partner' ||
    accountRole === 'admin'
      ? accountRole
      : 'contractor';
  const copy = ACCOUNT_COPY[supportedRole];

  return (
    <View style={themed.container}>
      <StatusBar barStyle={resolvedAppearance === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor={palette.bgBody} />
      <View style={{ height: insets.top }} />

      <View style={themed.header}>
        <Logo size="sm" />
        <HamburgerButton />
      </View>

      <ScrollView
        contentContainerStyle={[themed.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={themed.hero}>
          <View style={themed.iconWrap}>
            <Ionicons name={copy.icon as any} size={30} color={Colors.accent} />
          </View>
          <Text style={themed.eyebrow}>{copy.eyebrow}</Text>
          <Text style={themed.title}>{copy.title}</Text>
          <Text style={themed.name}>
            {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'CarMazium user'}
          </Text>
          <Text style={themed.description}>{copy.description}</Text>
        </View>

        <View style={themed.card}>
          <Text style={themed.cardTitle}>One CarMazium account</Text>
          <Text style={themed.cardBody}>
            Your identity, verification state and permissions come from the same CarMazium backend used by the website. Mobile no longer treats this account as a Buyer just because it has a business or platform role.
          </Text>
        </View>

        <View style={themed.actions}>
          <TouchableOpacity
            style={themed.primaryAction}
            onPress={() => navigation?.navigate('Settings')}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={18} color={Colors.white} />
            <Text style={themed.primaryActionText}>Account Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={themed.secondaryAction}
            onPress={() => navigation?.navigate('Messages')}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubbles-outline" size={18} color={palette.textPrimary} />
            <Text style={themed.secondaryActionText}>Messages</Text>
          </TouchableOpacity>
        </View>

        <Text style={themed.note}>
          Your account, verification and permissions stay the same whether you use CarMazium on the web or in the app.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    minHeight: 64,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: { paddingHorizontal: 20, paddingTop: 28 },
  hero: { alignItems: 'center', marginBottom: 24 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentAlpha10,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
    marginBottom: 18,
  },
  eyebrow: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.accent,
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize['3xl'],
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  name: {
    marginTop: 8,
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  description: {
    marginTop: 14,
    maxWidth: 360,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 21,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgSecondary,
    padding: 18,
    marginBottom: 18,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  cardBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  actions: { gap: 10 },
  primaryAction: {
    height: 52,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  secondaryAction: {
    height: 52,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgSecondary,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  note: {
    marginTop: 18,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size11_5,
    lineHeight: 18,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});

function useAccountRoleHomeScreenPalette() {
  const { palette } = useNativeAppearance();
  return React.useMemo(() => ({
    ...styles,
    container: [styles.container, { backgroundColor: palette.bgBody }],
    header: [styles.header, { backgroundColor: palette.bgHeader, borderBottomColor: palette.borderDefault }],
    hero: [styles.hero, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    iconWrap: [styles.iconWrap, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    title: [styles.title, { color: palette.textPrimary }],
    name: [styles.name, { color: palette.textSecondary }],
    description: [styles.description, { color: palette.textSecondary }],
    card: [styles.card, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    cardTitle: [styles.cardTitle, { color: palette.textPrimary }],
    cardBody: [styles.cardBody, { color: palette.textSecondary }],
    secondaryAction: [styles.secondaryAction, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    secondaryActionText: [styles.secondaryActionText, { color: palette.textPrimary }],
    note: [styles.note, { color: palette.textMuted }],
  }), [palette]);
}
