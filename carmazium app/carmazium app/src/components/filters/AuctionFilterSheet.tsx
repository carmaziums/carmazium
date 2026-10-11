import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { ThemedTextField } from '../ThemedTextField';
import { useNativeAppearance } from '../../theme/NativeAppearanceProvider';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/spacing';
import { FontFamily, FontSize, TextPresets } from '../../constants/typography';
import { BODY_TYPE_ICONS } from '../../constants/bodyTypes';
import {
  AUCTION_SORT_OPTIONS,
  AuctionFilterState,
  AuctionSort,
  INITIAL_AUCTION_FILTERS,
  countActiveAuctionFilters,
} from './auctionFilters';

const FUEL_OPTIONS = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid'];
const TRANSMISSION_OPTIONS = ['Automatic', 'Manual', 'Semi-Automatic', 'CVT'];

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Current committed filters — the sheet edits a draft copy of these. */
  value: AuctionFilterState;
  onApply: (next: AuctionFilterState) => void;
  /** Makes present in the current result set, so the list only offers makes
   *  that can actually match something. */
  availableMakes: string[];
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const { palette } = useNativeAppearance();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>{title}</Text>
      {children}
    </View>
  );
};

const Pill: React.FC<{ label: string; selected: boolean; onPress: () => void }> = ({
  label,
  selected,
  onPress,
}) => {
  const { palette } = useNativeAppearance();
  return (
  <TouchableOpacity
    style={[styles.pill, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }, selected && styles.pillSelected]}
    onPress={onPress}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityState={{ selected }}
  >
    <Text style={[styles.pillText, { color: selected ? palette.accent : palette.textSecondary }, selected && styles.pillTextSelected]} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
  );
};

/**
 * Auction filter panel.
 *
 * Edits a DRAFT copy of the filters and only commits on Apply. That matters on
 * a live-auction list: filters that applied on every keystroke would re-sort and
 * re-render a list whose contents are already moving under the user via socket
 * bid updates.
 */
