import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@/components/BrandIcon';
import { BottomSheet } from './BottomSheet';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Radius } from '../constants/spacing';
import {
  createSaleCancellation,
  SALE_CANCELLATION_EVIDENCE_REQUIRED,
  SALE_CANCELLATION_REASON_LABELS,
  type MobileCancellationEvidence,
  type SaleCancellationReason,
  type SaleCancellationRequest,
} from '../lib/saleCancellationApi';
import { haptics } from '../lib/haptics';

const REASONS = Object.keys(SALE_CANCELLATION_REASON_LABELS) as SaleCancellationReason[];
const MAX_EVIDENCE_FILES = 5;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

interface SaleCancellationSheetProps {
  visible: boolean;
  listingId: string;
  vehicleTitle: string;
  onClose: () => void;
  onCreated?: (request: SaleCancellationRequest) => void;
}

export const SaleCancellationSheet: React.FC<SaleCancellationSheetProps> = ({
  visible,
  listingId,
  vehicleTitle,
  onClose,
  onCreated,
}) => {
  const [reason, setReason] = useState<SaleCancellationReason>('MUTUAL_AGREEMENT');
  const [details, setDetails] = useState('');
  const [evidence, setEvidence] = useState<MobileCancellationEvidence[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evidenceRequired = SALE_CANCELLATION_EVIDENCE_REQUIRED.has(reason);

  const reset = () => {
    setReason('MUTUAL_AGREEMENT');
    setDetails('');
    setEvidence([]);
    setError(null);
    setSubmitting(false);
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const pickedSizeMb = useMemo(
    () => evidence.reduce((sum, item) => sum + Number(item.size ?? 0), 0) / 1024 / 1024,
    [evidence],
  );

  const pickEvidence = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
        'video/mp4',
        'video/quicktime',
        'video/webm',
      ],
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const remaining = MAX_EVIDENCE_FILES - evidence.length;
    if (remaining <= 0) {
      setError('You can attach up to 5 evidence files.');
      return;
    }

    const next: MobileCancellationEvidence[] = [];
    for (const asset of result.assets.slice(0, remaining)) {
      const mime = asset.mimeType || '';
      if (!ALLOWED_MIME.has(mime)) {
        setError(`${asset.name} is not a supported photo or video type.`);
        return;
      }
      if (asset.size != null && asset.size > MAX_FILE_BYTES) {
        setError(`${asset.name} is larger than 25 MB.`);
        return;
      }
      next.push({
        uri: asset.uri,
        name: asset.name || 'evidence',
        type: mime,
        size: asset.size,
      });
    }

    setEvidence(current => [...current, ...next].slice(0, MAX_EVIDENCE_FILES));
  };

  const submit = async () => {
    if (evidenceRequired && evidence.length === 0) {
      setError('Add at least one photo, screenshot or video for this reason.');
      return;
    }
    if (reason === 'OTHER' && details.trim().length < 20) {
      setError('Please explain the reason in at least 20 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const request = await createSaleCancellation({
        listingId,
        reason,
        details,
        evidence,
      });
      haptics.success();
      reset();
      onCreated?.(request);
      onClose();
      Alert.alert(
        'Cancellation request sent',
        request.status === 'PENDING_ADMIN'
          ? 'CarMazium will review this cancellation before the sale can be reversed.'
          : 'The other party must review and respond before the sale is reversed.',
      );
    } catch (err: any) {
      setError(err?.message || 'Could not submit the cancellation request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title="Request Sale Cancellation"
      avoidKeyboard
      maxHeightPercent={94}
      fillHeight
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.warningCard}>
          <Ionicons name="warning-outline" size={18} color={Colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>{vehicleTitle}</Text>
            <Text style={styles.warningText}>
              This creates a formal cancellation request. The sale is not silently removed. The other party normally has to agree, and sensitive cases go to CarMazium review.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>WHY ARE YOU CANCELLING?</Text>
        <View style={styles.reasonList}>
          {REASONS.map(value => {
            const selected = value === reason;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                activeOpacity={0.75}
                onPress={() => {
                  setReason(value);
                  setError(null);
                }}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>
                  {SALE_CANCELLATION_REASON_LABELS[value]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>EXPLAIN WHAT HAPPENED</Text>
        <TextInput
          style={styles.detailsInput}
          value={details}
          onChangeText={setDetails}
          multiline
          maxLength={2000}
          textAlignVertical="top"
          placeholder="Give the other party and CarMazium enough detail to understand the cancellation."
          placeholderTextColor={Colors.textMuted}
        />

        <View style={[styles.evidenceCard, evidenceRequired && styles.evidenceCardRequired]}>
          <View style={styles.evidenceHeader}>
            <Ionicons
              name={evidenceRequired ? 'alert-circle-outline' : 'attach-outline'}
              size={18}
              color={evidenceRequired ? Colors.warning : Colors.infoBlue}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.evidenceTitle}>
                Evidence {evidenceRequired ? 'required' : 'optional'}
              </Text>
              <Text style={styles.evidenceSub}>
                Up to 5 photos, screenshots or short videos. Maximum 25 MB per file. Evidence is stored privately.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.pickButton}
            activeOpacity={0.8}
            onPress={pickEvidence}
            disabled={submitting || evidence.length >= MAX_EVIDENCE_FILES}
          >
            <Ionicons name="cloud-upload-outline" size={15} color={Colors.textPrimary} />
            <Text style={styles.pickButtonText}>
              {evidence.length >= MAX_EVIDENCE_FILES ? '5 files attached' : 'Choose evidence'}
            </Text>
          </TouchableOpacity>

          {evidence.length > 0 && (
            <View style={styles.evidenceList}>
              {evidence.map((file, index) => (
                <View key={`${file.uri}-${index}`} style={styles.evidenceRow}>
                  <Ionicons
                    name={file.type.startsWith('video/') ? 'videocam-outline' : 'image-outline'}
                    size={15}
                    color={Colors.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                    <Text style={styles.fileMeta}>
                      {file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Evidence file'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setEvidence(current => current.filter((_, i) => i !== index))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    disabled={submitting}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
              <Text style={styles.totalEvidenceText}>
                {evidence.length}/5 files · {pickedSizeMb.toFixed(1)} MB selected
              </Text>
            </View>
          )}
        </View>

        <View style={styles.policyCard}>
          <Text style={styles.policyText}>
            Auction fee refunds depend on the cancellation reason and review outcome. Buyer evidence alone does not automatically refund the £125 fee. Submitted handovers, seller-reward activity and progressed TradeXchange work require admin review.
          </Text>
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.keepButton}
            activeOpacity={0.8}
            onPress={close}
            disabled={submitting}
          >
            <Text style={styles.keepButtonText}>Keep Sale</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, submitting && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Request Cancellation</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 12, gap: 14 },
  warningCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: Radius.inline,
    backgroundColor: Colors.warningAlpha10,
    borderWidth: 1,
    borderColor: Colors.warningAlpha25,
  },
  warningTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  warningText: {
    marginTop: 4,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  label: {
    marginTop: 2,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },
  reasonList: { gap: 7 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: Radius.inline,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
  },
  reasonRowSelected: {
    backgroundColor: Colors.accentAlpha12,
    borderColor: Colors.accentAlpha30,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.accent },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  reasonText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  reasonTextSelected: { color: Colors.textPrimary },
  detailsInput: {
    minHeight: 110,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radius.inline,
    padding: 13,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  evidenceCard: {
    padding: 14,
    borderRadius: Radius.inline,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    gap: 12,
  },
  evidenceCardRequired: {
    backgroundColor: Colors.warningAlpha05,
    borderColor: Colors.warningAlpha25,
  },
  evidenceHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  evidenceTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  evidenceSub: {
    marginTop: 3,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  pickButton: {
    height: 44,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    backgroundColor: Colors.whiteAlpha06,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  pickButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  evidenceList: { gap: 8 },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.blackAlpha20,
  },
  fileName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  fileMeta: {
    marginTop: 2,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
  },
  totalEvidenceText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    textAlign: 'right',
  },
  policyCard: {
    padding: 13,
    borderRadius: Radius.inline,
    backgroundColor: Colors.infoBlueAlpha08,
    borderWidth: 1,
    borderColor: Colors.infoBlueAlpha20,
  },
  policyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    lineHeight: 18,
    color: Colors.error,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  keepButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  submitButton: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
});
