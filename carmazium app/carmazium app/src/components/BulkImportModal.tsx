import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Colors } from '../constants/colors';
import {FontFamily, FontSize } from '../constants/typography';
import { apiClient } from '../lib/apiClient';

import { IconButton } from './IconButton';
// ─── Types ────────────────────────────────────────────────────────────────────

type ImportStatus = 'idle' | 'parsing' | 'importing' | 'complete';

interface CsvRow {
  vrm: string;
  price: number;
  mileage: number;
  images: string[];
}

interface ErrorRow {
  vrm: string;
  error: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// ─── CSV Template ─────────────────────────────────────────────────────────────

const TEMPLATE_CSV =
  'vrm,price,mileage,images\n' +
  'AB12CDE,15000,45000,https://example.com/img1.jpg|https://example.com/img2.jpg\n' +
  'XY22ZAB,8500,72000,https://example.com/img3.jpg';

// ─── RFC-4180 CSV Parser ──────────────────────────────────────────────────────
// Handles quoted fields (commas/newlines inside quotes) and escaped quotes ("").

function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let fields: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
        inQuotes = false; i++; continue;
      }
      field += ch; i++;
    } else {
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { fields.push(field); field = ''; i++; continue; }
      if (ch === '\r' && raw[i + 1] === '\n') {
        fields.push(field); rows.push(fields); field = ''; fields = []; i += 2; continue;
      }
      if (ch === '\n' || ch === '\r') {
        fields.push(field); rows.push(fields); field = ''; fields = []; i++; continue;
      }
      field += ch; i++;
    }
  }
  // flush last row
  if (field || fields.length > 0) { fields.push(field); rows.push(fields); }
  return rows;
}

