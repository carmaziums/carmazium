import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { SERVICE_LABELS, getMyCapabilities } from '../../lib/servicesApi';
import {
  CapabilityEvidenceType,
  CapabilityVerificationDetail,
  MobileEvidenceFile,
  ServiceCaseEntry,
  deleteCapabilityAttachment,
  getCapabilityVerification,
  uploadCapabilityAttachment,
} from '../../lib/serviceOperationsApi';
import { IconButton } from '../../components/IconButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ProviderVerification'>;

const stateColor = (state?: string) => {
  if (state === 'SATISFIED' || state === 'APPROVED' || state === 'VERIFIED' || state === 'READY') return Colors.accentGreen;
  if (state === 'REJECTED') return Colors.accent;
  if (state === 'PENDING' || state === 'IN_REVIEW') return Colors.warning;
  return Colors.textMuted;
};

export const ProviderVerificationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { capabilityId } = route.params;
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<CapabilityVerificationDetail | null>(null);
  const [serviceType, setServiceType] = useState<'DELIVERY' | 'INSPECTION' | 'FINANCE' | 'WARRANTY' | null>(null);
  const [evidenceType, setEvidenceType] = useState<CapabilityEvidenceType | null>(null);
  const [file, setFile] = useState<MobileEvidenceFile | null>(null);
  const [issuer, setIssuer] = useState('');
  const [reference, setReference] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mine, verification] = await Promise.all([
        getMyCapabilities(),
        getCapabilityVerification(capabilityId),
      ]);
      const cap = mine.capabilities.find((item) => item.id === capabilityId);
      if (!cap) throw new Error('This service application was not found on your Partner Account.');
      setServiceType(cap.serviceType);
      setDetail(verification);
      setEvidenceType((current) => {
        if (current && verification.verification.requirements.some((r) => r.type === current)) return current;
        return verification.verification.requirements.find((r) => r.state !== 'SATISFIED')?.type
          ?? verification.verification.requirements[0]?.type
          ?? null;
      });
    } catch (err: any) {
      setError(err?.message || 'Could not load provider verification.');
    } finally {
      setLoading(false);
    }
  }, [capabilityId]);

  useEffect(() => { void load(); }, [load]);

  const selectedRequirement = useMemo(
    () => detail?.verification.requirements.find((r) => r.type === evidenceType) ?? null,
    [detail, evidenceType],
  );

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 10 * 1024 * 1024) {
      Alert.alert('File too large', 'Verification files must be 10 MB or smaller.');
      return;
    }
    setFile({
      uri: asset.uri,
      name: asset.name || 'verification-evidence',
      mimeType: asset.mimeType,
      size: asset.size,
    });
  };

  const upload = async () => {
    if (!file || !evidenceType) {
      Alert.alert('Evidence required', 'Choose a requirement and a PDF or image file.');
      return;
    }
    if (selectedRequirement?.expiryRequired && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt.trim())) {
      Alert.alert('Expiry date required', 'Enter the evidence expiry date as YYYY-MM-DD.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await uploadCapabilityAttachment(capabilityId, file, {
        evidenceType,
        label: label.trim() || undefined,
        issuer: issuer.trim() || undefined,
        reference: reference.trim() || undefined,
        expiresAt: expiresAt.trim() || undefined,
      });
      setFile(null);
      setIssuer('');
      setReference('');
      setExpiresAt('');
      setLabel('');
      await load();
      Alert.alert('Uploaded', 'Evidence has been uploaded securely for CarMazium review.');
    } catch (err: any) {
      setError(err?.message || 'Could not upload this document.');
    } finally {
      setBusy(false);
    }
  };

  const remove = (entry: ServiceCaseEntry) => {
    if (entry.evidenceStatus !== 'PENDING') return;
    Alert.alert(
      'Delete pending evidence?',
      'Reviewed evidence is retained for audit. Only pending evidence can be deleted.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteCapabilityAttachment(capabilityId, entry.id);
              await load();
            } catch (err: any) {
              Alert.alert('Could not delete', err?.message || 'Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.header}>
        <IconButton style={styles.headerButton} icon={<Ionicons name="chevron-back" size={19} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>Provider verification</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View> : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{serviceType ? SERVICE_LABELS[serviceType] : 'Service application'}</Text>
          <Text style={styles.sub}>Complete every required business evidence item before CarMazium approval.</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {detail ? (
            <>
              <View style={styles.summaryCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>VERIFICATION STATUS</Text>
                  <Text style={[styles.summaryStatus, { color: stateColor(detail.verification.verificationStatus) }]}>
                    {detail.verification.verificationStatus.replace(/_/g, ' ')}
                  </Text>
                  {detail.verification.verificationExpiresAt ? (
                    <Text style={styles.cardText}>Expires {new Date(detail.verification.verificationExpiresAt).toLocaleDateString('en-GB')}</Text>
                  ) : null}
                </View>
                <Ionicons name="shield-checkmark-outline" size={30} color={stateColor(detail.verification.verificationStatus)} />
              </View>

              <Text style={styles.sectionTitle}>Requirements</Text>
              {detail.verification.requirements.map((req) => (
                <TouchableOpacity
                  key={req.type}
                  style={[styles.requirement, evidenceType === req.type && styles.requirementSelected]}
                  onPress={() => setEvidenceType(req.type)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={req.state === 'SATISFIED' ? 'checkmark-circle' : req.state === 'REJECTED' ? 'close-circle' : 'document-text-outline'}
                    size={20}
                    color={stateColor(req.state)}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{req.title}</Text>
                    <Text style={styles.cardText}>{req.description}</Text>
                    <Text style={[styles.stateText, { color: stateColor(req.state) }]}>{req.state}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              <View style={styles.warningCard}>
                <Ionicons name="business-outline" size={18} color={Colors.warning} />
                <Text style={styles.warningText}>
                  Upload business, insurance, qualification or regulatory evidence only. Do not upload passports, driving licences, personal bank statements or unrelated identity documents.
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Upload evidence</Text>
                <Text style={styles.cardText}>PDF, JPG, PNG or WEBP. Maximum 10 MB.</Text>

                <TouchableOpacity style={styles.fileButton} onPress={pickFile}>
                  <Ionicons name="attach-outline" size={17} color={Colors.white} />
                  <Text style={styles.fileButtonText}>{file?.name || 'CHOOSE FILE'}</Text>
                </TouchableOpacity>

                <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Label (optional)" placeholderTextColor={Colors.textMuted} />
                <TextInput style={styles.input} value={issuer} onChangeText={setIssuer} placeholder="Issuer (optional)" placeholderTextColor={Colors.textMuted} />
                <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholder="Policy / authority reference (optional)" placeholderTextColor={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  value={expiresAt}
                  onChangeText={setExpiresAt}
                  placeholder={selectedRequirement?.expiryRequired ? 'Expiry YYYY-MM-DD (required)' : 'Expiry YYYY-MM-DD (optional)'}
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={[styles.primaryButton, busy && { opacity: 0.6 }]} onPress={upload} disabled={busy || !file || !evidenceType}>
                  {busy ? <ActivityIndicator color={Colors.white} /> : <><Ionicons name="cloud-upload-outline" size={17} color={Colors.white} /><Text style={styles.primaryText}>UPLOAD FOR REVIEW</Text></>}
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>Evidence history ({detail.attachments.length})</Text>
              {detail.attachments.length === 0 ? (
                <View style={styles.empty}><Text style={styles.cardText}>No verification evidence uploaded yet.</Text></View>
              ) : detail.attachments.map((entry) => (
                <View key={entry.id} style={styles.card}>
                  <View style={styles.row}>
                    <Ionicons name="document-text-outline" size={20} color={Colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{entry.label || 'Verification evidence'}</Text>
                      <Text style={styles.cardText}>
                        {entry.evidenceIssuer || 'Issuer not supplied'}
                        {entry.evidenceReference ? ` · ${entry.evidenceReference}` : ''}
                      </Text>
                      <Text style={styles.cardText}>
                        Uploaded {new Date(entry.createdAt).toLocaleDateString('en-GB')}
                        {entry.evidenceExpiresAt ? ` · Expires ${new Date(entry.evidenceExpiresAt).toLocaleDateString('en-GB')}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.stateText, { color: stateColor(entry.evidenceStatus ?? undefined) }]}>{entry.evidenceStatus || 'PENDING'}</Text>
                  </View>
                  {entry.evidenceReviewNote ? <Text style={styles.cardText}>{entry.evidenceReviewNote}</Text> : null}
                  <View style={styles.actions}>
                    {entry.url ? (
                      <TouchableOpacity style={styles.actionButton} onPress={() => Linking.openURL(entry.url!)}>
                        <Text style={styles.actionText}>OPEN EVIDENCE</Text>
                      </TouchableOpacity>
                    ) : null}
                    {entry.evidenceStatus === 'PENDING' ? (
                      <TouchableOpacity style={[styles.actionButton, { borderColor: Colors.accentAlpha25 }]} onPress={() => remove(entry)} disabled={busy}>
                        <Text style={[styles.actionText, { color: Colors.paleRed_fca5a5 }]}>DELETE</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))}
            </>
          ) : null}
          <View style={{ height: 44 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.lg },
  content: { padding: 18, gap: 13 },
  title: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xl },
  sub: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, borderRadius: Radius.card, padding: 16 },
  summaryStatus: { fontFamily: FontFamily.bold, fontSize: FontSize.base, marginTop: 4 },
  label: { fontFamily: FontFamily.bold, color: Colors.textMuted, fontSize: FontSize.size10, letterSpacing: 1 },
  sectionTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.base, marginTop: 4 },
  requirement: { flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, borderRadius: Radius.card, padding: 14 },
  requirementSelected: { borderColor: Colors.accentAlpha25, backgroundColor: Colors.accentAlpha10 },
  card: { borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.bgSecondary, borderRadius: Radius.card, padding: 15, gap: 10 },
  cardTitle: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.sm },
  cardText: { fontFamily: FontFamily.regular, color: Colors.textSecondary, fontSize: FontSize.xs, lineHeight: 18 },
  stateText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, marginTop: 4 },
  warningCard: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: Colors.warningAlpha30, backgroundColor: Colors.warningAlpha08, borderRadius: Radius.inline, padding: 13 },
  warningText: { flex: 1, fontFamily: FontFamily.regular, color: Colors.lightYellow, fontSize: FontSize.xs, lineHeight: 18 },
  fileButton: { minHeight: 44, borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.whiteAlpha06, borderRadius: Radius.inline, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  fileButtonText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xs },
  input: { borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.bgTertiary, borderRadius: Radius.inline, color: Colors.white, paddingHorizontal: 13, paddingVertical: 11, fontFamily: FontFamily.regular, fontSize: FontSize.sm },
  primaryButton: { minHeight: 46, borderRadius: Radius.inline, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.xs },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.whiteAlpha10, borderRadius: Radius.card, padding: 24, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionButton: { minHeight: 35, borderWidth: 1, borderColor: Colors.whiteAlpha10, borderRadius: 9, justifyContent: 'center', paddingHorizontal: 10 },
  actionText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: FontSize.size10 },
  error: { fontFamily: FontFamily.regular, color: Colors.paleRed_fca5a5, fontSize: FontSize.size12 },
});
