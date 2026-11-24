import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from './BrandIcon';
import { Button } from './Button';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { useAuthStore } from '../store/authStore';
import { useDealerAccess } from '../hooks/useDealerAccess';
import { DEALER_ITEMS, USER_ITEMS, type MenuItem } from '../lib/dashboardNavigation';
import { defaultPreferences, moveDashboardItem, orderDashboardItems, parseDashboardPreferences, type DashboardPreferences } from '../lib/dashboardPreferences';

const palette: Record<string, string> = {
  Sell: Colors.dashboardSell, Selling: Colors.dashboardSell, Buy: Colors.dashboardBuy, Buying: Colors.dashboardBuy,
  Business: Colors.dashboardBusiness, Services: Colors.dashboardServices, Account: Colors.dashboardAccount,
};

export function DashboardCards({ mode }: { mode: 'dealer' | 'personal' }) {
  const userId = useAuthStore(s => s.user?.id);
  // A different account/view gets a fresh component, including pending reads.
  return userId ? <AccountCards key={`${userId}:${mode}`} userId={userId} mode={mode} /> : null;
}

function AccountCards({ userId, mode }: { userId: string; mode: 'dealer' | 'personal' }) {
  const navigation = useNavigation<any>();
  const { width, fontScale } = useWindowDimensions();
  const access = useDealerAccess(mode === 'dealer');
  const storageKey = `carmazium:dashboard:v1:${userId}:${mode}`;
  const [preferences, setPreferences] = useState<DashboardPreferences>(defaultPreferences);
  const current = useRef(preferences);
  const writes = useRef(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [iosGridWidth, setIosGridWidth] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey).then(raw => {
      if (active) { current.current = parseDashboardPreferences(raw); setPreferences(current.current); }
    }).catch(() => { if (active) setError('Your saved layout could not be loaded. Changes will replace it.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [storageKey]);
  const save = (next: DashboardPreferences) => {
    current.current = next;
    setPreferences(next);
    setError(null);
    // Queue rapid taps so an earlier write cannot replace a newer layout.
    writes.current = writes.current.then(() => AsyncStorage.setItem(storageKey, JSON.stringify(next)))
      .catch(() => { setError('Layout has not been saved. Tap Retry to save your changes.'); });
  };
  const items: MenuItem[] = mode === 'dealer' ? [
    { id: 'add-vehicle', label: 'Add Vehicle', section: 'Sell', icon: 'add-circle-outline', iconLib: 'ion', stackScreen: 'DealerListingMethod', requiredPermission: 'MANAGE_INVENTORY' } as MenuItem,
    ...DEALER_ITEMS.filter(item => item.id !== 'dealer-home'),
  ].filter(item => (item.id !== 'dealer-offers-only' || (!access.loading && !access.hasPermission('VIEW_TRADE')))
    && (!item.requiredPermission || (!access.loading && access.hasPermission(item.requiredPermission)))) : [
    { id: 'sell-car', label: 'Sell a Car', section: 'Selling', icon: 'add-circle-outline', iconLib: 'ion', stackScreen: 'SellLanding' },
    { id: 'browse-cars', label: 'Buy Cars', section: 'Buying', icon: 'search-outline', iconLib: 'ion', tabName: 'Search' },
    ...USER_ITEMS.filter(item => item.id !== 'user-dashboard'),
  ];
  const ordered = orderDashboardItems(items, preferences);
  const shown = editing ? ordered : ordered.filter(item => !preferences.hidden.includes(item.id));
  const open = (item: MenuItem) => {
    if (item.tabName) navigation.navigate('Tabs', { screen: item.tabName, params: item.tabParams ?? item.tabStackParams });
    else if (item.stackScreen) navigation.navigate(item.stackScreen, item.stackParams);
  };
  // iOS Dynamic Type at 1.3x was forcing ordinary iPhones into oversized,
  // full-width cards. Keep the same two-column phone grid as Android while
  // preserving a single column for truly large accessibility settings.
  const compactIOS = Platform.OS === 'ios' && width < 600;
  const columns = compactIOS
    ? (width < 340 || fontScale >= 1.75 ? 1 : 2)
    : (fontScale >= 1.3 || width < 360 ? 1 : width >= 1280 ? 3 : 2);
  const availableWidth = compactIOS ? Math.min(width - 40, iosGridWidth ?? width - 40) : width - 40;
  // Round down so fractional iOS layout points never push the second tile to another row.
  const cardWidth = compactIOS
    ? Math.max(0, Math.floor((availableWidth - (columns - 1) * 16) / columns))
    : (width - 40 - (columns - 1) * 16) / columns;
  return <View style={s.section}>
    <View style={[s.header, compactIOS && s.compactHeader, !compactIOS && fontScale >= 1.3 && { flexDirection: 'column', alignItems: 'stretch' }]}>
      {compactIOS ? (
        <>
          <View style={s.compactHeadingRow}>
            <Text accessibilityRole="header" style={s.compactTitle} maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Your dashboard</Text>
            <Button label={editing ? 'Done' : 'Customise'} size="sm" variant="outline" disabled={!ready} onPress={() => setEditing(!editing)} />
          </View>
          <Text style={s.compactHint}>Everything you need, in your order.</Text>
        </>
      ) : (
        <>
          <View style={s.heading}><Text accessibilityRole="header" style={s.title}>Your dashboard</Text><Text style={s.hint}>Everything you need, in your order.</Text></View>
          <Button label={editing ? 'Done' : 'Customise'} variant="outline" disabled={!ready} onPress={() => setEditing(!editing)} />
        </>
      )}
    </View>
    {error && <View accessibilityRole="alert"><Text style={s.error}>{error}</Text><Button label="Retry save" variant="outline" onPress={() => save(current.current)} /></View>}
    {mode === 'dealer' && access.error && <View><Text style={s.error}>Some tools are hidden because permissions could not be loaded.</Text><Button label="Retry permissions" variant="outline" onPress={() => void access.refresh(true)} /></View>}
    {!ready ? <ActivityIndicator accessibilityLabel="Loading dashboard layout" color={Colors.accent} /> : <>
      {editing && <View style={s.editIntro}><Text style={s.hint}>Show or hide cards, then use Earlier and Later to change their order. Your layout is saved on this device.</Text><Button label="Reset layout" size="sm" variant="ghost" onPress={() => save(defaultPreferences())} /></View>}
      {!shown.length && <Text style={s.hint}>All cards are hidden. Choose Customise to show them again.</Text>}
      <View style={s.grid} onLayout={compactIOS ? event => {
        const measured = event.nativeEvent.layout.width;
        if (Number.isFinite(measured) && measured > 0) setIosGridWidth(measured);
      } : undefined}>{shown.map(item => {
        const color = palette[item.section || 'Account'] || Colors.dashboardAccount;
        const hidden = preferences.hidden.includes(item.id);
        const index = ordered.findIndex(entry => entry.id === item.id);
        return <View key={item.id} style={[s.card, { width: cardWidth, backgroundColor: color, opacity: hidden ? 0.55 : 1 }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={item.label} onPress={() => open(item)} style={[s.cardAction, compactIOS && s.compactCardAction]} activeOpacity={0.8}>
            <View style={[s.icon, compactIOS && s.compactIcon]}>{item.iconLib === 'mci' ? <MaterialCommunityIcons name={item.icon} size={compactIOS ? 22 : 27} color={Colors.onAccent} /> : <Ionicons name={item.icon as any} size={compactIOS ? 22 : 27} color={Colors.onAccent} />}</View>
            <Text style={[s.group, compactIOS && s.compactGroup]} maxFontSizeMultiplier={compactIOS ? 1.2 : undefined}>{item.section}</Text>
            <Text style={[s.label, compactIOS && s.compactLabel]} maxFontSizeMultiplier={compactIOS ? 1.25 : undefined} numberOfLines={compactIOS ? 3 : undefined}>{item.label}</Text>
          </TouchableOpacity>
          {editing && <View style={s.controls}>
            <TouchableOpacity accessibilityRole="switch" accessibilityLabel={`Show ${item.label}`} accessibilityState={{ checked: !hidden }} style={s.control} onPress={() => save({ ...current.current, hidden: hidden ? current.current.hidden.filter(id => id !== item.id) : [...current.current.hidden, item.id] })}><Text style={s.controlLabel}>{hidden ? 'Show card' : 'Hide card'}</Text></TouchableOpacity>
            {([-1, 1] as const).map(direction => <TouchableOpacity key={direction} accessibilityRole="button" accessibilityLabel={`Move ${item.label} ${direction === -1 ? 'earlier' : 'later'}`} accessibilityState={{ disabled: direction === -1 ? index === 0 : index === ordered.length - 1 }} disabled={direction === -1 ? index === 0 : index === ordered.length - 1} style={[s.control, (direction === -1 ? index === 0 : index === ordered.length - 1) && { opacity: 0.4 }]} onPress={() => save(moveDashboardItem(current.current, ordered.map(entry => entry.id), item.id, direction))}><Text style={s.controlLabel}>{direction === -1 ? 'Earlier' : 'Later'}</Text></TouchableOpacity>)}
          </View>}
        </View>;
      })}</View>
    </>}
  </View>;
}

const s = StyleSheet.create({
  section: { paddingHorizontal: 20, marginVertical: 0, gap: 16 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  heading: { flexGrow: 1, flexShrink: 1 }, title: { fontSize: FontSize['2xl'], fontFamily: FontFamily.bold, color: Colors.textPrimary },
  compactHeader: { flexDirection: 'column', alignItems: 'stretch', gap: 6 },
  compactHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  compactTitle: { flex: 1, flexShrink: 1, fontSize: 20, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  compactHint: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary }, 
  hint: { fontSize: FontSize.base - 1, lineHeight: 22, color: Colors.textSecondary }, error: { fontSize: FontSize.base - 1, color: Colors.accent, marginBottom: 8 },
  editIntro: { gap: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
  card: { borderRadius: 20, borderBottomWidth: 4, borderColor: Colors.dashboardShadowBorder, overflow: 'hidden' },
  cardAction: { minHeight: 166, padding: 18, gap: 8 },
  compactCardAction: { minHeight: 132, padding: 12, gap: 5 },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.dashboardWhite15, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  compactIcon: { width: 37, height: 37, borderRadius: 11, marginBottom: 2 },
  group: { fontSize: FontSize.sm - 1, color: Colors.onAccent, fontFamily: FontFamily.medium },
  label: { fontSize: FontSize.lg - 1, lineHeight: 24, fontFamily: FontFamily.bold, color: Colors.onAccent },
  compactGroup: { fontSize: 11 },
  compactLabel: { fontSize: 14, lineHeight: 20 },
  controls: { padding: 8, gap: 6, borderTopWidth: 1, borderColor: Colors.dashboardWhite25 },
  control: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: Colors.dashboardWhite15 },
  controlLabel: { fontSize: FontSize.base - 1, color: Colors.onAccent, fontFamily: FontFamily.bold },
});