export const AuctionFilterSheet: React.FC<Props> = ({
  visible,
  onClose,
  value,
  onApply,
  availableMakes,
}) => {
  const { palette } = useNativeAppearance();
  const [draft, setDraft] = useState<AuctionFilterState>(value);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Re-seed the draft each time the sheet opens so a cancelled edit doesn't
  // persist into the next open.
  React.useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const activeCount = useMemo(() => countActiveAuctionFilters(draft), [draft]);
  const moreCount = [!!draft.minYear || !!draft.maxYear, !!draft.maxMileage, !!draft.location.trim(), draft.deliveryAvailable].filter(Boolean).length;

  const toggle = (key: 'makes' | 'bodyTypes' | 'fuelTypes' | 'transmissions', item: string) =>
    setDraft((prev) => ({
      ...prev,
      [key]: prev[key].includes(item)
        ? prev[key].filter((x) => x !== item)
        : [...prev[key], item],
    }));

  const set = <K extends keyof AuctionFilterState>(key: K, v: AuctionFilterState[K]) =>
    setDraft((prev) => ({ ...prev, [key]: v }));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter auctions"
      avoidKeyboard
      fillHeight
      maxHeightPercent={88}
    >
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Section title="Sort by">
            <View style={styles.pillWrap}>
              {AUCTION_SORT_OPTIONS.map((o) => (
                <Pill
                  key={o.value}
                  label={o.label}
                  selected={draft.sortBy === o.value}
                  onPress={() => set('sortBy', o.value as AuctionSort)}
                />
              ))}
            </View>
          </Section>

          {availableMakes.length > 0 && (
            <Section title="Make">
              <View style={styles.pillWrap}>
                {availableMakes.map((m) => (
                  <Pill
                    key={m}
                    label={m}
                    selected={draft.makes.includes(m)}
                    onPress={() => toggle('makes', m)}
                  />
                ))}
              </View>
            </Section>
          )}

          <Section title="Model">
            <ThemedTextField
              style={styles.input}
              value={draft.model}
              onChangeText={(t) => set('model', t)}
              placeholder="e.g. M4, Golf"
              autoCorrect={false}
            />
          </Section>

          <Section title="Body type">
            <View style={styles.pillWrap}>
              {BODY_TYPE_ICONS.map((b) => (
                <Pill
                  key={b.value}
                  label={b.label}
                  selected={draft.bodyTypes.includes(b.value)}
                  onPress={() => toggle('bodyTypes', b.value)}
                />
              ))}
            </View>
          </Section>

          <Section title="Fuel type">
            <View style={styles.pillWrap}>
              {FUEL_OPTIONS.map((f) => (
                <Pill
                  key={f}
                  label={f}
                  selected={draft.fuelTypes.includes(f)}
                  onPress={() => toggle('fuelTypes', f)}
                />
              ))}
            </View>
          </Section>

          <Section title="Transmission">
            <View style={styles.pillWrap}>
              {TRANSMISSION_OPTIONS.map((t) => (
                <Pill
                  key={t}
                  label={t}
                  selected={draft.transmissions.includes(t)}
                  onPress={() => toggle('transmissions', t)}
                />
              ))}
            </View>
          </Section>

          <Section title="Current bid (£)">
            <View style={styles.row}>
              <ThemedTextField
                style={[styles.input, styles.inputHalf]}
                value={draft.minBid}
                onChangeText={(t) => set('minBid', t)}
                placeholder="Min"
                keyboardType="number-pad"
              />
              <ThemedTextField
                style={[styles.input, styles.inputHalf]}
                value={draft.maxBid}
                onChangeText={(t) => set('maxBid', t)}
                placeholder="Max"
                keyboardType="number-pad"
              />
            </View>
          </Section>

          <TouchableOpacity
            style={[styles.moreToggle, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }]}
            onPress={() => setShowMoreFilters(v => !v)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ expanded: showMoreFilters }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.moreTitle, { color: palette.textPrimary }]}>More auction filters {moreCount > 0 ? `(${moreCount} active)` : ''}</Text>
              <Text style={[styles.moreSubtitle, { color: palette.textSecondary }]}>Year, mileage, location and delivery</Text>
            </View>
            <Text style={[styles.moreChevron, { color: palette.textSecondary }]}>{showMoreFilters ? '−' : '+'}</Text>
          </TouchableOpacity>
          {showMoreFilters && (
            <>
          <Section title="Year">
            <View style={styles.row}>
              <ThemedTextField
                style={[styles.input, styles.inputHalf]}
                value={draft.minYear}
                onChangeText={(t) => set('minYear', t)}
                placeholder="From"
                keyboardType="number-pad"
                maxLength={4}
              />
              <ThemedTextField
                style={[styles.input, styles.inputHalf]}
                value={draft.maxYear}
                onChangeText={(t) => set('maxYear', t)}
                placeholder="To"
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </Section>

          <Section title="Max mileage">
            <ThemedTextField
              style={styles.input}
              value={draft.maxMileage}
              onChangeText={(t) => set('maxMileage', t)}
              placeholder="e.g. 60000"
              keyboardType="number-pad"
            />
          </Section>

          <Section title="Location">
            <ThemedTextField
              style={styles.input}
              value={draft.location}
              onChangeText={(t) => set('location', t)}
              placeholder="Town, city or county"
              autoCorrect={false}
            />
          </Section>

          <Section title="Delivery">
            <View style={styles.pillWrap}>
              <Pill
                label="Delivery available"
                selected={draft.deliveryAvailable}
                onPress={() => set('deliveryAvailable', !draft.deliveryAvailable)}
              />
            </View>
          </Section>
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: palette.borderDefault }]}>
          <TouchableOpacity
            style={[styles.resetBtn, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }]}
            onPress={() => setDraft({ ...INITIAL_AUCTION_FILTERS, sortBy: draft.sortBy })}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={[styles.resetText, { color: palette.textSecondary }]}>
              {activeCount > 0 ? `Reset (${activeCount})` : 'Reset'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.applyText}>
              Apply filters
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  section: {
    marginBottom: 22,
  },
  moreToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 15, marginBottom: 18, borderRadius: Radius.inline, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.borderHi },
  moreTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white },
  moreSubtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  moreChevron: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textSecondary },
  sectionTitle: {
    ...TextPresets.eyebrow,
    color: Colors.white,
    marginBottom: 10,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillSelected: {
    backgroundColor: Colors.accentAlpha15,
    borderColor: Colors.accent,
  },
  pillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
  },
  pillTextSelected: {
    color: Colors.accent,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radius.inline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  inputHalf: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  resetBtn: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: Radius.inline,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.borderHi,
    justifyContent: 'center',
  },
  resetText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  applyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
