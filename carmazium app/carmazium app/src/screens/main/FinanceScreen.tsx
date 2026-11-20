import * as Crypto from 'expo-crypto';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { NativePage, FormField, CheckField, pageStyles as s } from '../../components/NativePage';
import { Button } from '../../components/Button';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';

type Provider = { id: string; name: string; applicationUrl: string; disclosure: string; version: string };
export const FinanceScreen: React.FC<any> = ({ navigation, route }) => {
  const listingId = route.params?.listingId;
  const user = useAuthStore(state => state.user);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(!!listingId), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [fullName, setFullName] = useState([user?.firstName, user?.lastName].filter(Boolean).join(' '));
  const [email, setEmail] = useState(user?.email || ''), [phone, setPhone] = useState(''), [consent, setConsent] = useState(false);
  const request = useRef<{ key: string; id: string } | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!listingId) return;
    let active = true;
    setProvider(null); setLoading(true); setError('');
    apiClient<{ data: { enabled: boolean; title: string; provider: Provider | null } }>(`/finance/referrals/listing/${encodeURIComponent(listingId)}`)
      .then(({ data }) => { if (active) { setProvider(data.enabled ? data.provider : null); setTitle(data.title); if (!data.enabled || !data.provider) setError('Finance is unavailable for this vehicle.'); } })
      .catch(() => { if (active) setError('Could not check finance availability. Please retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [listingId, retry]);
  const submit = async () => {
    if (inFlight.current || !provider) return;
    if (fullName.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !/^\+?[\d\s().-]{7,30}$/.test(phone.trim()) || !consent) {
      setError('Enter your name, valid email and telephone number, then agree to the referral notice.'); return;
    }
    const details = { listingId, providerId: provider.id, providerVersion: provider.version, fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), consent };
    const key = JSON.stringify(details);
    // Idempotency identifier, not an access credential. Retain it across retries.
    if (request.current?.key !== key) request.current = { key, id: Crypto.randomUUID() };
    inFlight.current = true; setBusy(true); setError('');
    try {
      const { data } = await apiClient<{ data: { redirectUrl: string } }>('/finance/referrals', { method: 'POST', headers: { 'X-CSRF-Token': 'finance-referral' }, body: JSON.stringify({ ...details, requestId: request.current.id }) });
      if (data.redirectUrl !== provider.applicationUrl || new URL(data.redirectUrl).protocol !== 'https:') throw Error('Could not verify the finance provider link. Please contact the team.');
      await WebBrowser.openBrowserAsync(data.redirectUrl);
    } catch (e: any) { setError(e.message || 'Could not save your details. Please retry.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <NativePage title="Vehicle Finance">
    <Text style={s.body}>CarMazium does not provide finance or make lending decisions. Start with a participating vehicle to apply through its selected finance provider.</Text>
    {loading && <ActivityIndicator accessibilityLabel="Checking finance availability" />}
    {provider && <View style={s.panel}>
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>Enter your contact details. We record your interest and notify the CarMazium admin team, then open the separate application with {provider.name}.</Text>
      <FormField label="Full name" value={fullName} onChangeText={setFullName} maxLength={120} autoComplete="name" />
      <FormField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <FormField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} />
      <CheckField value={consent} onChange={setConsent} label={`I agree that CarMazium may record these details and email them to its admin team to follow up my finance enquiry. I understand I will complete a separate application with ${provider.name}.`} />
      <Button label="Privacy Policy" variant="ghost" onPress={() => navigation.navigate('PrivacyPolicy')} />
      <Text style={s.body}>{provider.disclosure} CarMazium charges its finance partner a fee for a successful application.</Text>
      <Button label={`Continue to ${provider.name}`} loading={busy} onPress={() => void submit()} />
    </View>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!!listingId && !provider && !loading && <Button label="Retry availability" variant="outline" onPress={() => setRetry(n => n + 1)} />}
    <Button label="Browse cars" onPress={() => navigation.navigate('Tabs', { screen: 'Search' })} />
    <Text style={s.label}>Finance providers</Text><Text style={s.body}>Contact our team to discuss a partnership. Finance-provider registration is arranged directly with CarMazium.</Text>
    <Button label="Contact the team" variant="outline" onPress={() => navigation.navigate('Contact')} />
  </NativePage>;
};
