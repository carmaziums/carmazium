import React, { useEffect, useState } from 'react';
import { Alert, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Colors } from '../constants/colors';
import { formatUkServiceDateTime, parseUkServiceDateTime } from '../lib/ukServiceDateTime';
import { ServiceJob, ServiceJobChange, requestServiceJobChange, acceptServiceReschedule, addServiceCaseNote, uploadServiceCaseEvidence } from '../lib/servicesApi';

export function ServiceJobChanges({ job, role, onChange }: { job: ServiceJob; role: 'customer' | 'provider'; onChange: () => void }) {
  const [kind, setKind] = useState<ServiceJobChange['kind']>(job.status === 'ACCEPTED' ? 'CANCEL' : 'OTHER');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const canReschedule = job.status === 'PAID' || job.status === 'IN_PROGRESS';
  const proposalPending = job.status === 'DISPUTED' && job.changeRequest?.kind === 'RESCHEDULE' && !job.changeRequest.resolved;
  const progress = [
    ['Provider chosen', job.acceptedAt],
    ['Payment confirmed', job.payment?.paidAt],
    ['Work started', job.startedAt],
    ['Work completed', job.completedAt],
    ['Provider payout recorded', job.payment?.releasedAt],
  ] as const;
  useEffect(() => {
    if (!canReschedule && kind === 'RESCHEDULE') setKind('OTHER');
  }, [canReschedule, kind]);
  if (!['ACCEPTED', 'PAID', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'RELEASED'].includes(job.status)) return null;
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); setReason(''); setDate(''); setMessage('Saved.'); onChange(); }
    catch (e: any) { setMessage(e?.message || 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  };
  const button = (label: string, action: () => void, disabled = false) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={busy || disabled} onPress={action} style={[styles.button, (busy || disabled) && { opacity: 0.5 }]}><Text style={styles.text}>{label}</Text></TouchableOpacity>;
  const choices: Array<[ServiceJobChange['kind'], string]> = [['CANCEL', 'Request cancellation']];
  if (role === 'provider') choices.push(['CANNOT_ATTEND', 'I cannot attend or complete this job']);
  if (job.status !== 'ACCEPTED') choices.push(['NOT_COMPLETED', 'The work was not completed'], ['OTHER', 'Report a problem']);
  if (canReschedule) choices.push(['RESCHEDULE', 'Request a new date']);
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
    <View style={styles.progressCard}>
      <Text style={[styles.text, { fontWeight: '700' }]}>Work progress</Text>
      <Text style={styles.text}>Scheduled: {formatUkServiceDateTime(job.requestedFor)}</Text>
      {job.status === 'DISPUTED' && <Text accessibilityRole="alert" style={styles.text}>
        Work is paused for review. A proposed new date is not agreed until the other party accepts it.
      </Text>}
      {progress.map(([label, at]) => <View key={label} style={styles.progressRow}>
        <Text style={styles.text}>{label}</Text>
        <Text style={styles.text}>{at ? formatUkServiceDateTime(at) : 'Pending'}</Text>
      </View>)}
    </View>
    {job.payment?.stripeRefundStatus && <Text style={styles.text}>Refund: {job.payment.stripeRefundStatus}</Text>}
    {job.payment?.externalDisputeStatus && <Text style={styles.text}>Bank dispute: {job.payment.externalDisputeStatus}. CarMazium review required.</Text>}
    {job.changeRequest && <Text style={styles.text}>{job.changeRequest.reason}{job.changeRequest.requestedFor ? ` — proposed ${formatUkServiceDateTime(job.changeRequest.requestedFor)}` : ''}{job.changeRequest.resolved ? ' (resolved)' : ' (awaiting review)'}</Text>}
    {job.status === 'DISPUTED' ? <>
      {proposalPending && job.changeRequest?.requestedByRole !== role && button('Agree to the new date', () => {
        const proposed = formatUkServiceDateTime(job.changeRequest?.requestedFor);
        Alert.alert('Agree to the new UK date?', proposed + '\n\nThis resumes the same paid job without changing its price.', [
          { text: 'Keep reviewing', style: 'cancel' },
          { text: 'Agree to date', onPress: () => { void run(() => acceptServiceReschedule(job.id)); } },
        ]);
      })}
      <TextInput accessibilityLabel="Information for CarMazium" placeholder="Add information for CarMazium" placeholderTextColor={Colors.textMuted} multiline value={reason} onChangeText={setReason} maxLength={2000} style={styles.input}/>
      {button('Send case note', () => run(() => addServiceCaseNote(job.id, reason.trim())), reason.trim().length < 3)}
      {button('Upload private image or PDF evidence', () => run(upload))}
    </> : <>
      {choices.map(([value, label]) => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ checked: kind === value }} key={value} disabled={busy} style={[styles.button, kind === value && { borderColor: Colors.accent }]} onPress={() => setKind(value)}><Text style={styles.text}>{kind === value ? 'Selected: ' : ''}{label}</Text></TouchableOpacity>)}
      <TextInput accessibilityLabel="Explain the request" placeholder="Explain the request" placeholderTextColor={Colors.textMuted} multiline value={reason} onChangeText={setReason} maxLength={2000} style={styles.input}/>
      {kind === 'RESCHEDULE' && canReschedule && <>
        <Text style={styles.text}>Proposed UK date and time: DD/MM/YYYY HH:mm</Text>
        <TextInput accessibilityLabel="Proposed UK date and time" placeholder="15/12/2026 14:30"
          placeholderTextColor={Colors.textMuted} value={date} onChangeText={setDate} style={styles.input}/>
        <Text style={styles.text}>Interpreted in Europe/London time; skipped daylight-saving times are not valid.</Text>
      </>}
      {button('Submit request', () => run(async () => {
        let requestedFor: string | undefined;
        if (kind === 'RESCHEDULE') {
          if (!canReschedule) throw new Error('Only unfinished paid work can be rescheduled.');
          const proposed = parseUkServiceDateTime(date);
          if (!proposed) throw new Error('Choose a valid future UK date and time using DD/MM/YYYY HH:mm.');
          requestedFor = proposed;
        }
        await requestServiceJobChange(job.id, { kind, reason: reason.trim(), requestedFor });
      }), reason.trim().length < 3 || (kind === 'RESCHEDULE' && (!canReschedule || !date.trim())))}
    </>}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, gap: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.bgCard },
  progressCard: { gap: 7, borderWidth: 1, borderColor: Colors.border, padding: 12, borderRadius: 12 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 5 },
  text: { color: Colors.textSecondary, fontSize: 14 },
  input: { color: Colors.white, backgroundColor: Colors.bgTertiary, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, minHeight: 48 },
  button: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, minHeight: 44 },
});
