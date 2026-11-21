import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativePage, FormField, CheckField, pageStyles as s } from '../../components/NativePage';
import { Button } from '../../components/Button';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import { customerFields, vehicleFields, warrantyPayload, money, type WarrantyField, type WarrantyOrder } from '../../lib/nativeWarranty';
const headers = { 'X-CSRF-Token': 'warranty-order' };
const tokenKey = (id: string) => `carmazium-warranty-${id}`;
const additions = [['AIRBAGS', 'Airbag protection +£20'], ['DRIVER_ASSISTANCE', 'Driver assistance +£20'], ['EMISSIONS', 'Emissions +£20'], ['MULTIMEDIA', 'Multimedia +£80']];
export function WarrantyScreen({ navigation, route }: any) {
  const user = useAuthStore(state => state.user);
  const [listingId,setListingId]=useState<string>(route?.params?.listingId || '');
  const [listingTitle,setListingTitle]=useState('');
  const [prefillBusy,setPrefillBusy]=useState(!!route?.params?.listingId);
  const edited=useRef(new Set<string>());
  const [values, setValues] = useState<Record<string, string>>({ repairLimit: '2000', labourRate: '75', requestedStartDate: new Date().toISOString().slice(0, 10), firstName: user?.firstName || '', lastName: user?.lastName || '', email: user?.email || '' });
  const [extras, setExtras] = useState<string[]>([]), [confirmed, setConfirmed] = useState(false), [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false), [lookupBusy, setLookupBusy] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const lock = useRef(false), request = useRef<{ key: string; id: string; token: string } | null>(null);
  useEffect(()=>{
    if(!listingId){setPrefillBusy(false);return;}
    let active=true;setPrefillBusy(true);
    apiClient<{data:{title:string;vrm?:string;make?:string;model?:string;engineSize?:number;fuelType?:string;price:string}}>(`/warranties/listing/${encodeURIComponent(listingId)}`).then(({data})=>{
      if(!active)return;setListingTitle(data.title);
      const fields:Record<string,string>={vrm:data.vrm||'',make:data.make||'',model:data.model||'',engineCc:data.engineSize?.toString()||'',fuelType:data.fuelType||'',retailValue:String(data.price)};
      setValues(old=>({...old,...Object.fromEntries(Object.entries(fields).filter(([key])=>!edited.current.has(key)))}));
    }).catch(()=>{if(active){setError('This listing could not be loaded. Enter the vehicle details manually to request a standalone quote.');setListingId('');}}).finally(()=>{if(active)setPrefillBusy(false);});
    return()=>{active=false;};
  },[listingId]);
  const change = (key: string, value: string) => { edited.current.add(key); setValues(old => ({ ...old, [key]: value })); setError(''); };
  const lookup = async () => {
    if (lookupBusy) return;
    const vrm = (values.vrm || '').replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(vrm)) { setError('Enter the vehicle registration first.'); return; }
    setLookupBusy(true); setError('');
    try {
      const data = await apiClient<{ make?: string; model?: string; engineSize?: number; fuelType?: string; firstUsedDate?: string; motHistoryStatus?: string }>('/dvla/lookup', { method: 'POST', body: JSON.stringify({ vrm, allowAiEnrichment: false }) });
      setValues(old => old.vrm?.replace(/\s/g, '').toUpperCase() !== vrm ? old : { ...old, vrm, make: data.make || old.make || '', model: data.model || old.model || '', engineCc: data.engineSize !== undefined ? String(data.engineSize) : old.engineCc || '', fuelType: data.fuelType || old.fuelType || '', firstRegistrationDate: /^\d{4}-\d{2}-\d{2}/.test(data.firstUsedDate || '') ? data.firstUsedDate!.slice(0, 10) : old.firstRegistrationDate || '' });
      setNotice('Vehicle details loaded. Check every field against your documents and enter the current mileage. Missing details can be entered manually.');
    } catch { setNotice('Official vehicle lookup is unavailable. Enter the details manually from your vehicle documents.'); }
    finally { setLookupBusy(false); }
  };
  const quote = async () => {
    if (lock.current || lookupBusy || prefillBusy) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const details = { ...warrantyPayload(values, extras, confirmed, consent), ...(listingId?{listingId}:{}) }, key = JSON.stringify(details);
      if (request.current?.key !== key) request.current = { key, id: Crypto.randomUUID(), token: Array.from(await Crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join('') };
      await SecureStore.setItemAsync(tokenKey(request.current.id), request.current.token);
      const { data } = await apiClient<{ data: WarrantyOrder }>('/warranties/quotes', { method: 'POST', headers, body: JSON.stringify({ ...details, requestId: request.current.id, accessToken: request.current.token }) });
      navigation.navigate('WarrantyOrder', { id: data.id });
    } catch (e: any) { setError(e.message || 'Could not prepare your quote. Please retry.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const field = (f: WarrantyField) => <View key={f.key} style={{ gap: 8 }}>{f.options ? <><Text style={s.label}>{f.label}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{f.options.map(([key, label]) => <Button key={key} label={label} size="sm" variant={values[f.key] === key ? 'primary' : 'outline'} onPress={() => change(f.key, key)} />)}</View></> : <FormField label={`${f.label}${f.optional ? ' (optional)' : ''}${f.date ? ' — YYYY-MM-DD' : ''}`} value={values[f.key] || ''} onChangeText={text => change(f.key, text)} keyboardType={f.numeric ? 'decimal-pad' : f.key === 'email' ? 'email-address' : f.key === 'phone' ? 'phone-pad' : 'default'} autoCapitalize={f.key === 'email' ? 'none' : 'sentences'} />}</View>;
  return <NativePage title="Vehicle warranty">
    {prefillBusy&&<ActivityIndicator/>}{!!listingTitle&&<Text style={s.label}>{listingTitle}</Text>}
    <Text style={s.body}>Warrantywise warranties arranged through Pulse Cars Limited, the broker. CarMazium is the platform. Admin arranges issuance after payment.</Text>
    <Text style={s.label}>Your vehicle</Text>{field(vehicleFields[0])}<Button label="Find vehicle — DVLA & MOT" variant="outline" loading={lookupBusy} disabled={prefillBusy} onPress={() => void lookup()} />{!!notice && <Text style={s.body}>{notice}</Text>}{vehicleFields.slice(1).map(field)}
    {values.knownFaults === 'KNOWN' && <FormField label="Describe known faults" value={values.faultDetails || ''} onChangeText={text => change('faultDetails', text)} multiline maxLength={2000} />}
    <CheckField value={confirmed} onChange={setConfirmed} label="I have checked the vehicle details, current mileage, category and service history and confirm they are accurate. Known or pre-existing faults are not a promise of cover." />
    <Text style={s.label}>Choose your cover</Text><Text style={s.body}>12 months. Standard car £360; standard SUV £445, including VAT, with a £2,000 single repair limit and £75/hour labour. Review the server-confirmed quote before payment.</Text>
    {field({ key: 'repairLimit', label: 'Single repair limit', options: [['1000', '£1,000 — £30 less'], ['2000', '£2,000 — standard']] })}
    {field({ key: 'labourRate', label: 'Labour per hour', options: [['75', '£75 included'], ['100', '£100 — add 50%'], ['150', '£150 — add 75%'], ['200', '£200 — add 100%']] })}
    {additions.map(([code, label]) => <CheckField key={code} label={label} value={extras.includes(code)} onChange={enabled => setExtras(old => enabled ? [...old, code] : old.filter(x => x !== code))} />)}
    <Text style={s.body}>Eligibility, covered components, repair limits, labour allowances and exclusions depend on the issued Warrantywise plan. The requested start date is confirmed when issued.</Text>
    <Text style={s.label}>Your contact and address</Text>{customerFields.map(field)}
    <Button label="Read warranty order information" variant="outline" onPress={() => navigation.navigate('WarrantyTerms')} /><Button label="Read Privacy Policy" variant="outline" onPress={() => navigation.navigate('PrivacyPolicy')} />
    <CheckField value={consent} onChange={setConsent} label="I agree to the warranty order information and Privacy Policy. CarMazium may use and share these details with Pulse Cars Limited and Warrantywise to arrange the warranty and send order updates. Payment does not activate cover; issuance and confirmed cover dates are separate." />
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Button label="Get a quote" loading={busy} disabled={lookupBusy||prefillBusy} onPress={() => void quote()} /><Text style={s.body}>No payment is taken when you request a quote.</Text>
    <Button label="My warranty orders" variant="outline" onPress={() => navigation.navigate('WarrantyOrders')} />
  </NativePage>;
}

export function WarrantyOrderScreen({ route, navigation }: any) {
  const id = route.params.id;
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<WarrantyOrder | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [checkout, setCheckout] = useState<string | null>(null);
  const lock = useRef(false);
  const load = useCallback(async () => {
    setError('');
    try {
      const token = await SecureStore.getItemAsync(tokenKey(id));
      const { data } = await apiClient<{ data: WarrantyOrder }>(`/warranties/orders/${encodeURIComponent(id)}`, { headers: token ? { 'x-warranty-token': token } : {} }); setOrder(data);
    } catch (e: any) { setError(e.message || 'Could not load this warranty order.'); }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const pay = async () => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      const token = await SecureStore.getItemAsync(tokenKey(id));
      const { data } = await apiClient<{ data: { url: string } }>(`/warranties/orders/${encodeURIComponent(id)}/checkout`, { method: 'POST', headers, body: JSON.stringify({ accessToken: token || '0'.repeat(64) }) });
      const url = new URL(data.url); if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw Error('Could not verify the payment link.');
      setCheckout(data.url);
    } catch (e: any) { setError(e.message || 'Could not open payment.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const close = () => { setCheckout(null); void load(); };
  return <NativePage title="Your warranty order">
    {!!error && <><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button label="Retry" onPress={() => void load()} /></>}
    {!order && !error && <ActivityIndicator accessibilityLabel="Loading warranty order" />}
    {order && <><Text style={s.title}>{String(order.vehicle.vrm)} · {String(order.vehicle.make)} {String(order.vehicle.model)}</Text><Text style={s.label}>{order.statusLabel}</Text>
      {order.price.lines.map(line => <Text key={line.code} style={s.body}>{line.label}: {money(line.amountPence)}</Text>)}<Text style={s.title}>Total {money(order.totalPence)} including VAT</Text>
      <Text selectable style={s.body}>Order reference: {order.id}</Text>
      <Text style={s.body}>Payment purchases a warranty order, not the vehicle. Cover is active only once issued and the start date confirmed. If the selected cover cannot be arranged, the team will contact you and refund your payment.</Text>
      {order.warrantyReference && <Text style={s.body}>Reference: {order.warrantyReference}. Cover: {order.coverStart?.slice(0, 10)} to {order.coverEnd?.slice(0, 10)}.</Text>}
      {['QUOTED', 'CHECKOUT_PENDING'].includes(order.status) && <><Text style={s.body}>Payment has not been confirmed. Quote expires: {new Date(order.expiresAt).toLocaleString('en-GB')}.</Text><Button label={`Pay ${money(order.totalPence)} with Stripe`} loading={busy} onPress={() => void pay()} /></>}
      {['EXPIRED', 'PAYMENT_FAILED'].includes(order.status) && <Text style={s.body}>This checkout did not complete successfully. No warranty has been issued. Request a fresh quote to try again.</Text>}
      <Button label="Refresh payment status" variant="outline" onPress={() => void load()} /><Button label="Get a new quote" variant="outline" onPress={() => navigation.navigate('Warranty')} />
      <Button label="My warranty orders" variant="outline" onPress={() => navigation.navigate('WarrantyOrders')} />
      <Button label="Contact the team" variant="outline" onPress={() => navigation.navigate('Contact')} />
    </>}
    <Modal visible={!!checkout} onRequestClose={close} animationType="slide"><View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: Colors.bgPrimary }}><Button label="Close payment and check status" variant="outline" onPress={close} />{checkout && <WebView source={{ uri: checkout }} originWhitelist={['https://*']} onError={() => { close(); setError('Payment page could not load. Refresh the order status before retrying.'); }} onShouldStartLoadWithRequest={({ url }) => { try { const target = new URL(url); if (['carmazium.com', 'www.carmazium.com'].includes(target.hostname)) { close(); return false; } return target.protocol === 'https:'; } catch { return false; } }} />}</View></Modal>
  </NativePage>;
}
export function WarrantyOrdersScreen({ navigation }: any) {
  const [orders, setOrders] = useState<WarrantyOrder[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(''); try { const { data } = await apiClient<{ data: WarrantyOrder[] }>('/warranties/mine'); setOrders(data); } catch (e: any) { setError(e.message || 'Could not load orders.'); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <NativePage title="My warranty orders">{loading && <ActivityIndicator />}{!!error && <><Text style={s.error}>{error}</Text><Button label="Retry" onPress={() => void load()} /></>}{!loading && !error && !orders.length && <Text style={s.body}>No warranty orders are linked to this account.</Text>}{orders.map(order => <View key={order.id} style={s.panel}><Text style={s.label}>{String(order.vehicle.vrm)} · {String(order.vehicle.make)} {String(order.vehicle.model)}</Text><Text style={s.body}>{order.statusLabel} · {money(order.totalPence)} including VAT</Text><Text selectable style={s.body}>Order reference: {order.id}</Text><Button label="View order" onPress={() => navigation.navigate('WarrantyOrder', { id: order.id })} /></View>)}<Button label="Get a warranty quote" onPress={() => navigation.navigate('Warranty')} /></NativePage>;
}
