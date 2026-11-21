import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getAccessToken } from '../../lib/supabase';
import { purchaseReceiptPath } from '../../lib/dealerPurchaseRecords';
import { Button } from '../Button';
import { Colors } from '../../constants/colors';

/** Buyer-scoped PDF, authenticated in the app; never an anonymous browser URL. */
export function PurchaseReceiptButton({ saleId, reconciled = false }: { saleId: string; reconciled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    setBusy(true); setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw Error('Please sign in again to download this record.');
      if (!await Sharing.isAvailableAsync()) throw Error('This device cannot open PDF files.');
      const safeId = saleId.replace(/[^a-zA-Z0-9-]/g, '');
      const filename = `carmazium-${reconciled ? 'owner-confirmed-acquisition' : 'vehicle-purchase'}-${safeId}.pdf`;
      const result = await FileSystem.downloadAsync(
        `${process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev'}${purchaseReceiptPath(saleId, reconciled)}`,
        `${FileSystem.cacheDirectory}${filename}`, { headers: { Authorization: `Bearer ${token}` } },
      );
      if (result.status !== 200) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
        throw Error('Unable to download the purchase PDF. Please try again.');
      }
      await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to download the purchase PDF. Please try again.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.wrap}>
    <Button variant="outline" size="sm" loading={busy} onPress={() => void download()}
      label={reconciled ? 'Download purchase record (PDF)' : 'Download purchase receipt (PDF)'} />
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({ wrap: { gap: 6, marginTop: 12 }, error: { color: Colors.error, fontSize: 13 } });
