import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';

type NotifView = 'main' | 'delivery';

export const NotificationSettingsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
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
  const [sms, setSms] = useState(false);
  const [freq, setFreq] = useState('immediate'); // immediate, 30min, daily
  const [quietHours, setQuietHours] = useState(true);

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
          if (typeof saved.sms === 'boolean') setSms(saved.sms);
          if (typeof saved.freq === 'string') setFreq(saved.freq);
          if (typeof saved.quietHours === 'boolean') setQuietHours(saved.quietHours);
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
              push, email, sms, freq, quietHours,
            },
          },
        }),
      });
      Alert.alert('Saved', 'Your notification preferences have been saved.');
    } catch {
      Alert.alert('Error', 'Could not save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [muteAll, outbid, winning, endingSoon, newLot, counterOffer, offerAccepted, offerDeclined, push, email, sms, freq, quietHours]);

  const CustomSwitch = ({ value, onValueChange, activeColor = '#DC1F26' }: any) => (
    <Switch
       value={value}
       onValueChange={onValueChange}
       trackColor={{ false: 'rgba(255,255,255,0.1)', true: activeColor }}
       thumbColor="#FFFFFF"
       ios_backgroundColor="rgba(255,255,255,0.1)"
    />
  );

  const renderMainView = () => (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 14 }]}>
        
        {/* Header */}
        <View style={styles.header}>
           <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
           </TouchableOpacity>
           <Text style={styles.headerTitle}>Notifications</Text>
           <TouchableOpacity onPress={savePreferences} disabled={saving} activeOpacity={0.7}>
              {saving
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.resetText}>Save</Text>
              }
           </TouchableOpacity>
        </View>

        {/* Mute All Box */}
        <View style={styles.muteAllBox}>
           <LinearGradient
             colors={['rgba(220,31,38,0.15)', 'rgba(220,31,38,0.02)']}
             style={StyleSheet.absoluteFillObject}
             start={{ x: 0, y: 0 }}
             end={{ x: 1, y: 1 }}
           />
           <View style={styles.muteIconWrap}>
              <Ionicons name="notifications-off-outline" size={18} color="#DC1F26" />
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
              <Ionicons name="hammer-outline" size={12} color="#DC1F26" />
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
              <Ionicons name="pricetag-outline" size={12} color="#F59E0B" />
           </View>
           <Text style={styles.sectionTitle}>OFFERS</Text>
        </View>

        <View style={styles.cardBlock}>
           <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>Counter-offer received</Text>
                 <Text style={styles.toggleSub}>Seller responded to your offer</Text>
              </View>
              <CustomSwitch value={counterOffer} onValueChange={setCounterOffer} activeColor="#F59E0B" />
           </View>
           <View style={styles.divider} />
           <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>Offer accepted</Text>
                 <Text style={styles.toggleSub}>Great news — proceed to payment</Text>
              </View>
              <CustomSwitch value={offerAccepted} onValueChange={setOfferAccepted} activeColor="#F59E0B" />
           </View>
           <View style={styles.divider} />
           <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>Offer declined</Text>
                 <Text style={styles.toggleSub}>Seller rejected your offer</Text>
              </View>
              <CustomSwitch value={offerDeclined} onValueChange={setOfferDeclined} activeColor="#F59E0B" />
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
           <Ionicons name="chevron-forward" size={20} color="#606070" />
        </TouchableOpacity>

      </ScrollView>

    </View>
  );

  const renderDeliveryView = () => (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 14 }]}>
         
        {/* Header */}
        <View style={[styles.header, { marginBottom: 32 }]}>
           <TouchableOpacity style={styles.backBtn} onPress={() => setView('main')} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
           </TouchableOpacity>
           <View style={styles.headerCenter}>
              <Text style={styles.headerSubText}>NOTIFICATIONS</Text>
              <Text style={styles.headerTitleCenter}>Delivery & quiet hours</Text>
           </View>
           <View style={{ width: 38 }} />
        </View>

        <Text style={[styles.sectionTitle, { marginLeft: 24, marginBottom: 16 }]}>DELIVERY CHANNELS</Text>

        <View style={styles.cardBlock}>
           <View style={styles.toggleRow}>
              <View style={styles.channelIconRed}>
                 <Ionicons name="notifications-outline" size={16} color="#DC1F26" />
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
                 <Ionicons name="mail-outline" size={16} color="#DC1F26" />
              </View>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>Email</Text>
                 <Text style={styles.toggleSub}>airaf@example.com</Text>
              </View>
              <CustomSwitch value={email} onValueChange={setEmail} />
           </View>
           <View style={styles.divider} />
           <View style={styles.toggleRow}>
              <View style={styles.channelIconGrey}>
                 <Ionicons name="chatbubble-outline" size={16} color="#A0A0AB" />
              </View>
              <View style={styles.toggleTextWrap}>
                 <Text style={styles.toggleTitle}>SMS</Text>
                 <Text style={styles.toggleSub}>+44 7700 900123</Text>
              </View>
              <CustomSwitch value={sms} onValueChange={setSms} />
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
                 <View style={styles.timeInput}>
                    <Text style={styles.timeText}>22:00</Text>
                    <Ionicons name="chevron-down" size={16} color="#A0A0AB" />
                 </View>
              </View>
              <View style={styles.timeBlock}>
                 <Text style={styles.timeLabel}>UNTIL</Text>
                 <View style={styles.timeInput}>
                    <Text style={styles.timeText}>08:00</Text>
                    <Ionicons name="chevron-down" size={16} color="#A0A0AB" />
                 </View>
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
        colors={['rgba(220,31,38,0.03)', 'rgba(0,0,0,0)', '#0A0A0C']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#DC1F26" />
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
    backgroundColor: '#0A0A0C',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    color: '#FFFFFF',
    marginLeft: 16,
    letterSpacing: -0.5,
  },
  resetText: {
     fontFamily: FontFamily.bold, fontSize: 14, color: '#DC1F26'
  },
  headerCenter: {
     alignItems: 'center', flex: 1
  },
  headerSubText: {
     fontFamily: FontFamily.bold, fontSize: 10, color: '#606070', letterSpacing: 1.5, marginBottom: 4
  },
  headerTitleCenter: {
     fontFamily: FontFamily.extraBold, fontSize: 18, color: '#FFFFFF', letterSpacing: -0.5
  },

  // Mute All Box
  muteAllBox: {
     marginHorizontal: 24, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(220,31,38,0.2)',
     backgroundColor: '#111116', flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 32,
     overflow: 'hidden'
  },
  muteIconWrap: {
     width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(220,31,38,0.1)',
     alignItems: 'center', justifyContent: 'center', marginRight: 16
  },
  muteTextWrap: {
     flex: 1
  },
  muteTitle: {
     fontFamily: FontFamily.bold, fontSize: 15, color: '#FFFFFF', marginBottom: 2
  },
  muteSub: {
     fontFamily: FontFamily.regular, fontSize: 13, color: '#A0A0AB'
  },

  sectionHeaderWrap: {
     flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginBottom: 12
  },
  sectionIconWrapRed: {
     width: 20, height: 20, borderRadius: 6, backgroundColor: 'rgba(220,31,38,0.1)',
     alignItems: 'center', justifyContent: 'center', marginRight: 10
  },
  sectionIconWrapYellow: {
     width: 20, height: 20, borderRadius: 6, backgroundColor: 'rgba(245,158,11,0.1)',
     alignItems: 'center', justifyContent: 'center', marginRight: 10
  },
  sectionTitle: {
     fontFamily: FontFamily.bold, fontSize: 11, color: '#FFFFFF', letterSpacing: 1.5
  },

  cardBlock: {
     marginHorizontal: 24, backgroundColor: '#111116', borderRadius: 16, borderWidth: 1,
     borderColor: 'rgba(255,255,255,0.06)', marginBottom: 32, overflow: 'hidden'
  },
  toggleRow: {
     flexDirection: 'row', alignItems: 'center', padding: 16
  },
  toggleTextWrap: {
     flex: 1, marginRight: 16
  },
  toggleTitle: {
     fontFamily: FontFamily.bold, fontSize: 15, color: '#FFFFFF', marginBottom: 4
  },
  toggleSub: {
     fontFamily: FontFamily.regular, fontSize: 13, color: '#606070'
  },
  divider: {
     height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16
  },

  // Delivery Nav Button
  deliveryBtn: {
     marginHorizontal: 24, backgroundColor: '#111116', borderRadius: 16, borderWidth: 1,
     borderColor: 'rgba(255,255,255,0.06)', padding: 16, flexDirection: 'row', alignItems: 'center',
     marginBottom: 32
  },
  deliveryTextWrap: {
     flex: 1
  },

  // Delivery Channels
  channelIconRed: {
     width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(220,31,38,0.1)',
     alignItems: 'center', justifyContent: 'center', marginRight: 14
  },
  channelIconGrey: {
     width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)',
     alignItems: 'center', justifyContent: 'center', marginRight: 14
  },

  // Frequency
  freqRow: {
     flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, padding: 16,
     backgroundColor: '#111116', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
     marginBottom: 10
  },
  freqRowActive: {
     borderColor: 'rgba(220,31,38,0.3)', backgroundColor: 'rgba(220,31,38,0.05)'
  },
  radioOuter: {
     width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#606070', marginRight: 14
  },
  radioInnerActive: {
     width: 22, height: 22, borderRadius: 11, backgroundColor: '#DC1F26', marginRight: 14,
     borderWidth: 6, borderColor: 'rgba(220,31,38,0.2)'
  },
  freqTitle: {
     flex: 1, fontFamily: FontFamily.bold, fontSize: 15, color: '#FFFFFF'
  },
  recBadge: {
     backgroundColor: 'rgba(220,31,38,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6
  },
  recText: {
     fontFamily: FontFamily.bold, fontSize: 10, color: '#DC1F26'
  },

  // Quiet Hours
  quietTimeRow: {
     flexDirection: 'row', padding: 16, gap: 16
  },
  timeBlock: {
     flex: 1
  },
  timeLabel: {
     fontFamily: FontFamily.bold, fontSize: 10, color: '#606070', letterSpacing: 1.5, marginBottom: 8
  },
  timeInput: {
     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
     backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
     borderRadius: 12, paddingHorizontal: 14, height: 48
  },
  timeText: {
     fontFamily: FontFamily.bold, fontSize: 16, color: '#FFFFFF'
  },

  // Mock Tab Bar
  mockTabBar: {
     position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around',
     paddingTop: 12, backgroundColor: '#0A0A0C', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)'
  },
  tabItem: {
     alignItems: 'center', flex: 1
  },
  tabLabel: {
     fontFamily: FontFamily.bold, fontSize: 9, color: '#606070', marginTop: 4, letterSpacing: 0.5
  }
});
