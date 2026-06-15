import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, TextInput, ActivityIndicator, Alert,
  Switch, Dimensions, Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily, FontSize } from '../../constants/typography';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/apiClient';
import { supabase } from '../../lib/supabase';

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

const FUEL_TYPES = [
  { v: 'PETROL', l: 'Petrol' }, { v: 'DIESEL', l: 'Diesel' },
  { v: 'ELECTRIC', l: 'Electric' }, { v: 'HYBRID', l: 'Hybrid' },
  { v: 'PLUGIN_HYBRID', l: 'Plug-in Hybrid' },
];
const TRANSMISSIONS = [
  { v: 'AUTOMATIC', l: 'Automatic' }, { v: 'MANUAL', l: 'Manual' },
  { v: 'SEMI_AUTO', l: 'Semi-Auto' },
];
const DRIVE_TYPES = [
  { v: 'FWD', l: 'FWD' }, { v: 'RWD', l: 'RWD' },
  { v: 'AWD', l: 'AWD' }, { v: '4x4', l: '4x4' },
];
const SERVICE_HISTORY_OPTS = [
  { v: 'FULL_MAIN_DEALER', l: 'Full Main Dealer' },
  { v: 'FULL_INDEPENDENT', l: 'Full Independent' },
  { v: 'PARTIAL', l: 'Partial' }, { v: 'NONE', l: 'None' },
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
const BODY_TYPES = [
  { v: 'HATCHBACK', l: 'Hatchback' }, { v: 'SALOON', l: 'Saloon' },
  { v: 'ESTATE', l: 'Estate' }, { v: 'SUV', l: 'SUV' },
  { v: 'COUPE', l: 'Coupé' }, { v: 'CONVERTIBLE', l: 'Convertible' },
  { v: 'MPV', l: 'MPV' }, { v: 'VAN', l: 'Van' },
  { v: 'PICKUP', l: 'Pickup' }, { v: 'OTHER', l: 'Other' },
];
const DAMAGE_ZONES = [
  'Front Bumper', 'Bonnet', 'Windscreen (Front)', 'Front Left Wing', 'Front Right Wing',
  'Driver Side Door(s)', 'Passenger Side Door(s)', 'Roof', 'Rear Window',
  'Boot / Tailgate', 'Rear Bumper', 'Wheel (FL)', 'Wheel (FR)', 'Wheel (RL)', 'Wheel (RR)',
];
const DAMAGE_TYPES = ['SCRATCH', 'SCUFF', 'DENT', 'CRACK', 'OTHER'];

const BADGES = [
  {
    id: 'FREE' as const, label: 'Auction', price: 'Free',
    sub: '£0 seller listing fee',
    listingType: 'AUCTION' as const,
    features: ['Open bidding', '24-hour auction', 'Anyone can bid'],
    negative: ['No trust badges'],
    accent: '#F97316',
  },
  {
    id: 'BASIC' as const, label: 'Basic', price: '£1',
    sub: 'Standard listing',
    listingType: 'CLASSIFIED' as const,
    features: ['Standard listing', 'Offer range system'],
    negative: ['No trust badges', 'No featured boost'],
    accent: '#FFFFFF',
  },
  {
    id: 'STANDARD' as const, label: 'Standard', price: '£10',
    sub: 'Most popular',
    listingType: 'CLASSIFIED' as const,
    features: ['Everything in Basic', 'VIN Report badge', 'Verified Seller badge'],
    negative: ['No featured boost'],
    accent: '#3B82F6',
  },
  {
    id: 'PREMIUM' as const, label: 'Premium', price: '£25',
    sub: 'Best value',
    listingType: 'CLASSIFIED' as const,
    features: ['Everything in Standard', 'Featured boost (28 days)', 'Priority in search results', 'Featured badge on listing'],
    negative: [],
    accent: '#F59E0B',
  },
];

type BadgeTier = 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM';
const { width: SW } = Dimensions.get('window');

// ─── Small helper components ──────────────────────────────────────────────────

const SL = ({ label, required }: { label: string; required?: boolean }) => (
  <Text style={s.sectionLabel}>{label}{required ? ' *' : ''}</Text>
);

function FieldInput({
  label, value, onChange, placeholder, keyboardType, multiline, required, hint
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean;
  required?: boolean; hint?: string;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <SL label={label} required={required} />
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
      <TextInput
        style={[s.input, multiline && { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#404050"
        keyboardType={keyboardType}
        multiline={multiline}
        autoCorrect={false}
      />
    </View>
  );
}

function PillRow<T extends string>({
  label, options, value, onSelect, required
}: {
  label: string; options: { v: T; l: string }[]; value: T | '';
  onSelect: (v: T) => void; required?: boolean;
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
    </View>
  );
}

function YesNoRow({
  label, value, onChange, required
}: {
  label: string; value: boolean | null;
  onChange: (v: boolean) => void; required?: boolean;
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

function DamageMapper({
  records, onAdd, onRemove
}: {
  records: DamageEntry[];
  onAdd: (entry: DamageEntry) => void;
  onRemove: (id: string) => void;
}) {
  const [addingZone, setAddingZone] = useState<string | null>(null);
  const [dmgType, setDmgType] = useState<DamageEntry['type']>('SCRATCH');
  const [dmgDesc, setDmgDesc] = useState('');

  const markedZones = new Set(records.map(r => r.zone));

  // Simple top-down car visual using Views
  const carRows: Array<{ zones: Array<{ key: string; flex: number }> }> = [
    { zones: [{ key: 'Front Bumper', flex: 1 }] },
    { zones: [{ key: 'Front Left Wing', flex: 1 }, { key: 'Bonnet', flex: 2 }, { key: 'Front Right Wing', flex: 1 }] },
    { zones: [{ key: 'Windscreen (Front)', flex: 1 }] },
    { zones: [{ key: 'Driver Side Door(s)', flex: 1 }, { key: 'Roof', flex: 2 }, { key: 'Passenger Side Door(s)', flex: 1 }] },
    { zones: [{ key: 'Rear Window', flex: 1 }] },
    { zones: [{ key: 'Wheel (RL)', flex: 1 }, { key: 'Boot / Tailgate', flex: 2 }, { key: 'Wheel (RR)', flex: 1 }] },
    { zones: [{ key: 'Rear Bumper', flex: 1 }] },
  ];

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

  return (
    <View>
      <Text style={s.dvlaFieldLabel}>Tap a zone to mark damage</Text>

      {/* 2D car outline */}
      <View style={s.carDiagram}>
        {carRows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', marginBottom: 2 }}>
            {row.zones.map(z => {
              const marked = markedZones.has(z.key);
              return (
                <TouchableOpacity
                  key={z.key}
                  style={[s.carZone, { flex: z.flex }, marked && s.carZoneMarked]}
                  onPress={() => setAddingZone(z.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.carZoneText, marked && s.carZoneTextMarked]} numberOfLines={2}>
                    {z.key}
                  </Text>
                  {marked && <View style={s.carZoneDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        {/* wheels not in top view — shown separately */}
        <View style={{ flexDirection: 'row', marginTop: 4, gap: 8 }}>
          {['Wheel (FL)', 'Wheel (FR)'].map(z => {
            const marked = markedZones.has(z);
            return (
              <TouchableOpacity
                key={z}
                style={[s.wheelZone, marked && s.carZoneMarked]}
                onPress={() => setAddingZone(z)}
                activeOpacity={0.7}
              >
                <Text style={[s.carZoneText, marked && s.carZoneTextMarked]}>{z}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Inline add form */}
      {addingZone && (
        <View style={s.dmgForm}>
          <Text style={s.dmgFormTitle}>Mark damage: <Text style={{ color: '#DC1F26' }}>{addingZone}</Text></Text>
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
            placeholderTextColor="#404050"
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[s.pill, { flex: 1, justifyContent: 'center', paddingVertical: 12 }]} onPress={() => setAddingZone(null)}>
              <Text style={s.pillText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.pill, s.pillActive, { flex: 2, justifyContent: 'center', paddingVertical: 12 }]} onPress={confirmAdd}>
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
              <TouchableOpacity onPress={() => onRemove(r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color="#DC1F26" />
              </TouchableOpacity>
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
  // Legal declarations
  const [writeOffCat, setWriteOffCat] = useState('');
  const [stolenRecovered, setStolenRecovered] = useState<boolean | null>(null);
  const [outstandingFinance, setOutstandingFinance] = useState<boolean | null>(null);
  const [isLegalKeeper, setIsLegalKeeper] = useState<boolean | null>(null);
  const [declAcknowledged, setDeclAcknowledged] = useState(false);

  // ── Step 2 — Media ──
  const [photoTab, setPhotoTab] = useState<'Exterior' | 'Interior' | 'Damage'>('Exterior');
  const [exteriorImages, setExteriorImages] = useState<string[]>([]);
  const [interiorImages, setInteriorImages] = useState<string[]>([]);
  const [damageImages, setDamageImages] = useState<string[]>([]);
  const [damageRecords, setDamageRecords] = useState<DamageEntry[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── Step 3 — Pricing ──
  const [priceMin, setPriceMin] = useState('');
  const [priceAsking, setPriceAsking] = useState('');
  const [badgeTier, setBadgeTier] = useState<BadgeTier>('BASIC');
  const [listingType, setListingType] = useState<'CLASSIFIED' | 'AUCTION'>('CLASSIFIED');

  // ── Step 4 — Auction Schedule (only when listingType=AUCTION) ──
  const [auctionStartMode, setAuctionStartMode] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [auctionStartDate, setAuctionStartDate] = useState('');
  const [reservePrice, setReservePrice] = useState('');
  const [startingBid, setStartingBid] = useState('');
  const [minIncrement, setMinIncrement] = useState('100');

  // ── Publishing ──
  const [isPublishing, setIsPublishing] = useState(false);
  const [editMode] = useState<boolean>(!!(route?.params?.listingId));
  const [editListingId] = useState<string | null>(route?.params?.listingId ?? null);

  // ── Inline validation (Step 1 user-entered fields, Step 3 pricing) ──
  // Touched tracks whether user has interacted with a field (blur or change after focus)
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const fieldTouched = (key: string) => () => setTouched(prev => ({ ...prev, [key]: true }));

  // Validation rules — returns null (valid) or an error string (invalid)
  const fieldError = (key: string): string | null => {
    if (!touched[key]) return null;
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
    return null;
  };

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

  // ─── DVLA Lookup ─────────────────────────────────────────────────────────────

  async function handleDvlaLookup() {
    const clean = vrm.replace(/\s/g, '').toUpperCase();
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
      if (data.monthOfFirstRegistration) setFirstRegistered(String(data.monthOfFirstRegistration));
      if (data.wheelplan) setWheelplan(String(data.wheelplan));
      if (data.typeApproval) setTypeApproval(String(data.typeApproval));
      if (data.dateOfLastV5CIssued) setLastV5C(String(data.dateOfLastV5CIssued));
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
        body: JSON.stringify({ make, model, year, mileage, fuelType, transmission, colour, features }),
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

  // ─── Photo Handling ───────────────────────────────────────────────────────────

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingPhoto(true);
    try {
      const urls: string[] = [];
      for (const asset of result.assets) {
        const url = await uploadToSupabase(asset.uri);
        urls.push(url);
      }
      if (photoTab === 'Exterior') setExteriorImages(p => [...p, ...urls]);
      else if (photoTab === 'Interior') setInteriorImages(p => [...p, ...urls]);
      else setDamageImages(p => [...p, ...urls]);
    } catch {
      Alert.alert('Upload failed', 'Could not upload one or more photos.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function uploadToSupabase(uri: string): Promise<string> {
    const fileName = `listings/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const { data, error } = await supabase.storage.from('listings').upload(fileName, blob, {
      contentType: 'image/jpeg', upsert: false,
    });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('listings').getPublicUrl(data.path);
    return urlData.publicUrl;
  }

  function removePhoto(tab: string, uri: string) {
    if (tab === 'Exterior') setExteriorImages(p => p.filter(x => x !== uri));
    else if (tab === 'Interior') setInteriorImages(p => p.filter(x => x !== uri));
    else setDamageImages(p => p.filter(x => x !== uri));
  }

  // ─── Validation ───────────────────────────────────────────────────────────────

  const isAuction = listingType === 'AUCTION';
  const totalSteps = isAuction ? 5 : 4;

  function validateStep(s: Step): boolean {
    if (s === 1) {
      if (!make.trim()) { Alert.alert('Required', 'Please enter the vehicle make.'); return false; }
      if (!model.trim()) { Alert.alert('Required', 'Please enter the vehicle model.'); return false; }
      if (!year.trim()) { Alert.alert('Required', 'Please enter the vehicle year.'); return false; }
      if (!mileage.trim()) { Alert.alert('Required', 'Please enter the mileage.'); return false; }
      if (!title.trim()) { Alert.alert('Required', 'Please enter a listing title.'); return false; }
      if (!writeOffCat) { Alert.alert('Required', 'Please complete the write-off declaration.'); return false; }
      if ((writeOffCat === 'CAT_A' || writeOffCat === 'CAT_B') && !isAuction) {
        Alert.alert('Auction Only', 'Cat A and Cat B write-off vehicles can only be listed via auction. Select the Auction option in Step 3 Pricing.');
        return false;
      }
      if (stolenRecovered === null) { Alert.alert('Required', 'Please answer the stolen/recovered question.'); return false; }
      if (outstandingFinance === null) { Alert.alert('Required', 'Please answer the outstanding finance question.'); return false; }
      if (isLegalKeeper === null) { Alert.alert('Required', 'Please confirm if you are the legal registered keeper.'); return false; }
      if (!declAcknowledged) { Alert.alert('Required', 'Please acknowledge the declaration.'); return false; }
    }
    if (s === 3 && !isAuction) {
      if (!priceAsking.trim()) { Alert.alert('Required', 'Please enter an asking price.'); return false; }
    }
    if (s === 3 && isAuction) {
      if (!priceAsking.trim()) { Alert.alert('Required', 'Please enter a reserve price / asking price.'); return false; }
    }
    if (s === 4 && isAuction) {
      if (auctionStartMode === 'SCHEDULED' && !auctionStartDate.trim()) { Alert.alert('Required', 'Please enter the auction start date/time.'); return false; }
      if (!reservePrice.trim() || parseFloat(reservePrice) <= 0) { Alert.alert('Required', 'Please enter a reserve price.'); return false; }
      if (!startingBid.trim() || parseFloat(startingBid) <= 0) { Alert.alert('Required', 'Please enter a starting bid.'); return false; }
      if (!minIncrement.trim() || parseFloat(minIncrement) <= 0) { Alert.alert('Required', 'Please enter a minimum bid increment.'); return false; }
    }
    return true;
  }

  // ─── Publish ─────────────────────────────────────────────────────────────────

  async function handlePublish() {
    if (allImages.length === 0) {
      Alert.alert('Photos Required', 'Please add at least one photo of the vehicle before publishing your listing.');
      return;
    }
    setIsPublishing(true);
    try {
      const payload: Record<string, any> = {
        vehicleType,
        vrm: vrm.replace(/\s/g, '').toUpperCase(),
        vin, make, model, year: year ? parseInt(year) : undefined,
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
        features, title, description,
        owners: owners ? parseInt(owners) : undefined,
        isImported,
        writeOffCategory: writeOffCat,
        stolenRecovered, hasOutstandingFinance: outstandingFinance,
        isLegalRegisteredKeeper: isLegalKeeper,
        declarationAcknowledged: declAcknowledged,
        images: allImages,
        priceMin: priceMin ? parseFloat(priceMin.replace(/[^0-9.]/g, '')) : undefined,
        priceAsking: priceAsking ? parseFloat(priceAsking.replace(/[^0-9.]/g, '')) : undefined,
        price: priceAsking ? parseFloat(priceAsking.replace(/[^0-9.]/g, '')) : 0,
        badgeTier,
        listingType,
        damageRecords: damageRecords.map(r => ({ zone: r.zone, type: r.type, description: r.description })),
        // DVLA fields
        motStatus, taxStatus, motExpiryDate: motExpiry, taxDueDate: taxDue,
        monthOfFirstRegistration: firstRegistered, wheelplan, typeApproval, dateOfLastV5CIssued: lastV5C,
      };
      // Remove undefined values
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

      if (editMode && editListingId) {
        await apiClient(`/listings/${editListingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        Alert.alert('Updated!', 'Your listing has been updated.', [
          { text: 'Done', onPress: () => navigation?.navigate('SellerListings') },
        ]);
      } else {
        const res = await apiClient<{ data: { id: string } }>('/listings', { method: 'POST', body: JSON.stringify(payload) });
        // If auction, schedule it
        if (isAuction && res?.data?.id) {
          const auctionPayload: Record<string, any> = {
            listingId: res.data.id,
            reservePrice: parseFloat(reservePrice),
            startingBid: parseFloat(startingBid),
            minIncrement: parseFloat(minIncrement),
            durationHours: 24,
            antiSnipeMinutes: 3,
          };
          if (auctionStartMode === 'NOW') {
            auctionPayload.startTime = new Date().toISOString();
          } else {
            auctionPayload.startTime = new Date(auctionStartDate).toISOString();
          }
          Object.keys(auctionPayload).forEach(k => auctionPayload[k] === undefined && delete auctionPayload[k]);
          await apiClient('/auctions', { method: 'POST', body: JSON.stringify(auctionPayload) });
        }
        Alert.alert(
          isAuction ? 'Auction Scheduled!' : 'Published!',
          isAuction ? 'Your auction is now live.' : 'Your listing is now live.',
          [{ text: 'View Listings', onPress: () => navigation?.navigate('SellerListings') }],
        );
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
    if (step < totalSteps) setStep((step + 1) as Step);
  }

  function handleBack() {
    if (step > 1) setStep((step - 1) as Step);
    else navigation?.goBack();
  }

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
                    ? <Ionicons name="checkmark" size={13} color="#FFF" />
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 120 }]}>

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
        <SectionBox title="Registration (VRM) *" accent="#DC1F26">
          <Text style={s.fieldHint}>Enter the UK registration plate and tap Analyse to auto-fill vehicle details.</Text>
          <View style={s.vrmRow}>
            <TextInput
              style={s.vrmInput}
              value={vrm}
              onChangeText={t => setVrm(t.toUpperCase())}
              placeholder="e.g. AB12 CDE"
              placeholderTextColor="#806000"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[s.vrmBtn, dvlaLoading && { opacity: 0.6 }]}
              onPress={handleDvlaLookup}
              disabled={dvlaLoading}
              activeOpacity={0.8}
            >
              {dvlaLoading
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={s.vrmBtnText}>ANALYSE DATA</Text>
              }
            </TouchableOpacity>
          </View>
          {dvlaFetched && (
            <View style={s.dvlaSuccess}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={s.dvlaSuccessText}>DVLA data loaded — these fields are auto-filled but editable.</Text>
            </View>
          )}
        </SectionBox>

        {/* Registration & Compliance — DVLA auto-filled */}
        <SectionBox title="Registration & Compliance" accent="#3B82F6">
          <Text style={s.fieldHint}>These fields are filled from the DVLA and VIN database. They may not always be accurate.</Text>
          <View style={s.dvlaGrid}>
            <DVLAField label="LAST V5C ISSUED" value={lastV5C} />
            <DVLAField label="MOT STATUS" value={motStatus} />
            <DVLAField label="MOT EXPIRY DATE" value={motExpiry} />
            <DVLAField label="TAX STATUS" value={taxStatus} />
            <DVLAField label="TAX DUE DATE" value={taxDue} />
            <DVLAField label="FIRST REGISTERED" value={firstRegistered} />
            <DVLAField label="WHEELPLAN" value={wheelplan} />
            <DVLAField label="TYPE APPROVAL" value={typeApproval} />
          </View>
          <FieldInput label="VIN" value={vin} onChange={setVin} placeholder="17-character VIN" hint="Optional — from VIN database" />
        </SectionBox>

        {/* Make / Model / Year */}
        <SectionBox title="Make / Model / Year">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FieldInput label="MAKE *" value={make} onChange={setMake} placeholder="e.g. BMW" required />
            </View>
            <View style={{ flex: 1 }}>
              <FieldInput label="MODEL *" value={model} onChange={setModel} placeholder="e.g. M4" required />
            </View>
            <View style={{ width: 80 }}>
              <FieldInput label="YEAR *" value={year} onChange={setYear} placeholder="2021" keyboardType="number-pad" required />
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
                style={[s.pill, bodyType === bt.v && s.pillActive]}
                onPress={() => setBodyType(bt.v)}
                activeOpacity={0.7}
              >
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
                placeholderTextColor="#404050"
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
            placeholderTextColor="#404050"
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
              placeholderTextColor="#404050"
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
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <>
                      <Ionicons name="sparkles" size={12} color="#FFF" />
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
              placeholderTextColor="#404050"
              multiline
            />
          </View>
        </SectionBox>

        {/* Ownership */}
        <SectionBox title="Ownership">
          <View>
            <SL label="NUMBER OF OWNERS" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['1 Owner', '2 Owners', '3+ Owners'].map(k => (
                <TouchableOpacity key={k} style={[s.pill, owners === k && s.pillActive]} onPress={() => setOwners(k)} activeOpacity={0.7}>
                  <Text style={[s.pillText, owners === k && s.pillTextActive]}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <Text style={s.sectionLabel}>IMPORTED VEHICLE</Text>
            <Switch
              value={isImported}
              onValueChange={setIsImported}
              trackColor={{ false: '#2A2A35', true: '#DC1F26' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </SectionBox>

        {/* Write-Off & Legal Declaration */}
        <SectionBox title="Write-Off & Legal Declaration" accent="#DC1F26">
          <Text style={s.warnText}>
            Required by law. False declarations can constitute fraud and must be reported to relevant authorities.
          </Text>
          <View>
            <SL label="INSURANCE WRITE-OFF STATUS *" required />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {WRITE_OFF_CATS.map(c => (
                <TouchableOpacity
                  key={c.v}
                  style={[s.pill, writeOffCat === c.v && s.pillActive, c.v !== 'NONE' && writeOffCat === c.v && { backgroundColor: 'rgba(220,31,38,0.15)', borderColor: '#DC1F26' }]}
                  onPress={() => setWriteOffCat(c.v)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.pillText, writeOffCat === c.v && s.pillTextActive]}>{c.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ marginTop: 16 }}>
            <YesNoRow label="HAS THIS VEHICLE EVER BEEN REPORTED STOLEN OR RECOVERED? *" value={stolenRecovered} onChange={setStolenRecovered} required />
            <YesNoRow label="IS THERE CURRENTLY OUTSTANDING FINANCE ON THE VEHICLE? *" value={outstandingFinance} onChange={setOutstandingFinance} required />
            <YesNoRow label="ARE YOU THE LEGAL REGISTERED KEEPER OF THIS VEHICLE? *" value={isLegalKeeper} onChange={setIsLegalKeeper} required />
          </View>
          <TouchableOpacity
            style={[s.declRow, declAcknowledged && s.declRowActive]}
            onPress={() => setDeclAcknowledged(p => !p)}
            activeOpacity={0.8}
          >
            <View style={[s.checkbox, declAcknowledged && s.checkboxActive]}>
              {declAcknowledged && <Ionicons name="checkmark" size={12} color="#FFF" />}
            </View>
            <Text style={s.declText}>
              I confirm that the above declarations are true and accurate to the best of my knowledge.
              I understand that false declarations on this listing may have legal consequences.
            </Text>
          </TouchableOpacity>
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
            <Ionicons name="camera" size={14} color="#DC1F26" />
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
            <Ionicons name="information-circle-outline" size={14} color="#3B82F6" />
            <Text style={s.proTipText}>PRO TIP — EXTERIOR: Park in an open, well-lit area. Take photos from all 4 corners, straight on front/back, and close-ups of wheels.</Text>
          </View>
        )}
        {photoTab === 'Interior' && (
          <View style={s.proTip}>
            <Ionicons name="information-circle-outline" size={14} color="#3B82F6" />
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
                ? <ActivityIndicator color="#DC1F26" />
                : <>
                    <Ionicons name="camera-outline" size={28} color="#606070" />
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
                  {tabImages.map((uri, i) => (
                    <View key={uri} style={s.photoThumb}>
                      <ExpoImage
                        source={{ uri }}
                        style={s.photoThumbImg}
                        contentFit="cover"
                        transition={200}
                        placeholderContentFit="cover"
                      />
                      {i === 0 && <View style={s.coverBadge}><Text style={s.coverBadgeText}>COVER</Text></View>}
                      <TouchableOpacity style={s.photoRemoveBtn} onPress={() => removePhoto(photoTab, uri)}>
                        <Ionicons name="close" size={10} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          /* Damage Map */
          <View>
            <SectionBox title="Damage Map — Select Damaged Areas" accent="#F59E0B">
              <Text style={s.fieldHint}>
                Tap a zone on the car diagram to mark damage. Add damage type and description for each area.
              </Text>
              <DamageMapper
                records={damageRecords}
                onAdd={entry => setDamageRecords(p => [...p, entry])}
                onRemove={id => setDamageRecords(p => p.filter(r => r.id !== id))}
              />
            </SectionBox>
          </View>
        )}

      </ScrollView>
    );
  }

  // ─── Step 3 — Pricing ────────────────────────────────────────────────────────

  function renderStep3() {
    const minVal = parseFloat(priceMin.replace(/[^0-9.]/g, '')) || 0;
    const askVal = parseFloat(priceAsking.replace(/[^0-9.]/g, '')) || 0;
    const isValidRange = askVal > 0 && (minVal === 0 || minVal < askVal);

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 120 }]}>

        <SectionBox title="Set Your Price Range" accent="#DC1F26">
          <Text style={s.fieldHint}>
            The <Text style={{ color: '#FFFFFF', fontFamily: FontFamily.bold }}>Asking Price</Text> is displayed publicly.
            The <Text style={{ color: '#FFFFFF', fontFamily: FontFamily.bold }}>Lower (Min)</Text> defines your acceptable offer floor.
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
                  placeholderTextColor="#404050"
                  keyboardType="number-pad"
                />
              </View>
              {fieldError('priceMin') ? <Text style={s.inlineError}>{fieldError('priceMin')}</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <SL label="ASKING PRICE *" required />
              <Text style={s.fieldHintRed}>Displayed on listing — required</Text>
              <View style={[s.priceInputWrap, s.priceInputWrapActive, touched.priceAsking ? { borderColor: fieldBorderColor('priceAsking') } : {}]}>
                <Text style={[s.priceCurrency, { color: '#DC1F26' }]}>£</Text>
                <TextInput
                  style={s.priceInput}
                  value={priceAsking}
                  onChangeText={v => { setPriceAsking(v); if (touched.priceAsking) setTouched(prev => ({ ...prev, priceAsking: true })); }}
                  onBlur={fieldTouched('priceAsking')}
                  placeholder="0"
                  placeholderTextColor="#404050"
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
                <Text style={[s.fieldHint, { color: '#F59E0B' }]}>YOUR PRICE RANGE</Text>
                <Text style={[s.fieldHint, { color: isValidRange ? '#10B981' : '#DC1F26' }]}>
                  {isValidRange ? '✓ VALID' : '⚠ CHECK'}
                </Text>
              </View>
              <View style={s.priceRangeBar}>
                <View style={[s.priceRangeFill, !isValidRange && { backgroundColor: '#DC1F26' }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={[s.priceRangeLabel, { color: '#F59E0B' }]}>
                  {minVal > 0 ? `£${minVal.toLocaleString()}` : '£0'}
                </Text>
                <Text style={[s.priceRangeLabel, { color: '#FFFFFF' }]}>
                  {askVal > 0 ? `£${askVal.toLocaleString()}` : '—'}
                </Text>
              </View>
            </View>
          )}
        </SectionBox>

        {/* Seller Badges */}
        <SectionBox title="Seller Badges">
          <Text style={s.fieldHint}>
            Boost buyer confidence with trust badges on your listing. Badges increase buyer engagement and sell rates.
          </Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            {BADGES.map(badge => {
              const active = badge.id === 'FREE' ? listingType === 'AUCTION' : (badgeTier === badge.id && listingType === 'CLASSIFIED');
              return (
                <TouchableOpacity
                  key={badge.id}
                  style={[
                    s.badgeCard,
                    active && { borderColor: badge.accent, backgroundColor: `${badge.accent}14` },
                  ]}
                  onPress={() => {
                    setBadgeTier(badge.id);
                    setListingType(badge.listingType);
                  }}
                  activeOpacity={0.8}
                >
                  {badge.id === 'STANDARD' && (
                    <View style={[s.badgePopular, { backgroundColor: '#3B82F6' }]}><Text style={s.badgePopularText}>Standard</Text></View>
                  )}
                  {badge.id === 'PREMIUM' && (
                    <View style={[s.badgePopular, { backgroundColor: '#F59E0B' }]}>
                      <Text style={[s.badgePopularText, { color: '#000' }]}>Best Value</Text>
                    </View>
                  )}
                  {active && (
                    <View style={[s.badgeSelected, { backgroundColor: badge.accent }]}>
                      <Text style={[s.badgeSelectedText, badge.id === 'PREMIUM' && { color: '#000' }]}>Selected</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[s.radioCircle, active && { backgroundColor: badge.accent, borderColor: badge.accent }]}>
                      {active && <Ionicons name="checkmark" size={12} color={badge.id === 'PREMIUM' ? '#000' : '#FFF'} />}
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
                        <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                        <Text style={s.badgeFeatureText}>{f}</Text>
                      </View>
                    ))}
                    {badge.negative.map(f => (
                      <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="close" size={12} color="#404050" />
                        <Text style={[s.badgeFeatureText, { color: '#404050' }]}>{f}</Text>
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 120 }]}>

        <SectionBox title="Live Auction — 24-Hour Fixed Duration" accent="#F97316">
          <Text style={[s.fieldHint, { color: '#FB923C' }]}>
            Your auction will run for exactly 24 hours. Anti-snipe protection automatically extends bidding by 3 minutes if a bid arrives in the final 3 minutes.
          </Text>
        </SectionBox>

        {/* When to start */}
        <SectionBox title="When to Start *" accent="#F97316">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[s.auctionModeBtn, auctionStartMode === 'NOW' && s.auctionModeBtnActive]}
              onPress={() => setAuctionStartMode('NOW')}
              activeOpacity={0.7}
            >
              <Text style={s.auctionModeBtnIcon}>⚡</Text>
              <Text style={[s.auctionModeBtnTitle, auctionStartMode === 'NOW' && { color: '#FB923C' }]}>Start Immediately</Text>
              <Text style={s.auctionModeBtnHint}>Auction goes live right now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.auctionModeBtn, auctionStartMode === 'SCHEDULED' && s.auctionModeBtnActive]}
              onPress={() => setAuctionStartMode('SCHEDULED')}
              activeOpacity={0.7}
            >
              <Text style={s.auctionModeBtnIcon}>🗓️</Text>
              <Text style={[s.auctionModeBtnTitle, auctionStartMode === 'SCHEDULED' && { color: '#FB923C' }]}>Schedule</Text>
              <Text style={s.auctionModeBtnHint}>Choose a start date & time</Text>
            </TouchableOpacity>
          </View>
          {auctionStartMode === 'SCHEDULED' && (
            <View style={{ marginTop: 12 }}>
              <FieldInput
                label="START DATE & TIME"
                value={auctionStartDate}
                onChange={setAuctionStartDate}
                placeholder="e.g. 2025-12-25 14:00"
                required
              />
              <Text style={s.fieldHint}>Format: YYYY-MM-DD HH:MM (24-hour)</Text>
            </View>
          )}
        </SectionBox>

        {/* Pricing */}
        <SectionBox title="Auction Pricing" accent="#F97316">
          <FieldInput
            label="RESERVE PRICE (£) *"
            value={reservePrice}
            onChange={setReservePrice}
            placeholder="Minimum you'll accept"
            keyboardType="number-pad"
            required
            hint="The auction must reach this price for the sale to complete."
          />
          <FieldInput
            label="STARTING BID (£) *"
            value={startingBid}
            onChange={setStartingBid}
            placeholder="Opening bid amount"
            keyboardType="number-pad"
            required
            hint="The first bid placed must be at least this amount."
          />
          <FieldInput
            label="MINIMUM BID INCREMENT (£) *"
            value={minIncrement}
            onChange={setMinIncrement}
            placeholder="e.g. 100"
            keyboardType="number-pad"
            required
            hint="Each subsequent bid must raise the price by at least this amount."
          />
        </SectionBox>

        {/* Summary */}
        <SectionBox title="Auction Summary">
          <View style={s.reviewGrid}>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>DURATION</Text><Text style={s.reviewCellValue}>24 Hours</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>ANTI-SNIPE</Text><Text style={s.reviewCellValue}>3 Minutes</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>START</Text><Text style={s.reviewCellValue}>{auctionStartMode === 'NOW' ? 'Immediately' : auctionStartDate || '—'}</Text></View>
            <View style={s.reviewCell}><Text style={s.reviewCellLabel}>LISTING FEE</Text><Text style={[s.reviewCellValue, { color: '#10B981' }]}>Free</Text></View>
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 140 }]}>
        <Text style={s.reviewHeading}>Review Your Listing</Text>

        {/* Vehicle Identity */}
        <SectionBox title="Vehicle Identity" action={
          <TouchableOpacity style={s.reviewEditBtn} onPress={() => setStep(1)}>
            <Ionicons name="create-outline" size={12} color="#DC1F26" />
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
          <TouchableOpacity style={s.reviewEditBtn} onPress={() => setStep(2)}>
            <Ionicons name="create-outline" size={12} color="#DC1F26" />
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
          <TouchableOpacity style={s.reviewEditBtn} onPress={() => setStep(1)}>
            <Ionicons name="create-outline" size={12} color="#DC1F26" />
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
            <Text style={[s.reviewCellValue, { fontFamily: FontFamily.bold, fontSize: 14, marginTop: 4 }]}>{String(title)}</Text>
          </View> : null}
        </SectionBox>

        {/* Pricing */}
        <SectionBox title="Pricing" action={
          <TouchableOpacity style={s.reviewEditBtn} onPress={() => setStep(3)}>
            <Ionicons name="create-outline" size={12} color="#DC1F26" />
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
              <Text style={[s.reviewCellValue, { color: '#FFFFFF', fontFamily: FontFamily.extraBold, fontSize: 18 }]}>
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

      </ScrollView>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.03)', 'rgba(0,0,0,0)', '#0A0A0C']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.3 }}
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerSub}>SELL MY CAR</Text>
          <Text style={s.headerTitle}>
            {step === 1 ? 'Vehicle Details' : step === 2 ? 'Media & Damage' : step === 3 ? 'Pricing' : (step === 4 && isAuction) ? 'Auction Schedule' : 'Review & Publish'}
          </Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

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
            <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
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
            <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.nextBtn, s.publishBtn, isPublishing && { opacity: 0.7 }]}
            onPress={handlePublish}
            activeOpacity={0.8}
            disabled={isPublishing}
          >
            {isPublishing
              ? <ActivityIndicator color="#FFF" size="small" />
              : <>
                  <Text style={s.nextBtnText}>{editMode ? 'SAVE CHANGES' : 'PUBLISH LISTING'}</Text>
                  <Ionicons name="checkmark" size={16} color="#FFF" style={{ marginLeft: 8 }} />
                </>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center' },
  headerSub: { fontFamily: FontFamily.bold, fontSize: 9, color: '#DC1F26', letterSpacing: 1.5, marginBottom: 3 },
  headerTitle: { fontFamily: FontFamily.extraBold, fontSize: 16, color: '#FFFFFF' },

  // Stepper
  stepperContainer: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 16, marginBottom: 16 },
  stepItem: { alignItems: 'center', width: 56 },
  stepCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  stepCircleActive: { backgroundColor: '#DC1F26' },
  stepNum: { fontFamily: FontFamily.bold, fontSize: 11, color: '#606070' },
  stepNumActive: { color: '#FFFFFF' },
  stepLabel: { fontFamily: FontFamily.bold, fontSize: 8, color: '#606070', letterSpacing: 0.8 },
  stepLabelActive: { color: '#FFFFFF' },
  stepLine: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 12, marginHorizontal: -8 },
  stepLineActive: { backgroundColor: '#DC1F26' },

  // Section Box
  sectionBox: { backgroundColor: '#111116', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 12 },
  sectionBoxHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', borderLeftWidth: 3, borderLeftColor: 'rgba(255,255,255,0.15)', borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  sectionBoxTitle: { fontFamily: FontFamily.bold, fontSize: 11, color: '#FFFFFF', letterSpacing: 1, flex: 1 },
  sectionBoxBody: { padding: 14 },

  // Labels
  sectionLabel: { fontFamily: FontFamily.bold, fontSize: 10, color: '#FFFFFF', letterSpacing: 1.2, marginBottom: 8 },
  fieldHint: { fontFamily: FontFamily.regular, fontSize: 11, color: '#606070', marginBottom: 8, lineHeight: 16 },
  fieldHintRed: { fontFamily: FontFamily.regular, fontSize: 10, color: '#DC1F26', marginBottom: 8 },

  // Input
  input: { backgroundColor: '#1A1A22', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.medium, fontSize: 14, color: '#FFFFFF', marginBottom: 0 },
  inlineError: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.error, marginTop: 4 },

  // DVLA
  vrmRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  vrmInput: { flex: 1, backgroundColor: '#FCD34D', borderRadius: 10, paddingHorizontal: 16, fontFamily: FontFamily.black, fontSize: 22, color: '#000', letterSpacing: 2 } as any,
  vrmBtn: { backgroundColor: '#DC1F26', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', minWidth: 120 },
  vrmBtnText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#FFFFFF', letterSpacing: 0.8 },
  dvlaSuccess: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, padding: 10, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  dvlaSuccessText: { fontFamily: FontFamily.regular, fontSize: 11, color: '#10B981', flex: 1 },
  dvlaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, marginBottom: 12 },
  dvlaField: { width: '50%', paddingVertical: 8, paddingRight: 8 },
  dvlaFieldLabel: { fontFamily: FontFamily.bold, fontSize: 9, color: '#606070', letterSpacing: 1, marginBottom: 3 },
  dvlaFieldValue: { fontFamily: FontFamily.medium, fontSize: 13, color: '#FFFFFF' },

  // Pills
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pillActive: { backgroundColor: '#DC1F26', borderColor: '#DC1F26' },
  pillText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#A0A0AB' },
  pillTextActive: { color: '#FFFFFF' },

  // Yes/No
  yesno: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  yesnoActive: { backgroundColor: 'rgba(220,31,38,0.15)', borderColor: '#DC1F26' },
  yesnoText: { fontFamily: FontFamily.bold, fontSize: 12, color: '#A0A0AB' },
  yesnoTextActive: { color: '#FFFFFF' },

  // AI
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#DC1F26', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 8 },
  aiBtnText: { fontFamily: FontFamily.bold, fontSize: 9, color: '#FFF', letterSpacing: 0.8 },

  // Legal
  warnText: { fontFamily: FontFamily.regular, fontSize: 12, color: '#F59E0B', lineHeight: 18, marginBottom: 14, padding: 10, backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 8 },
  declRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)', marginTop: 8 },
  declRowActive: { borderColor: 'rgba(220,31,38,0.4)', backgroundColor: 'rgba(220,31,38,0.05)' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#606070', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  checkboxActive: { backgroundColor: '#DC1F26', borderColor: '#DC1F26' },
  declText: { fontFamily: FontFamily.regular, fontSize: 12, color: '#A0A0AB', lineHeight: 18, flex: 1 },

  // Photo
  photoTracker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  photoTrackerLabel: { fontFamily: FontFamily.bold, fontSize: 12, color: '#FFFFFF' },
  photoTrackerCount: { fontFamily: FontFamily.bold, fontSize: 12, color: '#DC1F26' },
  photoTrackerBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 8 },
  photoTrackerFill: { height: 4, backgroundColor: '#DC1F26', borderRadius: 2 },
  photoTrackerHint: { fontFamily: FontFamily.regular, fontSize: 11, color: '#606070', marginBottom: 16 },
  photoTabs: { flexDirection: 'row', gap: 0, marginBottom: 14, backgroundColor: '#111116', borderRadius: 10, padding: 3 },
  photoTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  photoTabActive: { backgroundColor: '#DC1F26' },
  photoTabText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#606070' },
  photoTabTextActive: { color: '#FFFFFF' },
  proTip: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', borderRadius: 10, padding: 10, marginBottom: 14 },
  proTipText: { fontFamily: FontFamily.regular, fontSize: 11, color: '#93C5FD', lineHeight: 16, flex: 1 },
  uploadZone: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed', borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 36, gap: 8 },
  uploadZoneTitle: { fontFamily: FontFamily.bold, fontSize: 15, color: '#FFFFFF' },
  uploadZoneHint: { fontFamily: FontFamily.regular, fontSize: 12, color: '#606070' },
  uploadZoneFormats: { fontFamily: FontFamily.regular, fontSize: 10, color: '#404050' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: (SW - 32 - 24) / 4, aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1A1A22' },
  photoThumbImg: { width: '100%', height: '100%' },
  coverBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: '#DC1F26', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 },
  coverBadgeText: { fontFamily: FontFamily.bold, fontSize: 7, color: '#FFF' },
  photoRemoveBtn: { position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },

  // Damage Map
  carDiagram: { backgroundColor: '#0D0D12', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 8, marginBottom: 12 },
  carZone: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 4, alignItems: 'center', justifyContent: 'center', minHeight: 34, marginHorizontal: 1, position: 'relative' },
  carZoneMarked: { backgroundColor: 'rgba(220,31,38,0.15)', borderColor: 'rgba(220,31,38,0.4)' },
  carZoneText: { fontFamily: FontFamily.bold, fontSize: 8, color: '#404050', textAlign: 'center', letterSpacing: 0.3 },
  carZoneTextMarked: { color: '#FFFFFF' },
  carZoneDot: { position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#DC1F26' },
  wheelZone: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 4, alignItems: 'center', justifyContent: 'center', height: 28 },
  dmgForm: { backgroundColor: '#111116', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(220,31,38,0.2)', padding: 14, marginBottom: 12 },
  dmgFormTitle: { fontFamily: FontFamily.bold, fontSize: 13, color: '#A0A0AB', marginBottom: 12 },
  dmgRecord: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10, marginBottom: 6 },
  dmgRecordZone: { fontFamily: FontFamily.bold, fontSize: 12, color: '#FFFFFF', marginBottom: 2 },
  dmgRecordMeta: { fontFamily: FontFamily.regular, fontSize: 11, color: '#606070' },

  // Pricing
  priceInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A22', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, height: 52, marginBottom: 0 },
  priceInputWrapActive: { borderColor: 'rgba(220,31,38,0.4)', backgroundColor: 'rgba(220,31,38,0.04)' },
  priceCurrency: { fontFamily: FontFamily.bold, fontSize: 16, color: '#A0A0AB', marginRight: 6 },
  priceInput: { flex: 1, fontFamily: FontFamily.bold, fontSize: 20, color: '#FFFFFF' },
  priceRangeBar: { height: 6, backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 3, marginBottom: 0 },
  priceRangeFill: { height: 6, width: '100%', backgroundColor: '#F59E0B', borderRadius: 3 },
  priceRangeLabel: { fontFamily: FontFamily.bold, fontSize: 11 },

  // Badge Cards
  badgeCard: { backgroundColor: '#111116', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 14, position: 'relative', overflow: 'hidden' },
  badgeSelected: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeSelectedText: { fontFamily: FontFamily.bold, fontSize: 9, color: '#FFF', letterSpacing: 0.8 },
  badgePopular: { position: 'absolute', top: 0, right: 0, backgroundColor: '#3B82F6', paddingHorizontal: 8, paddingVertical: 4, borderBottomLeftRadius: 8 },
  badgePopularText: { fontFamily: FontFamily.bold, fontSize: 9, color: '#FFF' },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#606070', alignItems: 'center', justifyContent: 'center' },
  badgeLabel: { fontFamily: FontFamily.bold, fontSize: 14, marginBottom: 2 },
  badgePrice: { fontFamily: FontFamily.extraBold, fontSize: 22, marginBottom: 2 },
  badgeSub: { fontFamily: FontFamily.regular, fontSize: 11, color: '#606070' },
  badgeFeatureText: { fontFamily: FontFamily.regular, fontSize: 11, color: '#A0A0AB' },

  // Review
  reviewHeading: { fontFamily: FontFamily.extraBold, fontSize: 22, color: '#FFFFFF', marginBottom: 16 },
  reviewEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewEditText: { fontFamily: FontFamily.bold, fontSize: 10, color: '#DC1F26' },
  reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  reviewCell: { width: '50%', paddingVertical: 8, paddingRight: 8 },
  reviewCellLabel: { fontFamily: FontFamily.bold, fontSize: 9, color: '#606070', letterSpacing: 1, marginBottom: 3 },
  reviewCellValue: { fontFamily: FontFamily.medium, fontSize: 13, color: '#C0C0CB' },
  reviewFeatureChip: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12 },
  reviewFeatureChipText: { fontFamily: FontFamily.medium, fontSize: 10, color: '#A0A0AB' },

  // Auction Schedule
  auctionModeBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14, alignItems: 'flex-start', gap: 4 },
  auctionModeBtnActive: { borderColor: '#F97316', backgroundColor: 'rgba(249,115,22,0.08)' },
  auctionModeBtnIcon: { fontSize: 20, marginBottom: 4 },
  auctionModeBtnTitle: { fontFamily: FontFamily.bold, fontSize: 13, color: '#FFFFFF', marginBottom: 2 },
  auctionModeBtnHint: { fontFamily: FontFamily.regular, fontSize: 10, color: '#606070' },

  // Bottom Bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#0A0A0C', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', gap: 10 },
  backBtnSm: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 52, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' },
  backBtnSmText: { fontFamily: FontFamily.bold, fontSize: 12, color: '#FFFFFF' },
  nextBtn: { flex: 1, backgroundColor: '#DC1F26', borderRadius: 12, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { fontFamily: FontFamily.bold, fontSize: 13, color: '#FFFFFF', letterSpacing: 0.8 },
  publishBtn: { backgroundColor: '#10B981' },
});
