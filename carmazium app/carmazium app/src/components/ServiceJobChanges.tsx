import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Colors } from '../constants/colors';
import { ServiceJob, ServiceJobChange, requestServiceJobChange, acceptServiceReschedule, addServiceCaseNote, uploadServiceCaseEvidence } from '../lib/servicesApi';

export function ServiceJobChanges({ job, role, onChange }: { job: ServiceJob; role: 'customer' | 'provider'; onChange: () => void }) {
  const [kind, setKind] = useState<ServiceJobChange['kind']>(job.status === 'ACCEPTED' ? 'CANCEL' : 'OTHER');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!['ACCEPTED', 'PAID', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'RELEASED'].includes(job.status)) return null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); setReason(''); setMessage('Saved.'); onChange(); }
    catch (e: any) { setMessage(e?.message || 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  };
  const button = (label: string, action: () => void, disabled = false) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={busy || disabled} onPress={action} style={[styles.button, (busy || disabled) && { opacity: 0.5 }]}><Text style={styles.text}>{label}</Text></TouchableOpacity>;
  const choices: Array<[ServiceJobChange['kind'], string]> = [['CANCEL', 'Request cancellation']];
  if (role === 'provider') choices.push(['CANNOT_ATTEND', 'I cannot attend or complete this job']);
  if (job.status !== 'ACCEPTED') choices.push(['NOT_COMPLETED', 'The work was not completed'], ['OTHER', 'Report a problem']);
  if (!['ACCEPTED', 'RELEASED'].includes(job.status)) choices.push(['RESCHEDULE', 'Request a new date']);
  const upload = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], multiple: false, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];
    if (file.size && file.size > 10 * 1024 * 1024) throw new Error('Choose a file no larger than 10 MB.');
    const body = new FormData();
    body.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
    body.append('label', file.name);
    await uploadServiceCaseEvidence(job.id, body);
  };
  return <View style={styles.card}>
    <Text style={[styles.text, { fontWeight: '700', fontSize: 18 }]}>Job changes and support</Text>
    <Text style={styles.text}>Unreleased payment stays on hold during review. Reporting a problem after payout does not itself recover the money.</Text>
    {job.payment?.stripeRefundStatus && <Text style={styles.text}>Refund: {job.payment.stripeRefundStatus}</Text>}
    {job.payment?.externalDisputeStatus && <Text style={styles.text}>Bank dispute: {job.payment.externalDisputeStatus}. CarMazium review required.</Text>}
    {job.changeRequest && <Text style={styles.text}>{job.changeRequest.reason}{job.changeRequest.requestedFor ? ` — ${new Date(job.changeRequest.requestedFor).toLocaleString()}` : ''}</Text>}
    {job.status === 'DISPUTED' ? <>
      {job.changeRequest?.kind === 'RESCHEDULE' && !job.changeRequest.resolved && job.changeRequest.requestedByRole !== role && button('Agree to the new date', () => run(() => acceptServiceReschedule(job.id)))}
      <TextInput accessibilityLabel="Information for CarMazium" placeholder="Add information for CarMazium" placeholderTextColor={Colors.textMuted} multiline value={reason} onChangeText={setReason} maxLength={2000} style={styles.input}/>
      {button('Send case note', () => run(() => addServiceCaseNote(job.id, reason.trim())), reason.trim().length < 3)}
      {button('Upload private image or PDF evidence', () => run(upload))}
    </> : <>
      {choices.map(([value, label]) => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ checked: kind === value }} key={value} disabled={busy} style={[styles.button, kind === value && { borderColor: Colors.accent }]} onPress={() => setKind(value)}><Text style={styles.text}>{kind === value ? 'Selected: ' : ''}{label}</Text></TouchableOpacity>)}
      <TextInput accessibilityLabel="Explain the request" placeholder="Explain the request" placeholderTextColor={Colors.textMuted} multiline value={reason} onChangeText={setReason} maxLength={2000} style={styles.input}/>
      {kind === 'RESCHEDULE' && <><Text style={styles.text}>Proposed UK date and time: DD/MM/YYYY HH:mm</Text><TextInput accessibilityLabel="Proposed UK date and time" placeholder="15/11/2026 14:30" placeholderTextColor={Colors.textMuted} value={date} onChangeText={setDate} style={styles.input}/></>}
      {button('Submit request', () => run(async () => {
        let requestedFor: string | undefined;
        if (kind === 'RESCHEDULE') {
          const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(date.trim());
          if (!m) throw new Error('Use DD/MM/YYYY HH:mm for the proposed date and time.');
          // Input is explicitly UK time, including summer time. Resolve the
          // IANA offset instead of silently using the phone's timezone.
          const base = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]));
          const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(base);
          const get = (type: string) => +(parts.find(p => p.type === type)?.value || 0);
          const offset = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) - base.getTime();
          const chosen = new Date(base.getTime() - offset);
          const displayed = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(chosen).replace(', ', ' ');
          if (displayed !== date.trim() || chosen.getTime() <= Date.now()) throw new Error('Choose a valid future UK date and time.');
          requestedFor = chosen.toISOString();
        }
        await requestServiceJobChange(job.id, { kind, reason: reason.trim(), requestedFor });
      }), reason.trim().length < 3)}
    </>}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, gap: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.bgCard },
  text: { color: Colors.textSecondary, fontSize: 14 },
  input: { color: Colors.white, backgroundColor: Colors.bgTertiary, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, minHeight: 48 },
  button: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, minHeight: 44 },
});
