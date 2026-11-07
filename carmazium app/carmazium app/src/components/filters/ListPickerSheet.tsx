import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/spacing';
import { FontFamily, FontSize } from '../../constants/typography';

/**
 * Full-screen searchable picker for long option lists (makes, models,
 * variants): search box, A–Z sections with a jump index, optional live
 * counts, single or multi select, and an "All" row that clears the choice.
 */
export interface ListPickerSheetProps {
  visible: boolean;
  title: string;
  options: string[];
  /** Selected values (multi) or a single selected value. */
  selected: string[];
  multi?: boolean;
  allowCustom?: boolean;
  /** Optional counts keyed by lower-case option label. */
  counts?: Record<string, number>;
  allLabel?: string;
  searchPlaceholder?: string;
  onChange: (next: string[]) => void;
  onClose: () => void;
}

type Section = { title: string; data: string[] };

const sectionKey = (label: string) => {
  const c = label.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
};

export const ListPickerSheet: React.FC<ListPickerSheetProps> = ({
  visible,
  title,
  options,
  selected,
  multi = false,
  allowCustom = false,
  counts,
  allLabel = 'All',
  searchPlaceholder = 'Search',
  onChange,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  useEffect(() => { if (visible) setQuery(''); }, [visible, title]);
  const listRef = useRef<SectionList<string, Section>>(null);

  const sections = useMemo<Section[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = options
      .filter((o) => !q || o.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b, 'en-GB'));
    const groups = new Map<string, string[]>();
    for (const o of filtered) {
      const k = sectionKey(o);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(o);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
      .map(([k, data]) => ({ title: k, data }));
  }, [options, query]);

  const letters = sections.map((sct) => sct.title);

  const toggle = (value: string) => {
    if (!multi) {
      onChange(selected.includes(value) ? [] : [value]);
      onClose();
      return;
    }
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const jumpTo = (letter: string) => {
    const index = sections.findIndex((sct) => sct.title === letter);
    if (index < 0) return;
    try {
      listRef.current?.scrollToLocation({ sectionIndex: index, itemIndex: 0, viewOffset: 0, animated: false });
    } catch {
      // Section not yet measured — harmless; the user can scroll.
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {multi ? (
            <TouchableOpacity style={styles.doneBtn} onPress={onClose} accessibilityRole="button">
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          ) : <View style={styles.headerBtn} />}
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={Colors.iconMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={Colors.inputPlaceholder}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={16} color={Colors.iconMuted} />
            </TouchableOpacity>
          )}
        </View>

        {allowCustom && query.trim() && !options.some(o => o.toLowerCase() === query.trim().toLowerCase()) && (
          <TouchableOpacity style={styles.row} accessibilityRole="button"
            onPress={() => { onChange(multi ? [...new Set([...selected, query.trim()])] : [query.trim()]); onClose(); }}>
            <Text style={styles.title}>Use “{query.trim()}”</Text>
          </TouchableOpacity>
        )}
        <View style={styles.body}>
          <SectionList
            ref={listRef}
            sections={sections}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            stickySectionHeadersEnabled
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            ListHeaderComponent={!query.trim() ? (
              <TouchableOpacity
                style={styles.row}
                onPress={() => { onChange([]); if (!multi) onClose(); }}
                accessibilityRole="button"
                accessibilityState={{ selected: selected.length === 0 }}
              >
                <Text style={styles.rowLabel}>{allLabel}</Text>
                {selected.length === 0 && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
              </TouchableOpacity>
            ) : null}
            ListEmptyComponent={<Text style={styles.empty}>No matches for “{query.trim()}”</Text>}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>{section.title}</Text></View>
            )}
            renderItem={({ item }) => {
              const on = selected.includes(item);
              const count = counts?.[item.toLowerCase()];
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => toggle(item)}
                  accessibilityRole={multi ? 'checkbox' : 'button'}
                  accessibilityState={multi ? { checked: on } : { selected: on }}
                >
                  <Text style={[styles.rowLabel, on && styles.rowLabelOn]} numberOfLines={1}>{item}</Text>
                  {count != null && <Text style={styles.count}>{count.toLocaleString('en-GB')}</Text>}
                  {on && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
                </TouchableOpacity>
              );
            }}
          />
          {letters.length > 6 && !query.trim() && (
            <View style={styles.index} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {letters.map((l) => (
                <TouchableOpacity key={l} onPress={() => jumpTo(l)} hitSlop={{ left: 8, right: 8 }}>
                  <Text style={styles.indexLetter}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  doneBtn: { minWidth: 40, height: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  doneText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.accent },
  title: { flex: 1, textAlign: 'center', fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textPrimary },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16,
    paddingHorizontal: 14, minHeight: 46, borderRadius: Radius.inline,
    borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgSecondary,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.textPrimary },
  body: { flex: 1, flexDirection: 'row' },
  sectionHeader: { backgroundColor: Colors.bgSurface, paddingHorizontal: 20, paddingVertical: 6 },
  sectionHeaderText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textPrimary },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52,
    paddingLeft: 20, paddingRight: 36,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  rowLabel: { flex: 1, fontFamily: FontFamily.semiBold, fontSize: FontSize.base, color: Colors.textPrimary },
  rowLabelOn: { color: Colors.accent },
  count: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted },
  empty: { padding: 24, textAlign: 'center', fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.textMuted },
  index: {
    position: 'absolute', right: 2, top: 0, bottom: 0, width: 28,
    alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  indexLetter: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accent, paddingVertical: 1 },
});
