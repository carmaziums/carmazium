import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Button } from '../Button';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import type { ContractorCapability } from '../../lib/servicesApi';
import {
  getCapabilityVerification, uploadCapabilityAttachment, deleteCapabilityAttachment,
  type CapabilityVerificationDetail, type MobileEvidenceFile, type ServiceCaseEntry,
} from '../../lib/serviceOperationsApi';

type Service = 'DELIVERY' | 'INSPECTION';
type Capability = Pick<ContractorCapability, 'id' | 'serviceType' | 'status'>;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateLabel = (value: string | null | undefined) =>
  value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString('en-GB') : 'Not recorded';

export function ProviderDocumentsSection({ capabilities }: { capabilities: Capability[] }) {
  const [expanded, setExpanded] = useState(false);
  const [service, setService] = useState<Service>('DELIVERY');
  const cap = capabilities.find(c => c.serviceType === service);
  const [detail, setDetail] = useState<CapabilityVerificationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uploadType, setUploadType] = useState<string | null>(null);
  const [file, setFile] = useState<MobileEvidenceFile | null>(null);
  const [issuer, setIssuer] = useState('');
  const [reference, setReference] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const generation = useRef(0);

  const reload = useCallback(async (capabilityId: string) => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    try {
      const next = await getCapabilityVerification(capabilityId);
      if (request !== generation.current) return;
      if (next.capabilityId !== capabilityId || next.serviceType !== service)
        throw Error('Verification data did not match this service.');
      setDetail(next);
    } catch (e: any) {
      if (request === generation.current) {
        setDetail(null);
        setError(e?.message || 'Could not load verification documents.');
      }
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    setDetail(null); setFile(null); setUploadType(null); setHistoryOpen(false); setNotice(null);
    if (expanded && cap?.id) void reload(cap.id);
    else generation.current++;
    return () => { generation.current++; };
  }, [cap?.id, expanded, reload]);

  const requirements = detail?.verification.requirements.filter(req => !req.optional) ?? [];
  const requirement = requirements.find(req => req.type === uploadType);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true, multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        Alert.alert('File too large', 'Choose a file up to 10 MB.');
        return;
      }
      setFile({ uri: asset.uri, name: asset.name || 'insurance-certificate', mimeType: asset.mimeType, size: asset.size });
    } catch (e: any) { setError(e?.message || 'Could not choose a document.'); }
  };

  const upload = async () => {
    if (!cap || !requirement || !file || busy) return;
    if (requirement.expiryRequired && (!DATE.test(expiresAt) || Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) {
      setError('Enter a future insurance expiry date as YYYY-MM-DD.');
      return;
    }
    setBusy(true); setError(null); setNotice(null);
    try {
      await uploadCapabilityAttachment(cap.id, file, {
        evidenceType: requirement.type, label: requirement.title,
        issuer: issuer.trim() || undefined, reference: reference.trim() || undefined,
        validFrom: validFrom || undefined, expiresAt,
      });
      setFile(null); setIssuer(''); setReference(''); setValidFrom(''); setExpiresAt('');
      setUploadType(null);
      setNotice('Insurance certificate uploaded for review. Previously approved evidence stays on record.');
      await reload(cap.id);
    } catch (e: any) { setError(e?.message || 'Could not upload insurance certificate.'); }
    finally { setBusy(false); }
  };

  const removePending = (entry: ServiceCaseEntry) => {
    if (!cap || entry.evidenceStatus !== 'PENDING' || busy) return;
    Alert.alert('Delete pending document?', 'Reviewed documents remain on record.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setBusy(true); setError(null);
        try {
          await deleteCapabilityAttachment(cap.id, entry.id);
          setNotice('Pending evidence removed.');
          await reload(cap.id);
        } catch (e: any) { setError(e?.message || 'Could not remove pending document.'); }
        finally { setBusy(false); }
      } },
    ]);
  };

  return <View style={styles.card}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Documents & Insurance"
      accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.headingButton}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Documents & Insurance</Text>
        <Text style={styles.desc}>Required insurance documents and saved evidence history for each service.</Text>
      </View>
      <Text style={styles.arrow}>{expanded ? '−' : '+'}</Text>
    </TouchableOpacity>
    {expanded && <View style={styles.stack}>
      <Text style={styles.desc}>One account can provide collection, delivery & recovery and inspections. Select either service to manage its separate insurance requirements.</Text>
      <View style={styles.row}>
        <Button label="Collection, delivery & recovery" variant={service === 'DELIVERY' ? 'primary' : 'outline'} onPress={() => setService('DELIVERY')} />
        <Button label="Inspection" variant={service === 'INSPECTION' ? 'primary' : 'outline'} onPress={() => setService('INSPECTION')} />
      </View>
      {!cap ? <Text style={styles.desc}>No {service === 'DELIVERY' ? 'collection/delivery/recovery' : 'inspection'} application yet. Apply in My Services above. Your other services stay saved.</Text>
        : loading ? <ActivityIndicator color={Colors.accent} accessibilityLabel="Loading documents" />
        : !detail ? <View style={styles.stack}><Text style={styles.error}>{error || 'Verification documents unavailable.'}</Text><Button label="Retry documents" variant="outline" onPress={() => void reload(cap.id)} /></View>
        : <>
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {notice && <Text accessibilityRole="alert" style={styles.success}>{notice}</Text>}
          {requirements.length > 0 ? requirements.map(req => <View key={req.type} style={styles.subCard}>
            <Text style={styles.subtitle}>{req.title}</Text>
            <Text style={styles.status}>{req.state === 'SATISFIED' ? 'Approved and current'
              : req.state === 'PENDING' ? 'Under review'
              : req.state === 'REJECTED' ? 'Rejected — replace'
              : 'Missing or expired'}</Text>
            <Text style={styles.desc}>{req.description}</Text>
            {req.state === 'SATISFIED' && <Text style={styles.desc}>Approved evidence expires {dateLabel(req.evidenceExpiresAt)}.</Text>}
            <Text style={styles.desc}>This certificate must cover the selected service. Each service is reviewed separately. Do not upload personal identity documents or bank statements.</Text>
            <Button label={uploadType === req.type ? 'Close upload'
              : req.state === 'SATISFIED' ? 'Replace ' + req.title
              : req.state === 'PENDING' ? 'Submit updated ' + req.title : 'Upload ' + req.title}
              variant="outline" disabled={busy} onPress={() => { setUploadType(current => current === req.type ? null : req.type); setFile(null); setIssuer(''); setReference(''); setValidFrom(''); setExpiresAt(''); }} />
            {uploadType === req.type && <View style={styles.stack}>
              <TextInput accessibilityLabel="Insurer" style={styles.input} placeholder="Insurer / organisation" placeholderTextColor={Colors.textMuted} value={issuer} onChangeText={setIssuer} />
              <TextInput accessibilityLabel="Policy reference" style={styles.input} placeholder="Policy reference" placeholderTextColor={Colors.textMuted} value={reference} onChangeText={setReference} />
              <TextInput accessibilityLabel="Valid from" style={styles.input} placeholder="Valid from YYYY-MM-DD (optional)" placeholderTextColor={Colors.textMuted} value={validFrom} onChangeText={setValidFrom} autoCapitalize="none" />
              <TextInput accessibilityLabel="Expiry date" style={styles.input} placeholder="Expiry YYYY-MM-DD (required)" placeholderTextColor={Colors.textMuted} value={expiresAt} onChangeText={setExpiresAt} autoCapitalize="none" />
              <Button label={file?.name || 'Choose PDF or image (max 10 MB)'} variant="outline" onPress={() => void pickFile()} />
              <Button label={busy ? 'Uploading…' : 'Upload for review'} disabled={busy || !file || !expiresAt} loading={busy} onPress={() => void upload()} />
            </View>}
          </View>) : <Text style={styles.desc}>No insurance requirement was returned for this service. Refresh or contact support before taking new jobs.</Text>}
          <Button label={historyOpen ? 'Hide document history' : 'Show document history (' + detail.attachments.length + ')'} variant="outline" onPress={() => setHistoryOpen(value => !value)} />
          {historyOpen && <View style={styles.stack}>
            <Text style={styles.desc}>Older documents remain for audit. They are not additional requirements.</Text>
            {detail.attachments.length === 0 && <Text style={styles.desc}>No previously uploaded documents.</Text>}
            {detail.attachments.map(entry => <View key={entry.id} style={styles.subCard}>
              <Text style={styles.subtitle}>{entry.label || entry.evidenceType || 'Verification evidence'}</Text>
              <Text style={styles.status}>{entry.evidenceStatus || 'PENDING'}</Text>
              <Text style={styles.desc}>Uploaded {dateLabel(entry.createdAt)}
                {entry.evidenceExpiresAt ? ' · Expires ' + dateLabel(entry.evidenceExpiresAt) : ''}</Text>
              {entry.evidenceReviewNote && <Text style={styles.desc}>{entry.evidenceReviewNote}</Text>}
              {entry.url && <Button label="Open evidence" variant="outline" onPress={() => void Linking.openURL(entry.url!)} />}
              {entry.evidenceStatus === 'PENDING' && <Button label="Delete pending document" variant="outline" disabled={busy} onPress={() => removePending(entry)} />}
            </View>)}
          </View>}
        </>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  headingButton: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: Colors.textPrimary, fontSize: 20, fontFamily: FontFamily.bold },
  subtitle: { color: Colors.textPrimary, fontSize: 16, fontFamily: FontFamily.bold },
  desc: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 3 },
  status: { color: Colors.textPrimary, fontSize: 13, fontFamily: FontFamily.bold },
  error: { color: Colors.error, fontSize: 14 },
  success: { color: Colors.success, fontSize: 14 },
  arrow: { color: Colors.textSecondary, fontSize: 24 },
  stack: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subCard: { gap: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  input: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgTertiary, color: Colors.textPrimary, padding: 12, borderRadius: 10, fontSize: 14 },
});
