import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { apiClient } from '../lib/apiClient';
import { DEALER_SERVICES_NOTICE_VERSION, shouldShowDealerServicesNotice } from '../lib/dealerNoticeRules';
import { useAuthStore } from '../store/authStore';

type ProfileResponse = {
  success: boolean;
  data: {
    id: string;
    dealerProfile?: object | null;
    preferences?: { dealerServicesNoticeV1?: unknown };
  };
};

export const DealerServicesNotice: React.FC = () => {
  const navigation = useNavigation<any>();
  const userId = useAuthStore(s => s.user?.id);
  const accountRole = useAuthStore(s => s.accountRole);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    if (accountRole !== 'dealer' || !userId) {
      setShow(false);
      return;
    }
    let current = true;
    void apiClient<ProfileResponse>('/users/me').then(result => {
      if (!current || !result.success || result.data.id !== userId) return;
      setShow(shouldShowDealerServicesNotice(result.data, userId));
    }).catch(() => { /* No false 'new setup' warning when profile request fails. */ });
    return () => { current = false; };
  }, [accountRole, userId]));

  const dismiss = async () => {
    if (busy || !userId) return;
    setBusy(true);
    setError('');
    try {
      await apiClient('/users/me/introduction', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'services_dismissed', version: DEALER_SERVICES_NOTICE_VERSION }),
      });
      setShow(false);
    } catch {
      setError('Could not save your dismissal. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!show || !userId || accountRole !== 'dealer') return null;
  return <View style={styles.notice} accessibilityRole="summary">
    <Text style={styles.title}>Manage your dealership services in Settings</Text>
    <Text style={styles.description}>Set your listing badges and open insurance-document uploads for collection, delivery, recovery or inspection through Account Settings → Business.</Text>
    <View style={styles.actions}>
      <TouchableOpacity
        accessibilityRole="button" accessibilityLabel="Open dealership services settings"
        style={styles.linkButton}
        onPress={() => navigation.navigate('Settings', { section: 'business' })}>
        <Ionicons name="settings-outline" size={17} color={Colors.accent} />
        <Text style={styles.link}>Open Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss dealership services notice"
        style={styles.dismissButton} disabled={busy} onPress={() => void dismiss()}>
        {busy ? <ActivityIndicator color={Colors.textPrimary} /> : <Text style={styles.dismiss}>Dismiss</Text>}
      </TouchableOpacity>
    </View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
};

const styles = StyleSheet.create({
  notice: {
    marginHorizontal: 20, marginBottom: 16, padding: 16, gap: 8,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  title: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.base },
  description: { color: Colors.textMuted, fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 18, flexWrap: 'wrap', alignItems: 'center' },
  linkButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 },
  link: { color: Colors.accent, fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, textDecorationLine: 'underline' },
  dismissButton: { minHeight: 44, justifyContent: 'center' },
  dismiss: { color: Colors.textPrimary, fontFamily: FontFamily.semiBold, fontSize: FontSize.sm },
  error: { color: Colors.error, fontSize: FontSize.sm },
});
