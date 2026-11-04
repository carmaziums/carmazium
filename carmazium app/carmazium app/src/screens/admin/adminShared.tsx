import React from 'react';
import { Alert, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@/components/BrandIcon';
import { IconButton } from '../../components/IconButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily, Type } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { useAuthStore } from '../../store/authStore';

/** The website admin console. Sections not built natively open here. */
export const ADMIN_WEB_BASE = 'https://www.carmazium.com';

export async function openAdminWeb(path: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(`${ADMIN_WEB_BASE}${path}`);
  } catch {
    Alert.alert('Could not open CarMazium', `Please visit www.carmazium.com${path}.`);
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    Alert.alert('Could not open link', url);
  }
}

/** Port of web `src/lib/externalUrl.ts` normalizeExternalUrl — http(s) only. */
export function normalizeExternalUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  const match = /^(https?):\/\/([^/?#\s]+)/i.exec(candidate);
  if (!match || !match[2]) return null;
  return candidate;
}

/** Same output as web `formatPrice` (src/lib/listingApi.ts). */
export function formatPrice(price: number | string | null | undefined): string {
  const n = typeof price === 'string' ? parseFloat(price) : Number(price ?? 0);
  if (!Number.isFinite(n)) return '£0.00';
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function isPdfUrl(url: string): boolean {
  return url.toLowerCase().includes('.pdf');
}

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

/** Screen header shared by the admin screens. Omit onBack on a tab root. */
export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle, onBack }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
      {onBack ? (
        <IconButton
          style={styles.backBtn}
          icon={<Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />}
          onPress={onBack}
          accessibilityLabel="Go back"
        />
      ) : null}
      <View style={styles.headerText}>
        <Text style={styles.headerTitle} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
};

/** Loading placeholder for an admin list: card-sized skeletons, full width. */
export const AdminListSkeleton: React.FC<{ count?: number; height?: number }> = ({ count = 2, height = 160 }) => {
  const { width } = useWindowDimensions();
  return (
    <View style={adminStyles.loading}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} w={width - 32} h={height} r={Radius.card} />
      ))}
    </View>
  );
};

/**
 * Admin screens render only for ADMIN accounts. The backend enforces the
 * same rule on every /admin route; this keeps non-admins from seeing a
 * screen whose every call would 403.
 */
export function withAdminGate<P extends object>(Screen: React.ComponentType<P>): React.FC<P> {
  const Gated: React.FC<P> = (props) => {
    const accountRole = useAuthStore((s) => s.accountRole);
    if (accountRole !== 'admin') {
      const nav = (props as { navigation?: { canGoBack?: () => boolean; goBack?: () => void } }).navigation;
      return (
        <View style={styles.gate}>
          <AdminHeader
            title="Admin"
            onBack={nav?.canGoBack?.() ? () => nav.goBack?.() : undefined}
          />
          <EmptyState
            icon="shield-outline"
            title="Admin access required"
            subtitle="This area is only available to CarMazium administrator accounts."
          />
        </View>
      );
    }
    return <Screen {...props} />;
  };
  Gated.displayName = `withAdminGate(${Screen.displayName || Screen.name || 'Screen'})`;
  return Gated;
}

export const adminStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  listContent: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  loading: { gap: 12, paddingTop: 8 },
  sectionLabel: {
    fontFamily: FontFamily.extraBold,
    fontSize: Type.eyebrow,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginTop: 8,
  },
  title: { fontFamily: FontFamily.bold, fontSize: Type.bodyLg, color: Colors.textPrimary },
  body: { fontFamily: FontFamily.regular, fontSize: Type.label, color: Colors.textSecondary, lineHeight: Type.label * 1.5 },
  meta: { fontFamily: FontFamily.medium, fontSize: Type.caption, color: Colors.textMuted },
  fieldLabel: {
    fontFamily: FontFamily.extraBold,
    fontSize: Type.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  fieldValue: { fontFamily: FontFamily.medium, fontSize: Type.label, color: Colors.textPrimary, marginTop: 2 },
  mono: { fontFamily: FontFamily.mono, fontSize: Type.label, color: Colors.textPrimary },
  link: { fontFamily: FontFamily.semiBold, fontSize: Type.label, color: Colors.infoLight },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1 },
  input: {
    marginTop: 6,
    minHeight: 64,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBg,
    color: Colors.textPrimary,
    fontFamily: FontFamily.regular,
    fontSize: Type.label,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: Type.h4, color: Colors.textPrimary },
  headerSub: { marginTop: 2, fontFamily: FontFamily.medium, fontSize: Type.caption, color: Colors.textMuted },
  gate: { flex: 1, backgroundColor: Colors.bgPrimary },
});
