import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, TextInput, ActivityIndicator, Alert,
  Switch, Dimensions, Platform, BackHandler,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily, FontSize } from '../../constants/typography';
import { Colors } from '../../constants/colors';
import { BODY_TYPE_ICONS } from '../../constants/bodyTypes';
import { IconButton } from '../../components/IconButton';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { convertAndCompress, uploadToStorage } from '../../lib/storageHelper';
import { useSellWizardStore } from '../../lib/sellWizardStore';
import { haptics } from '../../lib/haptics';
import { useStripe } from '@stripe/stripe-react-native';
import { createPaymentSheet } from '../../lib/paymentsApi';
import { ThreeDVehicleViewer } from '../../components/damage/ThreeDVehicleViewer';
import { DAMAGE_ZONES_3D, DAMAGE_ZONE_SECTIONS } from '../../components/damage/damageZones';
import { getRawListingById } from '../../lib/listingsApi';
import { CAR_MAKES, getModelsForMake } from '../../data/carData';
import { BottomSheet } from '../../components/BottomSheet';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

interface DvlaData {
  make?: string; model?: string; colour?: string; year?: number;
  engineSize?: number; fuelType?: string; transmission?: string;
  euroStandard?: string; co2Emissions?: number; motStatus?: string;
  taxStatus?: string; motExpiryDate?: string; taxDueDate?: string;
  markedForExport?: boolean; monthOfFirstRegistration?: string;
  wheelplan?: string; typeApproval?: string; dateOfLastV5CIssued?: string;
}

