import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativePage, pageStyles as s } from '../../components/NativePage';
import { Button } from '../../components/Button';
import { apiClient } from '../../lib/apiClient';

type Enquiry = { id: string; fullName: string; email: string; phone: string | null; message: string; verifiedAt: string; listing: { title: string; slug: string } };
export function GuestEnquiriesScreen() {
  const navigation = useNavigation<any>();
  const [rows, setRows] = useState<Enquiry[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError('');
    try { const result = await apiClient<{ data: Enquiry[] }>('/listing-enquiries/mine'); if (request === generation.current) setRows(result.data); }
    catch (e) { if (request === generation.current) setError(e instanceof Error ? e.message : 'Could not load enquiries.'); }
    finally { if (request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);
  const contact = async (url: string) => { try { await Linking.openURL(url); } catch { setError('Could not open your email or phone app. Use the contact details shown here.'); } };
  return <NativePage title="Guest vehicle enquiries">
    <Text style={s.body}>Buyers can contact you without creating an account. Their email address is confirmed before the enquiry arrives. Reply by email or phone. Showing your latest 100 enquiries from the last 90 days.</Text>
    <Button label={loading ? 'Loading…' : 'Refresh enquiries'} disabled={loading} onPress={() => void load()} />
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!loading && !error && !rows.length && <Text style={s.body}>No confirmed guest enquiries yet. Signed-in conversations remain in Messages.</Text>}
    {rows.map(row => <View key={row.id} style={s.panel}>
      <Button variant="outline" label={row.listing.title} onPress={() => navigation.navigate('VehicleDeepLink', { slug: row.listing.slug })} />
      <Text style={s.label}>{row.fullName}</Text><Text style={s.body}>Email confirmed · {new Date(row.verifiedAt).toLocaleString('en-GB')}</Text>
      <Text selectable style={s.body}>{row.message}</Text><Text selectable style={s.body}>{row.email}{row.phone ? `\n${row.phone}` : ''}</Text>
      <Button label="Reply by email" onPress={() => void contact(`mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(`Re: ${row.listing.title}`)}`)} />
      {row.phone && <Button label="Call buyer" variant="outline" onPress={() => void contact(`tel:${row.phone!.replace(/[^+\d]/g, '')}`)} />}
    </View>)}
  </NativePage>;
}
