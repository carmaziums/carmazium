import React, { useCallback, useState } from 'react';
import { View, Text, Switch, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HamburgerButton } from '../../components/HamburgerButton';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/apiClient';

export const DealerFinanceScreen: React.FC = () => {
  const inset = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    apiClient<{data: {enabled: boolean}}>('/finance/referrals/preference').then(r => { if (active) { setEnabled(r.data.enabled); setLoading(false); } }).catch(() => Alert.alert('Could not load finance setting', 'Please reopen this screen to try again.'));
    return () => { active = false; };
  }, []));
  const save = async (value: boolean) => {
    setSaving(true);
    try {
      const r = await apiClient<{data: {enabled: boolean}}>('/finance/referrals/preference', {method:'PATCH', body:JSON.stringify({enabled:value})});
      setEnabled(r.data.enabled);
    } catch { Alert.alert('Setting not saved', 'Please try again.'); }
    finally { setSaving(false); }
  };
  return <ScrollView style={{flex:1,backgroundColor:Colors.bgPrimary}} contentContainerStyle={{padding:24,paddingTop:inset.top+20,gap:20}}>
    <HamburgerButton />
    <Text style={{fontSize:24,fontWeight:'700',color:Colors.textPrimary}}>Listing finance calculator</Text>
    <Text style={{color:Colors.textSecondary}}>Show the finance calculator and Apply for Finance button on my current and future retail listings.</Text>
    {loading ? <ActivityIndicator /> : <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{flex:1,color:Colors.textPrimary}}>{enabled ? 'On — remove finance calculator from my listings' : 'Off — put finance calculator on my listings'}</Text><Switch value={enabled} disabled={saving} onValueChange={save} accessibilityLabel="Show finance calculator on my listings" /></View>}
    <Text style={{color:Colors.textSecondary}}>Buyers enter their name, email and phone, then continue to the Pulse Cars Limited Jigsaw Finance application. CarMazium does not provide finance or make lending decisions.</Text>
    <Text style={{fontSize:20,fontWeight:'700',color:Colors.textPrimary}}>Finance providers</Text>
    <Text style={{color:Colors.textSecondary}}>Want to offer finance through CarMazium? Contact the team directly to discuss a partnership. There is no online finance-provider registration.</Text>
    <Text accessibilityRole="link" onPress={() => Linking.openURL('https://www.carmazium.com/contact')} style={{color:Colors.accent}}>Contact the team</Text>
  </ScrollView>;
};
