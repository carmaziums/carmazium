import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Colors } from '../../constants/colors';
import { useAppearanceStore } from '../../store/appearanceStore';
import { mergeAppearanceStyles, appearancePalette } from '../../theme/appearancePalette';
import { FontFamily } from '../../constants/typography';
import { getBottomTabBarHeight } from '../../lib/nativeLayoutParity';
import type { DealerPermission } from '../../lib/dealerAccessApi';
import { useDealerAccess } from '../../hooks/useDealerAccess';
import { useAuthStore } from '../../store/authStore';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';
import { useAppearance } from '../../theme/useAppearance';

type NavProp = NativeStackNavigationProp<MainStackParamList>;
type DealerTool = {
  title: string;
  description: string;
  route: keyof MainStackParamList;
  permission: DealerPermission;
  icon: string;
};

// These are dealership-management tools, NOT a second copy of the public
// ten-item Menu. Stock, Customers and Buy & Bid already have bottom tabs.
const EXTRA_DEALER_TOOLS: DealerTool[] = [
  { title: 'Incoming Offers', description: 'Review offers from buyers', route: 'DealerOffers', permission: 'MANAGE_OFFERS', icon: 'pricetag-outline' },
  { title: 'My Offers', description: 'Offers your dealership has made', route: 'DealerMyOffers', permission: 'MANAGE_OFFERS', icon: 'send-outline' },
  { title: 'Purchases', description: 'Vehicles your dealership has bought', route: 'DealerPurchases', permission: 'VIEW_PURCHASES', icon: 'receipt-outline' },
  { title: 'Analytics', description: 'Performance and sales insights', route: 'DealerAnalytics', permission: 'VIEW_ANALYTICS', icon: 'bar-chart-outline' },
  { title: 'Earnings', description: 'Revenue and sales receipts', route: 'DealerEarnings', permission: 'VIEW_ANALYTICS', icon: 'cash-outline' },
  { title: 'Manage Team', description: 'Staff and dealership access', route: 'DealerTeam', permission: 'MANAGE_TEAM', icon: 'people-outline' },
];

export const DealerMoreScreen: React.FC = () => {
  const { tc } = useAppearance();
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const mode = useAppearanceStore(state => state.mode);
  const ts = mode === 'light' ? mergeAppearanceStyles(mergeAppearanceStyles(styles, lightDealerMoreStyles), lightContrastStyles) : styles;
  const { fontScale } = useWindowDimensions();
  const accountRole = useAuthStore(s => s.accountRole);
  const role = useAuthStore(s => s.role);
  const dealerMode = accountRole === 'dealer' && role === 'dealer';
  const { loading, error, hasPermission, refresh } = useDealerAccess(dealerMode);
  const allowedTools = EXTRA_DEALER_TOOLS.filter(tool => hasPermission(tool.permission));

  return (
    <View style={ts.page}>
      <WebsiteTopBar />
      <ScrollView
        style={ts.scroll}
        contentContainerStyle={[ts.content, { paddingBottom: getBottomTabBarHeight(fontScale, insets.bottom) + 24 }]}
        showsVerticalScrollIndicator={false}
        accessibilityLabel="Dealer tools"
      >
        <Text style={ts.title}>Dealer Tools</Text>
        <Text style={ts.subtitle}>
          Additional business tools for your verified dealership. The Menu button above is for general CarMazium navigation.
        </Text>
        {!dealerMode ? (
          <Text style={ts.notice}>Switch to your verified dealer workspace to use dealership tools.</Text>
        ) : loading ? (
          <View style={ts.loading}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={ts.notice}>Checking dealership access…</Text>
          </View>
        ) : error ? (
          <View style={ts.loading}>
            <Text style={ts.notice}>Dealer tools are temporarily unavailable. Your permissions could not be verified.</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Retry dealer access check"
              style={ts.retry}
              onPress={() => { void refresh(true); }}
            >
              <Ionicons name="refresh-outline" size={18} color={Colors.white} />
              <Text style={ts.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : allowedTools.length === 0 ? (
          <Text style={ts.notice}>No additional tools are enabled for your dealership role.</Text>
        ) : (
          <View style={ts.tools}>
            {allowedTools.map(tool => (
              <TouchableOpacity
                key={tool.route}
                style={ts.tool}
                accessibilityRole="button"
                accessibilityLabel={tool.title}
                accessibilityHint={tool.description}
                onPress={() => navigation.navigate(tool.route as any)}
              >
                <View style={ts.toolIcon}>
                  <Ionicons name={tool.icon as any} size={20} color={Colors.accent} accessibilityElementsHidden />
                </View>
                <View style={ts.toolCopy}>
                  <Text style={ts.toolTitle}>{tool.title}</Text>
                  <Text style={ts.toolDescription}>{tool.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={tc(Colors.textSecondary)} accessibilityElementsHidden />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const lightDealerMoreStyles = StyleSheet.create({
  page: { backgroundColor: '#EEF5FB' },
  title: { color: '#0F172A' },
  subtitle: { color: '#64748B' },
  notice: { color: '#334155' },
  tool: { backgroundColor: '#FFFFFF', borderColor: '#D5E1EC' },
  toolTitle: { color: '#0F172A' },
  toolDescription: { color: '#64748B' },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { flex: 1 },
  content: { paddingTop: 18, paddingHorizontal: 18, gap: 10 },
  title: { color: Colors.textPrimary, fontFamily: FontFamily.extraBold, fontSize: 23 },
  subtitle: { color: Colors.textSecondary, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  notice: { color: Colors.textSecondary, fontFamily: FontFamily.medium, fontSize: 14, lineHeight: 21 },
  loading: { gap: 14, alignItems: 'flex-start', paddingVertical: 16 },
  tools: { gap: 10 },
  tool: {
    minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: Colors.bgCard, borderColor: Colors.borderSubtle, borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12,
  },
  toolIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.accentAlpha10, alignItems: 'center', justifyContent: 'center' },
  toolCopy: { flex: 1, gap: 4 },
  toolTitle: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: 14 },
  toolDescription: { color: Colors.textSecondary, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 18 },
  retry: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, backgroundColor: Colors.accent, paddingHorizontal: 16 },
  retryText: { color: Colors.white, fontFamily: FontFamily.bold, fontSize: 13 },
});

const LIGHT_PALETTE = appearancePalette('light');

// Light-mode text colours for keys the screen's light map did not cover.
// Generated from the contrast audit (scripts/theme-audit); dark mode is untouched.
const lightContrastStyles = StyleSheet.create({
  subtitle: { color: LIGHT_PALETTE.muted },
});
