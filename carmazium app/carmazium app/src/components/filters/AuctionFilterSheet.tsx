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
import { CAR_MAKES, getModelsForMake } from '../../data/carData';
import { VEHICLE_FEATURE_GROUPS } from '../../data/vehicleFeatures';
import { EXTERIOR_GRADE_OPTIONS } from '../../lib/exteriorGrade';
import { useLocation } from '../../context/LocationContext';
import {
  AUCTION_SORT_OPTIONS,
  AuctionFilterState,
  AuctionSort,
  INITIAL_AUCTION_FILTERS,
  countActiveAuctionFilters,
} from './auctionFilters';

// Match the full website/retail catalogue rather than just five common fuels.
const FUEL_OPTIONS = [
  'Petrol', 'Diesel', 'Hybrid', 'Plug-in Hybrid', 'Electric',
  'LPG', 'Hydrogen', 'Bi Fuel', 'Natural Gas', 'Petrol Hybrid',
  'Diesel Hybrid', 'Petrol Plug-in Hybrid', 'Diesel Plug-in Hybrid', 'Unlisted',
];
const TRANSMISSION_OPTIONS = ['Automatic', 'Manual', 'Semi-Automatic', 'CVT'];
const CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'];
const WRITE_OFF_OPTIONS = [
  ['NONE', 'No write-off declared'], ['CAT_S', 'Cat S — structural'],
  ['CAT_N', 'Cat N — non-structural'], ['CAT_C', 'Cat C — historical'],
  ['CAT_D', 'Cat D — historical'], ['CAT_A', 'Cat A — salvage'],
  ['CAT_B', 'Cat B — salvage'],
] as const;
const EURO_OPTIONS = [
  ['EURO_4', 'Euro 4'], ['EURO_5', 'Euro 5'],
  ['EURO_6', 'Euro 6'], ['EURO_6D', 'Euro 6d'],
] as const;
type NumericFilterKey =
  'minYear' | 'maxYear' | 'minMileage' | 'maxMileage' |
  'minDoors' | 'minSeats' | 'minEngine' | 'maxEngine' |
  'maxCo2' | 'minCombinedMpg' | 'maxZeroToSixty' |
  'minBhp' | 'maxBhp';