function parseRows(raw: string): CsvRow[] {
  const all = parseCsv(raw);
  // Skip header row (first row)
  const data = all.slice(1);
  const result: CsvRow[] = [];
  for (const cols of data) {
    const vrm = (cols[0] ?? '').trim().toUpperCase().replace(/\s/g, '');
    const price = parseFloat((cols[1] ?? '').replace(/[^0-9.]/g, ''));
    const mileage = parseInt((cols[2] ?? '').replace(/[^0-9]/g, ''), 10);
    const imageStr = (cols[3] ?? '').trim();
    const images = imageStr ? imageStr.split('|').map(u => u.trim()).filter(Boolean) : [];
    if (!vrm || isNaN(price) || isNaN(mileage)) continue; // skip malformed rows
    result.push({ vrm, price, mileage, images });
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const BulkImportModal: React.FC<Props> = ({ isOpen, onClose, onComplete }) => {
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<ImportStatus>('idle');
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [current, setCurrent] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [errorRows, setErrorRows] = useState<ErrorRow[]>([]);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const [sharingTemplate, setSharingTemplate] = useState(false);

  const reset = () => {
    setStatus('idle');
    setRows([]);
    setCurrent(0);
    setImportedCount(0);
    setErrorRows([]);
    setErrorsExpanded(false);
  };

  // ── Share CSV template ──

  const handleShareTemplate = async () => {
    setSharingTemplate(true);
    try {
      const path = `${FileSystem.documentDirectory}carmazium-bulk-template.csv`;
      await FileSystem.writeAsStringAsync(path, TEMPLATE_CSV, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Save CSV Template' });
      } else {
        Alert.alert('Sharing not available', 'Cannot share files on this device.');
      }
    } catch {
      Alert.alert('Error', 'Could not share template file.');
    } finally {
      setSharingTemplate(false);
    }
  };

  // ── Pick and parse CSV file ──

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/csv'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setStatus('parsing');
      const uri = result.assets[0].uri;
      const raw = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const parsed = parseRows(raw);
      if (parsed.length === 0) {
        Alert.alert('No data found', 'The CSV file has no valid rows. Check the format and try again.');
        setStatus('idle');
        return;
      }

      setRows(parsed);
      setCurrent(0);
      setImportedCount(0);
      setErrorRows([]);
      setStatus('importing');
      runImport(parsed);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not read the CSV file.');
      setStatus('idle');
    }
  };

  // ── Sequential import ──

  const runImport = async (rowsToImport: CsvRow[]) => {
    let imported = 0;
    const errors: ErrorRow[] = [];

    for (let i = 0; i < rowsToImport.length; i++) {
      setCurrent(i + 1);
      const row = rowsToImport[i];

      try {
        // 1. DVLA lookup to enrich make/model/year/fuel
        let make: string | undefined;
        let model: string | undefined;
        let year: number | undefined;
        let fuelType: string | undefined;

        try {
          const dvla = await apiClient<any>('/dvla/lookup', {
            method: 'POST',
            body: JSON.stringify({ vrm: row.vrm }),
          });
          make = dvla?.make ?? undefined;
          model = dvla?.model ?? undefined;
          year = dvla?.year ?? undefined;
          fuelType = dvla?.fuelType ?? undefined;
        } catch {
          // DVLA lookup optional — continue without enrichment
        }

        // 2. Create listing as DRAFT
        const title = [year, make, model].filter(Boolean).join(' ') || row.vrm;
        await apiClient('/listings', {
          method: 'POST',
          body: JSON.stringify({
            vrm: row.vrm,
            price: row.price,
            mileage: row.mileage,
            images: row.images,
            title,
            make: make ?? '',
            model: model ?? '',
            year: year ?? new Date().getFullYear(),
            fuelType: fuelType ?? 'PETROL',
            status: 'DRAFT',
            badgeTier: 'FREE',
          }),
        });
        imported++;
      } catch (err: any) {
        errors.push({ vrm: row.vrm, error: err?.message ?? 'Import failed' });
      }
    }

    setImportedCount(imported);
    setErrorRows(errors);
    setStatus('complete');
  };

  // ── Progress percentage ──
  const progressPct = rows.length > 0 ? Math.round((current / rows.length) * 100) : 0;

  if (!isOpen) return null;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => { if (status !== 'importing') { reset(); onClose(); } }}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={st.container}>
        <LinearGradient
          colors={[Colors.warningAlpha05, 'rgba(10,10,12,0)', Colors.bgPrimary]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={{ height: insets.top }} />

        {/* Header */}
        <View style={st.header}>
          <IconButton style={st.closeBtn} icon={<Ionicons name="close" size={18} color={status === 'importing' ? Colors.textMuted : Colors.white} />} onPress={() => { if (status !== 'importing') { reset(); onClose(); } }} disabled={status === 'importing'} accessibilityLabel="Close" />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={st.headerTitle}>Bulk Import</Text>
            <Text style={st.headerSub}>Import listings from a CSV file</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>

          {/* ── IDLE: file pick + template ── */}
          {status === 'idle' && (
            <>
              {/* Format guide */}
              <View style={st.formatCard}>
                <Text style={st.formatTitle}>CSV FORMAT</Text>
                <Text style={st.formatCode}>vrm,price,mileage,images</Text>
                <Text style={st.formatCode}>AB12CDE,15000,45000,https://…|https://…</Text>
                <Text style={st.formatHint}>
                  • First row is the header (skipped){'\n'}
                  • Images: separate multiple URLs with a pipe character <Text style={st.formatCode}>|</Text>{'\n'}
                  • Price and mileage must be numbers
                </Text>
              </View>

              {/* Template button */}
              <TouchableOpacity
                style={[st.outlineBtn, sharingTemplate && { opacity: 0.6 }]}
                onPress={handleShareTemplate}
                disabled={sharingTemplate}
                activeOpacity={0.8}
              >
                {sharingTemplate ? (
                  <ActivityIndicator size="small" color={Colors.warning} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={16} color={Colors.warning} />
                    <Text style={st.outlineBtnText}>Download CSV Template</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* File pick button */}
              <TouchableOpacity style={st.primaryBtn} onPress={handlePickFile} activeOpacity={0.85}>
                <Ionicons name="document-text-outline" size={16} color={Colors.white} />
                <Text style={st.primaryBtnText}>Pick CSV File</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── PARSING ── */}
          {status === 'parsing' && (
            <View style={st.centeredBlock}>
              <ActivityIndicator size="large" color={Colors.accent} />
              <Text style={st.statusText}>Reading file…</Text>
            </View>
          )}

          {/* ── IMPORTING ── */}
          {status === 'importing' && (
            <View style={st.progressBlock}>
              <Text style={st.progressLabel}>
                Importing {current} of {rows.length} vehicles
              </Text>

              {/* Progress bar */}
              <View style={st.progressTrack}>
                <View style={[st.progressFill, { width: `${progressPct}%` as any }]} />
              </View>
              <Text style={st.progressPct}>{progressPct}%</Text>

              <Text style={st.progressHint}>
                Please keep the app open. Listings are created one at a time.
              </Text>

              {/* Live error count */}
              {errorRows.length > 0 && (
                <View style={st.liveErrorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={Colors.warning} />
                  <Text style={st.liveErrorText}>{errorRows.length} row{errorRows.length !== 1 ? 's' : ''} failed so far</Text>
                </View>
              )}
            </View>
          )}

          {/* ── COMPLETE ── */}
          {status === 'complete' && (
            <>
              {/* Success count */}
              <View style={st.completeCard}>
                <View style={st.completeIcon}>
                  <Ionicons name="checkmark-circle" size={32} color={Colors.accentGreen} />
                </View>
                <Text style={st.completeTitle}>{importedCount} listing{importedCount !== 1 ? 's' : ''} imported</Text>
                <Text style={st.completeSub}>All imported listings are saved as drafts. Review and publish them from My Listings.</Text>
              </View>

              {/* Error summary */}
              {errorRows.length > 0 && (
                <View style={st.errorSummary}>
                  <TouchableOpacity
                    style={st.errorSummaryHeader}
                    onPress={() => setErrorsExpanded(v => !v)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="alert-circle-outline" size={15} color={Colors.warning} />
                    <Text style={st.errorSummaryTitle}>{errorRows.length} row{errorRows.length !== 1 ? 's' : ''} failed</Text>
                    <Ionicons name={errorsExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textMuted} style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>

                  {errorsExpanded && (
                    <View style={st.errorList}>
                      {errorRows.map((e, i) => (
                        <View key={`err-${i}`} style={[st.errorItem, i < errorRows.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha05 }]}>
                          <Text style={st.errorVrm}>{e.vrm}</Text>
                          <Text style={st.errorMsg} numberOfLines={2}>{e.error}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Done */}
              <TouchableOpacity
                style={st.primaryBtn}
                onPress={() => { reset(); onComplete(); }}
                activeOpacity={0.85}
              >
                <Text style={st.primaryBtnText}>Done</Text>
              </TouchableOpacity>

              {/* Import another */}
              <TouchableOpacity onPress={reset} style={st.backLink}>
                <Text style={st.backLinkText}>Import another file</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white, textAlign: 'center' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },

  body: { paddingHorizontal: 24, paddingTop: 12, gap: 14 },

  // Format guide card
  formatCard: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  formatTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textMuted, letterSpacing: 1, marginBottom: 4 },
  formatCode: { fontFamily: FontFamily.mono, fontSize: FontSize.size12, color: Colors.infoBlueLight },
  formatHint: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textMuted, lineHeight: 18, marginTop: 8 },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.accent,
  },
  primaryBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white, letterSpacing: 0.3 },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.40)',
    backgroundColor: Colors.warningAlpha06,
  },
  outlineBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.warning },
  backLink: { alignItems: 'center', paddingVertical: 14 },
  backLinkText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted },

  // Parsing / importing
  centeredBlock: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  statusText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textPrimary },
  progressBlock: { gap: 12, paddingTop: 16 },
  progressLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textPrimary, textAlign: 'center' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.whiteAlpha08,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },
  progressPct: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'right' },
  progressHint: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  liveErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.warningAlpha08,
    borderWidth: 1,
    borderColor: Colors.warningAlpha20,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  liveErrorText: { fontFamily: FontFamily.medium, fontSize: FontSize.size12, color: Colors.lightYellow },

  // Complete
  completeCard: {
    backgroundColor: Colors.accentGreenAlpha06,
    borderWidth: 1,
    borderColor: Colors.accentGreenAlpha20,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  completeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accentGreenAlpha12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  completeTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textPrimary },
  completeSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },

  // Errors
  errorSummary: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.warningAlpha20,
    borderRadius: 14,
    overflow: 'hidden',
  },
  errorSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorSummaryTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.warning },
  errorList: { paddingHorizontal: 16, paddingBottom: 8 },
  errorItem: { paddingVertical: 10, gap: 2 },
  errorVrm: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textPrimary },
  errorMsg: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textMuted, lineHeight: 17 },
});
