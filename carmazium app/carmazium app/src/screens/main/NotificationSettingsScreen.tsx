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
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { GlobalToastContext } from '../../components/GlobalToastProvider';
import { useAuthStore } from '../../store/authStore';

import { IconButton } from '../../components/IconButton';
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
  const [freq, setFreq] = useState('immediate'); // immediate, 30min, daily
  const [quietHours, setQuietHours] = useState(true);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('08:00');

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Hydrate toggles from the user's saved preferences so this screen reflects
  // what's actually persisted instead of always showing hardcoded defaults
  useEffect(() => {
    let mounted = true;
    apiClient<{ success: boolean; data: { preferences?: { notifications?: Record<string, any> } } }>('/users/me')
      .then((res) => {
        if (!mounted) return;
        const saved = res?.data?.preferences?.notifications;
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
          if (typeof saved.freq === 'string') setFreq(saved.freq);
          if (typeof saved.quietHours === 'boolean') setQuietHours(saved.quietHours);
          if (typeof saved.quietStart === 'string') setQuietStart(saved.quietStart);
          if (typeof saved.quietEnd === 'string') setQuietEnd(saved.quietEnd);
        }
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const savePreferences = useCallback(async () => {
    setSaving(true);
    try {
      await apiClient('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          preferences: {
            notifications: {
              muteAll, outbid, winning, endingSoon, newLot,
              counterOffer, offerAccepted, offerDeclined,
              push, email, sms: false, freq, quietHours, quietStart, quietEnd,
            },
          },
        }),
      });
      showToast('Notification preferences saved', 'success');
    } catch {
      showToast('Could not save preferences. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }, [muteAll, outbid, winning, endingSoon, newLot, counterOffer, offerAccepted, offerDeclined, push, email, freq, quietHours]);

  const CustomSwitch = ({ value, onValueChange, activeColor = Colors.accent, disabled }: any) => (
    <Switch
       value={value}
       onValueChange={onValueChange}
       trackColor={{ false: Colors.whiteAlpha10, true: activeColor }}
       thumbColor={Colors.white}
       ios_backgroundColor={Colors.whiteAlpha10}
       disabled={disabled}
    />
  );

  const renderMainView = () => (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 14 }]}>
        
        {/* Header */}
        <View style={styles.header}>
           <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />
           <Text style={styles.headerTitle}>Notifications</Text>
           <TouchableOpacity onPress={savePreferences} disabled={saving} activeOpacity={0.7}>
              {saving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.resetText}>Save</Text>
              }
           </TouchableOpacity>
        </View>

        {/* Mute All Box */}
        <View style={styles.muteAllBox}>
           <LinearGradient
             colors={[Colors.accentAlpha15, Colors.accentAlpha03]}
             style={StyleSheet.absoluteFillObject}
             start={{ x: 0, y: 0 }}
             end={{ x: 1, y: 1 }}
           />
           <View style={styles.muteIconWrap}>
              <Ionicons name="notifications-off-outline" size={18} color={Colors.accent} />
           </View>
           <View style={styles.muteTextWrap}>
              <Text style={styles.muteTitle}>Mute all notifications</Text>
              <Text style={styles.muteSub}>Override all settings below</Text>
           </View>
           <CustomSwitch value={muteAll} onValueChange={setMuteAll} />
        </View>

        {/* BIDS & AUCTIONS */}
        <View style={styles.sectionHeaderWrap}>
           <View style={styles.sectionIconWrapRed}>
              <Ionicons name="hammer-outline" size={12} color={Colors.accent} />
           </View>
           <Text style={styles.sectionTitle}>BIDS & AUCTIONS</Text>
        </View>

        <View style={styles.cardBlock}>
           <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>Outbid alerts</Text>
                 <Text style={styles.toggleSub}>Notify me the moment someone outbids me</Text>
              </View>
              <CustomSwitch value={outbid} onValueChange={setOutbid} />
           </View>
           <View style={styles.divider} />
           <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>You're winning</Text>
                 <Text style={styles.toggleSub}>Confirmation when you take the lead</Text>
              </View>
              <CustomSwitch value={winning} onValueChange={setWinning} />
           </View>
           <View style={styles.divider} />
           <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>Ending soon</Text>
                 <Text style={styles.toggleSub}>15 min warning on watched auctions</Text>
              </View>
              <CustomSwitch value={endingSoon} onValueChange={setEndingSoon} />
           </View>
           <View style={styles.divider} />
           <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>New lot added</Text>
                 <Text style={styles.toggleSub}>Cars matching your saved searches</Text>
              </View>
              <CustomSwitch value={newLot} onValueChange={setNewLot} />
           </View>
        </View>

        {/* OFFERS */}
        <View style={styles.sectionHeaderWrap}>
           <View style={styles.sectionIconWrapYellow}>
              <Ionicons name="pricetag-outline" size={12} color={Colors.warning} />
           </View>
           <Text style={styles.sectionTitle}>OFFERS</Text>
        </View>

        <View style={styles.cardBlock}>
           <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>Counter-offer received</Text>
                 <Text style={styles.toggleSub}>Seller responded to your offer</Text>
              </View>
              <CustomSwitch value={counterOffer} onValueChange={setCounterOffer} activeColor={Colors.warning} />
           </View>
           <View style={styles.divider} />
           <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>Offer accepted</Text>
                 <Text style={styles.toggleSub}>Great news — proceed to payment</Text>
              </View>
              <CustomSwitch value={offerAccepted} onValueChange={setOfferAccepted} activeColor={Colors.warning} />
           </View>
           <View style={styles.divider} />
           <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>Offer declined</Text>
                 <Text style={styles.toggleSub}>Seller rejected your offer</Text>
              </View>
              <CustomSwitch value={offerDeclined} onValueChange={setOfferDeclined} activeColor={Colors.warning} />
           </View>
        </View>

        {/* ADVANCED */}
        <View style={styles.sectionHeaderWrap}>
           <Text style={styles.sectionTitle}>ADVANCED</Text>
        </View>
        <TouchableOpacity style={styles.deliveryBtn} onPress={() => setView('delivery')} activeOpacity={0.7}>
           <View style={styles.deliveryTextWrap}>
              <Text style={styles.toggleTitle}>Delivery & quiet hours</Text>
              <Text style={styles.toggleSub}>Manage push, email, SMS and sleep mode</Text>
           </View>
           <Ionicons name="chevron-forward" size={20} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
        </TouchableOpacity>

      </ScrollView>

    </View>
  );

  const renderDeliveryView = () => (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 14 }]}>
         
        {/* Header — was missing a Save action entirely, so toggling push/
            email/SMS/quiet hours here and backing out via the chevron never
            persisted anything (savePreferences only lived on the main
            view's header). */}
        <View style={[styles.header, { marginBottom: 32 }]}>
           <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => setView('main')} accessibilityLabel="Go back" />
           <View style={styles.headerCenter}>
              <Text style={styles.headerSubText}>NOTIFICATIONS</Text>
              <Text style={styles.headerTitleCenter}>Delivery & quiet hours</Text>
           </View>
           <TouchableOpacity onPress={savePreferences} disabled={saving} activeOpacity={0.7}>
              {saving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.resetText}>Save</Text>
              }
           </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { marginLeft: 24, marginBottom: 16 }]}>DELIVERY CHANNELS</Text>

        <View style={styles.cardBlock}>
           <View style={styles.toggleRow}>
              <View style={styles.channelIconRed}>
                 <Ionicons name="notifications-outline" size={16} color={Colors.accent} />
              </View>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>Push</Text>
                 <Text style={styles.toggleSub}>iPhone notifications</Text>
              </View>
              <CustomSwitch value={push} onValueChange={setPush} />
           </View>
           <View style={styles.divider} />
           <View style={styles.toggleRow}>
              <View style={styles.channelIconRed}>
                 <Ionicons name="mail-outline" size={16} color={Colors.accent} />
              </View>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>Email</Text>
                 <Text style={styles.toggleSub}>{user?.email || 'Not set'}</Text>
              </View>
              <CustomSwitch value={email} onValueChange={setEmail} />
           </View>
           <View style={styles.divider} />
           <View style={styles.toggleRow}>
              <View style={styles.channelIconGrey}>
                 <Ionicons name="chatbubble-outline" size={16} color={Colors.textSecondary} />
              </View>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>SMS</Text>
                 {/* No SMS provider exists in the backend at all — this toggle
                     could never have worked regardless of preference-reading
                     fixes elsewhere (mobile-production-readiness-plan.md F23).
                     Disabled + labeled, not silently inert, matching the
                     Apple sign-in / Finance Calculator "Coming Soon" pattern
                     already used elsewhere in this app. */}
                 <Text style={styles.toggleSub}>Coming soon</Text>
              </View>
              <CustomSwitch value={false} onValueChange={() => {}} disabled />
           </View>
        </View>

        <Text style={[styles.sectionTitle, { marginLeft: 24, marginBottom: 16, marginTop: 8 }]}>BID ALERT FREQUENCY</Text>

        <TouchableOpacity 
           style={[styles.freqRow, freq === 'immediate' && styles.freqRowActive]} 
           onPress={() => setFreq('immediate')}
           activeOpacity={0.8}
        >
           <View style={freq === 'immediate' ? styles.radioInnerActive : styles.radioOuter} />
           <Text style={styles.freqTitle}>Immediately</Text>
           {freq === 'immediate' && (
              <View style={styles.recBadge}>
                 <Text style={styles.recText}>Recommended</Text>
              </View>
           )}
        </TouchableOpacity>
        
        <TouchableOpacity 
           style={[styles.freqRow, freq === '30min' && styles.freqRowActive]} 
           onPress={() => setFreq('30min')}
           activeOpacity={0.8}
        >
           <View style={freq === '30min' ? styles.radioInnerActive : styles.radioOuter} />
           <Text style={styles.freqTitle}>Every 30 min</Text>
        </TouchableOpacity>

        <TouchableOpacity 
           style={[styles.freqRow, freq === 'daily' && styles.freqRowActive]} 
           onPress={() => setFreq('daily')}
           activeOpacity={0.8}
        >
           <View style={freq === 'daily' ? styles.radioInnerActive : styles.radioOuter} />
           <Text style={styles.freqTitle}>Daily digest</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginLeft: 24, marginBottom: 16, marginTop: 8 }]}>QUIET HOURS</Text>

        <View style={styles.cardBlock}>
           <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>Enable quiet hours</Text>
                 <Text style={styles.toggleSub}>No push notifications during these times</Text>
              </View>
              <CustomSwitch value={quietHours} onValueChange={setQuietHours} />
           </View>
           <View style={styles.divider} />
           <View style={styles.quietTimeRow}>
              <View style={styles.timeBlock}>
                 <Text style={styles.timeLabel}>FROM</Text>
                 <TouchableOpacity style={styles.timeInput} onPress={() => setQuietStart(cycleTime(quietStart))} activeOpacity={0.7}>
                    <Text style={styles.timeText}>{quietStart}</Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
                 </TouchableOpacity>
              </View>
              <View style={styles.timeBlock}>
                 <Text style={styles.timeLabel}>UNTIL</Text>
                 <TouchableOpacity style={styles.timeInput} onPress={() => setQuietEnd(cycleTime(quietEnd))} activeOpacity={0.7}>
                    <Text style={styles.timeText}>{quietEnd}</Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
                 </TouchableOpacity>
              </View>
           </View>
        </View>

      </ScrollView>

    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha03, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.accent} />
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
     marginHorizontal: 24, borderRadius: 16, borderWidth: 1, borderColor: Colors.accentAlpha20,
     backgroundColor: Colors.bgSecondaryAlt, flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 32,
     overflow: 'hidden'
  },
  muteIconWrap: {
     width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.accentAlpha10,
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
     marginHorizontal: 24, backgroundColor: Colors.bgSecondaryAlt, borderRadius: 16, borderWidth: 1,
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
     marginHorizontal: 24, backgroundColor: Colors.bgSecondaryAlt, borderRadius: 16, borderWidth: 1,
     borderColor: Colors.whiteAlpha06, padding: 16, flexDirection: 'row', alignItems: 'center',
     marginBottom: 32
  },
  deliveryTextWrap: {
     flex: 1
  },

  // Delivery Channels
  channelIconRed: {
     width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.accentAlpha10,
     alignItems: 'center', justifyContent: 'center', marginRight: 14
  },
  channelIconGrey: {
     width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.whiteAlpha05,
     alignItems: 'center', justifyContent: 'center', marginRight: 14
  },

  // Frequency
  freqRow: {
     flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, padding: 16,
     backgroundColor: Colors.bgSecondaryAlt, borderRadius: 14, borderWidth: 1, borderColor: Colors.whiteAlpha05,
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
     borderRadius: 12, paddingHorizontal: 14, height: 48
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
