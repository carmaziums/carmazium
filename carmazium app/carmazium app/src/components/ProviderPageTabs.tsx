import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
export function ProviderPageTabs() {
  const navigation = useNavigation<any>(), insets = useSafeAreaInsets();
  const tabs = [
    { label: 'Partner Home', screen: 'PartnerDashboard' }, { label: 'Service Overview', screen: 'ProviderOverview' },
    { label: 'Available Jobs', screen: 'ProviderJobs', params: { initialTab: 'open' } }, { label: 'My Work', screen: 'ProviderJobs', params: { initialTab: 'assigned' } },
  ];
  return <View style={[s.bar, { paddingBottom: insets.bottom }]}>{tabs.map(tab => <TouchableOpacity key={tab.label} accessibilityRole="tab" style={s.tab} onPress={() => navigation.navigate(tab.screen, tab.params)}><Text style={s.label}>{tab.label}</Text></TouchableOpacity>)}</View>;
}
const s = StyleSheet.create({ bar: { flexDirection: 'row', backgroundColor: Colors.bgCard, borderTopWidth: 1, borderColor: Colors.border }, tab: { flex: 1, minHeight: 68, padding: 8, alignItems: 'center', justifyContent: 'center' }, label: { color: Colors.textPrimary, fontSize: 12, textAlign: 'center' } });
