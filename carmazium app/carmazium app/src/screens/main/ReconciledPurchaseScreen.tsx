import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Button } from '../../components/Button';
import { PurchaseReceiptButton } from '../../components/purchases/PurchaseReceiptButton';
import { apiClient } from '../../lib/apiClient';
import type { ReconciledPurchase } from '../../lib/dealerPurchaseRecords';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';

const date = (value?: string) => value ? new Date(value.length === 10 ? value + 'T12:00:00Z' : value)
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }) : 'Not recorded';

export function ReconciledPurchaseScreen({ id }: { id: string }) {
  const [record, setRecord] = useState<ReconciledPurchase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setRecord(null); setError(null);
    apiClient<{ data: ReconciledPurchase }>(`/dealers/purchases/reconciled/${encodeURIComponent(id)}`)
      .then(result => { if (!result?.data?.id) throw Error('Purchase record unavailable.'); if (active) setRecord(result.data); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Purchase record unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry]);
  const fields = record ? [
    ['Registration', record.registration || 'Not recorded'],
    ['Original auction seller', record.sellerName],
    ['Original auction listed', date(record.originalListedAt)],
    ['Collection date', date(record.collectedAt || record.buyerCollectedAt)],
    ['Agreed purchase price', record.purchasePrice === null ? 'Not yet recorded' : record.purchasePrice.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })],
    ['Source', 'Original CarMazium auction listing'],
    ['Record reference', `CMZ-REC-${record.id.slice(0, 8).toUpperCase()}`],
  ] : [];
  return <View style={s.screen}><WebsiteTopBar /><ScrollView contentContainerStyle={s.content}>
    <Text accessibilityRole="header" style={s.title}>Completed purchase record</Text>
    {loading && <ActivityIndicator accessibilityLabel="Loading purchase" color={Colors.accent} />}
    {error && <View><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button label="Retry" onPress={() => setRetry(n => n + 1)} /></View>}
    {record && <>
      <View style={s.card}>
        {record.imageUrl && <Image source={{ uri: record.imageUrl }} style={s.image} contentFit="cover" accessibilityLabel={record.vehicleTitle} />}
        <Text style={s.success}>Completed · Collected</Text>
        <Text style={s.heading}>{record.vehicleTitle}</Text><Text style={s.body}>{record.vehicleSubtitle}</Text>
        {fields.map(([label, value]) => <View key={label} style={s.row}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>)}
        <PurchaseReceiptButton saleId={record.id} reconciled />
      </View>
      <View style={s.card}><Text style={s.heading}>About this recovered record</Text>
        <Text style={s.body}>You confirmed this vehicle was purchased and collected. This completed record was recovered against the original seller's CarMazium auction listing, including the original seller and photographs. It does not change the historic auction outcome, create a buyer fee, or mark any subsequent retail stock listing as sold.</Text>
        <Text style={s.body}>A CarMazium purchase record is not a VAT invoice or independent proof of payment. Keep your seller invoice and bank transfer evidence with your accounts.</Text>
      </View>
    </>}
  </ScrollView></View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary }, content: { padding: 20, paddingBottom: 100, gap: 20 },
  title: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  card: { padding: 20, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, backgroundColor: Colors.bgCard, gap: 12 },
  heading: { fontSize: 18, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  body: { fontSize: 14, lineHeight: 22, color: Colors.textSecondary }, image: { height: 160, borderRadius: 12 },
  success: { color: Colors.success, fontSize: 14, fontFamily: FontFamily.semiBold },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: Colors.border },
  label: { flex: 1, fontSize: 14, color: Colors.textSecondary }, value: { flex: 1, fontSize: 14, fontFamily: FontFamily.semiBold, textAlign: 'right', color: Colors.textPrimary },
  error: { color: Colors.error, fontSize: 14, marginBottom: 12 },
});
