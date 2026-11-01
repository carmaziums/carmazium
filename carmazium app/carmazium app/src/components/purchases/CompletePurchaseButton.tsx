import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';

/**
 * Either party can complete an accepted retail sale (same rule and wording as
 * web's CompletePurchaseButton), so a deal is never stuck at Sale Pending
 * when a seller stops using CarMazium. Show only while the listing is
 * OFFER_ACCEPTED.
 */
export const CompletePurchaseButton: React.FC<{ listingId: string; onCompleted?: () => void }> = ({ listingId, onCompleted }) => {
  const [busy, setBusy] = useState(false);

  const complete = async () => {
    setBusy(true);
    try {
      await apiClient(`/listings/${encodeURIComponent(listingId)}/complete-purchase`, { method: 'POST' });
      Alert.alert('Purchase completed', 'The sale is recorded and the seller has been told.');
      onCompleted?.();
    } catch (err: any) {
      Alert.alert('Could not complete the purchase', err?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => Alert.alert(
    "I've bought this car",
    'Only confirm once you have paid the seller and the deal is done. This records the sale at the accepted offer price and tells the seller. If anything goes wrong later, use Cancel sale.',
    [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Yes, complete the purchase', onPress: () => { void complete(); } },
    ],
  );

  return (
    <TouchableOpacity style={styles.button} onPress={confirm} disabled={busy}
      accessibilityRole="button" accessibilityLabel="I've bought this car, complete the purchase">
      {busy
        ? <ActivityIndicator size="small" color={Colors.success} />
        : <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />}
      <Text style={styles.text}>I've bought this car</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, paddingHorizontal: 14, marginTop: 8,
    borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.successAlpha25,
    backgroundColor: Colors.successAlpha12,
  },
  text: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.success },
});