interface DamageEntry {
  id: string;
  zone: string;
  type: 'SCRATCH' | 'SCUFF' | 'DENT' | 'CRACK' | 'OTHER';
  description: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Full parity with web's FuelType enum (ListingWizard.tsx) — was missing 9 of
// 14 values, silently blocking sellers with e.g. an LPG or hydrogen car from
// listing accurately.
const FUEL_TYPES = [
  { v: 'PETROL', l: 'Petrol' }, { v: 'DIESEL', l: 'Diesel' },
  { v: 'ELECTRIC', l: 'Electric' }, { v: 'HYBRID', l: 'Hybrid' },
  { v: 'PETROL_HYBRID', l: 'Petrol Hybrid' }, { v: 'DIESEL_HYBRID', l: 'Diesel Hybrid' },
  { v: 'PLUGIN_HYBRID', l: 'Plug-in Hybrid' },
  { v: 'PETROL_PLUGIN_HYBRID', l: 'Petrol Plug-in Hybrid' },
  { v: 'DIESEL_PLUGIN_HYBRID', l: 'Diesel Plug-in Hybrid' },
  { v: 'LPG', l: 'LPG' }, { v: 'BI_FUEL', l: 'Bi Fuel' },
  { v: 'NATURAL_GAS', l: 'Natural Gas' }, { v: 'HYDROGEN_CELL', l: 'Hydrogen' },
  { v: 'UNLISTED', l: 'Unlisted' },
];
const TRANSMISSIONS = [
  { v: 'AUTOMATIC', l: 'Automatic' }, { v: 'MANUAL', l: 'Manual' },
  // Was 'SEMI_AUTO' — the backend's Transmission enum only accepts
  // SEMI_AUTOMATIC, so selecting this used to fail listing submission.
  { v: 'SEMI_AUTOMATIC', l: 'Semi-Auto' }, { v: 'CVT', l: 'CVT' },
];
// Values match web's ListingWizard.tsx exactly (raw display strings, not
// enum codes — the backend DTO has no enum for either field, just
// @IsString(), so web's literal strings are the real contract). Mobile used
// to send '4x4'/'FULL_MAIN_DEALER'-style values that never matched what web
// wrote, silently breaking edit-prefill pill highlighting and any
// buyer-facing display expecting web's format.
const DRIVE_TYPES = [
  { v: 'FWD', l: 'FWD' }, { v: 'RWD', l: 'RWD' },
  { v: 'AWD', l: 'AWD' }, { v: '4WD', l: '4WD' },
];
const SERVICE_HISTORY_OPTS = [
  { v: 'Full Main Dealer', l: 'Full Main Dealer' },
  { v: 'Full Independent', l: 'Full Independent' },
  { v: 'Partial', l: 'Partial' }, { v: 'None', l: 'None' },
];
const CONDITIONS = [
  { v: 'EXCELLENT', l: 'Excellent' }, { v: 'GOOD', l: 'Good' },
  { v: 'FAIR', l: 'Fair' }, { v: 'POOR', l: 'Poor' },
];
const OWNERS_OPTIONS = [
  { v: '1', l: '1 Owner' }, { v: '2', l: '2 Owners' }, { v: '3', l: '3 Owners' },
  { v: '4', l: '4 Owners' }, { v: '5+', l: '5+ Owners' },
];
const BANNER_LABELS = [
  'Special Offer', 'Limited Time Offer', "Manager's Special", 'Below Market Value',
  'Weekend Deal', '5% Discount', '10% Discount', '15% Discount', 'Save £500', 'Save £1,000',
];
const RELATIONSHIP_OPTIONS = [
  'Son', 'Daughter', 'Sibling', 'Spouse', 'Executor of Will', 'Solicitor', 'Other',
];
// Matches web's NOT_OWNER_RELATIONSHIP_OPTIONS exactly (ListingWizard.tsx) —
// distinct from RELATIONSHIP_OPTIONS above, which is for the departed/estate
// sale case, a different question with a different option set.
const NOT_OWNER_RELATIONSHIP_OPTIONS = [
  'Family member', 'Friend', 'Employer', "Selling with owner's permission", 'Other',
];
const EURO_STANDARDS = ['EURO_4', 'EURO_5', 'EURO_6', 'EURO_6D'];
const WRITE_OFF_CATS = [
  { v: 'NONE', l: 'None' }, { v: 'CAT_S', l: 'Cat S' },
  { v: 'CAT_N', l: 'Cat N' }, { v: 'CAT_B', l: 'Cat B' },
  { v: 'CAT_A', l: 'Cat A' },
];
const PRESET_FEATURES = [
  'Navigation', 'Leather Seats', 'Heated Seats', 'Sunroof', 'Bluetooth',
  'Parking Sensors', 'Reverse Camera', 'Cruise Control', 'Climate Control',
  'Apple CarPlay', 'Android Auto', 'DAB Radio', 'LED Headlights', 'Alloy Wheels', 'Tow Bar',
];
// Source of truth for body-type icons app-wide — see src/constants/bodyTypes.ts
const BODY_TYPES = BODY_TYPE_ICONS.map(b => ({ v: b.value, l: b.label, icon: b.icon }));
const DAMAGE_TYPES = ['SCRATCH', 'SCUFF', 'DENT', 'CRACK', 'OTHER'];

const BADGES = [
  {
    id: 'FREE' as const, label: 'Auction', price: 'Free',
    sub: '£0 seller listing fee',
    listingType: 'AUCTION' as const,
    features: ['Open bidding', '24-hour auction', 'Anyone can bid'],
    negative: ['No trust badges'],
    accent: Colors.lightOrange_f97316,
  },
  {
    id: 'BASIC' as const, label: 'Basic', price: '£1',
    sub: 'Standard listing',
    listingType: 'CLASSIFIED' as const,
    features: ['Standard listing', 'Offer range system'],
    negative: ['No trust badges', 'No featured boost'],
    accent: Colors.white,
  },
  {
    id: 'STANDARD' as const, label: 'Standard', price: '£10',
    sub: 'Most popular',
    listingType: 'CLASSIFIED' as const,
    features: ['Everything in Basic', 'VIN Report badge', 'Verified Seller badge'],
    negative: ['No featured boost'],
    accent: Colors.infoBlue,
  },
  {
    id: 'PREMIUM' as const, label: 'Premium', price: '£25',
    sub: 'Best value',
    listingType: 'CLASSIFIED' as const,
    features: ['Everything in Standard', 'Featured boost (28 days)', 'Priority in search results', 'Featured badge on listing'],
    negative: [],
    accent: Colors.warning,
  },
];

type BadgeTier = 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM';
const { width: SW } = Dimensions.get('window');

// ─── Small helper components ──────────────────────────────────────────────────

const SL = ({ label, required }: { label: string; required?: boolean }) => (
  <Text style={s.sectionLabel}>{label}{required ? ' *' : ''}</Text>
);

function FieldInput({
  label, value, onChange, placeholder, keyboardType, multiline, required, hint, error
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean;
  required?: boolean; hint?: string; error?: string;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <SL label={label} required={required} />
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
      <TextInput
        style={[s.input, multiline && { height: 100, textAlignVertical: 'top', paddingTop: 12 }, error ? { borderColor: Colors.error } : null]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.borderMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCorrect={false}
      />
      {error ? <Text style={s.inlineError}>{error}</Text> : null}
    </View>
  );
}

// Searchable select-or-type field — used for Make/Model (mobile-production-
// readiness-plan.md F26). Web's equivalent is an HTML <select> with an
// "__other__" sentinel that reveals a free-text input; this adapts the same
// pick-from-list-or-type-your-own idea to a touch UI: a BottomSheet with a
// search box, a filtered list of known options, and an always-available
// "Use '<query>'" row so a value that isn't in the list (or an empty
// options list entirely, e.g. Model before Make is set to something with no
// known models) can still be entered directly.
function PickerField({
  label, value, onChange, options, placeholder, required, hint, error, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; required?: boolean;
  hint?: string; error?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;
  const exactMatch = options.some(o => o.toLowerCase() === query.trim().toLowerCase());

  const openSheet = () => {
    if (disabled) return;
    setQuery('');
    setOpen(true);
  };

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <SL label={label} required={required} />
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
      <TouchableOpacity
        style={[s.input, s.pickerFieldInput, error ? { borderColor: Colors.error } : null, disabled && { opacity: 0.5 }]}
        onPress={openSheet}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Text style={value ? s.pickerFieldValue : s.pickerFieldPlaceholder} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
      </TouchableOpacity>
      {error ? <Text style={s.inlineError}>{error}</Text> : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label.replace(' *', '')} avoidKeyboard>
        <TextInput
          style={s.pickerSearchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={options.length ? 'Search or type your own…' : 'Type it in…'}
          placeholderTextColor={Colors.borderMuted}
          autoCorrect={false}
          autoFocus
        />
        <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
          {!!query.trim() && !exactMatch && (
            <TouchableOpacity style={s.pickerOptionRow} onPress={() => select(query.trim())} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
              <Text style={[s.pickerOptionText, { color: Colors.accent }]}>Use "{query.trim()}"</Text>
            </TouchableOpacity>
          )}
          {filtered.map(opt => (
            <TouchableOpacity key={opt} style={s.pickerOptionRow} onPress={() => select(opt)} activeOpacity={0.7}>
              <Text style={s.pickerOptionText}>{opt}</Text>
              {value === opt && <Ionicons name="checkmark" size={16} color={Colors.accent} />}
            </TouchableOpacity>
          ))}
          {!filtered.length && !query.trim() && (
            <Text style={s.pickerEmptyText}>No preset list for this — type your own above.</Text>
          )}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function PillRow<T extends string>({
  label, options, value, onSelect, required, error
}: {
  label: string; options: { v: T; l: string }[]; value: T | '';
  onSelect: (v: T) => void; required?: boolean; error?: string;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <SL label={label} required={required} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map(o => (
          <TouchableOpacity
            key={o.v}
            style={[s.pill, value === o.v && s.pillActive]}
            onPress={() => onSelect(o.v)}
            activeOpacity={0.7}
          >
            <Text style={[s.pillText, value === o.v && s.pillTextActive]}>{o.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {error ? <Text style={s.inlineError}>{error}</Text> : null}
    </View>
  );
}

function YesNoRow({
  label, value, onChange, required, error
}: {
  label: string; value: boolean | null;
  onChange: (v: boolean) => void; required?: boolean; error?: string;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <SL label={label} required={required} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[true, false].map(b => (
          <TouchableOpacity
            key={String(b)}
            style={[s.yesno, value === b && s.yesnoActive]}
            onPress={() => onChange(b)}
            activeOpacity={0.7}
          >
            <Text style={[s.yesnoText, value === b && s.yesnoTextActive]}>{b ? 'Yes' : 'No'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={s.inlineError}>{error}</Text> : null}
    </View>
  );
}

function DVLAField({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.dvlaField}>
      <Text style={s.dvlaFieldLabel}>{label}</Text>
      <Text style={s.dvlaFieldValue}>{value || '—'}</Text>
    </View>
  );
}

function SectionBox({ title, children, accent, action }: {
  title: string; children: React.ReactNode; accent?: string; action?: React.ReactNode;
}) {
  return (
    <View style={s.sectionBox}>
      <View style={[s.sectionBoxHeader, accent ? { borderLeftColor: accent } : {}]}>
        <Text style={s.sectionBoxTitle}>{title}</Text>
        {action && <View style={{ marginLeft: 'auto' }}>{action}</View>}
      </View>
      <View style={s.sectionBoxBody}>{children}</View>
    </View>
  );
}

// ─── Interactive Damage Map ───────────────────────────────────────────────────

function Damage3DMapper({
  records, onAdd, onRemove, onHide, onPhoto, bodyTypeLabel,
}: {
  records: DamageEntry[];
  onAdd: (entry: DamageEntry) => void;
  onRemove: (id: string) => void;
  onHide: (zoneId: string) => void;
  onPhoto: (zoneId: string, uri: string) => void;
  bodyTypeLabel?: string;
}) {
  const [addingZone, setAddingZone] = useState<string | null>(null);
  const [dmgType, setDmgType] = useState<DamageEntry['type']>('SCRATCH');
  const [dmgDesc, setDmgDesc] = useState('');
  const [customZoneText, setCustomZoneText] = useState('');

  function confirmAdd() {
    if (!addingZone) return;
    onAdd({
      id: `${Date.now()}`,
      zone: addingZone,
      type: dmgType,
      description: dmgDesc.trim(),
    });
    setAddingZone(null);
    setDmgType('SCRATCH');
    setDmgDesc('');
  }

  const markedLabels = records.map(r => r.zone);

  return (
    <View>
      {/* 3D vehicle viewer with tappable damage hotspots */}
      <ThreeDVehicleViewer
        zones={DAMAGE_ZONES_3D}
        selectedZone={addingZone}
        markedZones={markedLabels}
        onZoneClick={zoneLabel => setAddingZone(zoneLabel)}
        onZoneHide={onHide}
        onZonePhoto={onPhoto}
        bodyTypeLabel={bodyTypeLabel}
      />

      {/* Quick-add button list — every zone the web app offers, for faster
          input than hunting for a precise spot on the 3D model */}
      <View style={{ marginTop: 16 }}>
        {DAMAGE_ZONE_SECTIONS.map(section => (
          <View key={section} style={{ marginBottom: 14 }}>
            <SL label={section.toUpperCase()} />
            <View style={s.zoneChipRow}>
              {DAMAGE_ZONES_3D.filter(z => z.section === section).map(zone => {
                const isMarked = markedLabels.includes(zone.label);
                // Selected (currently being marked, form not yet confirmed)
                // gets the same red treatment as marked — the pill previously
                // gave zero feedback on tap, only turning red after the
                // inline form was filled in and confirmed.
                const isSelected = addingZone === zone.label;
                return (
                  <TouchableOpacity
                    key={zone.id}
                    style={[s.pill, (isMarked || isSelected) && s.pillActive]}
                    onPress={() => setAddingZone(zone.label)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.pillText, (isMarked || isSelected) && s.pillTextActive]}>{zone.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Free-text zone for anything not covered above */}
        <View>
          <SL label="OTHER DAMAGE AREA" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={customZoneText}
              onChangeText={setCustomZoneText}
              placeholder="e.g. Interior — Driver Seat, Engine Bay..."
              placeholderTextColor={Colors.iconMuted}
            />
            <TouchableOpacity
              style={[s.pill, { justifyContent: 'center', paddingHorizontal: 18 }, !customZoneText.trim() && { opacity: 0.5 }]}
              disabled={!customZoneText.trim()}
              onPress={() => {
                setAddingZone(customZoneText.trim());
                setCustomZoneText('');
              }}
              activeOpacity={0.7}
            >
              <Text style={s.pillText}>Mark</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.zoneHint}>Not in the list above? Type any area and press Mark to describe the damage.</Text>
        </View>
      </View>

      {/* Inline add form */}
      {addingZone && (
        <View style={s.dmgForm}>
          <Text style={s.dmgFormTitle}>Mark damage: <Text style={{ color: Colors.accent }}>{addingZone}</Text></Text>
          <SL label="DAMAGE TYPE" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
            {DAMAGE_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[s.pill, dmgType === t && s.pillActive]}
                onPress={() => setDmgType(t as DamageEntry['type'])}
                activeOpacity={0.7}
              >
                <Text style={[s.pillText, dmgType === t && s.pillTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <SL label="DESCRIPTION (optional)" />
          <TextInput
            style={[s.input, { marginBottom: 12 }]}
            value={dmgDesc}
            onChangeText={setDmgDesc}
            placeholder="e.g. Small scratch on lower section"
            placeholderTextColor={Colors.borderMuted}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[s.pill, { flex: 1, justifyContent: 'center', paddingVertical: 12 }]} onPress={() => setAddingZone(null)} activeOpacity={0.8}>
              <Text style={s.pillText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.pill, s.pillActive, { flex: 2, justifyContent: 'center', paddingVertical: 12 }]} onPress={confirmAdd} activeOpacity={0.8}>
              <Text style={s.pillTextActive}>MARK DAMAGE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Damage list */}
      {records.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <SL label={`DAMAGE RECORDS (${records.length})`} />
          {records.map(r => (
            <View key={r.id} style={s.dmgRecord}>
              <View style={{ flex: 1 }}>
                <Text style={s.dmgRecordZone}>{r.zone}</Text>
                <Text style={s.dmgRecordMeta}>{r.type}{r.description ? ` · ${r.description}` : ''}</Text>
              </View>
              <IconButton
                icon={<Ionicons name="trash-outline" size={16} color={Colors.accent} />}
                accessibilityLabel={`Remove damage record for ${r.zone}`}
                onPress={() => onRemove(r.id)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const SellCarFlowScreen: React.FC<{ navigation?: any; route?: any }> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [step, setStep] = useState<Step>(1);

  // ── Step 1 — Vehicle Details ──
  const [vehicleType, setVehicleType] = useState<'CAR' | 'HGV' | 'MOTORCYCLE'>('CAR');
  const [vrm, setVrm] = useState('');
  const [dvlaLoading, setDvlaLoading] = useState(false);
  const [dvlaFetched, setDvlaFetched] = useState(false);
  // DVLA / Registration & Compliance
  const [vin, setVin] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [motStatus, setMotStatus] = useState('');
  const [motExpiry, setMotExpiry] = useState('');
  const [taxStatus, setTaxStatus] = useState('');
  const [taxDue, setTaxDue] = useState('');
  const [firstRegistered, setFirstRegistered] = useState('');
  const [lastV5C, setLastV5C] = useState('');
  const [wheelplan, setWheelplan] = useState('');
  const [typeApproval, setTypeApproval] = useState('');
  // Read-only buyer-trust signal, mirrors web's "MOT History" list — display
  // only, never sent in any payload (backend has no field for it on Listing).
  const [motHistory, setMotHistory] = useState<Array<{
    completedDate: string;
    testResult: 'PASSED' | 'FAILED';
    odometerValue?: string;
    odometerUnit?: string;
    defects?: Array<{ text: string; type: string }>;
  }>>([]);
  // Model Details
  const [variant, setVariant] = useState('');
  const [driveType, setDriveType] = useState('');
  const [serviceHistory, setServiceHistory] = useState('');
  const [numberOfKeys, setNumberOfKeys] = useState('');
  // Performance
  const [zeroTo60, setZeroTo60] = useState('');
  const [topSpeed, setTopSpeed] = useState('');
  const [torque, setTorque] = useState('');
  const [combinedMpg, setCombinedMpg] = useState('');
  const [extraUrbanMpg, setExtraUrbanMpg] = useState('');
  // Body & Location
  const [bodyType, setBodyType] = useState('');
  const [location, setLocation] = useState('');
  // Technical Specs
  const [mileage, setMileage] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [transmission, setTransmission] = useState('');
  const [colour, setColour] = useState('');
  const [engineSize, setEngineSize] = useState('');
  const [bhp, setBhp] = useState('');
  const [doors, setDoors] = useState('');
  const [seats, setSeats] = useState('');
  // UK Compliance
  const [ulezCompliant, setUlezCompliant] = useState<boolean | null>(null);
  const [euroStandard, setEuroStandard] = useState('');
  const [co2Emissions, setCo2Emissions] = useState('');
  // Features & Description
  const [features, setFeatures] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  // Ownership
  const [owners, setOwners] = useState('');
  const [isImported, setIsImported] = useState(false);
  const [markedForExport, setMarkedForExport] = useState(false);
  const [condition, setCondition] = useState('');
  const [isDepartedSale, setIsDepartedSale] = useState(false);
  const [departedRelSelect, setDepartedRelSelect] = useState('');
  const [departedRelOther, setDepartedRelOther] = useState('');
  const departedRelationship = departedRelSelect === 'Other' ? departedRelOther : departedRelSelect;
  // Legal declarations
  const [writeOffCat, setWriteOffCat] = useState('');
  const [stolenRecovered, setStolenRecovered] = useState<boolean | null>(null);
  const [outstandingFinance, setOutstandingFinance] = useState<boolean | null>(null);
  const [isLegalKeeper, setIsLegalKeeper] = useState<boolean | null>(null);
  const [notOwnerRelSelect, setNotOwnerRelSelect] = useState('');
  const [notOwnerRelOther, setNotOwnerRelOther] = useState('');
  const notOwnerRelationship = notOwnerRelSelect === 'Other' ? notOwnerRelOther : notOwnerRelSelect;
  const [declAcknowledged, setDeclAcknowledged] = useState(false);

  // ── Step 2 — Media ──
  const [photoTab, setPhotoTab] = useState<'Exterior' | 'Interior' | 'Damage'>('Exterior');
  const [exteriorImages, setExteriorImages] = useState<string[]>([]);
  const [interiorImages, setInteriorImages] = useState<string[]>([]);
  const [damageImages, setDamageImages] = useState<string[]>([]);
  const [damageRecords, setDamageRecords] = useState<DamageEntry[]>([]);
  const [hiddenZoneIds, setHiddenZoneIds] = useState<string[]>([]);
  const [zonePhotos, setZonePhotos] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [videoInput, setVideoInput] = useState('');

  // ── Step 3 — Pricing ──
  const [priceMin, setPriceMin] = useState('');
  const [priceAsking, setPriceAsking] = useState('');
  const [bannerLabel, setBannerLabel] = useState('');
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [deliveryMaxMiles, setDeliveryMaxMiles] = useState('');
  const [deliveryPricePerMile, setDeliveryPricePerMile] = useState('');
  const [badgeTier, setBadgeTier] = useState<BadgeTier>('BASIC');
  const [listingType, setListingType] = useState<'CLASSIFIED' | 'AUCTION'>('CLASSIFIED');

  // ── HPI Report unlock (Review step) — mirrors web's HpiPaymentModal ──
  // A listing has to exist before an HPI check can be run against it. If the
  // user hasn't published yet, unlocking HPI creates a DRAFT listing early
  // (same as web does) and remembers its id here — kept separate from
  // editListingId/editMode so it doesn't retrigger the heavy edit-prefill
  // effect. handlePublish below treats this draft the same way it treats an
  // existing edit target: PATCH it rather than creating a second listing.
  const [hpiDraftListingId, setHpiDraftListingId] = useState<string | null>(null);
  const [hpiUnlocking, setHpiUnlocking] = useState(false);
  const [hpiUnlocked, setHpiUnlocked] = useState(false);
  const [hpiSummary, setHpiSummary] = useState<{ isClear?: boolean } | null>(null);

  // ── Step 4 — Auction Schedule (only when listingType=AUCTION) ──
  const [auctionStartMode, setAuctionStartMode] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [auctionStartDate, setAuctionStartDate] = useState('');
  const [reservePrice, setReservePrice] = useState('');
  const [startingBid, setStartingBid] = useState('');
  const [minIncrement, setMinIncrement] = useState('100');

  // ── Per-image upload progress ──
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // ── Publishing ──
  const [isPublishing, setIsPublishing] = useState(false);
  const [editMode] = useState<boolean>(!!(route?.params?.listingId));
  const [editListingId] = useState<string | null>(route?.params?.listingId ?? null);
  // Gates the form while the existing listing loads in edit mode — without this,
  // editing a listing used to open a blank form and Save would silently overwrite
  // the real listing with defaults (mobile-audit.md, critical finding).
  const [editLoading, setEditLoading] = useState<boolean>(!!(route?.params?.listingId));

  // ── Draft persistence ──
  const { updateDraft, clearDraft } = useSellWizardStore();

  // ── Inline validation (Step 1 user-entered fields, Step 3 pricing) ──
  // Touched tracks whether user has interacted with a field (blur or change after focus)
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const fieldTouched = (key: string) => () => setTouched(prev => ({ ...prev, [key]: true }));
  // Shared across steps since only one step's ScrollView is ever mounted at a time.
  const stepScrollRef = useRef<ScrollView>(null);

  // ── Draft hydration — offer resume after app restart ─────────────────────────
  useEffect(() => {
    // Only show resume prompt for new listings, not edits
    if (editMode) return;
    const unsub = useSellWizardStore.persist.onFinishHydration(() => {
      const store = useSellWizardStore.getState();
      if (store.make || store.model || store.lastStep > 1) {
        Alert.alert(
          'Resume draft?',
          'You have an unsaved listing. Continue where you left off?',
          [
            {
              text: 'Start fresh',
              onPress: clearDraft,
              style: 'cancel',
            },
            {
              text: 'Resume',
              onPress: () => {
                if (store.make) setMake(store.make);
                if (store.model) setModel(store.model);
                if (store.year) setYear(store.year);
                if (store.mileage) setMileage(store.mileage);
                if (store.title) setTitle(store.title);
                if (store.fuelType) setFuelType(store.fuelType);
                if (store.transmission) setTransmission(store.transmission);
                if (store.bodyType) setBodyType(store.bodyType);
                if (store.colour) setColour(store.colour);
                if (store.price) setPriceAsking(store.price);
                if (store.listingType) setListingType(store.listingType as 'CLASSIFIED' | 'AUCTION');
                if (store.exteriorImages.length > 0) setExteriorImages(store.exteriorImages);
                if (store.interiorImages.length > 0) setInteriorImages(store.interiorImages);
                if (store.damageImages.length > 0) setDamageImages(store.damageImages);
                if (store.lastStep > 1) setStep(store.lastStep as Step);
              },
            },
          ],
        );
      }
    });
    return () => unsub();
  }, []);

  // ── Edit mode — prefill the form from the existing listing ─────────────────
  // Mirrors ListingWizard.tsx's edit-prefill effect (web). Without this, opening
  // an existing listing for edit showed a blank form and Save (a real PATCH)
  // silently overwrote the listing with defaults.
  useEffect(() => {
    if (!editMode || !editListingId) return;
    let cancelled = false;

    (async () => {
      try {
        const l = await getRawListingById(editListingId);
        if (!l || cancelled) return;

        if (l.vin) setVin(String(l.vin));
        if (l.vehicleType) setVehicleType(l.vehicleType);
        setMake(l.make ?? '');
        setModel(l.model ?? '');
        if (l.year) setYear(String(l.year));
        if (l.motStatus) setMotStatus(String(l.motStatus));
        if (l.motExpiryDate) setMotExpiry(String(l.motExpiryDate));
        if (l.taxStatus) setTaxStatus(String(l.taxStatus));
        if (l.taxDueDate) setTaxDue(String(l.taxDueDate));
        if (l.monthOfFirstRegistration) setFirstRegistered(String(l.monthOfFirstRegistration));
        if (l.wheelplan) setWheelplan(String(l.wheelplan));
        if (l.typeApproval) setTypeApproval(String(l.typeApproval));
        setVariant(l.variant ?? '');
        if (l.driveType) setDriveType(String(l.driveType));
        if (l.serviceHistory) setServiceHistory(String(l.serviceHistory));
        if (l.numberOfKeys != null) setNumberOfKeys(String(l.numberOfKeys));
        if (l.zeroTo60Mph != null) setZeroTo60(String(l.zeroTo60Mph));
        if (l.topSpeedMph != null) setTopSpeed(String(l.topSpeedMph));
        if (l.torqueNm != null) setTorque(String(l.torqueNm));
        if (l.combinedMpg != null) setCombinedMpg(String(l.combinedMpg));
        if (l.extraUrbanMpg != null) setExtraUrbanMpg(String(l.extraUrbanMpg));
        setBodyType(l.bodyType ?? '');
        setLocation(l.location ?? '');
        if (l.mileage != null) setMileage(String(l.mileage));
        if (l.fuelType) setFuelType(l.fuelType);
        if (l.transmission) setTransmission(l.transmission);
        setColour(l.color ?? '');
        if (l.engineSize != null) setEngineSize(String(l.engineSize));
        if (l.bhp != null) setBhp(String(l.bhp));
        if (l.doors != null) setDoors(String(l.doors));
        if (l.seats != null) setSeats(String(l.seats));
        if (l.ulezCompliant != null) setUlezCompliant(!!l.ulezCompliant);
        if (l.euroStandard) setEuroStandard(String(l.euroStandard));
        if (l.co2Emissions != null) setCo2Emissions(String(l.co2Emissions));
        setFeatures(l.features ?? []);
        setTitle(l.title ?? '');
        setDescription(l.description ?? '');
        if (l.owners != null) setOwners(String(l.owners));
        setIsImported(!!l.isImported);
        setMarkedForExport(!!l.markedForExport);
        setIsDepartedSale(!!l.isDepartedSale);
        if (l.departedRelationship) {
          const opt = RELATIONSHIP_OPTIONS.find(o => o === l.departedRelationship);
          if (opt) { setDepartedRelSelect(opt); } else { setDepartedRelSelect('Other'); setDepartedRelOther(String(l.departedRelationship)); }
        }
        setWriteOffCat(l.writeOffCategory ?? '');
        if (l.stolenRecovered != null) setStolenRecovered(!!l.stolenRecovered);
        if (l.hasOutstandingFinance != null) setOutstandingFinance(!!l.hasOutstandingFinance);
        if (l.isLegalRegisteredKeeper != null) setIsLegalKeeper(!!l.isLegalRegisteredKeeper);
        if (l.notOwnerRelationship) {
          const opt = NOT_OWNER_RELATIONSHIP_OPTIONS.find(o => o === l.notOwnerRelationship);
          if (opt) { setNotOwnerRelSelect(opt); } else { setNotOwnerRelSelect('Other'); setNotOwnerRelOther(String(l.notOwnerRelationship)); }
        }
        // Editing an already-published listing implies the declaration was
        // already made and accepted at initial publish time.
        setDeclAcknowledged(true);
        // The three photo tabs (Exterior/Interior/Damage) are flattened into one
        // `images` array server-side with no category preserved — put everything
        // under Exterior so nothing is lost; the seller can still remove/re-add.
        if (l.images?.length) setExteriorImages(l.images);
        if (l.videoUrls?.length) setVideoUrls(l.videoUrls);
        if (l.priceMin != null) setPriceMin(String(l.priceMin));
        setPriceAsking(l.price != null ? String(l.price) : '');
        setBannerLabel(l.bannerLabel ?? '');
        if (l.deliveryAvailable) {
          setDeliveryAvailable(true);
          if (l.deliveryMaxMiles != null) setDeliveryMaxMiles(String(l.deliveryMaxMiles));
          if (l.deliveryPricePerMile != null) setDeliveryPricePerMile(String(l.deliveryPricePerMile));
        }
        if (l.badgeTier && l.badgeTier !== 'FREE') setBadgeTier(l.badgeTier);
        if (l.linkedListing?.type === 'AUCTION' || (l as any).type === 'AUCTION') setListingType('AUCTION');

        // Load existing damage records (separate endpoint, not part of /listings).
        try {
          const dmgRes = await apiClient<{ success: boolean; data: any[] }>(`/damage/${editListingId}`);
          const records = dmgRes?.data ?? [];
          if (records.length && !cancelled) {
            const mappedEntries: DamageEntry[] = [];
            // Note: the backend's damageRecord model has no `hidden` column, so
            // that toggle has never been persisted — nothing to restore here.
            const nextPhotos: Record<string, string> = {};
            records.forEach((r: any) => {
              const zone = DAMAGE_ZONES_3D.find(z => z.id === r.part);
              mappedEntries.push({
                id: `${r.part}-${Date.now()}-${Math.random()}`,
                zone: zone?.label ?? r.part,
                type: (r.type as DamageEntry['type']) || 'OTHER',
                description: '',
              });
              if (zone && r.imageUrl) nextPhotos[zone.id] = r.imageUrl;
            });
            setDamageRecords(mappedEntries);
            if (Object.keys(nextPhotos).length) setZonePhotos(nextPhotos);
          }
        } catch (err) {
          console.warn(`Failed to load damage records for listing ${editListingId}:`, err);
        }

        setStep(1);
      } catch (err) {
        console.error('Failed to load listing for edit:', err);
        Alert.alert('Could not load listing', 'Failed to load this listing for editing. Please try again.');
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [editMode, editListingId]);

  // Core per-field validation — returns null (valid) or an error string
  // (invalid), regardless of touched state. Split out from fieldError() so
  // touchAndCheck() (below) can check a field's real validity at the moment
  // it force-touches it, instead of going through the touched-gated wrapper
  // and reading the pre-update `touched` state from its own render closure.
  const fieldErrorRaw = (key: string): string | null => {
    if (key === 'priceAsking') {
      const v = parseFloat(priceAsking.replace(/[^0-9.]/g, ''));
      if (!priceAsking.trim() || isNaN(v) || v <= 0) return 'Enter a valid asking price (e.g. 12500)';
    }
    if (key === 'priceMin') {
      if (!priceMin.trim()) return null; // optional field
      const v = parseFloat(priceMin.replace(/[^0-9.]/g, ''));
      if (isNaN(v) || v < 0) return 'Enter a valid price or leave blank';
    }
    if (key === 'mileage') {
      const v = parseInt(mileage.replace(/[^0-9]/g, ''), 10);
      if (!mileage.trim() || isNaN(v) || v < 0) return 'Enter a non-negative mileage';
    }
    if (key === 'title') {
      if (!title.trim()) return 'Listing title is required';
    }
    if (key === 'make' && !make.trim()) return 'Required';
    if (key === 'model' && !model.trim()) return 'Required';
    if (key === 'year' && !year.trim()) return 'Required';
    if (key === 'condition' && !condition) return 'Required';
    if (key === 'owners' && !owners) return 'Required';
    if (key === 'departedRelationship' && isDepartedSale && !departedRelationship.trim()) return 'Required';
    if (key === 'writeOffCat' && !writeOffCat) return 'Required';
    if (key === 'stolenRecovered' && stolenRecovered === null) return 'Required';
    if (key === 'outstandingFinance' && outstandingFinance === null) return 'Required';
    if (key === 'isLegalKeeper' && isLegalKeeper === null) return 'Required';
    if (key === 'notOwnerRelationship' && isLegalKeeper === false && !notOwnerRelationship.trim()) return 'Please select your relationship to the registered keeper.';
    if (key === 'declAcknowledged' && !declAcknowledged) return 'You must acknowledge this declaration to continue';
    if (key === 'auctionStartDate' && auctionStartMode === 'SCHEDULED' && !auctionStartDate.trim()) return 'Required';
    if (key === 'reservePrice' && (!reservePrice.trim() || parseFloat(reservePrice) <= 0)) return 'Enter a valid reserve price';
    if (key === 'startingBid' && (!startingBid.trim() || parseFloat(startingBid) <= 0)) return 'Enter a valid starting bid';
    if (key === 'minIncrement' && (!minIncrement.trim() || parseFloat(minIncrement) <= 0)) return 'Enter a valid minimum increment';
    return null;
  };

  // Touched-gated wrapper — used everywhere the UI should only show an error
  // after the user has actually interacted with that specific field (inline
  // error text, border color). Do NOT use this inside touchAndCheck(); see
  // fieldErrorRaw's comment above.
  const fieldError = (key: string): string | null => {
    if (!touched[key]) return null;
    return fieldErrorRaw(key);
  };

  // All field keys validated per step — used to force every field's error to show
  // (mark touched) when Next is tapped, and to know which keys to check.
  const STEP1_FIELD_KEYS = ['make', 'model', 'year', 'mileage', 'title', 'condition', 'owners', 'departedRelationship', 'writeOffCat', 'stolenRecovered', 'outstandingFinance', 'isLegalKeeper', 'notOwnerRelationship', 'declAcknowledged'];
  const STEP3_FIELD_KEYS = ['priceAsking'];
  const STEP4_AUCTION_FIELD_KEYS = ['auctionStartDate', 'reservePrice', 'startingBid', 'minIncrement'];

  // Border color helper
  const fieldBorderColor = (key: string): string => {
    if (!touched[key]) return Colors.inputBorder;
    return fieldError(key) ? Colors.error : Colors.success;
  };

  // Step 1 has invalid touched fields?
  const step1HasErrors = (): boolean => {
    return !!fieldError('mileage') || !!fieldError('title');
  };

  // Step 3 has invalid touched fields?
  const step3HasErrors = (): boolean => {
    return !!fieldError('priceAsking') || !!fieldError('priceMin');
  };

  const allImages = [...exteriorImages, ...interiorImages, ...damageImages];

  // ─── DVLA Auto-submit handler ─────────────────────────────────────────────────

  const handlePlateChange = (raw: string) => {
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setVrm(cleaned);
    if (cleaned.length >= 7 && cleaned.length <= 8 && !dvlaFetched && !dvlaLoading) {
      handleDvlaLookup(cleaned);
    }
  };

  // ─── DVLA Lookup ─────────────────────────────────────────────────────────────

  async function handleDvlaLookup(override?: string) {
    const clean = (override ?? vrm).replace(/\s/g, '').toUpperCase();
    if (!clean) return Alert.alert('Enter a registration', 'Please enter a UK registration number.');
    setDvlaLoading(true);
    try {
      const data = await apiClient<any>('/dvla/lookup', {
        method: 'POST',
        body: JSON.stringify({ vrm: clean }),
      });
      // Use String() on every field — the backend might return nested objects for some fields
      if (data.make) setMake(String(data.make));
      if (data.model) setModel(String(data.model));
      if (data.year) setYear(String(data.year));
      if (data.colour) setColour(String(data.colour));
      if (data.primaryColour) setColour(String(data.primaryColour));
      if (data.engineSize) setEngineSize(String(data.engineSize));
      if (data.fuelType) setFuelType(String(data.fuelType));
      if (data.transmission) setTransmission(String(data.transmission));
      if (data.euroStandard) setEuroStandard(String(data.euroStandard));
      if (data.co2Emissions) setCo2Emissions(String(data.co2Emissions));
      if (data.motStatus) setMotStatus(String(data.motStatus));
      if (data.taxStatus) setTaxStatus(String(data.taxStatus));
      if (data.motExpiryDate) setMotExpiry(String(data.motExpiryDate));
      if (data.taxDueDate) setTaxDue(String(data.taxDueDate));
      if (data.markedForExport !== undefined) setMarkedForExport(!!data.markedForExport);
      if (data.monthOfFirstRegistration) setFirstRegistered(String(data.monthOfFirstRegistration));
      if (data.wheelplan) setWheelplan(String(data.wheelplan));
      if (data.typeApproval) setTypeApproval(String(data.typeApproval));
      if (data.dateOfLastV5CIssued) setLastV5C(String(data.dateOfLastV5CIssued));
      if (Array.isArray(data.motHistory)) setMotHistory(data.motHistory);
      setDvlaFetched(true);
    } catch (err: any) {
      Alert.alert('DVLA Lookup Failed', err.message || 'Could not fetch vehicle data. Fill in details manually.');
    } finally {
      setDvlaLoading(false);
    }
  }

  // ─── AI Description ───────────────────────────────────────────────────────────

  async function handleGenerateDescription() {
    if (!make || !model) return Alert.alert('Incomplete', 'Enter Make & Model first.');
    setAiGenerating(true);
    try {
      const res = await apiClient<any>('/ai/generate-description', {
        method: 'POST',
        body: JSON.stringify({
          make, model, year, mileage, fuelType, transmission, color: colour, features, vrm, motStatus,
          condition, bodyType, serviceHistory, owners, engineSize,
        }),
      });
      // API may return { data: { text: "..." } } or { text: "..." } directly
      const text = String(res?.data?.text || res?.text || '');
      if (text) setDescription(text);
    } catch {
      Alert.alert('Failed', 'Could not generate description. Write one manually.');
    } finally {
      setAiGenerating(false);
    }
  }

  // ─── Damage zone hide / photo (from the 3D viewer's action pill) ──────────────
  function handleZoneHide(zoneId: string) {
    setHiddenZoneIds(prev => prev.includes(zoneId) ? prev.filter(id => id !== zoneId) : [...prev, zoneId]);
  }
  function handleZonePhoto(zoneId: string, uri: string) {
    setZonePhotos(prev => ({ ...prev, [zoneId]: uri }));
  }

  // ─── Photo Handling ───────────────────────────────────────────────────────────

  /**
   * Upload a single image with per-image progress tracking.
   * Shows 0 → 50 (post-compress) → 100 progress on the thumbnail.
   * Returns a Supabase public URL (https://), never a local file:// URI.
   */
  async function uploadImage(localUri: string, category: string, index: number): Promise<string> {
    const id = `${category}-${index}`;
    setUploadProgress(prev => ({ ...prev, [id]: 0 }));
    const jpegUri = await convertAndCompress(localUri);
    setUploadProgress(prev => ({ ...prev, [id]: 50 }));
    const userId = useAuthStore.getState().user?.id ?? 'anon';
    const filename = `${userId}/${category}/${Date.now()}-${index}.jpg`;
    const url = await uploadToStorage(jpegUri, 'listings', filename, 'image/jpeg');
    setUploadProgress(prev => ({ ...prev, [id]: 100 }));
    return url;
  }

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsMultipleSelection: true,
      quality: 1.0, // raw quality — convertAndCompress handles compression
    });
    if (result.canceled) return;
    setUploadingPhoto(true);
    try {
      const category = photoTab.toLowerCase();
      // Determine starting index for unique progress IDs
      const startIndex = (
        photoTab === 'Exterior' ? exteriorImages :
        photoTab === 'Interior' ? interiorImages :
        damageImages
      ).length;

      const urls: string[] = [];
      for (let i = 0; i < result.assets.length; i++) {
        const url = await uploadImage(result.assets[i].uri, category, startIndex + i);
        urls.push(url);
      }
      if (photoTab === 'Exterior') setExteriorImages(p => [...p, ...urls]);
      else if (photoTab === 'Interior') setInteriorImages(p => [...p, ...urls]);
      else setDamageImages(p => [...p, ...urls]);
    } catch {
      Alert.alert('Upload failed', 'Could not upload one or more photos. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function removePhoto(tab: string, uri: string) {
    if (tab === 'Exterior') setExteriorImages(p => p.filter(x => x !== uri));
    else if (tab === 'Interior') setInteriorImages(p => p.filter(x => x !== uri));
    else setDamageImages(p => p.filter(x => x !== uri));
  }

  function handleAddVideoUrl() {
    const url = videoInput.trim();
    if (!url.startsWith('http')) return;
    if (videoUrls.includes(url)) { setVideoInput(''); return; }
    if (videoUrls.length >= 5) return;
    setVideoUrls(p => [...p, url]);
    setVideoInput('');
  }

  // ─── Validation ───────────────────────────────────────────────────────────────

  const isAuction = listingType === 'AUCTION';
  const totalSteps = isAuction ? 5 : 4;

  // Marks every field relevant to a step as touched (forcing fieldError() to
  // evaluate/show for all of them, not just ones the user already blurred),
  // then reports whether any of them actually have an error.
  function touchAndCheck(keys: string[]): boolean {
    setTouched(prev => {
      const next = { ...prev };
      for (const k of keys) next[k] = true;
      return next;
    });
    // fieldErrorRaw, not fieldError — the setTouched above hasn't landed yet
    // in this render, so fieldError's own `touched` guard would still see
    // the pre-update state and silently report "no error" for any field the
    // user hadn't already individually focused+blurred.
    return keys.some(k => fieldErrorRaw(k) != null);
  }

  function validateStep(s: Step): boolean {
    if (s === 1) {
      if (touchAndCheck(STEP1_FIELD_KEYS)) {
        stepScrollRef.current?.scrollTo({ y: 0, animated: true });
        return false;
      }
      // Cross-field business rule (not a per-field "required" validation) —
      // still a genuine blocking condition, kept as an alert per CLAUDE.md's
      // guidance that only inline "required" validation moves to inline errors.
      if ((writeOffCat === 'CAT_A' || writeOffCat === 'CAT_B') && !isAuction) {
        Alert.alert('Auction Only', 'Cat A and Cat B write-off vehicles can only be listed via auction. Select the Auction option in Step 3 Pricing.');
        return false;
      }
    }
    if (s === 3) {
      if (touchAndCheck(STEP3_FIELD_KEYS)) {
        stepScrollRef.current?.scrollTo({ y: 0, animated: true });
        return false;
      }
    }
    if (s === 4 && isAuction) {
      if (touchAndCheck(STEP4_AUCTION_FIELD_KEYS)) {
        stepScrollRef.current?.scrollTo({ y: 0, animated: true });
        return false;
      }
    }
    return true;
  }

  // ─── Listing Fee Payment ──────────────────────────────────────────────────────

  async function triggerListingFeePayment(listingId: string, tier: 'BASIC' | 'STANDARD' | 'PREMIUM'): Promise<boolean> {
    const amounts: Record<string, number> = { BASIC: 1, STANDARD: 10, PREMIUM: 25 };
    const amount = amounts[tier];
    const sheet = await createPaymentSheet({ listingId, amount, type: 'LISTING_FEE', currency: 'gbp', badgeTier: tier });
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: 'Carmazium',
      customerId: sheet.customerId,
      customerEphemeralKeySecret: sheet.ephemeralKey,
      paymentIntentClientSecret: sheet.clientSecret,
      allowsDelayedPaymentMethods: false,
      appearance: {
        colors: {
          primary: Colors.accent,
          background: Colors.bgSecondaryAlt,
          componentBackground: Colors.deepBlue_18181f,
          componentBorder: Colors.whiteAlpha08Hex,
          componentDivider: Colors.whiteAlpha06Hex,
          primaryText: Colors.white,
          secondaryText: Colors.textSecondary,
          componentText: Colors.white,
          placeholderText: Colors.iconMuted,
          icon: Colors.textSecondary,
          error: Colors.accent,
        },
      },
    });
    if (initError) throw new Error(initError.message);

    const { error: presentError } = await presentPaymentSheet();
    if (presentError) {
      if (presentError.code !== 'Canceled') throw new Error(presentError.message);
      return false; // user cancelled
    }
    return true;
  }

  // ─── HPI Report Payment ────────────────────────────────────────────────────────

  async function triggerHpiPayment(listingId: string, reportVrm: string): Promise<boolean> {
    const sheet = await createPaymentSheet({ listingId, amount: 9.99, type: 'HPI_REPORT', currency: 'gbp', vrm: reportVrm });
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: 'Carmazium',
      customerId: sheet.customerId,
      customerEphemeralKeySecret: sheet.ephemeralKey,
      paymentIntentClientSecret: sheet.clientSecret,
      allowsDelayedPaymentMethods: false,
      appearance: {
        colors: {
          primary: Colors.accent,
          background: Colors.bgSecondaryAlt,
          componentBackground: Colors.deepBlue_18181f,
          componentBorder: Colors.whiteAlpha08Hex,
          componentDivider: Colors.whiteAlpha06Hex,
          primaryText: Colors.white,
          secondaryText: Colors.textSecondary,
          componentText: Colors.white,
          placeholderText: Colors.iconMuted,
          icon: Colors.textSecondary,
          error: Colors.accent,
        },
      },
    });
    if (initError) throw new Error(initError.message);

    const { error: presentError } = await presentPaymentSheet();
    if (presentError) {
      if (presentError.code !== 'Canceled') throw new Error(presentError.message);
      return false; // user cancelled
    }
    return true;
  }

  async function handleUnlockHpi() {
    if (!vrm.trim()) {
      Alert.alert('Registration required', 'Enter the vehicle\'s registration (VRM) above first.');
      return;
    }
    setHpiUnlocking(true);
    try {
      let listingId = editListingId ?? hpiDraftListingId;
      if (!listingId) {
        const draft = await apiClient<{ success: boolean; data: { id: string } }>('/listings', {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim() || `${make} ${model} ${year}`.trim() || vrm,
            price: parseFloat(priceAsking) || 1,
            mileage: parseInt(mileage) || 0,
            year: parseInt(year) || new Date().getFullYear(),
            vrm,
            images: exteriorImages,
            listingType,
            make: make || undefined,
            model: model || undefined,
            status: 'DRAFT',
            badgeTier,
            vehicleType,
          }),
        });
        listingId = draft?.data?.id ?? null;
        if (!listingId) throw new Error('Could not save a draft listing to run the check against.');
        setHpiDraftListingId(listingId);
      }

      const paid = await triggerHpiPayment(listingId, vrm);
      if (!paid) return; // user cancelled — not an error

      // Report generation happens async off the Stripe webhook — poll briefly
      // for it rather than assuming it's ready the instant the sheet closes.
      // (React state isn't readable synchronously after setHpiUnlocked below,
      // hence the local flag rather than checking hpiUnlocked post-loop.)
      let found = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const res = await apiClient<{ success: boolean; data: { isClear?: boolean } }>(
            `/hpi/listing/${listingId}/summary`,
          );
          if (res?.success && res.data) {
            setHpiSummary(res.data);
            setHpiUnlocked(true);
            found = true;
            break;
          }
        } catch {
          // not ready yet — keep polling
        }
      }
      if (!found) {
        // Payment succeeded even if the report isn't back yet — don't block
        // the seller, just show it as pending rather than failed.
        Alert.alert('Payment received', 'Your HPI check is being generated and will appear shortly.');
      }
    } catch (err: any) {
      Alert.alert('HPI Check failed', err?.message ?? 'Please try again.');
    } finally {
      setHpiUnlocking(false);
    }
  }

  // ─── Publish ─────────────────────────────────────────────────────────────────

  async function handlePublish() {
    if (allImages.length === 0) {
      Alert.alert('Photos Required', 'Please add at least one photo of the vehicle before publishing your listing.');
      return;
    }
    setIsPublishing(true);
    try {
      const vinTrimmed = vin.trim().toUpperCase();
      const isValidVin = /^[A-Z0-9]{17}$/.test(vinTrimmed);

      const payload: Record<string, any> = {
        vehicleType,
        vrm: vrm.replace(/\s/g, '').toUpperCase(),
        vin: isValidVin ? vinTrimmed : undefined, make, model, year: year ? parseInt(year) : undefined,
        bodyType, location,
        mileage: mileage ? parseInt(mileage.replace(/[^0-9]/g, '')) : undefined,
        fuelType, transmission, color: colour, engineSize: engineSize ? parseInt(engineSize) : undefined,
        bhp: bhp ? parseInt(bhp) : undefined,
        doors: doors ? parseInt(doors) : undefined,
        seats: seats ? parseInt(seats) : undefined,
        variant, driveType,
        serviceHistory, numberOfKeys: numberOfKeys ? parseInt(numberOfKeys) : undefined,
        zeroTo60Mph: zeroTo60 ? parseFloat(zeroTo60) : undefined,
        topSpeedMph: topSpeed ? parseInt(topSpeed) : undefined,
        torqueNm: torque ? parseInt(torque) : undefined,
        combinedMpg: combinedMpg ? parseFloat(combinedMpg) : undefined,
        extraUrbanMpg: extraUrbanMpg ? parseFloat(extraUrbanMpg) : undefined,
        ulezCompliant, euroStandard, co2Emissions: co2Emissions ? parseInt(co2Emissions) : undefined,
        features, title, description, condition,
        owners: owners || undefined,
        isImported,
        markedForExport,
        isDepartedSale: isDepartedSale || undefined,
        departedRelationship: isDepartedSale ? (departedRelationship || undefined) : undefined,
        writeOffCategory: writeOffCat,
        stolenRecovered, hasOutstandingFinance: outstandingFinance,
        isLegalRegisteredKeeper: isLegalKeeper,
        notOwnerRelationship: isLegalKeeper === false ? (notOwnerRelationship || undefined) : undefined,
        images: allImages,
        videoUrls: videoUrls.length ? videoUrls : undefined,
        priceMin: priceMin ? parseFloat(priceMin.replace(/[^0-9.]/g, '')) : undefined,
        // priceMax mirrors the asking price — web has no separate max-price input either
        price: priceAsking ? parseFloat(priceAsking.replace(/[^0-9.]/g, '')) : 0,
        priceMax: priceAsking ? parseFloat(priceAsking.replace(/[^0-9.]/g, '')) : undefined,
        bannerLabel: bannerLabel || undefined,
        ...(deliveryAvailable && {
          deliveryAvailable: true,
          deliveryMaxMiles: deliveryMaxMiles ? parseFloat(deliveryMaxMiles) : undefined,
          deliveryPricePerMile: deliveryPricePerMile ? parseFloat(deliveryPricePerMile) : undefined,
        }),
        badgeTier,
        listingType,
        // DVLA fields
        motStatus, taxStatus, motExpiryDate: motExpiry, taxDueDate: taxDue,
        monthOfFirstRegistration: firstRegistered, wheelplan, typeApproval,
      };
      // Remove undefined values
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

      // Damage records are saved via a dedicated endpoint, not the /listings payload.
      // Returns whether the save succeeded — failures must be surfaced to the seller,
      // not silently swallowed (mobile-audit.md W7: publish used to succeed while the
      // damage details vanished with no indication anything went wrong).
      const saveDamageRecords = (listingId: string): Promise<boolean> => {
        if (damageRecords.length === 0) return Promise.resolve(true);
        return apiClient(`/damage/${listingId}/save`, {
          method: 'POST',
          body: JSON.stringify({
            // `part` sends the zone id (e.g. "front-bumper") to match the web app's
            // convention (VehicleDamageMapper.tsx sends r.zone = a zoneId string) —
            // fall back to the raw label for manually-typed zones with no matching id.
            //
            // Field names below match damage.service.ts's DamageDetection interface
            // exactly (part/type/size/coords/imageUrl) — the previous payload sent
            // severity/description/hidden/photoUrl, none of which the backend reads
            // (it destructures d.size/d.coords/d.imageUrl), and never sent `coords`
            // at all. That meant every damage pin saved from mobile silently lost
            // its position and photo — DamageMapViewer.tsx positions pins from
            // record.coords, which was always empty. `hidden` has no column on the
            // backend's damageRecord model, so it's intentionally not sent.
            detections: damageRecords.map(r => {
              const zone = DAMAGE_ZONES_3D.find(z => z.label === r.zone);
              // `type` is a free-form string on the backend (no enum) — web
              // sends the user's typed description directly as `type`. Mobile
              // additionally collects a category picker (Scratch/Dent/etc),
              // which used to win outright and silently drop whatever the
              // user typed in the description box. Keep the category as a
              // prefix so it isn't lost, but no longer discard the text.
              const type = r.description.trim() ? `${r.type} - ${r.description.trim()}` : r.type;
              return {
                part: zone?.id ?? r.zone,
                type,
                size: 'MODERATE',
                coords: zone?.coords,
                imageUrl: zone ? zonePhotos[zone.id] : undefined,
              };
            }),
          }),
        }).then(() => true).catch((err) => {
          console.error(`Failed to save damage records for listing ${listingId}:`, err);
          return false;
        });
      };
      const DAMAGE_SAVE_FAILED_MSG =
        'Listing published, but damage details couldn\'t be saved — edit the listing to retry.';

      if (editMode && editListingId) {
        await apiClient(`/listings/${editListingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        const damageSaved = await saveDamageRecords(editListingId);
        haptics.success();
        Alert.alert(
          damageSaved ? 'Updated!' : 'Updated — damage details not saved',
          damageSaved ? 'Your listing has been updated.' : DAMAGE_SAVE_FAILED_MSG,
          [{ text: 'Done', onPress: () => navigation?.navigate('SellerListings') }],
        );
      } else {
        // If an HPI check already created a draft for this listing, finish
        // that same record (PATCH) instead of POSTing a duplicate — the rest
        // of this branch (auction scheduling / listing-fee payment /
        // publish) is unchanged either way.
        let newListingId: string | null | undefined;
        if (hpiDraftListingId) {
          await apiClient(`/listings/${hpiDraftListingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
          newListingId = hpiDraftListingId;
        } else {
          const res = await apiClient<{ success: boolean; data: { id: string } }>('/listings', { method: 'POST', body: JSON.stringify(payload) });
          newListingId = res?.data?.id;
        }

        const damageSaved = newListingId ? await saveDamageRecords(newListingId) : true;

        if (isAuction && newListingId) {
          // Auction listings: schedule the auction, then publish (no listing fee for auction tier)
          const auctionPayload: Record<string, any> = {
            listingId: newListingId,
            reservePrice: parseFloat(reservePrice),
            startingBid: parseFloat(startingBid),
            minIncrement: parseFloat(minIncrement),
          };
          if (auctionStartMode === 'NOW') {
            auctionPayload.startTime = new Date().toISOString();
          } else {
            auctionPayload.startTime = new Date(auctionStartDate).toISOString();
          }
          Object.keys(auctionPayload).forEach(k => auctionPayload[k] === undefined && delete auctionPayload[k]);
          try {
            await apiClient('/auctions', { method: 'POST', body: JSON.stringify(auctionPayload) });
          } catch (auctionErr: any) {
            Alert.alert(
              'Listing created',
              `Your listing was saved but the auction could not be scheduled: ${auctionErr.message || 'Unknown error'}. You can schedule the auction from your listings.`,
            );
            return;
          }
          // Publish auction listing (no fee)
          try {
            await apiClient(`/listings/${newListingId}/publish`, { method: 'POST' });
          } catch {
            // Non-fatal — listing still exists
          }
          haptics.success();
          clearDraft();
          Alert.alert(
            damageSaved ? 'Auction Scheduled!' : 'Auction scheduled — damage details not saved',
            damageSaved ? 'Your auction is now live.' : DAMAGE_SAVE_FAILED_MSG,
            [{ text: 'View Listings', onPress: () => navigation?.navigate('SellerListings') }],
          );
        } else if (newListingId) {
          // Classified listing: gate behind payment sheet for all tiers (BASIC=£1, STANDARD=£10, PREMIUM=£25)
          let paid = false;
          try {
            paid = await triggerListingFeePayment(newListingId, badgeTier as 'BASIC' | 'STANDARD' | 'PREMIUM');
          } catch (payErr: any) {
            Alert.alert('Payment Failed', payErr.message || 'Could not process payment.');
            return;
          }

          if (!paid) {
            // User cancelled — listing exists as draft
            Alert.alert('Payment cancelled', 'Your listing was saved as a draft. Complete payment to publish.');
            return;
          }

          // Payment succeeded — publish the listing
          haptics.success();
          try {
            await apiClient(`/listings/${newListingId}/publish`, { method: 'POST' });
          } catch {
            Alert.alert(
              'Almost there!',
              'Listing created but could not be published automatically. Visit "My Listings" to publish.',
            );
          }
          clearDraft();
          Alert.alert(
            damageSaved ? 'Published!' : 'Published — damage details not saved',
            damageSaved ? 'Your listing is now live.' : DAMAGE_SAVE_FAILED_MSG,
            [{ text: 'View Listings', onPress: () => navigation?.navigate('SellerListings') }],
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not publish listing.');
    } finally {
      setIsPublishing(false);
    }
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────

  function handleNext() {
    // Touch pricing fields on step 3 so errors become visible before validateStep runs
    if (step === 3) {
      setTouched(prev => ({ ...prev, priceAsking: true, priceMin: priceMin.trim() ? true : prev.priceMin }));
    }
    if (!validateStep(step)) return;
    const nextStep = Math.min(step + 1, totalSteps) as Step;
    // Persist current state to draft before advancing
    updateDraft({
      make, model, year, mileage, title, fuelType, transmission, bodyType, colour,
      price: priceAsking, listingType,
      exteriorImages, interiorImages, damageImages,
      lastStep: nextStep,
    });
    if (step < totalSteps) setStep(nextStep);
  }

  function handleBack() {
    if (step > 1) setStep((step - 1) as Step);
    else navigation?.goBack();
  }

  // Save-and-exit — useSellWizardStore already persists draft state (see the
  // resume-draft prompt above); this just surfaces an explicit exit point on
  // any step beyond the first instead of only auto-saving on Next (SE8).
  function handleSaveDraftExit() {
    updateDraft({
      make, model, year, mileage, title, fuelType, transmission, bodyType, colour,
      price: priceAsking, listingType,
      exteriorImages, interiorImages, damageImages,
      lastStep: step,
    });
    haptics.light();
    navigation?.goBack();
  }

  // Android hardware back previously dropped the whole flow instead of stepping
  // back like the header chevron does (mobile-ui-ux-audit.md §C8/SE1).
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { handleBack(); return true; });
    return () => sub.remove();
  }, [step]));

  // ─── Stepper ─────────────────────────────────────────────────────────────────

  const STEP_LABELS = isAuction
    ? ['DETAILS', 'MEDIA', 'PRICING', 'AUCTION', 'REVIEW']
    : ['DETAILS', 'MEDIA', 'PRICING', 'REVIEW'];

  function renderStepper() {
    return (
      <View style={s.stepperContainer}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = step >= n;
          const done = step > n;
          return (
            <React.Fragment key={label}>
              <View style={s.stepItem}>
                <View style={[s.stepCircle, active && s.stepCircleActive]}>
                  {done
                    ? <Ionicons name="checkmark" size={13} color={Colors.white} />
                    : <Text style={[s.stepNum, active && s.stepNumActive]}>{n}</Text>
                  }
                </View>
                <Text style={[s.stepLabel, active && s.stepLabelActive]}>{label}</Text>
              </View>
              {i < STEP_LABELS.length - 1 && <View style={[s.stepLine, step > n && s.stepLineActive]} />}
            </React.Fragment>
          );
        })}
      </View>
    );
  }

  // ─── Step 1 — Vehicle Details ─────────────────────────────────────────────────

  function renderStep1() {
    return (
      <ScrollView ref={stepScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 120 }]}>

        {/* Vehicle Type */}
        <SectionBox title="Vehicle Type">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['CAR', 'HGV', 'MOTORCYCLE'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[s.pill, { flex: 1, justifyContent: 'center' }, vehicleType === t && s.pillActive]}
                onPress={() => setVehicleType(t)}
                activeOpacity={0.7}
              >
                <Text style={[s.pillText, vehicleType === t && s.pillTextActive]}>
                  {t === 'HGV' ? 'HGV / Commercial' : t === 'MOTORCYCLE' ? 'Motorcycle' : 'Car'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionBox>

        {/* Registration */}
        <SectionBox title="Registration (VRM) *" accent={Colors.accent}>
          <Text style={s.fieldHint}>Enter the UK registration plate and tap Analyse to auto-fill vehicle details.</Text>
          <View style={s.vrmRow}>
            <TextInput
              style={s.vrmInput}
              value={vrm}
              onChangeText={handlePlateChange}
              placeholder="e.g. AB12 CDE"
              placeholderTextColor={Colors.darkYellow}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[s.vrmBtn, dvlaLoading && { opacity: 0.6 }]}
              onPress={() => handleDvlaLookup()}
              disabled={dvlaLoading}
              activeOpacity={0.8}
            >
              {dvlaLoading
                ? <ActivityIndicator size="small" color={Colors.black} />
                : <Text style={s.vrmBtnText}>ANALYSE DATA</Text>
              }
            </TouchableOpacity>
          </View>
          {dvlaFetched && (
            <View style={s.dvlaSuccess}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.accentGreen} />
              <Text style={s.dvlaSuccessText}>DVLA data loaded — these fields are auto-filled but editable.</Text>
            </View>
          )}
        </SectionBox>

        {/* Registration & Compliance — DVLA auto-filled but editable, matching
            web (ListingWizard.tsx) — these used to render as read-only text
            even though the banner above claimed they were editable. Last V5C
            Issued and First Registered stay read-only: dateOfLastV5CIssued
            isn't in the backend's CreateListingDto at all (dead on web too),
            and monthOfFirstRegistration has no manual-entry field on web
            either — both are DVLA-lookup-only. */}
        <SectionBox title="Registration & Compliance" accent={Colors.infoBlue}>
          <Text style={s.fieldHint}>These fields are auto-filled from the DVLA and MOT databases, but can be manually adjusted.</Text>
          <View style={s.dvlaGrid}>
            <DVLAField label="LAST V5C ISSUED" value={lastV5C} />
            <DVLAField label="FIRST REGISTERED" value={firstRegistered} />
          </View>
          <FieldInput label="MOT STATUS" value={motStatus} onChange={setMotStatus} placeholder="e.g. Valid" />
          <FieldInput label="MOT EXPIRY DATE" value={motExpiry} onChange={setMotExpiry} placeholder="YYYY-MM-DD" />
          <FieldInput label="TAX STATUS" value={taxStatus} onChange={setTaxStatus} placeholder="e.g. Taxed" />
          <FieldInput label="TAX DUE DATE" value={taxDue} onChange={setTaxDue} placeholder="YYYY-MM-DD" />
          <FieldInput label="TYPE APPROVAL" value={typeApproval} onChange={setTypeApproval} placeholder="e.g. M1" />
          <FieldInput label="WHEELPLAN" value={wheelplan} onChange={setWheelplan} placeholder="e.g. 2 AXLE RIGID BODY" />
          <FieldInput label="VIN" value={vin} onChange={setVin} placeholder="17-character VIN" hint="Optional — from VIN database" />
          {motHistory.length > 0 && (
            <View style={s.motHistoryBox}>
              <Text style={s.motHistoryTitle}>MOT HISTORY</Text>
              {motHistory.slice(0, 5).map((test, i) => (
                <View key={i} style={s.motHistoryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.motHistoryDate}>
                      {new Date(test.completedDate).toLocaleDateString('en-GB')}
                    </Text>
                    {test.odometerValue ? (
                      <Text style={s.motHistoryMeta}>
                        {Number(test.odometerValue).toLocaleString()} {test.odometerUnit}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[s.motHistoryBadge, test.testResult === 'PASSED' ? s.motHistoryBadgePass : s.motHistoryBadgeFail]}>
                    <Text style={s.motHistoryBadgeText}>{test.testResult}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </SectionBox>

        {/* Make / Model / Year */}
        <SectionBox title="Make / Model / Year">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PickerField
                label="MAKE *"
                value={make}
                options={CAR_MAKES}
                onChange={v => {
                  setMake(v);
                  if (touched.make) setTouched(prev => ({ ...prev, make: true }));
                  // Model list depends on Make — a model picked under the
                  // previous make may not even exist for the new one.
                  if (model) setModel('');
                }}
                placeholder="e.g. BMW"
                required
                error={fieldError('make') ?? undefined}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PickerField
                label="MODEL *"
                value={model}
                options={getModelsForMake(make)}
                onChange={v => { setModel(v); if (touched.model) setTouched(prev => ({ ...prev, model: true })); }}
                placeholder="e.g. M4"
                required
                hint={!make.trim() ? 'Pick a Make first for a model list' : undefined}
                error={fieldError('model') ?? undefined}
              />
            </View>
            <View style={{ width: 80 }}>
              <FieldInput
                label="YEAR *"
                value={year}
                onChange={v => { setYear(v); if (touched.year) setTouched(prev => ({ ...prev, year: true })); }}
                placeholder="2021"
                keyboardType="number-pad"
                required
                error={fieldError('year') ?? undefined}
              />
            </View>
          </View>
        </SectionBox>

        {/* Model Details */}
        <SectionBox title="Model Details">
          <FieldInput label="VARIANT / TRIM" value={variant} onChange={setVariant} placeholder="e.g. S-Line, M Sport, Ghia" />
          <PillRow label="DRIVE TYPE" options={DRIVE_TYPES} value={driveType as any} onSelect={setDriveType} />
          <PillRow label="SERVICE HISTORY" options={SERVICE_HISTORY_OPTS} value={serviceHistory as any} onSelect={setServiceHistory} />
          <View>
            <SL label="NUMBER OF KEYS" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['1', '2', '3+ Keys'].map(k => (
                <TouchableOpacity
                  key={k}
                  style={[s.pill, numberOfKeys === k && s.pillActive]}
                  onPress={() => setNumberOfKeys(k)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.pillText, numberOfKeys === k && s.pillTextActive]}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </SectionBox>

        {/* Performance & Economy */}
        <SectionBox title="Performance & Economy">
          <Text style={s.fieldHint}>Optional — fill in from manufacturer specs.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FieldInput label="0-60 MPH (SEC)" value={zeroTo60} onChange={setZeroTo60} placeholder="e.g. 4.5" keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <FieldInput label="TOP SPEED MPH" value={topSpeed} onChange={setTopSpeed} placeholder="e.g. 155" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <FieldInput label="TORQUE (NM)" value={torque} onChange={setTorque} placeholder="e.g. 405" keyboardType="number-pad" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FieldInput label="COMBINED MPG" value={combinedMpg} onChange={setCombinedMpg} placeholder="e.g. 34.4" keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <FieldInput label="EXTRA URBAN MPG" value={extraUrbanMpg} onChange={setExtraUrbanMpg} placeholder="e.g. 42.8" keyboardType="decimal-pad" />
            </View>
          </View>
        </SectionBox>

        {/* Body Type */}
        <SectionBox title="Body Type">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {BODY_TYPES.map(bt => (
              <TouchableOpacity
                key={bt.v}
                style={[s.pill, s.bodyTypePill, bodyType === bt.v && s.pillActive]}
                onPress={() => setBodyType(bt.v)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name={bt.icon as any} size={18} color={bodyType === bt.v ? Colors.white : Colors.textSecondary} />
                <Text style={[s.pillText, bodyType === bt.v && s.pillTextActive]}>{bt.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionBox>

        {/* Location */}
        <SectionBox title="Location">
          <FieldInput label="LOCATION" value={location} onChange={setLocation} placeholder="e.g. London" />
        </SectionBox>

        {/* Technical Specs */}
        <SectionBox title="Technical Specs">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <SL label="MILEAGE" required />
              <TextInput
                style={[s.input, { borderColor: fieldBorderColor('mileage') }]}
                value={mileage}
                onChangeText={v => { setMileage(v); if (touched.mileage) setTouched(prev => ({ ...prev, mileage: true })); }}
                onBlur={fieldTouched('mileage')}
                placeholder="e.g. 45000"
                placeholderTextColor={Colors.borderMuted}
                keyboardType="number-pad"
                autoCorrect={false}
              />
              {fieldError('mileage') ? <Text style={s.inlineError}>{fieldError('mileage')}</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <FieldInput label="COLOUR" value={colour} onChange={setColour} placeholder="e.g. Silver" />
            </View>
          </View>
          <PillRow label="FUEL TYPE" options={FUEL_TYPES} value={fuelType as any} onSelect={setFuelType} />
          <PillRow label="TRANSMISSION" options={TRANSMISSIONS} value={transmission as any} onSelect={setTransmission} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FieldInput label="ENGINE SIZE (CC)" value={engineSize} onChange={setEngineSize} placeholder="e.g. 1998" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <FieldInput label="BHP" value={bhp} onChange={setBhp} placeholder="e.g. 503" keyboardType="number-pad" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FieldInput label="DOORS" value={doors} onChange={setDoors} placeholder="e.g. 4" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <FieldInput label="SEATS" value={seats} onChange={setSeats} placeholder="e.g. 5" keyboardType="number-pad" />
            </View>
          </View>
        </SectionBox>

        {/* UK Compliance */}
        <SectionBox title="UK Compliance">
          <YesNoRow label="ULEZ / CAZ COMPLIANT" value={ulezCompliant} onChange={setUlezCompliant} />
          <PillRow
            label="EURO STANDARD"
            options={EURO_STANDARDS.map(e => ({ v: e, l: e.replace('_', ' ') }))}
            value={euroStandard as any}
            onSelect={setEuroStandard}
          />
          <FieldInput label="CO2 EMISSIONS (G/KM)" value={co2Emissions} onChange={setCo2Emissions} placeholder="e.g. 136" keyboardType="number-pad" />
        </SectionBox>

        {/* Features */}
        <SectionBox title="Features">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PRESET_FEATURES.map(f => {
              const on = features.includes(f);
              return (
                <TouchableOpacity
                  key={f}
                  style={[s.pill, on && s.pillActive]}
                  onPress={() => setFeatures(p => on ? p.filter(x => x !== f) : [...p, f])}
                  activeOpacity={0.7}
                >
                  <Text style={[s.pillText, on && s.pillTextActive]}>{f}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            style={[s.input, { marginTop: 12 }]}
            placeholder="Additional features (comma separated)"
            placeholderTextColor={Colors.borderMuted}
            onSubmitEditing={e => {
              const extras = e.nativeEvent.text.split(',').map(x => x.trim()).filter(Boolean);
              setFeatures(p => [...new Set([...p, ...extras])]);
            }}
          />
        </SectionBox>

        {/* Listing Title & Description */}
        <SectionBox title="Listing Title & Description">
          <View style={{ marginBottom: 16 }}>
            <SL label="LISTING TITLE" required />
            <TextInput
              style={[s.input, { borderColor: fieldBorderColor('title') }]}
              value={title}
              onChangeText={v => { setTitle(v); if (touched.title) setTouched(prev => ({ ...prev, title: true })); }}
              onBlur={fieldTouched('title')}
              placeholder="e.g. BMW M4 Competition 2021"
              placeholderTextColor={Colors.borderMuted}
              autoCorrect={false}
            />
            {fieldError('title') ? <Text style={s.inlineError}>{fieldError('title')}</Text> : null}
          </View>
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <SL label="DESCRIPTION" />
              <TouchableOpacity
                style={[s.aiBtn, aiGenerating && { opacity: 0.6 }]}
                onPress={handleGenerateDescription}
                disabled={aiGenerating}
                activeOpacity={0.8}
              >
                {aiGenerating
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <>
                      <Ionicons name="sparkles" size={12} color={Colors.white} />
                      <Text style={s.aiBtnText}>AUTO GENERATE WITH AI</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
            <TextInput
              style={[s.input, { height: 120, textAlignVertical: 'top', paddingTop: 12 }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your vehicle for potential buyers..."
              placeholderTextColor={Colors.borderMuted}
              multiline
            />
          </View>
        </SectionBox>

        {/* Ownership */}
        <SectionBox title="Ownership">
          <PillRow
            label="CONDITION"
            options={CONDITIONS}
            value={condition as any}
            onSelect={v => { setCondition(v); setTouched(prev => ({ ...prev, condition: true })); }}
            required
            error={fieldError('condition') ?? undefined}
          />
          <PillRow
            label="NUMBER OF OWNERS"
            options={OWNERS_OPTIONS}
            value={owners as any}
            onSelect={v => { setOwners(v); setTouched(prev => ({ ...prev, owners: true })); }}
            required
            error={fieldError('owners') ?? undefined}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <Text style={s.sectionLabel}>IMPORTED VEHICLE</Text>
            <Switch
              value={isImported}
              onValueChange={setIsImported}
              trackColor={{ false: Colors.darkBlue_2a2a35, true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>

          {/* "Marked for export" question removed from the form — it's real
              DVLA-sourced data (see markedForExport state/autofill/payload
              below, all untouched), not something a seller should be asked
              to declare as an opinion. Still silently populated by DVLA
              autofill and still sent in the submit payload. */}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <Text style={s.sectionLabel}>DEPARTED / ESTATE SALE</Text>
            <Switch
              value={isDepartedSale}
              onValueChange={v => {
                setIsDepartedSale(v);
                if (!v) { setDepartedRelSelect(''); setDepartedRelOther(''); }
              }}
              trackColor={{ false: Colors.darkBlue_2a2a35, true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>
          <Text style={s.fieldHint}>
            Buyers will see a Deceased Estate badge on your listing. You may be asked for probate documentation.
          </Text>
          {isDepartedSale && (
            <View style={{ marginTop: 12 }}>
              <SL label="RELATIONSHIP TO OWNER" required />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {RELATIONSHIP_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[s.pill, departedRelSelect === opt && s.pillActive]}
                    onPress={() => {
                      setDepartedRelSelect(opt);
                      if (opt !== 'Other') setDepartedRelOther('');
                      setTouched(prev => ({ ...prev, departedRelationship: true }));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.pillText, departedRelSelect === opt && s.pillTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {departedRelSelect === 'Other' && (
                <TextInput
                  style={[s.input, { marginTop: 10 }]}
                  value={departedRelOther}
                  onChangeText={v => { setDepartedRelOther(v); setTouched(prev => ({ ...prev, departedRelationship: true })); }}
                  placeholder="Please specify your relationship"
                  placeholderTextColor={Colors.borderMuted}
                />
              )}
              {fieldError('departedRelationship') ? <Text style={s.inlineError}>{fieldError('departedRelationship')}</Text> : null}
            </View>
          )}
        </SectionBox>

        {/* Write-Off & Legal Declaration */}
        <SectionBox title="Write-Off & Legal Declaration" accent={Colors.accent}>
          <Text style={s.warnText}>
            Required by law. False declarations can constitute fraud and must be reported to relevant authorities.
          </Text>
          <View>
            <SL label="INSURANCE WRITE-OFF STATUS *" required />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {WRITE_OFF_CATS.map(c => (
                <TouchableOpacity
                  key={c.v}
                  style={[s.pill, writeOffCat === c.v && s.pillActive, c.v !== 'NONE' && writeOffCat === c.v && { backgroundColor: Colors.accentAlpha15, borderColor: Colors.accent }]}
                  onPress={() => { setWriteOffCat(c.v); setTouched(prev => ({ ...prev, writeOffCat: true })); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.pillText, writeOffCat === c.v && s.pillTextActive]}>{c.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {fieldError('writeOffCat') ? <Text style={s.inlineError}>{fieldError('writeOffCat')}</Text> : null}
          </View>
          <View style={{ marginTop: 16 }}>
            <YesNoRow
              label="HAS THIS VEHICLE EVER BEEN REPORTED STOLEN OR RECOVERED? *"
              value={stolenRecovered}
              onChange={v => { setStolenRecovered(v); setTouched(prev => ({ ...prev, stolenRecovered: true })); }}
              required
              error={fieldError('stolenRecovered') ?? undefined}
            />
            <YesNoRow
              label="IS THERE CURRENTLY OUTSTANDING FINANCE ON THE VEHICLE? *"
              value={outstandingFinance}
              onChange={v => { setOutstandingFinance(v); setTouched(prev => ({ ...prev, outstandingFinance: true })); }}
              required
              error={fieldError('outstandingFinance') ?? undefined}
            />
            <YesNoRow
              label="ARE YOU THE LEGAL REGISTERED KEEPER OF THIS VEHICLE? *"
              value={isLegalKeeper}
              onChange={v => {
                setIsLegalKeeper(v);
                setTouched(prev => ({ ...prev, isLegalKeeper: true }));
                if (v) { setNotOwnerRelSelect(''); setNotOwnerRelOther(''); }
              }}
              required
              error={fieldError('isLegalKeeper') ?? undefined}
            />
            {isLegalKeeper === false && (
              <View style={{ marginTop: 12 }}>
                <SL label="RELATIONSHIP TO THE REGISTERED KEEPER" required />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {NOT_OWNER_RELATIONSHIP_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[s.pill, notOwnerRelSelect === opt && s.pillActive]}
                      onPress={() => {
                        setNotOwnerRelSelect(opt);
                        if (opt !== 'Other') setNotOwnerRelOther('');
                        setTouched(prev => ({ ...prev, notOwnerRelationship: true }));
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.pillText, notOwnerRelSelect === opt && s.pillTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {notOwnerRelSelect === 'Other' && (
                  <TextInput
                    style={[s.input, { marginTop: 8 }]}
                    value={notOwnerRelOther}
                    onChangeText={v => { setNotOwnerRelOther(v); setTouched(prev => ({ ...prev, notOwnerRelationship: true })); }}
                    placeholder="Describe your relationship"
                    placeholderTextColor={Colors.borderMuted}
                    autoCorrect={false}
                  />
                )}
                {fieldError('notOwnerRelationship') ? <Text style={s.inlineError}>{fieldError('notOwnerRelationship')}</Text> : null}
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[s.declRow, declAcknowledged && s.declRowActive]}
            onPress={() => setDeclAcknowledged(p => { setTouched(prev => ({ ...prev, declAcknowledged: true })); return !p; })}
            activeOpacity={0.8}
          >
            <View style={[s.checkbox, declAcknowledged && s.checkboxActive]}>
              {declAcknowledged && <Ionicons name="checkmark" size={12} color={Colors.white} />}
            </View>
            <Text style={s.declText}>
              I confirm that the above declarations are true and accurate to the best of my knowledge.
              I understand that false declarations on this listing may have legal consequences.
            </Text>
          </TouchableOpacity>
          {fieldError('declAcknowledged') ? <Text style={s.inlineError}>{fieldError('declAcknowledged')}</Text> : null}
        </SectionBox>

      </ScrollView>
    );
  }

  // ─── Step 2 — Media ──────────────────────────────────────────────────────────

  function renderStep2() {
    const tabImages = photoTab === 'Exterior' ? exteriorImages : photoTab === 'Interior' ? interiorImages : damageImages;
    const totalCount = allImages.length;

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 120 }]}>

        {/* Photo Tracker */}
        <View style={s.photoTracker}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="camera" size={14} color={Colors.accent} />
            <Text style={s.photoTrackerLabel}>Photo Tracker</Text>
          </View>
          <Text style={s.photoTrackerCount}>{totalCount} / 20</Text>
        </View>
        <View style={s.photoTrackerBar}>
          <View style={[s.photoTrackerFill, { width: `${Math.min((totalCount / 20) * 100, 100)}%` }]} />
        </View>
        <Text style={s.photoTrackerHint}>Aim for at least 20 photos. Cars with 20+ photos sell on average 40% faster.</Text>

        {/* Photo Category Tabs */}
        <View style={s.photoTabs}>
          {(['Exterior', 'Interior', 'Damage'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.photoTab, photoTab === tab && s.photoTabActive]}
              onPress={() => setPhotoTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[s.photoTabText, photoTab === tab && s.photoTabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pro Tip */}
        {photoTab === 'Exterior' && (
          <View style={s.proTip}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.infoBlue} accessibilityElementsHidden importantForAccessibility="no" />
            <Text style={s.proTipText}>PRO TIP — EXTERIOR: Park in an open, well-lit area. Take photos from all 4 corners, straight on front/back, and close-ups of wheels.</Text>
          </View>
        )}
        {photoTab === 'Interior' && (
          <View style={s.proTip}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.infoBlue} accessibilityElementsHidden importantForAccessibility="no" />
            <Text style={s.proTipText}>PRO TIP — INTERIOR: Photograph dashboard, steering wheel, infotainment, seats, boot, and any wear.</Text>
          </View>
        )}

        {photoTab !== 'Damage' ? (
          <>
            {/* Upload Zone */}
            <TouchableOpacity
              style={s.uploadZone}
              onPress={handlePickPhoto}
              disabled={uploadingPhoto}
              activeOpacity={0.7}
            >
              {uploadingPhoto
                ? <ActivityIndicator color={Colors.accent} />
                : <>
                    <Ionicons name="camera-outline" size={28} color={Colors.iconMuted} />
                    <Text style={s.uploadZoneTitle}>Add {photoTab} Photos</Text>
                    <Text style={s.uploadZoneHint}>Tap to select from gallery · Max 50 photos</Text>
                    <Text style={s.uploadZoneFormats}>JPEG, PNG, WebP · Max 5MB per file</Text>
                  </>
              }
            </TouchableOpacity>

            {/* Photo Grid */}
            {tabImages.length > 0 && (
              <View>
                <Text style={[s.sectionLabel, { marginTop: 20 }]}>ALL UPLOADED PHOTOS</Text>
                <View style={s.photoGrid}>
                  {tabImages.map((uri, i) => {
                    const category = photoTab.toLowerCase();
                    const progressKey = `${category}-${i}`;
                    const progress = uploadProgress[progressKey];
                    const isUploading = progress !== undefined && progress < 100;
                    return (
                      <View key={uri} style={s.photoThumb}>
                        <ExpoImage
                          source={{ uri }}
                          style={s.photoThumbImg}
                          contentFit="cover"
                          transition={200}
                          placeholderContentFit="cover"
                        />
                        {/* Per-image upload progress bar */}
                        {isUploading && (
                          <View style={s.photoProgressBar}>
                            <View style={[s.photoProgressFill, { width: `${progress}%` as any }]} />
                          </View>
                        )}
                        {i === 0 && <View style={s.coverBadge}><Text style={s.coverBadgeText}>COVER</Text></View>}
                        <IconButton style={s.photoRemoveBtn} icon={<Ionicons name="close" size={10} color={Colors.white} />} onPress={() => removePhoto(photoTab, uri)} accessibilityLabel="Remove photo" />
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        ) : (
          /* Damage Map */
          <View>
            <SectionBox title="Damage Map — Select Damaged Areas" accent={Colors.warning}>
              <Text style={s.fieldHint}>
                Drag to rotate the 3D model. Tap a zone to mark damage, hide it, or attach a photo.
              </Text>
              <Damage3DMapper
                records={damageRecords}
                onAdd={entry => setDamageRecords(p => [...p, entry])}
                onRemove={id => setDamageRecords(p => p.filter(r => r.id !== id))}
                onHide={handleZoneHide}
                onPhoto={handleZonePhoto}
                bodyTypeLabel={BODY_TYPES.find(bt => bt.v === bodyType)?.l}
              />
            </SectionBox>
          </View>
        )}

        {/* Video Links */}
        <SectionBox title="Video Links (optional)">
          <Text style={s.fieldHint}>
            Add YouTube, Instagram, Facebook or X links to show your car in action.
          </Text>

          {/* Input + Add row */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput
              style={[s.input, { flex: 1, marginBottom: 0 }]}
              value={videoInput}
              onChangeText={setVideoInput}
              onSubmitEditing={handleAddVideoUrl}
              placeholder="Paste a YouTube, Instagram or Facebook URL"
              placeholderTextColor={Colors.borderMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              editable={videoUrls.length < 5}
            />
            <TouchableOpacity
              style={[s.pill, s.pillActive, { paddingHorizontal: 16, alignSelf: 'stretch', justifyContent: 'center' }]}
              onPress={handleAddVideoUrl}
              disabled={videoUrls.length >= 5}
              activeOpacity={0.7}
            >
              <Text style={s.pillTextActive}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* URL chips */}
          {videoUrls.length > 0 && (
            <View style={{ gap: 8, marginTop: 12 }}>
              {videoUrls.map(url => (
                <View
                  key={url}
                  style={[s.pill, s.pillActive, { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 }]}
                >
                  <Ionicons name="play-circle-outline" size={14} color={Colors.white} />
                  <Text style={[s.pillTextActive, { flex: 1, fontSize: FontSize.xs }]} numberOfLines={1}>
                    {url.length > 40 ? `${url.slice(0, 40)}…` : url}
                  </Text>
                  <IconButton icon={<Ionicons name="close" size={13} color={Colors.white} />} onPress={() => setVideoUrls(p => p.filter(v => v !== url))} accessibilityLabel="Remove video" />
                </View>
              ))}
            </View>
          )}

          {/* Limit notice */}
          {videoUrls.length >= 5 && (
            <Text style={[s.fieldHint, { color: Colors.warning, marginTop: 6 }]}>
              Max 5 videos
            </Text>
          )}
        </SectionBox>

      </ScrollView>
    );
  }

  // ─── Step 3 — Pricing ────────────────────────────────────────────────────────

  function renderStep3() {
    const minVal = parseFloat(priceMin.replace(/[^0-9.]/g, '')) || 0;
    const askVal = parseFloat(priceAsking.replace(/[^0-9.]/g, '')) || 0;
    const isValidRange = askVal > 0 && (minVal === 0 || minVal < askVal);

    return (
      <ScrollView ref={stepScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 120 }]}>

        <SectionBox title="Set Your Price Range" accent={Colors.accent}>
          <Text style={s.fieldHint}>
            The <Text style={{ color: Colors.white, fontFamily: FontFamily.bold }}>Asking Price</Text> is displayed publicly.
            The <Text style={{ color: Colors.white, fontFamily: FontFamily.bold }}>Lower (Min)</Text> defines your acceptable offer floor.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <SL label="LOWER (MIN)" />
              <Text style={s.fieldHint}>Floor price — not visible to buyers</Text>
              <View style={[s.priceInputWrap, touched.priceMin ? { borderColor: fieldBorderColor('priceMin') } : {}]}>
                <Text style={s.priceCurrency}>£</Text>
                <TextInput
                  style={s.priceInput}
                  value={priceMin}
                  onChangeText={v => { setPriceMin(v); if (touched.priceMin) setTouched(prev => ({ ...prev, priceMin: true })); }}
                  onBlur={fieldTouched('priceMin')}
                  placeholder="0"
                  placeholderTextColor={Colors.borderMuted}
                  keyboardType="number-pad"
                />
              </View>
              {fieldError('priceMin') ? <Text style={s.inlineError}>{fieldError('priceMin')}</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <SL label="ASKING PRICE *" required />
              <Text style={s.fieldHintRed}>Displayed on listing — required</Text>
              <View style={[s.priceInputWrap, s.priceInputWrapActive, touched.priceAsking ? { borderColor: fieldBorderColor('priceAsking') } : {}]}>
                <Text style={[s.priceCurrency, { color: Colors.accent }]}>£</Text>
                <TextInput
                  style={s.priceInput}
                  value={priceAsking}
                  onChangeText={v => { setPriceAsking(v); if (touched.priceAsking) setTouched(prev => ({ ...prev, priceAsking: true })); }}
                  onBlur={fieldTouched('priceAsking')}
                  placeholder="0"
                  placeholderTextColor={Colors.borderMuted}
                  keyboardType="number-pad"
                />
              </View>
              {fieldError('priceAsking') ? <Text style={s.inlineError}>{fieldError('priceAsking')}</Text> : null}
            </View>
          </View>

          {/* Price Range Visual */}
          {(minVal > 0 || askVal > 0) && (
            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[s.fieldHint, { color: Colors.warning }]}>YOUR PRICE RANGE</Text>
                <Text style={[s.fieldHint, { color: isValidRange ? Colors.accentGreen : Colors.accent }]}>
                  {isValidRange ? '✓ VALID' : '⚠ CHECK'}
                </Text>
              </View>
              <View style={s.priceRangeBar}>
                <View style={[s.priceRangeFill, !isValidRange && { backgroundColor: Colors.accent }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={[s.priceRangeLabel, { color: Colors.warning }]}>
                  {minVal > 0 ? `£${minVal.toLocaleString()}` : '£0'}
                </Text>
                <Text style={[s.priceRangeLabel, { color: Colors.white }]}>
                  {askVal > 0 ? `£${askVal.toLocaleString()}` : '—'}
                </Text>
              </View>
            </View>
          )}

          {/* Listing Ribbon Label */}
          <View style={{ marginTop: 20 }}>
            <Text style={s.sectionLabel}>LISTING RIBBON LABEL (optional)</Text>
            <Text style={s.fieldHint}>Appears as a coloured tag on your listing card</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
              {BANNER_LABELS.map(label => (
                <TouchableOpacity
                  key={label}
                  style={[s.pill, bannerLabel === label && s.pillActive]}
                  onPress={() => setBannerLabel(p => p === label ? '' : label)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.pillText, bannerLabel === label && s.pillTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Custom text — shares the same bannerLabel field as the presets
                above (mutually exclusive by construction, matching web's
                ListingWizard.tsx): typing here overwrites whatever preset was
                selected, and the input shows blank whenever the current value
                is one of the presets rather than custom text. */}
            <TextInput
              style={[s.input, { marginTop: 10 }]}
              value={BANNER_LABELS.includes(bannerLabel) ? '' : bannerLabel}
              onChangeText={setBannerLabel}
              placeholder="Or type your own label…"
              placeholderTextColor={Colors.borderMuted}
              maxLength={40}
              autoCorrect={false}
            />
          </View>
        </SectionBox>

        {/* Delivery */}
        <SectionBox title="Delivery">
          {/* Toggle row — matches the isImported Switch pattern */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.sectionLabel}>OFFER DELIVERY</Text>
              <Text style={s.fieldHint}>Buyers can request delivery to their address</Text>
            </View>
            <Switch
              value={deliveryAvailable}
              onValueChange={setDeliveryAvailable}
              trackColor={{ false: Colors.darkBlue_2a2a35, true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>

          {/* Reveal delivery detail inputs when toggle is ON */}
          {deliveryAvailable && (
            <View style={{ marginTop: 16, gap: 16 }}>
              <View>
                <Text style={s.sectionLabel}>MAX DELIVERY RADIUS (MILES)</Text>
                <TextInput
                  style={s.input}
                  value={deliveryMaxMiles}
                  onChangeText={setDeliveryMaxMiles}
                  placeholder="e.g. 50"
                  placeholderTextColor={Colors.borderMuted}
                  keyboardType="number-pad"
                  autoCorrect={false}
                />
              </View>

              <View>
                <Text style={s.sectionLabel}>PRICE PER MILE (£, ex-VAT)</Text>
                <TextInput
                  style={s.input}
                  value={deliveryPricePerMile}
                  onChangeText={setDeliveryPricePerMile}
                  placeholder="e.g. 2.00"
                  placeholderTextColor={Colors.borderMuted}
                  keyboardType="decimal-pad"
                  autoCorrect={false}
                />
              </View>

              {/* Fee preview — shows how the tiered formula works for a 20-mile trip */}
              {(() => {
                const EXAMPLE_MILES = 20;
                const ppm = parseFloat(deliveryPricePerMile) || 0;
                // Tiered base: ≤10mi = £30, 11-30mi = £30+(d-10)×£2, >30mi = £70+(d-30)×£1.50
                const feeExVat = EXAMPLE_MILES <= 10
                  ? 30
                  : EXAMPLE_MILES <= 30
                    ? 30 + (EXAMPLE_MILES - 10) * 2
                    : 70 + (EXAMPLE_MILES - 30) * 1.5;
                const totalExVat = feeExVat + ppm * EXAMPLE_MILES;
                return (
                  <View style={s.deliveryPreview}>
                    <Ionicons name="information-circle-outline" size={13} color={Colors.infoBlueLight} accessibilityElementsHidden importantForAccessibility="no" />
                    <Text style={s.deliveryPreviewText}>
                      {`Example: ${EXAMPLE_MILES}-mile delivery = £${Math.round(totalExVat)} ex-VAT`}
                      {ppm > 0 ? ` (£${Math.round(feeExVat)} base + £${Math.round(ppm * EXAMPLE_MILES)} per-mile)` : ' (base fee only)'}
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}
        </SectionBox>

        {/* Listing Method — tapping a pricing tier used to silently flip
            listingType as a side effect (setListingType(badge.listingType)
            in the tier card's onPress below), so choosing "Premium" from a
            Retail mindset could silently switch you to a completely
            different flow with no explicit choice ever made. This is now
            the one place listingType changes; tier cards only set badgeTier. */}
        <SectionBox title="Listing Method">
          <Text style={s.fieldHint}>
            Choose how you want to sell — a fixed-price retail listing, or a live auction.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {([
              { v: 'CLASSIFIED' as const, l: 'Retail Listing' },
              { v: 'AUCTION' as const, l: 'Auction' },
            ]).map(opt => (
              <TouchableOpacity
                key={opt.v}
                style={[s.pill, { flex: 1, justifyContent: 'center' }, listingType === opt.v && s.pillActive]}
                onPress={() => {
                  if (listingType === opt.v) return;
                  setListingType(opt.v);
                  // Previous tier no longer applies to the new method —
                  // reset to that method's default rather than leaving a
                  // stale FREE/BASIC selection that doesn't match.
                  setBadgeTier(opt.v === 'AUCTION' ? 'FREE' : 'BASIC');
                }}
                activeOpacity={0.7}
              >
                <Text style={[s.pillText, listingType === opt.v && s.pillTextActive]}>{opt.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionBox>

        {/* Seller Badges — only the tiers relevant to the listing method
            chosen above (Auction's Free tier vs Classified's Basic/Standard/
            Premium tiers were never really alternatives to each other). */}
        <SectionBox title="Seller Badges">
          <Text style={s.fieldHint}>
            Boost buyer confidence with trust badges on your listing. Badges increase buyer engagement and sell rates.
          </Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            {BADGES.filter(badge => (badge.listingType === 'AUCTION') === (listingType === 'AUCTION')).map(badge => {
              const active = badgeTier === badge.id;
              return (
                <TouchableOpacity
                  key={badge.id}
                  style={[
                    s.badgeCard,
                    active && { borderColor: badge.accent, backgroundColor: `${badge.accent}14` },
                  ]}
                  onPress={() => setBadgeTier(badge.id)}
                  activeOpacity={0.8}
                >
                  {badge.id === 'STANDARD' && (
                    <View style={[s.badgePopular, { backgroundColor: Colors.infoBlue }]}><Text style={s.badgePopularText}>Standard</Text></View>
                  )}
                  {badge.id === 'PREMIUM' && (
                    <View style={[s.badgePopular, { backgroundColor: Colors.warning }]}>
                      <Text style={[s.badgePopularText, { color: Colors.black }]}>Best Value</Text>
                    </View>
                  )}
                  {active && (
                    <View style={[s.badgeSelected, { backgroundColor: badge.accent }]}>
                      <Text style={[s.badgeSelectedText, badge.id === 'PREMIUM' && { color: Colors.black }]}>Selected</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[s.radioCircle, active && { backgroundColor: badge.accent, borderColor: badge.accent }]}>
                      {active && <Ionicons name="checkmark" size={12} color={badge.id === 'PREMIUM' ? Colors.black : Colors.white} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {badge.id === 'FREE' && <Ionicons name="hammer-outline" size={12} color={badge.accent} />}
                        <Text style={[s.badgeLabel, { color: badge.accent }]}>{badge.label}</Text>
                      </View>
                      <Text style={[s.badgePrice, { color: badge.accent }]}>{badge.price}</Text>
                      <Text style={s.badgeSub}>{badge.sub}</Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 10, marginLeft: 36, gap: 4 }}>
                    {badge.features.map(f => (
                      <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="checkmark-circle" size={12} color={Colors.accentGreen} />
                        <Text style={s.badgeFeatureText}>{f}</Text>
                      </View>
                    ))}
                    {badge.negative.map(f => (
                      <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="close" size={12} color={Colors.borderMuted} />
                        <Text style={[s.badgeFeatureText, { color: Colors.borderMuted }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </SectionBox>

      </ScrollView>
    );
  }

  // ─── Step 4 — Auction Schedule (auction only) ────────────────────────────────

  function renderAuctionSchedule() {
    return (
      <ScrollView ref={stepScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 120 }]}>

        <SectionBox title="Live Auction — 24-Hour Fixed Duration" accent={Colors.lightOrange_f97316}>
          <Text style={[s.fieldHint, { color: Colors.lightOrange_fb923c }]}>
            Your auction will run for exactly 24 hours. Anti-snipe protection automatically extends bidding by 3 minutes if a bid arrives in the final 3 minutes.
          </Text>
        </SectionBox>

        {/* When to start */}
        <SectionBox title="When to Start *" accent={Colors.lightOrange_f97316}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[s.auctionModeBtn, auctionStartMode === 'NOW' && s.auctionModeBtnActive]}
              onPress={() => setAuctionStartMode('NOW')}
              activeOpacity={0.7}
            >
              <Text style={s.auctionModeBtnIcon}>⚡</Text>
              <Text style={[s.auctionModeBtnTitle, auctionStartMode === 'NOW' && { color: Colors.lightOrange_fb923c }]}>Start Immediately</Text>
              <Text style={s.auctionModeBtnHint}>Auction goes live right now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.auctionModeBtn, auctionStartMode === 'SCHEDULED' && s.auctionModeBtnActive]}
              onPress={() => setAuctionStartMode('SCHEDULED')}
              activeOpacity={0.7}
            >
              <Text style={s.auctionModeBtnIcon}>🗓️</Text>
              <Text style={[s.auctionModeBtnTitle, auctionStartMode === 'SCHEDULED' && { color: Colors.lightOrange_fb923c }]}>Schedule</Text>
              <Text style={s.auctionModeBtnHint}>Choose a start date & time</Text>
            </TouchableOpacity>
          </View>
          {auctionStartMode === 'SCHEDULED' && (
            <View style={{ marginTop: 12 }}>
              <FieldInput
                label="START DATE & TIME"
                value={auctionStartDate}
                onChange={v => { setAuctionStartDate(v); if (touched.auctionStartDate) setTouched(prev => ({ ...prev, auctionStartDate: true })); }}
                placeholder="e.g. 2025-12-25 14:00"
                required
                error={fieldError('auctionStartDate') ?? undefined}
              />
              <Text style={s.fieldHint}>Format: YYYY-MM-DD HH:MM (24-hour)</Text>
            </View>
          )}
        </SectionBox>

        {/* Pricing */}
        <SectionBox title="Auction Pricing" accent={Colors.lightOrange_f97316}>
          <FieldInput
            label="RESERVE PRICE (£) *"
            value={reservePrice}
            onChange={v => { setReservePrice(v); if (touched.reservePrice) setTouched(prev => ({ ...prev, reservePrice: true })); }}
            placeholder="Minimum you'll accept"
            keyboardType="number-pad"
            required
            hint="The auction must reach this price for the sale to complete."
            error={fieldError('reservePrice') ?? undefined}
          />
          <FieldInput
            label="STARTING BID (£) *"
            value={startingBid}
            onChange={v => { setStartingBid(v); if (touched.startingBid) setTouched(prev => ({ ...prev, startingBid: true })); }}
            placeholder="Opening bid amount"
            keyboardType="number-pad"
            required
            hint="The first bid placed must be at least this amount."
            error={fieldError('startingBid') ?? undefined}
          />
          <FieldInput
            label="MINIMUM BID INCREMENT (£) *"
            value={minIncrement}
            onChange={v => { setMinIncrement(v); if (touched.minIncrement) setTouched(prev => ({ ...prev, minIncrement: true })); }}
            placeholder="e.g. 100"
            keyboardType="number-pad"
            required
            hint="Each subsequent bid must raise the price by at least this amount."
            error={fieldError('minIncrement') ?? undefined}
          />
        </SectionBox>

        {/* Summary */}
        <SectionBox title="Auction Summary">
          <View style={s.reviewGrid}>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>DURATION</Text><Text style={s.reviewCellValue}>24 Hours</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>ANTI-SNIPE</Text><Text style={s.reviewCellValue}>3 Minutes</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>START</Text><Text style={s.reviewCellValue}>{auctionStartMode === 'NOW' ? 'Immediately' : auctionStartDate || '—'}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>LISTING FEE</Text><Text style={[s.reviewCellValue, { color: Colors.accentGreen }]}>Free</Text></View>
          </View>
        </SectionBox>

      </ScrollView>
    );
  }

  // ─── Step 4/5 — Review ───────────────────────────────────────────────────────

  function renderStep4() {
    const badge = BADGES.find(b => b.id === badgeTier);
    const askNum = parseFloat(priceAsking.replace(/[^0-9.]/g, '')) || 0;
    const minNum = parseFloat(priceMin.replace(/[^0-9.]/g, '')) || 0;

    return (
      <ScrollView style={{ flex: 1, backgroundColor: Colors.bgPrimary }} showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 140 }]}>
        <Text style={s.reviewHeading}>Review Your Listing</Text>

        {/* Vehicle Identity */}
        <SectionBox title="Vehicle Identity" action={
          <TouchableOpacity style={s.reviewEditBtn} onPress={() => setStep(1)} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={12} color={Colors.accent} />
            <Text style={s.reviewEditText}>Edit</Text>
          </TouchableOpacity>
        }>
          <View style={s.reviewGrid}>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>VRM</Text><Text style={s.reviewCellValue}>{String(vrm) || '—'}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>MAKE</Text><Text style={s.reviewCellValue}>{String(make) || '—'}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>MODEL</Text><Text style={s.reviewCellValue}>{String(model) || '—'}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>YEAR</Text><Text style={s.reviewCellValue}>{String(year) || '—'}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>BODY</Text><Text style={s.reviewCellValue}>{String(bodyType) || '—'}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>LOCATION</Text><Text style={s.reviewCellValue}>{String(location) || '—'}</Text></View>
          </View>
        </SectionBox>

        {/* Photos */}
        <SectionBox title={`Photos (${allImages.length})`} action={
          <TouchableOpacity style={s.reviewEditBtn} onPress={() => setStep(2)} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={12} color={Colors.accent} />
            <Text style={s.reviewEditText}>Edit</Text>
          </TouchableOpacity>
        }>
          {allImages.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {allImages.map((uri, i) => (
                <ExpoImage
                  key={i}
                  source={{ uri }}
                  style={{ width: 80, height: 60, borderRadius: 8, backgroundColor: Colors.bgTertiary }}
                  contentFit="cover"
                  transition={200}
                />
              ))}
            </ScrollView>
          ) : (
            <Text style={s.fieldHint}>No photos added yet.</Text>
          )}
        </SectionBox>

        {/* Technical Specs */}
        <SectionBox title="Technical Specs" action={
          <TouchableOpacity style={s.reviewEditBtn} onPress={() => setStep(1)} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={12} color={Colors.accent} />
            <Text style={s.reviewEditText}>Edit</Text>
          </TouchableOpacity>
        }>
          <View style={s.reviewGrid}>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>MILEAGE</Text><Text style={s.reviewCellValue}>{mileage ? `${parseInt(String(mileage).replace(/\D/g, '') || '0', 10).toLocaleString()} mi` : '—'}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>FUEL</Text><Text style={s.reviewCellValue}>{String(fuelType || '—')}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>TRANSMISSION</Text><Text style={s.reviewCellValue}>{String(transmission || '—')}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>BHP</Text><Text style={s.reviewCellValue}>{String(bhp || '—')}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>ENGINE</Text><Text style={s.reviewCellValue}>{engineSize ? `${String(engineSize)}cc` : '—'}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>COLOUR</Text><Text style={s.reviewCellValue}>{String(colour || '—')}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>DOORS</Text><Text style={s.reviewCellValue}>{String(doors || '—')}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>SEATS</Text><Text style={s.reviewCellValue}>{String(seats || '—')}</Text></View>
          </View>
          {(String(motStatus) || String(taxStatus)) ? (
            <>
              <View style={s.dvlaGrid}>
                {motStatus ? <DVLAField label="MOT STATUS" value={String(motStatus)} /> : null}
                {motExpiry ? <DVLAField label="MOT EXPIRY" value={String(motExpiry)} /> : null}
                {taxStatus ? <DVLAField label="TAX STATUS" value={String(taxStatus)} /> : null}
                {taxDue ? <DVLAField label="TAX DUE" value={String(taxDue)} /> : null}
                {firstRegistered ? <DVLAField label="FIRST REGISTERED" value={String(firstRegistered)} /> : null}
                {lastV5C ? <DVLAField label="LAST V5C" value={String(lastV5C)} /> : null}
              </View>
            </>
          ) : null}
          {features.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {features.map((f, fi) => (
                <View key={fi} style={s.reviewFeatureChip}>
                  <Text style={s.reviewFeatureChipText}>{String(f)}</Text>
                </View>
              ))}
            </View>
          )}
          {title ? <View style={{ marginTop: 12 }}>
            <Text style={s.reviewCellLabel}>TITLE</Text>
            <Text style={[s.reviewCellValue, { fontFamily: FontFamily.bold, fontSize: FontSize.size14, marginTop: 4 }]}>{String(title)}</Text>
          </View> : null}
        </SectionBox>

        {/* Pricing */}
        <SectionBox title="Pricing" action={
          <TouchableOpacity style={s.reviewEditBtn} onPress={() => setStep(3)} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={12} color={Colors.accent} />
            <Text style={s.reviewEditText}>Edit</Text>
          </TouchableOpacity>
        }>
          <View style={s.reviewGrid}>
            <View style={s.reviewCell}>
              <Text style={s.reviewCellLabel}>LOWER (MIN)</Text>
              <Text style={s.reviewCellValue}>{minNum > 0 ? `£${minNum.toLocaleString()}` : '—'}</Text>
            </View>
            <View style={s.reviewCell}>
              <Text style={s.reviewCellLabel}>ASKING PRICE</Text>
              <Text style={[s.reviewCellValue, { color: Colors.white, fontFamily: FontFamily.extraBold, fontSize: FontSize.lg }]}>
                {askNum > 0 ? `£${askNum.toLocaleString()}` : '—'}
              </Text>
            </View>
          </View>
          {badge && (
            <View style={{ marginTop: 8 }}>
              <Text style={s.reviewCellLabel}>BADGE</Text>
              <Text style={[s.reviewCellValue, { color: badge.accent }]}>{badge.label} — {badge.price}</Text>
            </View>
          )}
        </SectionBox>

        {/* HPI Check Callout — was a static, non-pressable promo card; now
            actually triggers the £9.99 Payment Sheet and shows the unlocked
            badge, matching web's HpiPaymentModal flow. */}
        {hpiUnlocked ? (
          <View style={s.hpiCallout}>
            <View style={s.hpiCalloutIcon}>
              <Ionicons name="shield-checkmark" size={22} color={Colors.accentGreen} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.hpiCalloutTitle}>HPI Check Verified</Text>
              <Text style={s.hpiCalloutSub}>
                {hpiSummary?.isClear === false
                  ? 'This vehicle has records on file — full report available to buyers.'
                  : 'No adverse history found — a Verified badge will show on your listing.'}
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={s.hpiCallout}
            activeOpacity={0.8}
            onPress={handleUnlockHpi}
            disabled={hpiUnlocking}
          >
            <View style={s.hpiCalloutIcon}>
              {hpiUnlocking
                ? <ActivityIndicator size="small" color={Colors.infoBlue} />
                : <Ionicons name="shield-checkmark-outline" size={22} color={Colors.infoBlue} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.hpiCalloutTitle}>Add HPI Vehicle Check</Text>
              <Text style={s.hpiCalloutSub}>Verified HPI badge increases buyer trust and helps cars sell 2× faster</Text>
            </View>
            <View style={s.hpiCalloutBadge}>
              <Text style={s.hpiCalloutPrice}>{hpiUnlocking ? '...' : '£9.99'}</Text>
            </View>
          </TouchableOpacity>
        )}

      </ScrollView>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha03, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.3 }}
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <IconButton style={s.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={handleBack} accessibilityLabel="Go back" />
        <View style={s.headerCenter}>
          <Text style={s.headerSub}>SELL MY CAR</Text>
          <Text style={s.headerTitle}>
            {step === 1 ? 'Vehicle Details' : step === 2 ? 'Media & Damage' : step === 3 ? 'Pricing' : (step === 4 && isAuction) ? 'Auction Schedule' : 'Review & Publish'}
          </Text>
        </View>
        {step >= 2 && !editMode ? (
          <TouchableOpacity onPress={handleSaveDraftExit} activeOpacity={0.7} style={{ width: 38, alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: FontFamily.medium, fontSize: FontSize.size9, color: Colors.textSecondary }}>SAVE{'\n'}& EXIT</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      {editLoading ? (
        <View style={s.editLoadingWrap}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={s.editLoadingText}>Loading your listing…</Text>
        </View>
      ) : (
        <>
          {renderStepper()}

          <View style={{ flex: 1 }}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && isAuction && renderAuctionSchedule()}
            {((step === 4 && !isAuction) || step === 5) && renderStep4()}
          </View>

          {/* Bottom Actions */}
          <View style={[s.bottomBar, { paddingBottom: insets.bottom || 20 }]}>
            {step > 1 && (
              <TouchableOpacity style={s.backBtnSm} onPress={handleBack} activeOpacity={0.8}>
                <Ionicons name="arrow-back" size={16} color={Colors.white} />
                <Text style={s.backBtnSmText}>BACK</Text>
              </TouchableOpacity>
            )}
            {step < totalSteps ? (
              <TouchableOpacity
                style={[s.nextBtn, ((step === 1 && step1HasErrors()) || (step === 3 && step3HasErrors())) ? { opacity: 0.5 } : {}]}
                onPress={handleNext}
                activeOpacity={0.8}
                disabled={(step === 1 && step1HasErrors()) || (step === 3 && step3HasErrors())}
              >
                <Text style={s.nextBtnText}>
                  {step === 1 ? 'NEXT · MEDIA'
                    : step === 2 ? 'NEXT · PRICING'
                    : step === 3 && isAuction ? 'NEXT · AUCTION'
                    : step === 3 ? 'REVIEW LISTING'
                    : 'REVIEW LISTING'}
                </Text>
                <Ionicons name="arrow-forward" size={16} color={Colors.white} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.nextBtn, s.publishBtn, isPublishing && { opacity: 0.7 }]}
                onPress={handlePublish}
                activeOpacity={0.8}
                disabled={isPublishing}
              >
                {isPublishing
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <>
                      <Text style={s.nextBtnText}>{editMode ? 'SAVE CHANGES' : 'PUBLISH LISTING'}</Text>
                      <Ionicons name="checkmark" size={16} color={Colors.white} style={{ marginLeft: 8 }} />
                    </>
                }
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  editLoadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  editLoadingText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.whiteAlpha05, borderWidth: 1, borderColor: Colors.whiteAlpha08, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center' },
  headerSub: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.accent, letterSpacing: 1.5, marginBottom: 3 },
  headerTitle: { fontFamily: FontFamily.extraBold, fontSize: FontSize.md, color: Colors.white },

  // Stepper
  stepperContainer: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 16, marginBottom: 16 },
  stepItem: { alignItems: 'center', width: 56 },
  stepCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.whiteAlpha05, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  stepCircleActive: { backgroundColor: Colors.accent },
  stepNum: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.iconMuted },
  stepNumActive: { color: Colors.white },
  stepLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size8, color: Colors.iconMuted, letterSpacing: 0.8 },
  stepLabelActive: { color: Colors.white },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.whiteAlpha08, marginTop: 12, marginHorizontal: -8 },
  stepLineActive: { backgroundColor: Colors.accent },

  // Section Box
  sectionBox: { backgroundColor: Colors.bgSecondaryAlt, borderRadius: 14, borderWidth: 1, borderColor: Colors.whiteAlpha06, marginBottom: 12 },
  sectionBoxHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha05, borderLeftWidth: 3, borderLeftColor: Colors.whiteAlpha15, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  sectionBoxTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white, letterSpacing: 1, flex: 1 },
  sectionBoxBody: { padding: 14 },

  // Labels
  sectionLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.white, letterSpacing: 1.2, marginBottom: 8 },
  fieldHint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted, marginBottom: 8, lineHeight: 16 },
  deliveryPreview: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: Colors.infoBlueAlpha08, borderWidth: 1, borderColor: Colors.infoBlueAlpha20, borderRadius: 8, padding: 10 },
  deliveryPreviewText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.paleBlue_93c5fd, flex: 1, lineHeight: 17 },
  fieldHintRed: { fontFamily: FontFamily.regular, fontSize: FontSize.size10, color: Colors.accent, marginBottom: 8 },

  // Input
  input: { backgroundColor: Colors.deepBlue_1a1a22, borderRadius: 10, borderWidth: 1, borderColor: Colors.whiteAlpha08, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.medium, fontSize: FontSize.size14, color: Colors.white, marginBottom: 0 },
  inlineError: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.error, marginTop: 4 },

  // PickerField (Make/Model search-or-type sheet — F26)
  pickerFieldInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerFieldValue: { fontFamily: FontFamily.medium, fontSize: FontSize.size14, color: Colors.white, flex: 1 },
  pickerFieldPlaceholder: { fontFamily: FontFamily.medium, fontSize: FontSize.size14, color: Colors.borderMuted, flex: 1 },
  pickerSearchInput: { backgroundColor: Colors.deepBlue_1a1a22, borderRadius: 10, borderWidth: 1, borderColor: Colors.whiteAlpha08, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.medium, fontSize: FontSize.size14, color: Colors.white, marginBottom: 10 },
  pickerOptionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha06 },
  pickerOptionText: { fontFamily: FontFamily.medium, fontSize: FontSize.size14, color: Colors.white, flex: 1 },
  pickerEmptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 20 },

  // DVLA
  vrmRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  vrmInput: { flex: 1, backgroundColor: Colors.lightYellow, borderRadius: 10, paddingHorizontal: 16, fontFamily: FontFamily.black, fontSize: FontSize.size22, color: Colors.black, letterSpacing: 2 } as any,
  vrmBtn: { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', minWidth: 120 },
  vrmBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white, letterSpacing: 0.8 },
  dvlaSuccess: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, padding: 10, backgroundColor: Colors.accentGreenAlpha08, borderRadius: 8, borderWidth: 1, borderColor: Colors.accentGreenAlpha20 },
  dvlaSuccessText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.accentGreen, flex: 1 },
  dvlaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, marginBottom: 12 },
  dvlaField: { width: '50%', paddingVertical: 8, paddingRight: 8 },
  dvlaFieldLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.iconMuted, letterSpacing: 1, marginBottom: 3 },
  dvlaFieldValue: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.white },
  motHistoryBox: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: Colors.infoBlueAlpha08, borderWidth: 1, borderColor: Colors.infoBlueAlpha20 },
  motHistoryTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.infoBlue, letterSpacing: 1, marginBottom: 8 },
  motHistoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  motHistoryDate: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white },
  motHistoryMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.size9, color: Colors.iconMuted, marginTop: 2 },
  motHistoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  motHistoryBadgePass: { backgroundColor: Colors.accentGreenAlpha20 },
  motHistoryBadgeFail: { backgroundColor: Colors.errorAlpha20 },
  motHistoryBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.size8, color: Colors.white, letterSpacing: 0.5 },

  // Pills
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.whiteAlpha04, borderWidth: 1, borderColor: Colors.whiteAlpha08 },
  pillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  pillText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
  pillTextActive: { color: Colors.white },
  zoneChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  zoneHint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted, marginTop: 6, lineHeight: 16 },

  // Yes/No
  yesno: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.whiteAlpha04, borderWidth: 1, borderColor: Colors.whiteAlpha08 },
  yesnoActive: { backgroundColor: Colors.accentAlpha15, borderColor: Colors.accent },
  yesnoText: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.textSecondary },
  yesnoTextActive: { color: Colors.white },

  // AI
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.accent, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 8 },
  aiBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.white, letterSpacing: 0.8 },

  // Legal
  warnText: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.warning, lineHeight: 18, marginBottom: 14, padding: 10, backgroundColor: Colors.warningAlpha08, borderRadius: 8 },
  declRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.whiteAlpha08, backgroundColor: Colors.whiteAlpha02, marginTop: 8 },
  declRowActive: { borderColor: Colors.accentAlpha40, backgroundColor: Colors.accentAlpha05 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: Colors.iconMuted, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  checkboxActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  declText: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textSecondary, lineHeight: 18, flex: 1 },

  // Photo
  photoTracker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  photoTrackerLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.white },
  photoTrackerCount: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.accent },
  photoTrackerBar: { height: 4, backgroundColor: Colors.whiteAlpha10, borderRadius: 2, marginBottom: 8 },
  photoTrackerFill: { height: 4, backgroundColor: Colors.accent, borderRadius: 2 },
  photoTrackerHint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted, marginBottom: 16 },
  photoTabs: { flexDirection: 'row', gap: 0, marginBottom: 14, backgroundColor: Colors.bgSecondaryAlt, borderRadius: 10, padding: 3 },
  photoTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  photoTabActive: { backgroundColor: Colors.accent },
  photoTabText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.iconMuted },
  photoTabTextActive: { color: Colors.white },
  proTip: { flexDirection: 'row', gap: 8, backgroundColor: Colors.infoBlueAlpha08, borderWidth: 1, borderColor: Colors.infoBlueAlpha20, borderRadius: 10, padding: 10, marginBottom: 14 },
  proTipText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.paleBlue_93c5fd, lineHeight: 16, flex: 1 },
  uploadZone: { borderWidth: 1, borderColor: Colors.whiteAlpha10, borderStyle: 'dashed', borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 36, gap: 8 },
  uploadZoneTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white },
  uploadZoneHint: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.iconMuted },
  uploadZoneFormats: { fontFamily: FontFamily.regular, fontSize: FontSize.size10, color: Colors.borderMuted },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: (SW - 32 - 24) / 4, aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.deepBlue_1a1a22 },
  photoThumbImg: { width: '100%', height: '100%' },
  coverBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: Colors.accent, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 },
  coverBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.size7, color: Colors.white },
  photoRemoveBtn: { position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  photoProgressBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(0,0,0,0.4)' },
  photoProgressFill: { height: 4, backgroundColor: Colors.accent ?? Colors.accent, borderRadius: 0 },

  // Damage Map
  dmgForm: { backgroundColor: Colors.bgSecondaryAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.accentAlpha20, padding: 14, marginBottom: 12 },
  dmgFormTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 12 },
  dmgRecord: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.whiteAlpha03, borderRadius: 8, padding: 10, marginBottom: 6 },
  dmgRecordZone: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.white, marginBottom: 2 },
  dmgRecordMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted },

  // Pricing
  priceInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.deepBlue_1a1a22, borderRadius: 10, borderWidth: 1, borderColor: Colors.whiteAlpha08, paddingHorizontal: 14, height: 52, marginBottom: 0 },
  priceInputWrapActive: { borderColor: Colors.accentAlpha40, backgroundColor: Colors.accentAlpha04 },
  priceCurrency: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.textSecondary, marginRight: 6 },
  priceInput: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.white },
  priceRangeBar: { height: 6, backgroundColor: Colors.warningAlpha15, borderRadius: 3, marginBottom: 0 },
  priceRangeFill: { height: 6, width: '100%', backgroundColor: Colors.warning, borderRadius: 3 },
  priceRangeLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },

  // Badge Cards
  badgeCard: { backgroundColor: Colors.bgSecondaryAlt, borderRadius: 14, borderWidth: 1, borderColor: Colors.whiteAlpha06, padding: 14, position: 'relative', overflow: 'hidden' },
  badgeSelected: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeSelectedText: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.white, letterSpacing: 0.8 },
  badgePopular: { position: 'absolute', top: 0, right: 0, backgroundColor: Colors.infoBlue, paddingHorizontal: 8, paddingVertical: 4, borderBottomLeftRadius: 8 },
  badgePopularText: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.white },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.iconMuted, alignItems: 'center', justifyContent: 'center' },
  badgeLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, marginBottom: 2 },
  badgePrice: { fontFamily: FontFamily.extraBold, fontSize: FontSize.size22, marginBottom: 2 },
  badgeSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted },
  badgeFeatureText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary },

  // Review
  reviewHeading: { fontFamily: FontFamily.extraBold, fontSize: FontSize.size22, color: Colors.white, marginBottom: 16 },
  reviewEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewEditText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.accent },
  reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  reviewCell: { width: '50%', paddingVertical: 8, paddingRight: 8 },
  reviewCellLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.iconMuted, letterSpacing: 1, marginBottom: 3 },
  reviewCellValue: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.paleBlue_c0c0cb },
  reviewFeatureChip: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.whiteAlpha06, borderRadius: 12 },
  reviewFeatureChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.size10, color: Colors.textSecondary },

  // Auction Schedule
  auctionModeBtn: { flex: 1, backgroundColor: Colors.whiteAlpha03, borderRadius: 12, borderWidth: 1, borderColor: Colors.whiteAlpha08, padding: 14, alignItems: 'flex-start', gap: 4 },
  auctionModeBtnActive: { borderColor: Colors.lightOrange_f97316, backgroundColor: 'rgba(249,115,22,0.08)' },
  auctionModeBtnIcon: { fontSize: FontSize.xl, marginBottom: 4 },
  auctionModeBtnTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, marginBottom: 2 },
  auctionModeBtnHint: { fontFamily: FontFamily.regular, fontSize: FontSize.size10, color: Colors.iconMuted },

  // Body type pill with icon stacked
  bodyTypePill: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, gap: 4 },

  // HPI callout in review
  hpiCallout: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.07)', borderWidth: 1, borderColor: Colors.infoBlueAlpha20, borderRadius: 14, padding: 14, marginBottom: 12, gap: 12 },
  hpiCalloutIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.infoBlueAlpha12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hpiCalloutTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.white, marginBottom: 3 },
  hpiCalloutSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  hpiCalloutBadge: { backgroundColor: Colors.infoBlueAlpha15, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  hpiCalloutPrice: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.infoBlueLight },

  // Bottom Bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: Colors.bgPrimary, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha05, flexDirection: 'row', gap: 10 },
  backBtnSm: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 52, borderRadius: 12, borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.whiteAlpha05 },
  backBtnSmText: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.white },
  nextBtn: { flex: 1, backgroundColor: Colors.accent, borderRadius: 12, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, letterSpacing: 0.8 },
  publishBtn: { backgroundColor: Colors.accentGreen },
});
