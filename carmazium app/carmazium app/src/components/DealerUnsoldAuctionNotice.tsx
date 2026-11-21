import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Modal, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { getNotifications, markNotificationRead, type AppNotification } from '../lib/notificationsApi';
import { getUnsoldAuctionPrompt } from '../lib/dealerNoticeRules';
import { useAuthStore } from '../store/authStore';

/**
 * Port of the website's /dashboard/dealer unsold-auction recommendation.
 * This is notification-only. Never lists a vehicle or initiates a payment.
 */
export const DealerUnsoldAuctionNotice: React.FC = () => {
  const navigation = useNavigation<any>();
  const accountRole = useAuthStore(s => s.accountRole);
  const userId = useAuthStore(s => s.user?.id);
  const [notice, setNotice] = useState<AppNotification | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    if (accountRole !== 'dealer' || !userId) {
      setNotice(null);
      return;
    }
    let current = true;
    const read = async () => {
      try {
        const result = await getNotifications(1, 20);
        if (current) setNotice(getUnsoldAuctionPrompt(result.notifications));
      } catch { /* No disruptive error for an optional recommendation. */ }
    };
    void read();
    const interval = setInterval(() => { void read(); }, 30_000);
    return () => { current = false; clearInterval(interval); };
  }, [accountRole, userId]));

  const dismiss = async (open: boolean) => {
    const current = notice;
    if (!current || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await markNotificationRead(current.id);
    } catch {
      // The notification is still unread remotely; do not claim it was saved.
      // It may be shown again after refreshing the page.
    } finally {
      setBusy(false);
    }

    if (open) {
      const listingId = typeof current.data?.listingId === 'string' ? current.data.listingId : undefined;
      const retailAlreadyLive = current.data?.retailAlreadyLive === true;
      if (retailAlreadyLive) {
        navigation.navigate('DealerInventory');
      } else {
        // SellerAuctions supports focusListingId. Do not hand an ended AUCTION
        // directly to SellCarFlow as a CLASSIFIED edit: it may change type.
        navigation.navigate('SellerAuctions', listingId ? { focusListingId: listingId } : undefined);
      }
    }
  };

  if (!notice || accountRole !== 'dealer') return null;
  const alreadyLive = notice.data?.retailAlreadyLive === true;

  return <Modal transparent animationType="fade" visible onRequestClose={() => void dismiss(false)}>
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.headingRow}>
          <View style={styles.icon}>
            <Ionicons name="hammer-outline" size={23} color={Colors.accent} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>AUCTION UPDATE</Text>
            <Text style={styles.title}>Give your vehicle a wider audience</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss auction update"
            disabled={busy} onPress={() => void dismiss(false)} style={styles.close}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scroll}>
          <Text style={styles.description}>{notice.message}</Text>
          <View style={styles.retail}>
            <Ionicons name="bag-outline" size={21} color={Colors.success} />
            <View style={styles.flex}>
              <Text style={styles.retailTitle}>{alreadyLive ? 'Your Retail Listing is already live' : 'Retail Listing — £1 until sold'}</Text>
              <Text style={styles.small}>{alreadyLive
                ? 'Manage your existing vehicle in your dealership stock.'
                : 'Review your unsold auction in My Auctions before choosing whether to list it in the retail marketplace.'}</Text>
            </View>
          </View>
        </ScrollView>
        <View style={styles.actions}>
          <TouchableOpacity accessibilityRole="button" onPress={() => void dismiss(false)}
            disabled={busy} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Not now</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => void dismiss(true)}
            disabled={busy} style={styles.primaryButton}>
            {busy ? <ActivityIndicator color={Colors.onAccent} /> : <Text style={styles.primaryText}>{alreadyLive ? 'Manage Retail Listing' : 'Open My Auctions'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>;
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: Colors.blackAlpha75, paddingHorizontal: 16 },
  card: { width: '100%', maxWidth: 490, alignSelf: 'center', backgroundColor: Colors.bgCard, borderRadius: 22, borderWidth: 1, borderColor: Colors.border, padding: 19, gap: 15, maxHeight: '88%' },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10, justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },
  eyebrow: { color: Colors.accent, fontFamily: FontFamily.extraBold, fontSize: FontSize.xs, letterSpacing: 1.2 },
  title: { color: Colors.textPrimary, fontFamily: FontFamily.extraBold, fontSize: FontSize.xl, marginTop: 4 },
  close: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  scroll: { flexGrow: 0 },
  description: { color: Colors.textSecondary, fontSize: FontSize.base, lineHeight: 24 },
  retail: { marginTop: 18, borderRadius: 15, borderWidth: 1, borderColor: Colors.successAlpha20, backgroundColor: Colors.successAlpha06, padding: 15, flexDirection: 'row', gap: 10 },
  retailTitle: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.base },
  small: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 5, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10 },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary },
  primaryButton: { flex: 1.5, minHeight: 48, borderRadius: 12, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.onAccent },
});