const NUMERIC_FILTERS: { title: string; fields: { key: NumericFilterKey; label: string }[] }[] = [
  { title: 'Year', fields: [{ key: 'minYear', label: 'From' }, { key: 'maxYear', label: 'To' }] },
  { title: 'Mileage (miles)', fields: [{ key: 'minMileage', label: 'Minimum' }, { key: 'maxMileage', label: 'Maximum' }] },
  { title: 'Doors & seats', fields: [{ key: 'minDoors', label: 'At least doors' }, { key: 'minSeats', label: 'At least seats' }] },
  { title: 'Engine size (cc)', fields: [{ key: 'minEngine', label: 'Minimum' }, { key: 'maxEngine', label: 'Maximum' }] },
  { title: 'Power (BHP)', fields: [{ key: 'minBhp', label: 'Minimum' }, { key: 'maxBhp', label: 'Maximum' }] },
  { title: 'CO₂ emissions (g/km)', fields: [{ key: 'maxCo2', label: 'Maximum' }] },
  { title: 'Fuel economy (combined MPG)', fields: [{ key: 'minCombinedMpg', label: 'Minimum' }] },
  { title: 'Acceleration (0–60 mph)', fields: [{ key: 'maxZeroToSixty', label: 'Maximum seconds' }] },
];


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
}) => {
  const [draft, setDraft] = useState<AuctionFilterState>(value);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [makeQuery, setMakeQuery] = useState('');
  const [showAllMakes, setShowAllMakes] = useState(false);
  const [featureQuery, setFeatureQuery] = useState('');
  const [postcodeInput, setPostcodeInput] = useState('');
  const [savingPostcode, setSavingPostcode] = useState(false);
  const { postcode, latitude, longitude, setPostcode } = useLocation();
  const hasDistanceOrigin = latitude != null && longitude != null;
  const makeOptions = Array.from(new Set([...CAR_MAKES, ...availableMakes, ...draft.makes]));
  const searchedMakes = makeOptions.filter(m => m.toLowerCase().includes(makeQuery.trim().toLowerCase()));
  const visibleMakes = makeQuery.trim() ? searchedMakes : showAllMakes ? makeOptions : [...new Set([...availableMakes, ...draft.makes, ...CAR_MAKES.slice(0, 12)])];
  const modelOptions = draft.makes.length === 1 ? getModelsForMake(draft.makes[0]) : [];


  // Re-seed the draft each time the sheet opens so a cancelled edit doesn't
  // persist into the next open.
  React.useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const activeCount = useMemo(() => countActiveAuctionFilters(draft), [draft]);
  const moreCount = activeCount - [
    draft.makes.length > 0, !!draft.model, draft.bodyTypes.length > 0,
    draft.fuelTypes.length > 0, draft.transmissions.length > 0,
    !!draft.minBid || !!draft.maxBid,
  ].filter(Boolean).length;

  const toggle = (key: 'makes' | 'bodyTypes' | 'fuelTypes' | 'transmissions' | 'conditions' | 'writeOffCategories' | 'features', item: string) =>
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

          <Section title="Make">
            <TextInput
              style={styles.input}
              value={makeQuery}
              onChangeText={setMakeQuery}
              placeholder="Search all makes…"
              placeholderTextColor={Colors.inputPlaceholder}
              autoCorrect={false}
              accessibilityLabel="Search vehicle makes"
            />
            <View style={[styles.pillWrap, { marginTop: 10 }]}>
              {visibleMakes.map(m => (
                <Pill key={m} label={m} selected={draft.makes.includes(m)} onPress={() => toggle('makes', m)} />
              ))}
            </View>
            {!makeQuery.trim() && (
              <TouchableOpacity style={styles.showAllMakes} onPress={() => setShowAllMakes(open => !open)} accessibilityRole="button">
                <Text style={styles.resetText}>{showAllMakes ? 'Show fewer makes' : 'Show all makes'}</Text>
              </TouchableOpacity>
            )}
          </Section>

          <Section title="Model">
            <TextInput style={styles.input} value={draft.model} onChangeText={t => set('model', t)}
              placeholder="Search model" placeholderTextColor={Colors.inputPlaceholder} autoCorrect={false} />
            {modelOptions.length > 0 && (
              <View style={[styles.pillWrap, { marginTop: 10 }]}>
                {modelOptions.filter(m => !draft.model.trim() || m.toLowerCase().includes(draft.model.toLowerCase()))
                  .slice(0, 30).map(m => (
                    <Pill key={m} label={m} selected={draft.model === m} onPress={() => set('model', draft.model === m ? '' : m)} />
                  ))}
              </View>
            )}
          </Section>

          <Section title="Variant / trim">
            <TextInput style={styles.input} value={draft.variant} onChangeText={t => set('variant', t)}
              placeholder="e.g. M Sport, GT Line" placeholderTextColor={Colors.inputPlaceholder} autoCorrect={false} />
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

          <TouchableOpacity
            style={styles.moreToggle}
            onPress={() => setShowMoreFilters(v => !v)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ expanded: showMoreFilters }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.moreTitle}>More auction filters {moreCount > 0 ? `(${moreCount} active)` : ''}</Text>
              <Text style={styles.moreSubtitle}>Condition, features, emissions, dimensions, UK compliance and distance</Text>
            </View>
            <Text style={styles.moreChevron}>{showMoreFilters ? '−' : '+'}</Text>
          </TouchableOpacity>
          {showMoreFilters && (
            <>
              <Section title="Colour">
                <TextInput style={styles.input} value={draft.colour} onChangeText={t => set('colour', t)}
                  placeholder="e.g. Black or Blue" placeholderTextColor={Colors.inputPlaceholder} />
              </Section>
              {NUMERIC_FILTERS.map(group => (
                <Section key={group.title} title={group.title}>
                  <View style={styles.row}>
                    {group.fields.map(field => (
                      <TextInput key={field.key} style={[styles.input, styles.inputHalf]}
                        value={draft[field.key]} onChangeText={t => set(field.key, t)}
                        placeholder={field.label} accessibilityLabel={group.title + ': ' + field.label}
                        placeholderTextColor={Colors.inputPlaceholder} keyboardType="decimal-pad" />
                    ))}
                  </View>
                </Section>
              ))}
              <Section title="Exterior Grade (1–5)">
                <Text style={styles.moreSubtitle}>Calculated from reported vehicle defects; Grade 1 is best.</Text>
                <View style={[styles.pillWrap, { marginTop: 10 }]}>
                  {EXTERIOR_GRADE_OPTIONS.map(grade => (
                    <Pill key={grade.value} label={`Grade ${grade.value} — ${grade.label}`}
                      selected={draft.exteriorGrades.includes(grade.value)}
                      onPress={() => set('exteriorGrades', draft.exteriorGrades.includes(grade.value)
                        ? draft.exteriorGrades.filter(g => g !== grade.value)
                        : [...draft.exteriorGrades, grade.value])} />
                  ))}
                </View>
              </Section>
              <Section title="Seller-reported condition">
                <View style={styles.pillWrap}>
                  {CONDITIONS.map(value => (
                    <Pill key={value} label={value[0] + value.slice(1).toLowerCase()} selected={draft.conditions.includes(value)}
                      onPress={() => toggle('conditions', value)} />
                  ))}
                </View>
              </Section>
              <Section title="Insurance write-off status">
                <Text style={styles.moreSubtitle}>Seller declarations are not necessarily independently HPI-verified.</Text>
                <View style={[styles.pillWrap, { marginTop: 10 }]}>
                  {WRITE_OFF_OPTIONS.map(([value, label]) => (
                    <Pill key={value} label={label} selected={draft.writeOffCategories.includes(value)}
                      onPress={() => toggle('writeOffCategories', value)} />
                  ))}
                </View>
              </Section>
              <Section title="ULEZ / CAZ compliance">
                <View style={styles.pillWrap}>
                  {([['', 'Any'], ['yes', 'Compliant'], ['no', 'Not compliant']] as const).map(([value, label]) => (
                    <Pill key={label} label={label} selected={draft.ulezCompliant === value} onPress={() => set('ulezCompliant', value)} />
                  ))}
                </View>
              </Section>
              <Section title="Euro standard">
                <View style={styles.pillWrap}>
                  <Pill label="Any" selected={!draft.euroStandard} onPress={() => set('euroStandard', '')} />
                  {EURO_OPTIONS.map(([value, label]) => (
                    <Pill key={value} label={label} selected={draft.euroStandard === value}
                      onPress={() => set('euroStandard', draft.euroStandard === value ? '' : value)} />
                  ))}
                </View>
              </Section>
              <Section title="Drivetrain">
                <View style={styles.pillWrap}>
                  {['FWD', 'RWD', 'AWD', '4WD'].map(drive => (
                    <Pill key={drive} label={drive} selected={draft.driveType === drive}
                      onPress={() => set('driveType', draft.driveType === drive ? '' : drive)} />
                  ))}
                </View>
              </Section>
              <Section title="Features / options">
                <TextInput style={styles.input} value={featureQuery} onChangeText={setFeatureQuery}
                  placeholder="Search equipment" placeholderTextColor={Colors.inputPlaceholder} />
                {Object.entries(VEHICLE_FEATURE_GROUPS).map(([group, entries]) => {
                  const options = entries.filter(x => x.toLowerCase().includes(featureQuery.trim().toLowerCase()));
                  return options.length ? (
                    <View key={group} style={{ marginTop: 12 }}>
                      <Text style={styles.sectionTitle}>{group}</Text>
                      <View style={styles.pillWrap}>
                        {options.map(feature => (
                          <Pill key={feature} label={feature} selected={draft.features.includes(feature)}
                            onPress={() => toggle('features', feature)} />
                        ))}
                      </View>
                    </View>
                  ) : null;
                })}
              </Section>
              <Section title="Seller type">
                <View style={styles.pillWrap}>
                  {([['', 'All'], ['DEALER', 'Dealer'], ['PRIVATE', 'Private']] as const).map(([value, label]) => (
                    <Pill key={label} label={label} selected={draft.sellerType === value} onPress={() => set('sellerType', value)} />
                  ))}
                </View>
              </Section>
              <Section title="Vehicle type">
                <View style={styles.pillWrap}>
                  {([['', 'All'], ['CAR', 'Car'], ['HGV', 'HGV'], ['MOTORCYCLE', 'Motorcycle']] as const).map(([value, label]) => (
                    <Pill key={label} label={label} selected={draft.vehicleType === value} onPress={() => set('vehicleType', value)} />
                  ))}
                </View>
              </Section>
              <Section title="Import status">
                <View style={styles.pillWrap}>
                  {([['', 'Any'], ['yes', 'Imported only'], ['no', 'Hide imported']] as const).map(([value, label]) => (
                    <Pill key={label} label={label} selected={draft.isImported === value} onPress={() => set('isImported', value)} />
                  ))}
                </View>
              </Section>
              <Section title="Location">
                <TextInput style={styles.input} value={draft.location} onChangeText={t => set('location', t)}
                  placeholder="Town, city or county" placeholderTextColor={Colors.inputPlaceholder} />
              </Section>
              <Section title="Distance from postcode">
                <Text style={styles.moreSubtitle}>
                  {hasDistanceOrigin ? `Using ${postcode}` : 'Enter a UK postcode to enable a distance search.'}
                </Text>
                {!hasDistanceOrigin && (
                  <View style={[styles.row, { marginTop: 10 }]}>
                    <TextInput style={[styles.input, styles.inputHalf]} value={postcodeInput} onChangeText={setPostcodeInput}
                      placeholder="UK postcode" placeholderTextColor={Colors.inputPlaceholder} autoCapitalize="characters" />
                    <TouchableOpacity style={styles.postcodeButton} disabled={savingPostcode || !postcodeInput.trim()}
                      accessibilityRole="button" onPress={async () => {
                        setSavingPostcode(true);
                        try { await setPostcode(postcodeInput.trim()); }
                        finally { setSavingPostcode(false); }
                      }}>
                      <Text style={styles.applyText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={[styles.pillWrap, { marginTop: 10 }]}>
                  {([null, 10, 25, 50, 100, 200] as (number | null)[]).map(miles => (
                    <Pill key={String(miles)} label={miles == null ? 'Any distance' : `${miles} mi`}
                      selected={draft.maxDistanceMi === miles}
                      onPress={() => { if (miles == null || hasDistanceOrigin) set('maxDistanceMi', miles); }} />
                  ))}
                </View>
              </Section>
              <Section title="Delivery">
                <View style={styles.pillWrap}>
                  <Pill label="Delivery available" selected={draft.deliveryAvailable}
                    onPress={() => set('deliveryAvailable', !draft.deliveryAvailable)} />
                </View>
              </Section>
            </>
          )}
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
  section: { marginBottom: 22 },
  showAllMakes: { alignSelf: 'flex-start', paddingVertical: 10 },
  postcodeButton: { backgroundColor: Colors.accent, borderRadius: Radius.inline, paddingHorizontal: 18, justifyContent: 'center' },
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
