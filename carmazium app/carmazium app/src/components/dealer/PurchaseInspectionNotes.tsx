import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';

// Same kinds and wording as web (src/components/dealer/PurchaseInspectionNotes.tsx).
const KIND_LABELS: Record<string, string> = {
  NEW_DAMAGE: 'New damage found',
  DIFFERS_FROM_ADVERT: 'Differs from the advert',
  GENERAL: 'General note',
};

interface InspectionNote {
  id: string;
  kind: string;
  part: string | null;
  description: string;
  createdAt: string;
  byYou: boolean;
}

/**
 * The dealership's own inspection findings, set against the original
 * disclosure. Append-only; never changes the agreed price or status.
 * Renders nothing until the backend has notes switched on.
 */
export const PurchaseInspectionNotes: React.FC<{ saleId: string }> = ({ saleId }) => {
  const base = `/dealers/purchases/${encodeURIComponent(saleId)}/inspection-notes`;
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<InspectionNote[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [kind, setKind] = useState('NEW_DAMAGE');
  const [part, setPart] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    apiClient<{ data: { enabled: boolean; notes: InspectionNote[] } }>(base)
      .then(res => {
        if (!mounted) return;
        setEnabled(res.data.enabled);
        setNotes(res.data.notes);
      })
      .catch(() => { if (mounted) { setEnabled(true); setLoadError(true); } });
    return () => { mounted = false; };
  }, [base]);

  if (!enabled) return null;

  const save = async () => {
    if (description.trim().length < 3) {
      setSaveError('Describe what you found (at least 3 characters).');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiClient<{ data: InspectionNote }>(base, {
        method: 'POST',
        body: JSON.stringify({ kind, part: part.trim() || undefined, description: description.trim() }),
      });
      setNotes(prev => [...prev, res.data]);
      setPart('');
      setDescription('');
    } catch (err: any) {
      setSaveError(err?.message || 'The note could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="clipboard-outline" color={Colors.accent} size={19} />
        <Text style={styles.title}>Inspection notes</Text>
      </View>
      <Text style={styles.muted}>
        Record anything you find that the advert didn't show. Notes are kept as a record for your team and don't
        change the agreed price or purchase status. To change the price, use Adjustments & cancellations.
      </Text>

      {loadError && <Text style={styles.warning}>Earlier notes could not be loaded.</Text>}
      {notes.length === 0 && !loadError && <Text style={styles.muted}>No inspection notes yet.</Text>}
      {notes.map(n => (
        <View key={n.id} style={styles.note}>
          <Text style={styles.noteTitle}>{KIND_LABELS[n.kind] ?? 'Note'}{n.part ? ` · ${n.part}` : ''}</Text>
          <Text style={styles.noteBody}>{n.description}</Text>
          <Text style={styles.muted}>
            {new Date(n.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {n.byYou ? ' · You' : ' · Your team'}
          </Text>
        </View>
      ))}

      <View style={styles.kinds} accessibilityLabel="Type">
        {Object.entries(KIND_LABELS).map(([value, label]) => {
          const selected = kind === value;
          return (
            <TouchableOpacity key={value} style={[styles.kind, selected && styles.kindActive]}
              onPress={() => setKind(value)} accessibilityRole="button" accessibilityState={{ selected }}>
              <Text style={[styles.kindText, selected && styles.kindTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TextInput style={styles.input} value={part} onChangeText={setPart} maxLength={80}
        placeholder="Panel or area (optional), e.g. Rear bumper" placeholderTextColor={Colors.textMuted}
        accessibilityLabel="Panel or area" />
      <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription}
        maxLength={2000} multiline placeholder="What you found" placeholderTextColor={Colors.textMuted}
        accessibilityLabel="What you found" />
      {saveError && <Text style={styles.error}>{saveError}</Text>}
      <TouchableOpacity style={[styles.save, saving && styles.saveDisabled]} onPress={save} disabled={saving}
        accessibilityRole="button">
        {saving && <ActivityIndicator size="small" color={Colors.white} />}
        <Text style={styles.saveText}>Add note</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: 8, padding: 16, borderRadius: Radius.card, borderWidth: 1,
    borderColor: Colors.borderSubtle, backgroundColor: Colors.bgCard,
  },
  titleRow: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  title: { fontFamily: FontFamily.extraBold, fontSize: FontSize.md, color: Colors.textPrimary },
  muted: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 19, color: Colors.textMuted },
  warning: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.warning },
  error: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.error },
  note: { gap: 3, padding: 10, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.borderSubtle },
  noteTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary },
  noteBody: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 19, color: Colors.textPrimary },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kind: {
    minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  kindActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  kindText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textMuted },
  kindTextActive: { color: Colors.white },
  input: {
    minHeight: 44, paddingHorizontal: 12, borderRadius: Radius.inline, borderWidth: 1,
    borderColor: Colors.borderSubtle, backgroundColor: Colors.bgElevated,
    fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.white,
  },
  multiline: { minHeight: 88, paddingTop: 10, textAlignVertical: 'top' },
  save: {
    flexDirection: 'row', gap: 8, alignSelf: 'flex-start', alignItems: 'center',
    minHeight: 44, paddingHorizontal: 18, borderRadius: Radius.inline, backgroundColor: Colors.accent,
  },
  saveDisabled: { opacity: 0.5 },
  saveText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white },
});
