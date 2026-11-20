import React, { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/apiClient';
import { BottomSheet } from '../BottomSheet';
import { Button } from '../Button';

type Props = { listingId: string; vehicleTitle: string; onClose: () => void };

export function GuestEnquirySheet({ listingId, vehicleTitle, onClose }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(`Hello, I am interested in ${vehicleTitle}. Is it still available?`);
  const [consent, setConsent] = useState(false);
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function submit() {
    if (submitting.current) return;
    let validation = '';
    if (challenge) {
      if (!/^\d{6}$/.test(code)) validation = 'Enter the six-digit code from your email.';
    } else if (fullName.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      validation = 'Enter your name and a valid email address.';
    } else if (message.trim().length < 10 || !consent) {
      validation = 'Enter a message of at least 10 characters and confirm the seller may contact you.';
    }
    setError(validation);
    if (validation) return;
    submitting.current = true;
    setBusy(true);
    const headers = { 'X-CSRF-Token': 'public-listing-enquiry' };
    try {
      if (challenge) {
        await apiClient('/listing-enquiries/verify', { method: 'POST', headers, body: JSON.stringify({ id: challenge, code }) });
        setSent(true);
      } else {
        const result = await apiClient<{ data: { id: string } }>('/listing-enquiries', {
          method: 'POST', headers, body: JSON.stringify({ listingId, fullName: fullName.trim(),
            email: email.trim(), phone: phone.trim(), message: message.trim(), consent }),
        });
        setChallenge(result.data.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your enquiry. Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const field = (label: string, value: string, onChangeText: (s: string) => void,
    options: Pick<React.ComponentProps<typeof TextInput>, 'keyboardType' | 'maxLength' | 'multiline' | 'autoCapitalize' | 'autoComplete'>) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} value={value} onChangeText={onChangeText} editable={!busy} {...options} />
    </View>
  );

  return (
    <BottomSheet visible avoidKeyboard title={sent ? 'Enquiry sent' : challenge ? 'Confirm your email' : 'Contact the seller'} onClose={() => { if (!submitting.current) onClose(); }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {sent ? <>
          <Text style={styles.label}>The seller has received your enquiry and can reply using the details you provided.</Text>
          <Button label="Done" onPress={onClose} />
        </> : <>
          {challenge ? <>
            <Text style={styles.label}>Enter the six-digit code sent to {email.trim()} within 15 minutes.</Text>
            {field('Email confirmation code', code, setCode, { keyboardType: 'number-pad', maxLength: 6, autoComplete: 'one-time-code' })}
            <Button variant="ghost" label="Change details or request a new code" disabled={busy} onPress={() => { setChallenge(''); setCode(''); setError(''); }} />
          </> : <>
            <Text style={styles.label}>Confirm your email to contact the seller of {vehicleTitle}.</Text>
            {field('Your name', fullName, setFullName, { maxLength: 120, autoComplete: 'name' })}
            {field('Email address', email, setEmail, { maxLength: 254, keyboardType: 'email-address', autoCapitalize: 'none', autoComplete: 'email' })}
            {field('Phone number (optional)', phone, setPhone, { maxLength: 30, keyboardType: 'phone-pad', autoComplete: 'tel' })}
            {field('Message', message, setMessage, { maxLength: 2000, multiline: true })}
            <View style={styles.consent}>
              <Text style={[styles.label, styles.consentText]}>I agree that CarMazium may share my name, contact details and message with this vehicle’s seller so they can reply.</Text>
              <Switch accessibilityLabel="Share my contact details with this seller" value={consent} onValueChange={setConsent} disabled={busy} />
            </View>
            <Button variant="ghost" label="Privacy Policy" onPress={() => { void WebBrowser.openBrowserAsync('https://www.carmazium.com/privacy-policy').catch(() => Alert.alert('Privacy Policy', 'Visit www.carmazium.com/privacy-policy.')); }} />
          </>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Button loading={busy} disabled={busy} label={challenge ? 'Confirm email and send enquiry' : 'Send confirmation code'} onPress={() => void submit()} />
        </>}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  label: { color: Colors.textPrimary, fontSize: 16 },
  input: { marginTop: 5, padding: 12, color: Colors.textPrimary, backgroundColor: Colors.inputBg,
    borderColor: Colors.inputBorder, borderWidth: 1, borderRadius: 9, fontSize: 16 },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  consentText: { flex: 1 },
  error: { color: Colors.error, fontSize: 16 },
});
