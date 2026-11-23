import React, { useCallback, useState } from 'react';
import { View, Text, Switch, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { DealerPageTabs } from '../../components/dealer/DealerPageTabs';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';

export const DealerFinanceScreen: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError(null);
    apiClient<{data: {enabled: boolean}}>('/finance/referrals/preference')
      .then(r => { if (typeof r.data?.enabled !== 'boolean') throw Error('Invalid preference'); if (active) setEnabled(r.data.enabled); })
      .catch(() => { if (active) setError('Could not load finance setting. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]));
  const save = async (value: boolean) => {
    setSaving(true);
    try {
      const r = await apiClient<{data: {enabled: boolean}}>('/finance/referrals/preference', {method:'PATCH', body:JSON.stringify({enabled:value})});
      if (typeof r.data?.enabled !== 'boolean') throw Error('Invalid preference');
      setEnabled(r.data.enabled);
    } catch { Alert.alert('Setting not saved', 'Please try again.'); }
    finally { setSaving(false); }
  };
  return <View style={styles.screen}><WebsiteTopBar />
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Finance Calculator</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Show finance calculator</Text>
        <Text style={styles.body}>Choose whether the calculator and Apply for Finance button appear on your current and future retail listings. It is on by default. You can turn it off or back on at any time. Buyers enter their name, email and phone number, then continue to the application with the finance provider selected by CarMazium admin.</Text>
        {loading ? <ActivityIndicator color={Colors.accent} /> : error ? <View style={{gap:12}}><Text accessibilityRole="alert" style={styles.body}>{error}</Text><Button label="Try again" variant="outline" onPress={() => setRetry(n => n + 1)} /></View> :
          <View style={styles.toggle}><Text style={styles.body}>{enabled ? 'On' : 'Off'}</Text><Switch value={enabled} disabled={saving} onValueChange={save} trackColor={{true:Colors.accent}} accessibilityLabel="Show finance calculator on my listings" /></View>}
        <Text style={styles.body}>CarMazium does not provide finance or make lending decisions. Enabling this option does not register you as a finance provider. Your own dealership finance badge is a separate setting.</Text>
      </View>
    </ScrollView><DealerPageTabs />
  </View>;
};
const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:Colors.bgPrimary}, content:{padding:20,paddingTop:24,gap:24},
  title:{fontSize:24,lineHeight:32,fontFamily:FontFamily.bold,color:Colors.textPrimary},
  card:{padding:24,gap:16,borderRadius:24,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.bgCard},
  label:{fontSize:18,lineHeight:26,fontFamily:FontFamily.semiBold,color:Colors.textPrimary},
  body:{fontSize:14,lineHeight:22,color:Colors.textSecondary}, toggle:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
});
