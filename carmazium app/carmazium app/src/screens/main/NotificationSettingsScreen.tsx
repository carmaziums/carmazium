import React, { useState, useCallback, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { useNativeAppearance } from '../../theme/NativeAppearanceProvider';
import { GlobalToastContext } from '../../components/GlobalToastProvider';
import { useAuthStore } from '../../store/authStore';

import { IconButton } from '../../components/IconButton';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
type NotifView = 'main' | 'delivery';

// FROM/UNTIL used to be static "22:00"/"08:00" text with a decorative
// chevron-down that did nothing on tap — looked like a picker, wasn't one.
// Tapping now cycles through hourly options rather than pulling in a new
// picker dependency for two fields.
const QUIET_HOUR_TIMES = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
const cycleTime = (current: string) => {
  const idx = QUIET_HOUR_TIMES.indexOf(current);
  return QUIET_HOUR_TIMES[(idx + 1) % QUIET_HOUR_TIMES.length] ?? QUIET_HOUR_TIMES[0];
};

export const NotificationSettingsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { palette, resolvedAppearance } = useNativeAppearance();
  const themed = useNotificationSettingsThemeStyles();
  const insets = useSafeAreaInsets();
  const { showToast } = useContext(GlobalToastContext);
  const { user } = useAuthStore();
  const [view, setView] = useState<NotifView>('main');

  // Main Toggles
  const [muteAll, setMuteAll] = useState(false);
  const [outbid, setOutbid] = useState(true);
  const [winning, setWinning] = useState(true);
  const [endingSoon, setEndingSoon] = useState(true);
  const [newLot, setNewLot] = useState(false);
  const [counterOffer, setCounterOffer] = useState(true);
  const [offerAccepted, setOfferAccepted] = useState(true);
  const [offerDeclined, setOfferDeclined] = useState(false);

  // Delivery Toggles
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(true);
  // Digest scheduling is not implemented by the notification delivery backend.
  const [quietHours, setQuietHours] = useState(true);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('08:00');

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [savedNotifications, setSavedNotifications] = useState<Record<string, any>>({});

  // Hydrate toggles from the user's saved preferences so this screen reflects
  // what's actually persisted instead of always showing hardcoded defaults
  useEffect(() => {
    let mounted = true;
    apiClient<{ success: boolean; data: { preferences?: { notifications?: Record<string, any> } } }>('/users/me')
      .then((res) => {
        if (!mounted) return;
        if (res?.success !== true || !res?.data) throw new Error('Preferences unavailable');
        const saved = res.data.preferences?.notifications;
        if (saved != null && (typeof saved !== 'object' || Array.isArray(saved))) {
          throw new Error('Invalid notification preferences');
        }
        // Preserve preference keys this screen does not control when PATCHing.
        setSavedNotifications(saved ?? {});
        setLoadError(null);
        if (saved) {
          if (typeof saved.muteAll === 'boolean') setMuteAll(saved.muteAll);
          if (typeof saved.outbid === 'boolean') setOutbid(saved.outbid);
          if (typeof saved.winning === 'boolean') setWinning(saved.winning);
          if (typeof saved.endingSoon === 'boolean') setEndingSoon(saved.endingSoon);
          if (typeof saved.newLot === 'boolean') setNewLot(saved.newLot);
          if (typeof saved.counterOffer === 'boolean') setCounterOffer(saved.counterOffer);
          if (typeof saved.offerAccepted === 'boolean') setOfferAccepted(saved.offerAccepted);
          if (typeof saved.offerDeclined === 'boolean') setOfferDeclined(saved.offerDeclined);
          if (typeof saved.push === 'boolean') setPush(saved.push);
          if (typeof saved.email === 'boolean') setEmail(saved.email);
          if (typeof saved.quietHours === 'boolean') setQuietHours(saved.quietHours);
          if (typeof saved.quietStart === 'string') setQuietStart(saved.quietStart);
          if (typeof saved.quietEnd === 'string') setQuietEnd(saved.quietEnd);
        }
      })
      .catch(() => { if (mounted) setLoadError('Could not load your saved notification settings. No changes have been made.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [loadAttempt]);

  const savePreferences = useCallback(async () => {
    // Never replace real saved choices with guessed defaults if the GET failed.
    if (loading || loadError || saving) return;
    const nextNotifications = {
      ...savedNotifications,
      muteAll, outbid, winning, endingSoon, newLot,
      counterOffer, offerAccepted, offerDeclined,
      push, email, quietHours, quietStart, quietEnd,
    };
    setSaving(true);
    try {
      await apiClient('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ preferences: { notifications: nextNotifications } }),
      });
      setSavedNotifications(nextNotifications);
      showToast('Notification preferences saved', 'success');
    } catch {
      showToast('Could not save preferences. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }, [loading, loadError, saving, savedNotifications, muteAll, outbid, winning, endingSoon, newLot, counterOffer, offerAccepted, offerDeclined, push, email, quietHours, quietStart, quietEnd, showToast]);

  const CustomSwitch = ({ value, onValueChange, activeColor = Colors.accent, disabled }: any) => (
    <Switch
       value={value}
       onValueChange={onValueChange}
       trackColor={{ false: palette.borderDefault, true: activeColor }}
       thumbColor={Colors.white}
       ios_backgroundColor={palette.borderDefault}
       disabled={disabled}
    />
  );

  const renderMainView = () => (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[themed.scrollContent, { paddingTop: insets.top + 14 }]}>
        
        {/* Header */}
        <View style={themed.header}>
           <IconButton style={themed.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />
           <Text style={themed.headerTitle}>Notifications</Text>
           <TouchableOpacity onPress={savePreferences} disabled={saving} activeOpacity={0.7}>
              {saving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={themed.resetText}>Save</Text>
              }
           </TouchableOpacity>
        </View>

        {/* Mute All Box */}
        <View style={themed.muteAllBox}>
           <LinearGradient
             colors={[Colors.accentAlpha15, Colors.accentAlpha03]}
             style={StyleSheet.absoluteFillObject}
             start={{ x: 0, y: 0 }}
             end={{ x: 1, y: 1 }}
           />
           <View style={themed.muteIconWrap}>
              <Ionicons name="notifications-off-outline" size={18} color={Colors.accent} />
           </View>
           <View style={themed.muteTextWrap}>
              <Text style={themed.muteTitle}>Mute all notifications</Text>
              <Text style={themed.muteSub}>Override all settings below</Text>
           </View>
           <CustomSwitch value={muteAll} onValueChange={setMuteAll} />
        </View>

        {/* BIDS & AUCTIONS */}
        <View style={themed.sectionHeaderWrap}>
           <View style={themed.sectionIconWrapRed}>
              <Ionicons name="hammer-outline" size={12} color={Colors.accent} />
           </View>
           <Text style={themed.sectionTitle}>BIDS & AUCTIONS</Text>
        </View>

        <View style={themed.cardBlock}>
           <View style={themed.toggleRow}>
              <View style={themed.toggleTextWrap}>
                 <Text style={themed.toggleTitle}>Outbid alerts</Text>
                 <Text style={themed.toggleSub}>Notify me the moment someone outbids me</Text>
              </View>
              <CustomSwitch value={outbid} onValueChange={setOutbid} />
           </View>
           <View style={themed.divider} />
           <View style={themed.toggleRow}>
              <View style={themed.toggleTextWrap}>
                 <Text style={themed.toggleTitle}>You're winning</Text>
                 <Text style={themed.toggleSub}>Confirmation when you take the lead</Text>
              </View>
              <CustomSwitch value={winning} onValueChange={setWinning} />
           </View>
           <View style={themed.divider} />
           <View style={themed.toggleRow}>
              <View style={themed.toggleTextWrap}>
                 <Text style={themed.toggleTitle}>Ending soon</Text>
                 <Text style={themed.toggleSub}>15 min warning on watched auctions</Text>
              </View>
              <CustomSwitch value={endingSoon} onValueChange={setEndingSoon} />
           </View>
           <View style={themed.divider} />
           <View style={themed.toggleRow}>
              <View style={themed.toggleTextWrap}>
                 <Text style={themed.toggleTitle}>New lot added</Text>
                 <Text style={themed.toggleSub}>Cars matching your saved searches</Text>
              </View>
              <CustomSwitch value={newLot} onValueChange={setNewLot} />
           </View>
        </View>

        {/* OFFERS */}
        <View style={themed.sectionHeaderWrap}>
           <View style={themed.sectionIconWrapYellow}>
              <Ionicons name="pricetag-outline" size={12} color={Colors.warning} />
           </View>
           <Text style={themed.sectionTitle}>OFFERS</Text>
        </View>

        <View style={themed.cardBlock}>
           <View style={themed.toggleRow}>
              <View style={themed.toggleTextWrap}>
                 <Text style={themed.toggleTitle}>Counter-offer received</Text>
                 <Text style={themed.toggleSub}>Seller responded to your offer</Text>
              </View>
              <CustomSwitch value={counterOffer} onValueChange={setCounterOffer} activeColor={Colors.warning} />
           </View>
           <View style={themed.divider} />
           <View style={themed.toggleRow}>
              <View style={themed.toggleTextWrap}>
                 <Text style={themed.toggleTitle}>Offer accepted</Text>
                 <Text style={themed.toggleSub}>Great news — proceed to payment</Text>
              </View>
              <CustomSwitch value={offerAccepted} onValueChange={setOfferAccepted} activeColor={Colors.warning} />
           </View>
           <View style={themed.divider} />
           <View style={themed.toggleRow}>
              <View style={themed.toggleTextWrap}>
                 <Text style={themed.toggleTitle}>Offer declined</Text>
                 <Text style={themed.toggleSub}>Seller rejected your offer</Text>
              </View>
              <CustomSwitch value={offerDeclined} onValueChange={setOfferDeclined} activeColor={Colors.warning} />
           </View>
        </View>

        {/* ADVANCED */}
        <View style={themed.sectionHeaderWrap}>
           <Text style={themed.sectionTitle}>ADVANCED</Text>
        </View>
        <TouchableOpacity style={themed.deliveryBtn} onPress={() => setView('delivery')} activeOpacity={0.7}>
           <View style={themed.deliveryTextWrap}>
              <Text style={themed.toggleTitle}>Delivery & quiet hours</Text>
              <Text style={themed.toggleSub}>Manage push, email and quiet hours</Text>
           </View>
           <Ionicons name="chevron-forward" size={20} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
        </TouchableOpacity>

      </ScrollView>

    </View>
  );

  const renderDeliveryView = () => (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[themed.scrollContent, { paddingTop: insets.top + 14 }]}>
         
        {/* Header — was missing a Save action entirely, so toggling push/
            email/SMS/quiet hours here and backing out via the chevron never
            persisted anything (savePreferences only lived on the main
            view's header). */}
        <View style={[themed.header, { marginBottom: 32 }]}>
           <IconButton style={themed.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => setView('main')} accessibilityLabel="Go back" />
           <View style={themed.headerCenter}>
              <Text style={themed.headerSubText}>NOTIFICATIONS</Text>
              <Text style={themed.headerTitleCenter}>Delivery & quiet hours</Text>
           </View>
           <TouchableOpacity onPress={savePreferences} disabled={saving} activeOpacity={0.7}>
              {saving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={themed.resetText}>Save</Text>
              }
           </TouchableOpacity>
        </View>

        <Text style={[themed.sectionTitle, { marginLeft: 24, marginBottom: 16 }]}>DELIVERY CHANNELS</Text>

        <View style={themed.cardBlock}>
           <View style={themed.toggleRow}>
              <View style={themed.channelIconRed}>
                 <Ionicons name="notifications-outline" size={16} color={Colors.accent} />
              </View>
              <View style={themed.toggleTextWrap}>
                 <Text style={themed.toggleTitle}>Push</Text>
                 <Text style={themed.toggleSub}>Android and iPhone notifications</Text>
              </View>
              <CustomSwitch value={push} onValueChange={setPush} />
           </View>
           <View style={themed.divider} />
           <View style={themed.toggleRow}>
              <View style={themed.channelIconRed}>
                 <Ionicons name="mail-outline" size={16} color={Colors.accent} />
              </View>
              <View style={themed.toggleTextWrap}>
                 <Text style={themed.toggleTitle}>Email</Text>
                 <Text style={themed.toggleSub}>{user?.email || 'Not set'}</Text>
              </View>
              <CustomSwitch value={email} onValueChange={setEmail} />
           </View>
           <View style={themed.divider} />
           <View style={themed.toggleRow}>
              <View style={themed.channelIconGrey}>
                 <Ionicons name="chatbubble-outline" size={16} color={Colors.textSecondary} />
              </View>
              <View style={themed.toggleTextWrap}>
                 <Text style={themed.toggleTitle}>SMS</Text>
                 {/* No SMS provider exists in the backend at all — this toggle
                     could never have worked regardless of preference-reading
                     fixes elsewhere (mobile-production-readiness-plan.md F23).
                     Disabled + labeled, not silently inert, matching the
                     Apple sign-in / Finance Calculator "Coming Soon" pattern
                     already used elsewhere in this app. */}
                 <Text style={themed.toggleSub}>Coming soon</Text>
              </View>
              <CustomSwitch value={false} onValueChange={() => {}} disabled />
           </View>
        </View>

        <Text style={[themed.sectionTitle, { marginLeft: 24, marginBottom: 16, marginTop: 8 }]}>ALERT DELIVERY</Text>
        <View style={themed.cardBlock}>
          <View style={themed.toggleRow}>
            <View style={themed.toggleTextWrap}>
              <Text style={themed.toggleTitle}>Alerts are sent as they happen</Text>
              <Text style={themed.toggleSub}>30-minute and daily digests are not available yet.</Text>
            </View>
          </View>
        </View>

        <Text style={[themed.sectionTitle, { marginLeft: 24, marginBottom: 16, marginTop: 8 }]}>QUIET HOURS</Text>

        <View style={themed.cardBlock}>
           <View style={themed.toggleRow}>
              <View style={themed.toggleTextWrap}>
                 <Text style={themed.toggleTitle}>Enable quiet hours</Text>
                 <Text style={themed.toggleSub}>No push notifications during these times</Text>
              </View>
              <CustomSwitch value={quietHours} onValueChange={setQuietHours} />
           </View>
           <View style={themed.divider} />
           <View style={themed.quietTimeRow}>
              <View style={themed.timeBlock}>
                 <Text style={themed.timeLabel}>FROM</Text>
                 <TouchableOpacity style={themed.timeInput} onPress={() => setQuietStart(cycleTime(quietStart))} activeOpacity={0.7}>
                    <Text style={themed.timeText}>{quietStart}</Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
                 </TouchableOpacity>
              </View>
              <View style={themed.timeBlock}>
                 <Text style={themed.timeLabel}>UNTIL</Text>
                 <TouchableOpacity style={themed.timeInput} onPress={() => setQuietEnd(cycleTime(quietEnd))} activeOpacity={0.7}>
                    <Text style={themed.timeText}>{quietEnd}</Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
                 </TouchableOpacity>
              </View>
           </View>
        </View>

      </ScrollView>

    </View>
  );

  return (
    <View style={themed.container}>
      <StatusBar barStyle={resolvedAppearance === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor={palette.bgBody} />
      <LinearGradient
        colors={[Colors.accentAlpha03, 'rgba(0,0,0,0)', palette.bgBody]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />
      {loading ? (
        <View style={themed.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : loadError ? (
        <View style={{ paddingHorizontal: 24, paddingTop: insets.top + 32 }}>
          <Text style={themed.headerTitle}>Notifications</Text>
          <ErrorBanner message={loadError} onRetry={() => { setLoading(true); setLoadAttempt(n => n + 1); }} />
        </View>
      ) : (
        view === 'main' ? renderMainView() : renderDeliveryView()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.xl,
    color: Colors.white,
    marginLeft: 16,
    letterSpacing: -0.5,
  },
  resetText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.accent
  },
  headerCenter: {
     alignItems: 'center', flex: 1
  },
  headerSubText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.iconMuted, letterSpacing: 1.5, marginBottom: 4
  },
  headerTitleCenter: {
     fontFamily: FontFamily.extraBold, fontSize: FontSize.lg, color: Colors.white, letterSpacing: -0.5
  },

  // Mute All Box
  muteAllBox: {
     marginHorizontal: 24, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.accentAlpha20,
     backgroundColor: Colors.bgSecondaryAlt, flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 32,
     overflow: 'hidden'
  },
  muteIconWrap: {
     width: 40, height: 40, borderRadius: Radius.inline, backgroundColor: Colors.accentAlpha10,
     alignItems: 'center', justifyContent: 'center', marginRight: 16
  },
  muteTextWrap: {
     flex: 1
  },
  muteTitle: {
     fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white, marginBottom: 2
  },
  muteSub: {
     fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary
  },

  sectionHeaderWrap: {
     flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginBottom: 12
  },
  sectionIconWrapRed: {
     width: 20, height: 20, borderRadius: 6, backgroundColor: Colors.accentAlpha10,
     alignItems: 'center', justifyContent: 'center', marginRight: 10
  },
  sectionIconWrapYellow: {
     width: 20, height: 20, borderRadius: 6, backgroundColor: Colors.warningAlpha10,
     alignItems: 'center', justifyContent: 'center', marginRight: 10
  },
  sectionTitle: {
     fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white, letterSpacing: 1.5
  },

  cardBlock: {
     marginHorizontal: 24, backgroundColor: Colors.bgSecondaryAlt, borderRadius: Radius.card, borderWidth: 1,
     borderColor: Colors.whiteAlpha06, marginBottom: 32, overflow: 'hidden'
  },
  toggleRow: {
     flexDirection: 'row', alignItems: 'center', padding: 16
  },
  toggleTextWrap: {
     flex: 1, marginRight: 16
  },
  toggleTitle: {
     fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white, marginBottom: 4
  },
  toggleSub: {
     fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.iconMuted
  },
  divider: {
     height: 1, backgroundColor: Colors.whiteAlpha05, marginHorizontal: 16
  },

  // Delivery Nav Button
  deliveryBtn: {
     marginHorizontal: 24, backgroundColor: Colors.bgSecondaryAlt, borderRadius: Radius.card, borderWidth: 1,
     borderColor: Colors.whiteAlpha06, padding: 16, flexDirection: 'row', alignItems: 'center',
     marginBottom: 32
  },
  deliveryTextWrap: {
     flex: 1
  },

  // Delivery Channels
  channelIconRed: {
     width: 36, height: 36, borderRadius: Radius.inline, backgroundColor: Colors.accentAlpha10,
     alignItems: 'center', justifyContent: 'center', marginRight: 14
  },
  channelIconGrey: {
     width: 36, height: 36, borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha05,
     alignItems: 'center', justifyContent: 'center', marginRight: 14
  },

  // Frequency
  freqRow: {
     flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, padding: 16,
     backgroundColor: Colors.bgSecondaryAlt, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha05,
     marginBottom: 10
  },
  freqRowActive: {
     borderColor: Colors.accentAlpha30, backgroundColor: Colors.accentAlpha05
  },
  radioOuter: {
     width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.iconMuted, marginRight: 14
  },
  radioInnerActive: {
     width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.accent, marginRight: 14,
     borderWidth: 6, borderColor: Colors.accentAlpha20
  },
  freqTitle: {
     flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white
  },
  recBadge: {
     backgroundColor: Colors.accentAlpha10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6
  },
  recText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.accent
  },

  // Quiet Hours
  quietTimeRow: {
     flexDirection: 'row', padding: 16, gap: 16
  },
  timeBlock: {
     flex: 1
  },
  timeLabel: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.iconMuted, letterSpacing: 1.5, marginBottom: 8
  },
  timeInput: {
     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
     backgroundColor: Colors.whiteAlpha05, borderWidth: 1, borderColor: Colors.whiteAlpha10,
     borderRadius: Radius.inline, paddingHorizontal: 14, height: 48
  },
  timeText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white
  },

  // Mock Tab Bar
  mockTabBar: {
     position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around',
     paddingTop: 12, backgroundColor: Colors.bgPrimary, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha05
  },
  tabItem: {
     alignItems: 'center', flex: 1
  },
  tabLabel: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.iconMuted, marginTop: 4, letterSpacing: 0.5
  }
});

function useNotificationSettingsThemeStyles() {
  const { palette } = useNativeAppearance();
  return React.useMemo(() => ({
    ...styles,
    container: [styles.container, { backgroundColor: palette.bgBody }],
    header: [styles.header, { backgroundColor: palette.bgHeader, borderBottomColor: palette.borderDefault }],
    backBtn: [styles.backBtn, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    headerTitle: [styles.headerTitle, { color: palette.textPrimary }],
    resetText: [styles.resetText, { color: palette.accent }],
    headerSubText: [styles.headerSubText, { color: palette.textMuted }],
    headerTitleCenter: [styles.headerTitleCenter, { color: palette.textPrimary }],
    muteAllBox: [styles.muteAllBox, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    muteTitle: [styles.muteTitle, { color: palette.textPrimary }],
    muteSub: [styles.muteSub, { color: palette.textSecondary }],
    sectionTitle: [styles.sectionTitle, { color: palette.textPrimary }],
    cardBlock: [styles.cardBlock, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    toggleRow: [styles.toggleRow, { borderBottomColor: palette.borderDefault }],
    toggleTitle: [styles.toggleTitle, { color: palette.textPrimary }],
    toggleSub: [styles.toggleSub, { color: palette.textMuted }],
    divider: [styles.divider, { backgroundColor: palette.borderDefault }],
    deliveryBtn: [styles.deliveryBtn, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    freqRow: [styles.freqRow, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    freqTitle: [styles.freqTitle, { color: palette.textPrimary }],
    quietTimeRow: [styles.quietTimeRow, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    timeLabel: [styles.timeLabel, { color: palette.textMuted }],
    timeInput: [styles.timeInput, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    timeText: [styles.timeText, { color: palette.textPrimary }],
  }), [palette]);
}
