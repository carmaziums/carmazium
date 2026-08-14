import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
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
const TRANSMISSION_OPTIONS = ['Automatic', 'Manual'];

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Current committed filters — the sheet edits a draft copy of these. */
  value: AuctionFilterState;
  onApply: (next: AuctionFilterState) => void;
  /** Makes present in the current result set, so the list only offers makes
   *  that can actually match something. */
  availableMakes: string[];
  /** Result count for the draft filters, shown on the Apply button. */
  resultCount?: number;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const Pill: React.FC<{ label: string; selected: boolean; onPress: () => void }> = ({
  label,
  selected,
  onPress,
}) => (
  <TouchableOpacity
    style={[styles.pill, selected && styles.pillSelected]}
    onPress={onPress}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityState={{ selected }}
  >
    <Text style={[styles.pillText, selected && styles.pillTextSelected]} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

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
  resultCount,
}) => {
  const [draft, setDraft] = useState<AuctionFilterState>(value);

  // Re-seed the draft each time the sheet opens so a cancelled edit doesn't
  // persist into the next open.
  React.useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const activeCount = useMemo(() => countActiveAuctionFilters(draft), [draft]);

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
            <TextInput
              style={styles.input}
              value={draft.model}
              onChangeText={(t) => set('model', t)}
              placeholder="e.g. M4, Golf"
              placeholderTextColor={Colors.inputPlaceholder}
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
              <TextInput
                style={[styles.input, styles.inputHalf]}
                value={draft.minBid}
                onChangeText={(t) => set('minBid', t)}
                placeholder="Min"
                placeholderTextColor={Colors.inputPlaceholder}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.input, styles.inputHalf]}
                value={draft.maxBid}
                onChangeText={(t) => set('maxBid', t)}
                placeholder="Max"
                placeholderTextColor={Colors.inputPlaceholder}
                keyboardType="number-pad"
              />
            </View>
          </Section>

          <Section title="Year">
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.inputHalf]}
                value={draft.minYear}
                onChangeText={(t) => set('minYear', t)}
                placeholder="From"
                placeholderTextColor={Colors.inputPlaceholder}
                keyboardType="number-pad"
                maxLength={4}
              />
              <TextInput
                style={[styles.input, styles.inputHalf]}
                value={draft.maxYear}
                onChangeText={(t) => set('maxYear', t)}
                placeholder="To"
                placeholderTextColor={Colors.inputPlaceholder}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </Section>

          <Section title="Max mileage">
            <TextInput
              style={styles.input}
              value={draft.maxMileage}
              onChangeText={(t) => set('maxMileage', t)}
              placeholder="e.g. 60000"
              placeholderTextColor={Colors.inputPlaceholder}
              keyboardType="number-pad"
            />
          </Section>

          <Section title="Location">
            <TextInput
              style={styles.input}
              value={draft.location}
              onChangeText={(t) => set('location', t)}
              placeholder="Town, city or county"
              placeholderTextColor={Colors.inputPlaceholder}
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
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => setDraft({ ...INITIAL_AUCTION_FILTERS, sortBy: draft.sortBy })}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.resetText}>
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
              {resultCount == null
                ? 'Apply'
                : `Show ${resultCount} ${resultCount === 1 ? 'auction' : 'auctions'}`}
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
