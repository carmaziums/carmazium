import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { ThreeDVehicleViewer } from '../../components/damage/ThreeDVehicleViewer';
import { DAMAGE_ZONES_3D, CUSTOM_ZONE_COORDS } from '../../components/damage/damageZones';

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0A0C',
  card: '#111115',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.15)',
  accent: '#DC1F26',
  accentBg: 'rgba(220,31,38,0.12)',
  white: '#FFFFFF',
  grey1: '#E2E2EA',
  grey2: '#A0A0AB',
  grey3: '#5C5C6B',
  success: '#22C55E',
  successBg: 'rgba(34,197,94,0.10)',
  successBorder: 'rgba(34,197,94,0.25)',
  warning: '#F59E0B',
  warningBg: 'rgba(245,158,11,0.10)',
  blue: '#3B82F6',
  blueBg: 'rgba(59,130,246,0.12)',
  indigo: '#6366F1',
  indigoBg: 'rgba(99,102,241,0.12)',
  plate: '#F5C518',
  plateText: '#000000',
  glassChip: 'rgba(255,255,255,0.05)',
};

// ── Zone → save-coords lookup (label keyed, matches damageRecords[].zone) ─────
// DamageMapViewer (the read-only viewer buyers see) plots damage with these
// percentage-based 2D coords, so every label we can produce — preset 3D zone
// or freeform manual entry — must resolve to one.
const ZONE_COORDS: Record<string, { x: number; y: number; view: string }> = Object.fromEntries(
  DAMAGE_ZONES_3D.map((z) => [z.label, z.coords])
);
const zoneCoordsFor = (label: string) => ZONE_COORDS[label] ?? CUSTOM_ZONE_COORDS;

const PRESET_FEATURES = [
  'Navigation', 'Leather Seats', 'Heated Seats', 'Sunroof', 'Bluetooth',
  'Parking Sensors', 'Reverse Camera', 'Cruise Control', 'Climate Control',
  'Apple CarPlay', 'Android Auto', 'DAB Radio', 'LED Headlights',
  'Alloy Wheels', 'Tow Bar',
];

// ── Payload maps ──────────────────────────────────────────────────────────────
const fuelMap: Record<string, string> = {
  'Petrol': 'PETROL', 'Diesel': 'DIESEL', 'Electric': 'ELECTRIC',
  'Hybrid': 'HYBRID', 'Plug-in Hybrid': 'PLUGIN_HYBRID', 'LPG': 'LPG',
};
const bodyMap: Record<string, string> = {
  'SUV': 'SUV', 'Saloon': 'SEDAN', 'Sedan': 'SEDAN', 'Hatchback': 'HATCHBACK',
  'Coupé': 'COUPE', 'Coupe': 'COUPE', 'Estate': 'ESTATE', 'Convertible': 'CONVERTIBLE',
  'Crossover': 'CROSSOVER', 'MPV': 'MPV',
};
const condMap: Record<string, string> = {
  'Excellent': 'EXCELLENT', 'Good': 'GOOD', 'Fair': 'FAIR', 'Project': 'POOR',
};
const transMap: Record<string, string> = {
  'Manual': 'MANUAL', 'Automatic': 'AUTOMATIC', 'Semi-Auto': 'SEMI_AUTOMATIC', 'CVT': 'CVT',
};

// ── Step Progress Bar ─────────────────────────────────────────────────────────
const STEP_LABELS = ['DETAILS', 'MEDIA', 'PRICING', 'REVIEW'];

const WizardStepper: React.FC<{ current: number }> = ({ current }) => (
  <View style={st.stepperRow}>
    {[1, 2, 3, 4].map((n, i) => (
      <React.Fragment key={n}>
        <View style={st.stepItem}>
          <View style={[
            st.stepCircle,
            n < current && st.stepCircleDone,
            n === current && st.stepCircleActive,
          ]}>
            {n < current ? (
              <Ionicons name="checkmark" size={11} color="#fff" />
            ) : (
              <Text style={[st.stepNum, n === current && st.stepNumActive]}>{n}</Text>
            )}
          </View>
          <Text style={[st.stepLabel, n <= current && st.stepLabelActive]}>
            {STEP_LABELS[i]}
          </Text>
        </View>
        {n < 4 && (
          <View style={[st.stepLine, n < current && st.stepLineActive]} />
        )}
      </React.Fragment>
    ))}
  </View>
);

// ── Chip (toggleable pill) ────────────────────────────────────────────────────
const Chip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
  accentColor?: string;
  small?: boolean;
}> = ({ label, active, onPress, accentColor = C.accent, small }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    style={[
      st.chip,
      small && st.chipSmall,
      active
        ? { backgroundColor: accentColor + '22', borderColor: accentColor }
        : { backgroundColor: C.glassChip, borderColor: C.border },
    ]}
  >
    <Text style={[
      st.chipText,
      small && st.chipTextSmall,
      { color: active ? accentColor : C.grey2 },
    ]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ── Glass Card ────────────────────────────────────────────────────────────────
const GlassCard: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => (
  <View style={[st.glassCard, style]}>{children}</View>
);

// ── Eyebrow Label ─────────────────────────────────────────────────────────────
const Eyebrow: React.FC<{ label: string; color?: string; style?: import('react-native').StyleProp<import('react-native').TextStyle> }> = ({ label, color = C.grey3, style }) => (
  <Text style={[st.eyebrow, { color }, style]}>{label}</Text>
);

// ── Glass Input ───────────────────────────────────────────────────────────────
const GlassInput: React.FC<{
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  height?: number;
  prefix?: string;
  autoCapitalize?: any;
  style?: any;
}> = ({ value, onChangeText, placeholder, keyboardType, multiline, height, prefix, autoCapitalize, style }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[
      st.inputWrap,
      { height: height ?? (multiline ? undefined : 52) },
      focused && { borderColor: C.accent },
      style,
    ]}>
      {prefix ? <Text style={st.inputPrefix}>{prefix}</Text> : null}
      <TextInput
        style={[st.inputText, multiline && { textAlignVertical: 'top', paddingTop: 12 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.grey3}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
};

// ── DVLA Grid Row ─────────────────────────────────────────────────────────────
const DvlaRow: React.FC<{ label: string; value?: string | number | null; highlight?: 'success' | 'danger' }> = ({ label, value, highlight }) => (
  <View style={st.dvlaRow}>
    <Text style={st.dvlaLabel}>{label}</Text>
    <Text style={[
      st.dvlaValue,
      highlight === 'success' && { color: C.success },
      highlight === 'danger' && { color: C.accent },
    ]}>
      {value ?? '—'}
    </Text>
  </View>
);

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export const SellCarsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // ── Navigation ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // ── Step 1 — VRM & DVLA ────────────────────────────────────────────────────
  const [regInput, setRegInput] = useState('');
  const [vehicleData, setVehicleData] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [regError, setRegError] = useState('');

  // ── Step 1 — Manual fields ─────────────────────────────────────────────────
  const [mileage, setMileage] = useState('');
  const [selectedTransmission, setSelectedTransmission] = useState('');
  const [selectedBodyType, setSelectedBodyType] = useState('');
  const [condition, setCondition] = useState('');
  const [owners, setOwners] = useState('');
  const [location, setLocation] = useState('');
  const [ulezCompliant, setUlezCompliant] = useState('Unknown');
  const [euroStandard, setEuroStandard] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [customFeature, setCustomFeature] = useState('');
  const [listingTitle, setListingTitle] = useState('');
  const [description, setDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // ── Step 1 — Optional technical ────────────────────────────────────────────
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [bhp, setBhp] = useState('');
  const [zeroToSixty, setZeroToSixty] = useState('');
  const [topSpeed, setTopSpeed] = useState('');
  const [torque, setTorque] = useState('');
  const [combinedMpg, setCombinedMpg] = useState('');
  const [doors, setDoors] = useState('');
  const [seats, setSeats] = useState('');
  const [variant, setVariant] = useState('');
  const [driveType, setDriveType] = useState('');
  const [serviceHistory, setServiceHistory] = useState('');
  const [numberOfKeys, setNumberOfKeys] = useState('');

  // ── Step 1 — Legal ─────────────────────────────────────────────────────────
  const [writeOffCategory, setWriteOffCategory] = useState('NONE');
  const [stolenReported, setStolenReported] = useState('No');
  const [outstandingFinance, setOutstandingFinance] = useState('No');
  const [legalKeeper, setLegalKeeper] = useState('Yes');
  const [selectedFuel, setSelectedFuel] = useState('');

  // ── Step 2 — Media ─────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<string[]>([]);
  const [activePhotoTab, setActivePhotoTab] = useState<'EXTERIOR' | 'INTERIOR' | 'DAMAGE'>('EXTERIOR');
  const [damageRecords, setDamageRecords] = useState<Array<{ zone: string; type: string; severity: string }>>([]);
  const [activeDamageZone, setActiveDamageZone] = useState<string | null>(null);
  const [damageType, setDamageType] = useState('Scratch');
  const [damageSeverity, setDamageSeverity] = useState('Minor');
  const [customZoneInput, setCustomZoneInput] = useState('');

  // ── Step 3 — Pricing ───────────────────────────────────────────────────────
  const [lowerPrice, setLowerPrice] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [listingType, setListingType] = useState<'CLASSIFIED' | 'AUCTION'>('CLASSIFIED');
  const [badgeTier, setBadgeTier] = useState('standard');

  // ── Step 4 — Publishing ────────────────────────────────────────────────────
  const [isPublishing, setIsPublishing] = useState(false);

  // ── Description expand ─────────────────────────────────────────────────────
  const [descExpanded, setDescExpanded] = useState(false);

  // ── DVLA Lookup ────────────────────────────────────────────────────────────
  const handleDvlaLookup = async () => {
    const vrm = regInput.replace(/\s/g, '').toUpperCase();
    if (vrm.length < 2) { setRegError('Enter a valid registration.'); return; }
    setLookupLoading(true);
    setRegError('');
    try {
      const res = await apiClient<any>('/dvla/lookup', {
        method: 'POST',
        body: JSON.stringify({ vrm }),
      });
      setVehicleData(res);
      setListingTitle(`${res.year ?? ''} ${res.make ?? ''} ${res.model ?? ''}`.trim());
      if (res.fuelType) setSelectedFuel(res.fuelType);
    } catch {
      setRegError('Registration not found. Check the plate and try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  // ── AI Description ─────────────────────────────────────────────────────────
  const handleGenerateDescription = async () => {
    setAiLoading(true);
    try {
      const res = await apiClient<{ success: boolean; data: string }>('/ai/generate-description', {
        method: 'POST',
        body: JSON.stringify({
          make: vehicleData?.make,
          model: vehicleData?.model,
          year: String(vehicleData?.year ?? ''),
          mileage,
          condition,
          fuelType: selectedFuel || vehicleData?.fuelType,
          transmission: selectedTransmission,
          color: vehicleData?.colour,
          features: selectedFeatures,
          vrm: regInput.replace(/\s/g, '').toUpperCase(),
          motStatus: vehicleData?.motStatus,
        }),
      });
      if (res.success && res.data) setDescription(res.data);
    } catch {
      Alert.alert('AI Error', 'Could not generate description. Please write one manually.');
    } finally {
      setAiLoading(false);
    }
  };

  // ── Photo picker ───────────────────────────────────────────────────────────
  const handleAddPhoto = async () => {
    if (photos.length >= 10) {
      Alert.alert('Limit Reached', 'You can upload a maximum of 10 photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 10 - photos.length,
    });
    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...uris].slice(0, 10));
    }
  };

  // ── Damage zone tapped ─────────────────────────────────────────────────────
  const handleZoneTap = (zone: string) => {
    setActiveDamageZone(zone);
    setDamageType('Scratch');
    setDamageSeverity('Minor');
  };

  const confirmDamage = () => {
    if (!activeDamageZone) return;
    setDamageRecords((prev) => {
      const filtered = prev.filter((r) => r.zone !== activeDamageZone);
      return [...filtered, { zone: activeDamageZone, type: damageType, severity: damageSeverity }];
    });
    setActiveDamageZone(null);
  };

  const clearDamageZone = () => setActiveDamageZone(null);

  // ── Manual zone entry (for damage not covered by the 10 preset hotspots) ──
  const handleAddCustomZone = () => {
    const trimmed = customZoneInput.trim();
    if (!trimmed) return;
    handleZoneTap(trimmed);
    setCustomZoneInput('');
  };

  // ── Feature toggle ─────────────────────────────────────────────────────────
  const toggleFeature = (f: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  const addCustomFeature = () => {
    const trimmed = customFeature.trim();
    if (trimmed && !selectedFeatures.includes(trimmed)) {
      setSelectedFeatures((prev) => [...prev, trimmed]);
      setCustomFeature('');
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (!vehicleData) { Alert.alert('VRM Required', 'Please perform a DVLA lookup first.'); return false; }
    if (!mileage.trim()) { Alert.alert('Mileage Required', 'Please enter the vehicle mileage.'); return false; }
    if (!selectedTransmission) { Alert.alert('Transmission Required', 'Please select a transmission type.'); return false; }
    if (!selectedBodyType) { Alert.alert('Body Type Required', 'Please select a body type.'); return false; }
    if (!condition) { Alert.alert('Condition Required', 'Please select the vehicle condition.'); return false; }
    if (legalKeeper === 'No') { Alert.alert('Legal Keeper', 'You must be the legal registered keeper to list this vehicle.'); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (photos.length < 1) { Alert.alert('Photos Required', 'Please add at least 1 photo.'); return false; }
    return true;
  };

  const validateStep3 = () => {
    if (!askingPrice || parseFloat(askingPrice) <= 0) {
      Alert.alert('Price Required', 'Please enter an asking price.');
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) setStep(4);
  };

  const goBack = () => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4);
    else navigation.goBack();
  };

  // ── Publish ────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (photos.length === 0) {
      Alert.alert('Photos Required', 'Please add at least one photo of the vehicle before publishing your listing.');
      return;
    }
    setIsPublishing(true);
    try {
      const payload: any = {
        title: listingTitle || `${vehicleData?.year ?? ''} ${vehicleData?.make ?? ''} ${vehicleData?.model ?? ''}`.trim(),
        price: parseFloat(askingPrice) || 0,
        priceMin: lowerPrice ? (parseFloat(lowerPrice) || undefined) : undefined,
        mileage: parseInt(mileage.replace(/[^0-9]/g, ''), 10) || 0,
        year: vehicleData?.year || new Date().getFullYear(),
        vrm: regInput.replace(/\s/g, '').toUpperCase(),
        make: vehicleData?.make,
        model: vehicleData?.model,
        description: description || undefined,
        images: photos.filter(p => p.startsWith('http')),
        listingType: listingType as any,
        fuelType: (vehicleData?.fuelType
          ? (fuelMap[vehicleData.fuelType] ?? 'PETROL')
          : (selectedFuel ? fuelMap[selectedFuel] : undefined)) as any,
        transmission: (transMap[selectedTransmission] || undefined) as any,
        bodyType: (bodyMap[selectedBodyType] || undefined) as any,
        condition: (condMap[condition] || undefined) as any,
        color: vehicleData?.colour,
        engineSize: vehicleData?.engineSize,
        co2Emissions: vehicleData?.co2Emissions,
        euroStandard: vehicleData?.euroStandard as any,
        motStatus: vehicleData?.motStatus,
        taxStatus: vehicleData?.taxStatus,
        motExpiryDate: vehicleData?.motExpiryDate,
        taxDueDate: vehicleData?.taxDueDate,
        monthOfFirstRegistration: vehicleData?.monthOfFirstRegistration,
        dateOfLastV5CIssued: vehicleData?.dateOfLastV5CIssued,
        wheelplan: vehicleData?.wheelplan,
        typeApproval: vehicleData?.typeApproval,
        markedForExport: vehicleData?.markedForExport,
        bhp: bhp ? parseInt(bhp) : undefined,
        doors: doors ? parseInt(doors) : undefined,
        seats: seats ? parseInt(seats) : undefined,
        torqueNm: torque ? parseInt(torque) : undefined,
        topSpeedMph: topSpeed ? parseInt(topSpeed) : undefined,
        zeroTo60Mph: zeroToSixty ? parseFloat(zeroToSixty) : undefined,
        combinedMpg: combinedMpg ? parseFloat(combinedMpg) : undefined,
        location: location || undefined,
        features: selectedFeatures.length > 0 ? selectedFeatures : undefined,
        variant: variant || undefined,
        driveType: driveType || undefined,
        numberOfKeys: numberOfKeys ? parseInt(numberOfKeys) : undefined,
        serviceHistory: serviceHistory || undefined,
        owners: owners || undefined,
        badgeTier: (listingType === 'AUCTION' ? 'FREE' : badgeTier.toUpperCase()) as any,
        ulezCompliant: ulezCompliant === 'Yes' ? true : ulezCompliant === 'No' ? false : undefined,
        stolenRecovered: stolenReported === 'Yes',
        hasOutstandingFinance: outstandingFinance === 'Yes',
        isLegalRegisteredKeeper: legalKeeper !== 'No',
        writeOffCategory: writeOffCategory as any,
      };

      const listing = await apiClient<any>('/listings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (damageRecords.length > 0 && listing?.id) {
        await apiClient(`/damage/${listing.id}/save`, {
          method: 'POST',
          body: JSON.stringify({
            detections: damageRecords.map((r) => ({
              part: r.zone,
              type: r.type,
              severity: r.severity,
              coords: zoneCoordsFor(r.zone),
            })),
          }),
        }).catch(() => {});
      }

      Alert.alert('Listing Published!', 'Your car is now live on Carmazium.', [
        { text: 'View My Listings', onPress: () => navigation.navigate('MyListingDashboard') },
      ]);
    } catch (err: any) {
      Alert.alert('Publishing Failed', err.message || 'Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  // ── Badge tier helper ──────────────────────────────────────────────────────
  const BADGE_COST: Record<string, number> = { free: 0, basic: 1, standard: 10, premium: 25 };

  // ── Write-off chip colors ──────────────────────────────────────────────────
  const writeOffColor = (cat: string) => {
    if (cat === 'CAT_A' || cat === 'CAT_B') return C.accent;
    if (cat === 'NONE') return C.grey2;
    return C.warning;
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[st.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={st.backBtn} onPress={goBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={C.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={st.headerMeta}>SELL YOUR CAR</Text>
          <Text style={st.headerTitle}>
            {['Vehicle Details', 'Photos & Damage', 'Pricing', 'Review'][step - 1]}
          </Text>
        </View>
      </View>

      {/* ── Stepper ─────────────────────────────────────────────────────── */}
      <View style={st.stepperWrap}>
        <WizardStepper current={step} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ══════════════════════════════════════════════════════════════
              STEP 1 — VEHICLE DETAILS
          ══════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <View>

              {/* A — Registration Lookup */}
              <Eyebrow label="REGISTRATION" color={C.accent} />
              <View style={st.plateSection}>
                <View style={st.plateWrap}>
                  <View style={st.plateBlueBand} />
                  <TextInput
                    style={st.plateInput}
                    value={regInput}
                    onChangeText={(t) => {
                      setRegInput(t.toUpperCase());
                      setRegError('');
                      setVehicleData(null);
                    }}
                    placeholder="AB12 CDE"
                    placeholderTextColor="rgba(0,0,0,0.3)"
                    autoCapitalize="characters"
                    maxLength={8}
                    returnKeyType="search"
                    onSubmitEditing={handleDvlaLookup}
                  />
                </View>
                <TouchableOpacity
                  style={[st.dvlaBtn, lookupLoading && { opacity: 0.6 }]}
                  onPress={handleDvlaLookup}
                  activeOpacity={0.8}
                  disabled={lookupLoading}
                >
                  {lookupLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={st.dvlaBtnText}>ANALYSE DVLA</Text>
                  )}
                </TouchableOpacity>
              </View>

              {regError ? (
                <View style={st.errorBanner}>
                  <Ionicons name="alert-circle" size={14} color={C.accent} />
                  <Text style={st.errorText}>{regError}</Text>
                </View>
              ) : null}

              {/* B — DVLA Data Card */}
              {vehicleData && (
                <GlassCard style={{ marginBottom: 20 }}>
                  <View style={st.dvlaHeaderRow}>
                    <View style={st.dvlaChip}>
                      <Text style={st.dvlaChipText}>DVLA DATA</Text>
                    </View>
                    <View style={st.dvlaSuccessChip}>
                      <Ionicons name="checkmark-circle" size={12} color={C.success} />
                      <Text style={st.dvlaSuccessText}>VERIFIED</Text>
                    </View>
                  </View>
                  <View style={st.dvlaGrid}>
                    <View style={st.dvlaCol}>
                      <DvlaRow label="MAKE" value={vehicleData.make} />
                      <DvlaRow label="YEAR" value={vehicleData.year} />
                      <DvlaRow label="COLOUR" value={vehicleData.colour} />
                      <DvlaRow label="MOT STATUS" value={vehicleData.motStatus}
                        highlight={vehicleData.motStatus?.toLowerCase().includes('valid') ? 'success' : 'danger'} />
                      <DvlaRow label="MOT EXPIRY" value={vehicleData.motExpiryDate} />
                      <DvlaRow label="TAX DUE" value={vehicleData.taxDueDate} />
                      <DvlaRow label="CO2" value={vehicleData.co2Emissions ? `${vehicleData.co2Emissions} g/km` : null} />
                    </View>
                    <View style={[st.dvlaCol, { borderLeftWidth: 1, borderLeftColor: C.border, paddingLeft: 12 }]}>
                      <DvlaRow label="MODEL" value={vehicleData.model || 'Not found'} />
                      <DvlaRow label="FUEL" value={vehicleData.fuelType} />
                      <DvlaRow label="ENGINE" value={vehicleData.engineSize ? `${vehicleData.engineSize}cc` : null} />
                      <DvlaRow label="TAX STATUS" value={vehicleData.taxStatus} />
                      <DvlaRow label="V5C ISSUED" value={vehicleData.dateOfLastV5CIssued} />
                      <DvlaRow label="EURO STD" value={vehicleData.euroStandard} />
                      <DvlaRow label="WHEELPLAN" value={vehicleData.wheelplan} />
                    </View>
                  </View>
                </GlassCard>
              )}

              {/* C — Manual Required Fields */}
              <Eyebrow label="MILEAGE *" />
              <GlassInput
                value={mileage}
                onChangeText={setMileage}
                placeholder="e.g. 45,000"
                keyboardType="numeric"
                style={{ marginBottom: 16 }}
              />

              <Eyebrow label="TRANSMISSION *" />
              <View style={st.chipRow}>
                {['Manual', 'Automatic', 'Semi-Auto', 'CVT'].map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    active={selectedTransmission === t}
                    onPress={() => setSelectedTransmission(t)}
                  />
                ))}
              </View>

              <Eyebrow label="BODY TYPE *" style={{ marginTop: 12 }} />
              <View style={st.bodyTypeGrid}>
                {[
                  { label: 'SUV', icon: 'car' },
                  { label: 'Saloon', icon: 'car-side' },
                  { label: 'Hatchback', icon: 'car-hatchback' },
                  { label: 'Coupé', icon: 'car-sports' },
                  { label: 'Estate', icon: 'car-estate' },
                  { label: 'Convertible', icon: 'car-convertible' },
                  { label: 'Crossover', icon: 'car-2-plus' },
                  { label: 'MPV', icon: 'car-minivan' },
                ].map(({ label, icon }) => {
                  const active = selectedBodyType === label;
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[st.bodyTypeChip, active && st.bodyTypeChipActive]}
                      onPress={() => setSelectedBodyType(label)}
                      activeOpacity={0.75}
                    >
                      <MaterialCommunityIcons
                        name={icon as any}
                        size={20}
                        color={active ? C.accent : C.grey3}
                      />
                      <Text style={[st.bodyTypeLabel, active && { color: C.accent }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Eyebrow label="CONDITION *" style={{ marginTop: 12 }} />
              <View style={st.chipRow}>
                {['Excellent', 'Good', 'Fair', 'Project'].map((c) => (
                  <Chip key={c} label={c} active={condition === c} onPress={() => setCondition(c)} />
                ))}
              </View>

              <Eyebrow label="NUMBER OF OWNERS" style={{ marginTop: 12 }} />
              <View style={st.chipRow}>
                {['1 Owner', '2 Owners', '3+ Owners'].map((o) => (
                  <Chip key={o} label={o} active={owners === o} onPress={() => setOwners(o)} />
                ))}
              </View>

              {/* D — Technical Details (collapsible) */}
              <TouchableOpacity
                style={st.collapseToggle}
                onPress={() => setShowMoreDetails(!showMoreDetails)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={showMoreDetails ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={C.grey2}
                />
                <Text style={st.collapseToggleText}>
                  {showMoreDetails ? 'Hide Technical Details' : 'Show More Details'}
                </Text>
              </TouchableOpacity>

              {showMoreDetails && (
                <GlassCard style={{ marginBottom: 16 }}>
                  <View style={st.techRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Eyebrow label="BHP / POWER" />
                      <GlassInput value={bhp} onChangeText={setBhp} placeholder="e.g. 200" keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Eyebrow label="0-60 MPH" />
                      <GlassInput value={zeroToSixty} onChangeText={setZeroToSixty} placeholder="e.g. 4.5" keyboardType="decimal-pad" />
                    </View>
                  </View>
                  <View style={st.techRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Eyebrow label="TOP SPEED (MPH)" />
                      <GlassInput value={topSpeed} onChangeText={setTopSpeed} placeholder="e.g. 155" keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Eyebrow label="TORQUE (NM)" />
                      <GlassInput value={torque} onChangeText={setTorque} placeholder="e.g. 400" keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={st.techRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Eyebrow label="COMBINED MPG" />
                      <GlassInput value={combinedMpg} onChangeText={setCombinedMpg} placeholder="e.g. 35.5" keyboardType="decimal-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Eyebrow label="DOORS" />
                      <GlassInput value={doors} onChangeText={setDoors} placeholder="e.g. 4" keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={st.techRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Eyebrow label="SEATS" />
                      <GlassInput value={seats} onChangeText={setSeats} placeholder="e.g. 5" keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Eyebrow label="VARIANT / TRIM" />
                      <GlassInput value={variant} onChangeText={setVariant} placeholder="e.g. M Sport" />
                    </View>
                  </View>
                  <Eyebrow label="DRIVE TYPE" />
                  <View style={[st.chipRow, { marginBottom: 12 }]}>
                    {['FWD', 'RWD', 'AWD', '4WD'].map((d) => (
                      <Chip key={d} label={d} active={driveType === d} onPress={() => setDriveType(d)} small />
                    ))}
                  </View>
                  <Eyebrow label="SERVICE HISTORY" />
                  <View style={[st.chipRow, { marginBottom: 12, flexWrap: 'wrap' }]}>
                    {['Full Main Dealer', 'Full Independent', 'Partial', 'None'].map((s) => (
                      <Chip key={s} label={s} active={serviceHistory === s} onPress={() => setServiceHistory(s)} small />
                    ))}
                  </View>
                  <Eyebrow label="NUMBER OF KEYS" />
                  <View style={[st.chipRow, { marginBottom: 0 }]}>
                    {['1 Key', '2 Keys', '3+ Keys'].map((k) => (
                      <Chip key={k} label={k} active={numberOfKeys === k} onPress={() => setNumberOfKeys(k)} small />
                    ))}
                  </View>
                </GlassCard>
              )}

              {/* E — Location */}
              <Eyebrow label="LOCATION" style={{ marginTop: 4 }} />
              <GlassInput
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. London, Knightsbridge"
                style={{ marginBottom: 16 }}
              />

              {/* F — UK Compliance */}
              <Eyebrow label="ULEZ / CAZ COMPLIANT" />
              <View style={[st.chipRow, { marginBottom: 16 }]}>
                {['Yes', 'No', 'Unknown'].map((u) => (
                  <Chip key={u} label={u} active={ulezCompliant === u} onPress={() => setUlezCompliant(u)} />
                ))}
              </View>

              {/* G — Features */}
              <Eyebrow label="VEHICLE FEATURES" color={C.grey3} />
              <View style={st.featuresGrid}>
                {PRESET_FEATURES.map((f) => (
                  <Chip
                    key={f}
                    label={f}
                    active={selectedFeatures.includes(f)}
                    onPress={() => toggleFeature(f)}
                    small
                  />
                ))}
              </View>
              <View style={st.customFeatureRow}>
                <TextInput
                  style={st.customFeatureInput}
                  value={customFeature}
                  onChangeText={setCustomFeature}
                  placeholder="Add custom feature..."
                  placeholderTextColor={C.grey3}
                  returnKeyType="done"
                  onSubmitEditing={addCustomFeature}
                />
                <TouchableOpacity style={st.addFeatureBtn} onPress={addCustomFeature} activeOpacity={0.8}>
                  <Text style={st.addFeatureBtnText}>ADD</Text>
                </TouchableOpacity>
              </View>
              {selectedFeatures.filter((f) => !PRESET_FEATURES.includes(f)).length > 0 && (
                <View style={[st.chipRow, { flexWrap: 'wrap', marginBottom: 16 }]}>
                  {selectedFeatures.filter((f) => !PRESET_FEATURES.includes(f)).map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[st.chip, st.chipSmall, { backgroundColor: C.accentBg, borderColor: C.accent }]}
                      onPress={() => toggleFeature(f)}
                    >
                      <Text style={[st.chipTextSmall, { color: C.accent }]}>{f}</Text>
                      <Ionicons name="close" size={10} color={C.accent} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* H — Listing Title */}
              <Eyebrow label="LISTING TITLE" style={{ marginTop: 4 }} />
              <GlassInput
                value={listingTitle}
                onChangeText={setListingTitle}
                placeholder="e.g. 2021 BMW M4 Competition"
                style={{ marginBottom: 16 }}
              />

              {/* I — Description */}
              <Eyebrow label="DESCRIPTION" />
              <GlassInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your car — upgrades, service history, reason for sale..."
                multiline
                height={120}
                style={{ marginBottom: 10 }}
              />
              <TouchableOpacity
                style={[st.aiBtn, (!vehicleData || aiLoading) && { opacity: 0.5 }]}
                onPress={handleGenerateDescription}
                disabled={!vehicleData || aiLoading}
                activeOpacity={0.8}
              >
                {aiLoading ? (
                  <ActivityIndicator size="small" color={C.indigo} />
                ) : (
                  <Ionicons name="sparkles" size={14} color={C.indigo} />
                )}
                <Text style={st.aiBtnText}>
                  {aiLoading ? 'GENERATING…' : 'GENERATE WITH AI'}
                </Text>
              </TouchableOpacity>

              {/* J — Legal Declarations */}
              <View style={[st.legalSection, { marginTop: 20 }]}>
                <Eyebrow label="LEGAL DECLARATIONS" color={C.accent} />

                <Text style={st.legalQ}>WRITE-OFF STATUS</Text>
                <View style={[st.chipRow, { flexWrap: 'wrap', marginBottom: 12 }]}>
                  {['NONE', 'CAT_S', 'CAT_N', 'CAT_A', 'CAT_B', 'CAT_D'].map((cat) => (
                    <Chip
                      key={cat}
                      label={cat.replace('_', ' ')}
                      active={writeOffCategory === cat}
                      onPress={() => setWriteOffCategory(cat)}
                      accentColor={writeOffColor(cat)}
                      small
                    />
                  ))}
                </View>

                <Text style={st.legalQ}>BEEN REPORTED STOLEN?</Text>
                <View style={[st.chipRow, { marginBottom: 12 }]}>
                  {['Yes', 'No'].map((v) => (
                    <Chip key={v} label={v} active={stolenReported === v} onPress={() => setStolenReported(v)}
                      accentColor={v === 'Yes' ? C.accent : C.success} />
                  ))}
                </View>

                <Text style={st.legalQ}>OUTSTANDING FINANCE?</Text>
                <View style={[st.chipRow, { marginBottom: 12 }]}>
                  {['Yes', 'No'].map((v) => (
                    <Chip key={v} label={v} active={outstandingFinance === v} onPress={() => setOutstandingFinance(v)}
                      accentColor={v === 'Yes' ? C.warning : C.success} />
                  ))}
                </View>

                <Text style={st.legalQ}>ARE YOU THE LEGAL REGISTERED KEEPER?</Text>
                <View style={[st.chipRow, { marginBottom: 0 }]}>
                  {['Yes', 'No'].map((v) => (
                    <Chip key={v} label={v} active={legalKeeper === v} onPress={() => setLegalKeeper(v)}
                      accentColor={v === 'Yes' ? C.success : C.accent} />
                  ))}
                </View>
              </View>

            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 2 — MEDIA
          ══════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <View>

              {/* A — Photo Upload */}
              <Eyebrow label="PHOTOS" color={C.grey3} />
              <View style={st.photoTrackerRow}>
                <Text style={st.photoTrackerLabel}>Photo Tracker</Text>
                <Text style={st.photoTrackerCount}>{photos.length} / 10</Text>
              </View>
              <View style={st.progressBarBg}>
                <View style={[st.progressBarFill, { width: `${(photos.length / 10) * 100}%` }]} />
              </View>

              {/* Category tabs */}
              <View style={st.photoTabs}>
                {(['EXTERIOR', 'INTERIOR', 'DAMAGE'] as const).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[st.photoTab, activePhotoTab === tab && st.photoTabActive]}
                    onPress={() => setActivePhotoTab(tab)}
                    activeOpacity={0.75}
                  >
                    <Text style={[st.photoTabText, activePhotoTab === tab && st.photoTabTextActive]}>
                      {tab}
                    </Text>
                    {activePhotoTab === tab && <View style={st.photoTabUnderline} />}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Pro tip */}
              <GlassCard style={{ marginBottom: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Ionicons name="bulb-outline" size={15} color={C.warning} style={{ marginTop: 1 }} />
                <Text style={st.proTipText}>
                  {activePhotoTab === 'EXTERIOR' && 'Park in well-lit area, shoot from all 4 corners and front/back.'}
                  {activePhotoTab === 'INTERIOR' && 'Show dashboard, seats, boot, and any notable features.'}
                  {activePhotoTab === 'DAMAGE' && 'Photograph any scratches, scuffs, or dents with clear lighting.'}
                </Text>
              </GlassCard>

              {/* Upload area */}
              <TouchableOpacity style={st.uploadArea} onPress={handleAddPhoto} activeOpacity={0.75}>
                <Ionicons name="camera-outline" size={36} color={C.grey3} />
                <Text style={st.uploadAreaTitle}>Tap to add photos</Text>
                <Text style={st.uploadAreaSub}>JPEG, PNG · Max 10 photos</Text>
              </TouchableOpacity>

              {/* Photo grid */}
              {photos.length > 0 && (
                <View style={st.photoGrid}>
                  {photos.map((uri, i) => (
                    <View key={i} style={st.photoThumbWrap}>
                      <Image source={{ uri }} style={st.photoThumb} />
                      {i === 0 && (
                        <View style={st.coverBadge}>
                          <Text style={st.coverBadgeText}>COVER</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={st.photoRemoveBtn}
                        onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Ionicons name="close" size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* B — Damage Map */}
              <View style={{ marginTop: 24 }}>
                <View style={st.damageMapHeader}>
                  <Eyebrow label="DAMAGE MAP" color={C.grey3} />
                  <Text style={st.damageMapSub}>Tap a hotspot to mark damage</Text>
                </View>

                {/* Interactive 3D vehicle viewer with 10 preset hotspots */}
                <ThreeDVehicleViewer
                  zones={DAMAGE_ZONES_3D}
                  selectedZone={activeDamageZone}
                  markedZones={damageRecords.map((r) => r.zone)}
                  onZoneClick={handleZoneTap}
                />

                {/* Zone legend — same 10 hotspots as text chips, in case a pointer is hard to tap precisely */}
                <View style={st.zoneLegendRow}>
                  {DAMAGE_ZONES_3D.map((zone) => (
                    <Chip
                      key={zone.id}
                      label={zone.label}
                      active={damageRecords.some((r) => r.zone === zone.label)}
                      onPress={() => handleZoneTap(zone.label)}
                      small
                    />
                  ))}
                </View>

                {/* Manual fallback for damage that doesn't match any preset zone */}
                <Text style={st.customZoneLabel}>Can't find the right spot? Add it manually:</Text>
                <View style={st.customFeatureRow}>
                  <TextInput
                    style={st.customFeatureInput}
                    value={customZoneInput}
                    onChangeText={setCustomZoneInput}
                    placeholder="e.g. Wing mirror, Alloy wheel..."
                    placeholderTextColor={C.grey3}
                    returnKeyType="done"
                    onSubmitEditing={handleAddCustomZone}
                  />
                  <TouchableOpacity style={st.addFeatureBtn} onPress={handleAddCustomZone} activeOpacity={0.8}>
                    <Text style={st.addFeatureBtnText}>ADD</Text>
                  </TouchableOpacity>
                </View>

                {/* Damage records list */}
                {damageRecords.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    {damageRecords.map((r, i) => (
                      <View key={i} style={st.damageRecord}>
                        <View style={{ flex: 1 }}>
                          <Text style={st.damageRecordZone}>{r.zone}</Text>
                          <Text style={st.damageRecordMeta}>{r.type} · {r.severity}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setDamageRecords((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          <Ionicons name="trash-outline" size={15} color={C.accent} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 3 — PRICING
          ══════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <View>

              {/* A — Price Range */}
              <Eyebrow label="SET YOUR PRICE RANGE" color={C.warning} />
              <Text style={st.pricingInfo}>
                The Asking Price is shown publicly. The Lower (Min) is your acceptable offer floor.
              </Text>

              <View style={st.priceRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={st.priceInputLabel}>LOWER (MIN)</Text>
                  <View style={st.priceInputWrap}>
                    <Text style={st.pricePrefix}>£</Text>
                    <TextInput
                      style={st.priceInput}
                      value={lowerPrice}
                      onChangeText={setLowerPrice}
                      placeholder="0"
                      placeholderTextColor={C.grey3}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <Text style={st.priceSub}>Floor price — not visible to buyers</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.priceInputLabel}>ASKING PRICE *</Text>
                  <View style={[st.priceInputWrap, { borderColor: C.accent }]}>
                    <Text style={[st.pricePrefix, { color: C.accent }]}>£</Text>
                    <TextInput
                      style={st.priceInput}
                      value={askingPrice}
                      onChangeText={setAskingPrice}
                      placeholder="0"
                      placeholderTextColor={C.grey3}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <Text style={st.priceSub}>Displayed on listing</Text>
                </View>
              </View>

              {lowerPrice && askingPrice && parseFloat(askingPrice) > parseFloat(lowerPrice) && (
                <GlassCard style={{ marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <View style={st.priceBarBg}>
                      <View style={[st.priceBarFill, {
                        left: `${(parseFloat(lowerPrice) / parseFloat(askingPrice)) * 100}%` as any,
                        right: 0,
                      }]} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={{ fontSize: 11, color: C.success, fontFamily: FontFamily.semiBold }}>
                        £{parseFloat(lowerPrice).toLocaleString('en-GB')}
                      </Text>
                      <Text style={{ fontSize: 11, color: C.accent, fontFamily: FontFamily.semiBold }}>
                        £{parseFloat(askingPrice).toLocaleString('en-GB')}
                      </Text>
                    </View>
                  </View>
                  <View style={st.validBadge}>
                    <Text style={st.validBadgeText}>✓ VALID</Text>
                  </View>
                </GlassCard>
              )}

              {/* B — Listing Type */}
              <Eyebrow label="LISTING TYPE" />
              <View style={st.listingTypeRow}>
                {[
                  { id: 'CLASSIFIED', icon: 'pricetag-outline', title: 'Private Sale', sub: 'Set your price and accept offers from buyers' },
                  { id: 'AUCTION', icon: 'hammer-outline', title: 'Open Auction', sub: 'Let buyers bid. No listing fee.' },
                ].map(({ id, icon, title, sub }) => {
                  const active = listingType === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[st.listingTypeCard, active && st.listingTypeCardActive]}
                      onPress={() => {
                        setListingType(id as any);
                        if (id === 'AUCTION') setBadgeTier('free');
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={icon as any} size={22} color={active ? C.accent : C.grey3} />
                      <Text style={[st.listingTypeTitle, active && { color: C.accent }]}>{title}</Text>
                      <Text style={st.listingTypeSub}>{sub}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* C — Seller Badge */}
              <Eyebrow label="SELLER BADGES" style={{ marginTop: 4 }} />
              {listingType === 'AUCTION' ? (
                <GlassCard style={[st.badgeCardActive, { marginBottom: 16 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="hammer" size={20} color={C.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={[st.badgeName, { color: C.accent }]}>Auction — FREE</Text>
                      <Text style={st.badgeSub}>Open bidding · 24-hour auction · No trust badges</Text>
                    </View>
                    <View style={st.selectedBadge}><Text style={st.selectedBadgeText}>Selected</Text></View>
                  </View>
                </GlassCard>
              ) : (
                <View style={st.badgeGrid}>
                  {[
                    { id: 'basic', label: 'BASIC', price: 1, chip: null, features: ['Standard listing', 'Offer range system'] },
                    { id: 'standard', label: 'STANDARD', price: 10, chip: 'POPULAR', features: ['Everything in Basic', 'VIN Report badge', 'Verified Seller badge'] },
                    { id: 'premium', label: 'PREMIUM', price: 25, chip: 'BEST', features: ['Everything in Standard', 'Featured boost (28 days)', 'Priority placement', 'Featured badge'] },
                  ].map(({ id, label, price, chip, features }) => {
                    const active = badgeTier === id;
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[st.badgeCard, active && st.badgeCardActive]}
                        onPress={() => setBadgeTier(id)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={[st.badgeName, active && { color: C.accent }]}>{label}</Text>
                          {chip && (
                            <View style={[st.badgeChip, { backgroundColor: chip === 'BEST' ? C.accentBg : C.warningBg }]}>
                              <Text style={[st.badgeChipText, { color: chip === 'BEST' ? C.accent : C.warning }]}>{chip}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[st.badgePrice, active && { color: C.accent }]}>£{price}</Text>
                        {features.map((f) => (
                          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                            <Ionicons name="checkmark-circle" size={11} color={active ? C.accent : C.grey3} />
                            <Text style={[st.badgeFeature, active && { color: C.grey2 }]}>{f}</Text>
                          </View>
                        ))}
                        {active && (
                          <View style={[st.selectedBadge, { marginTop: 8 }]}>
                            <Text style={st.selectedBadgeText}>Selected</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Cost summary */}
              <GlassCard style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={st.costLabel}>Listing fee:</Text>
                <Text style={[st.costValue, { color: BADGE_COST[badgeTier] === 0 ? C.success : C.accent }]}>
                  {BADGE_COST[badgeTier] === 0 ? 'FREE' : `£${BADGE_COST[badgeTier]}`}
                </Text>
              </GlassCard>

            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 4 — REVIEW
          ══════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <View>
              <Text style={st.reviewHeading}>REVIEW YOUR LISTING</Text>

              {/* Vehicle Identity */}
              <View style={st.reviewSectionHeader}>
                <Eyebrow label="VEHICLE IDENTITY" />
                <TouchableOpacity onPress={() => setStep(1)}>
                  <Text style={st.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              <GlassCard style={{ marginBottom: 16 }}>
                <View style={st.reviewGrid}>
                  {[
                    ['VRM', regInput.replace(/\s/g, '').toUpperCase()],
                    ['Make', vehicleData?.make],
                    ['Model', vehicleData?.model],
                    ['Year', vehicleData?.year],
                    ['Body', selectedBodyType],
                    ['Location', location || '—'],
                  ].map(([label, value]) => (
                    <View key={label as string} style={st.reviewKv}>
                      <Text style={st.reviewKvLabel}>{label as string}</Text>
                      <Text style={st.reviewKvValue}>{value ?? '—'}</Text>
                    </View>
                  ))}
                </View>
              </GlassCard>

              {/* Photos */}
              <View style={st.reviewSectionHeader}>
                <Eyebrow label={`PHOTOS (${photos.length})`} />
                <TouchableOpacity onPress={() => setStep(2)}>
                  <Text style={st.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              {photos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {photos.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={st.reviewThumb} />
                  ))}
                </ScrollView>
              ) : (
                <GlassCard style={{ marginBottom: 16 }}>
                  <Text style={{ color: C.grey3, fontSize: 13, fontFamily: FontFamily.regular }}>No photos added.</Text>
                </GlassCard>
              )}

              {/* Technical Specs */}
              <Eyebrow label="TECHNICAL SPECS" />
              <GlassCard style={{ marginBottom: 16 }}>
                <View style={st.reviewGrid}>
                  {[
                    ['Mileage', mileage ? `${mileage} mi` : null],
                    ['Fuel', vehicleData?.fuelType],
                    ['Transmission', selectedTransmission],
                    ['Colour', vehicleData?.colour],
                    ['Engine', vehicleData?.engineSize ? `${vehicleData.engineSize}cc` : null],
                    ['BHP', bhp],
                    ['Doors', doors],
                    ['Seats', seats],
                    ['CO2', vehicleData?.co2Emissions ? `${vehicleData.co2Emissions} g/km` : null],
                    ['Condition', condition],
                  ].map(([label, value]) => value ? (
                    <View key={label as string} style={st.reviewKv}>
                      <Text style={st.reviewKvLabel}>{label as string}</Text>
                      <Text style={st.reviewKvValue}>{value as string}</Text>
                    </View>
                  ) : null)}
                </View>
              </GlassCard>

              {/* DVLA Data */}
              {vehicleData && (
                <>
                  <View style={st.reviewSectionHeader}>
                    <Eyebrow label="DVLA DATA" />
                    <View style={st.dvlaChip}><Text style={st.dvlaChipText}>DVLA</Text></View>
                  </View>
                  <GlassCard style={{ marginBottom: 16 }}>
                    <View style={st.reviewGrid}>
                      {[
                        ['MOT Status', vehicleData.motStatus],
                        ['MOT Expiry', vehicleData.motExpiryDate],
                        ['Tax Status', vehicleData.taxStatus],
                        ['Tax Due', vehicleData.taxDueDate],
                        ['V5C Issued', vehicleData.dateOfLastV5CIssued],
                        ['Euro Std', vehicleData.euroStandard],
                      ].map(([label, value]) => value ? (
                        <View key={label as string} style={st.reviewKv}>
                          <Text style={st.reviewKvLabel}>{label as string}</Text>
                          <Text style={st.reviewKvValue}>{value as string}</Text>
                        </View>
                      ) : null)}
                    </View>
                  </GlassCard>
                </>
              )}

              {/* Features */}
              {selectedFeatures.length > 0 && (
                <>
                  <Eyebrow label="FEATURES" />
                  <View style={[st.chipRow, { flexWrap: 'wrap', marginBottom: 16 }]}>
                    {selectedFeatures.map((f) => (
                      <View key={f} style={[st.chip, st.chipSmall, { backgroundColor: C.accentBg, borderColor: C.accent }]}>
                        <Text style={[st.chipTextSmall, { color: C.accent }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Title & Description */}
              <Eyebrow label="TITLE & DESCRIPTION" />
              <GlassCard style={{ marginBottom: 16 }}>
                <Text style={st.reviewTitle}>
                  {listingTitle || `${vehicleData?.year ?? ''} ${vehicleData?.make ?? ''} ${vehicleData?.model ?? ''}`.trim()}
                </Text>
                {description ? (
                  <>
                    <Text
                      style={st.reviewDesc}
                      numberOfLines={descExpanded ? undefined : 3}
                    >
                      {description}
                    </Text>
                    {description.length > 120 && (
                      <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
                        <Text style={{ color: C.accent, fontSize: 12, fontFamily: FontFamily.semiBold, marginTop: 6 }}>
                          {descExpanded ? 'Show less' : 'Show more'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <Text style={{ color: C.grey3, fontSize: 13, fontFamily: FontFamily.regular }}>No description added.</Text>
                )}
              </GlassCard>

              {/* Pricing */}
              <View style={st.reviewSectionHeader}>
                <Eyebrow label="PRICING" />
                <TouchableOpacity onPress={() => setStep(3)}>
                  <Text style={st.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              <GlassCard style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View>
                    <Text style={st.reviewKvLabel}>LOWER (FLOOR)</Text>
                    <Text style={[st.reviewKvValue, { color: C.success, fontSize: 17 }]}>
                      {lowerPrice ? `£${parseFloat(lowerPrice).toLocaleString('en-GB')}` : '—'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={st.reviewKvLabel}>ASKING PRICE</Text>
                    <Text style={[st.reviewKvValue, { color: C.accent, fontSize: 17 }]}>
                      {askingPrice ? `£${parseFloat(askingPrice).toLocaleString('en-GB')}` : '—'}
                    </Text>
                  </View>
                </View>
                <View style={[st.reviewKv, { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 }]}>
                  <Text style={st.reviewKvLabel}>BADGE · FEE</Text>
                  <Text style={st.reviewKvValue}>
                    {(listingType === 'AUCTION' ? 'FREE' : badgeTier.toUpperCase())} · {BADGE_COST[badgeTier] === 0 ? 'FREE' : `£${BADGE_COST[badgeTier]}`}
                  </Text>
                </View>
              </GlassCard>

              <Text style={st.tosText}>
                By publishing, you agree to Carmazium's Seller Terms. Your listing is fully editable after publishing.
              </Text>
            </View>
          )}

        </ScrollView>

        {/* ── Sticky Footer ──────────────────────────────────────────────── */}
        <View style={[st.footer, { paddingBottom: insets.bottom + 12 }]}>
          {step < 4 ? (
            <TouchableOpacity style={st.nextBtn} onPress={goNext} activeOpacity={0.85}>
              <Text style={st.nextBtnText}>
                {step === 1 ? 'NEXT — MEDIA' : step === 2 ? 'NEXT — PRICING' : 'NEXT — REVIEW'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[st.publishBtn, isPublishing && { opacity: 0.6 }]}
              onPress={handlePublish}
              activeOpacity={0.85}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={st.nextBtnText}>PUBLISH LISTING</Text>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginLeft: 6 }} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ── Damage Zone Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={!!activeDamageZone}
        transparent
        animationType="slide"
        onRequestClose={clearDamageZone}
      >
        <View style={st.modalOverlay}>
          <View style={st.damageSheet}>
            <View style={st.damageSheetHandle} />
            <Text style={st.damageSheetTitle}>{activeDamageZone}</Text>

            <Eyebrow label="DAMAGE TYPE" style={{ marginTop: 14 }} />
            <View style={[st.chipRow, { marginBottom: 14 }]}>
              {['Scratch', 'Scuff', 'Dent'].map((t) => (
                <Chip key={t} label={t} active={damageType === t} onPress={() => setDamageType(t)} />
              ))}
            </View>

            <Eyebrow label="SEVERITY" />
            <View style={[st.chipRow, { marginBottom: 20 }]}>
              {['Minor', 'Moderate', 'Severe'].map((s) => (
                <Chip
                  key={s}
                  label={s}
                  active={damageSeverity === s}
                  onPress={() => setDamageSeverity(s)}
                  accentColor={s === 'Severe' ? C.accent : s === 'Moderate' ? C.warning : C.success}
                />
              ))}
            </View>

            <TouchableOpacity style={st.damageConfirmBtn} onPress={confirmDamage} activeOpacity={0.85}>
              <Text style={st.damageConfirmText}>Mark Damage</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 10, alignItems: 'center' }} onPress={clearDamageZone}>
              <Text style={{ color: C.grey3, fontSize: 13, fontFamily: FontFamily.medium }}>No Damage Here</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: C.bg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMeta: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    color: C.accent,
    letterSpacing: 1.4,
    marginBottom: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FontFamily.extraBold,
    color: C.white,
    letterSpacing: -0.3,
  },

  // ── Stepper ───────────────────────────────────────────────────────────────
  stepperWrap: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: C.bg,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  stepCircleDone: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  stepNum: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    color: C.grey3,
  },
  stepNumActive: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 8,
    fontFamily: FontFamily.semiBold,
    color: C.grey3,
    letterSpacing: 0.8,
  },
  stepLabelActive: {
    color: C.white,
  },
  stepLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
    marginBottom: 16,
  },
  stepLineActive: {
    backgroundColor: C.accent,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: {
    padding: 20,
  },

  // ── Eyebrow ───────────────────────────────────────────────────────────────
  eyebrow: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  // ── Glass card ────────────────────────────────────────────────────────────
  glassCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 16,
  },

  // ── Input ─────────────────────────────────────────────────────────────────
  inputWrap: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.medium,
    color: C.white,
    height: '100%',
  },
  inputPrefix: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
    color: C.grey2,
    marginRight: 6,
  },

  // ── Chip ──────────────────────────────────────────────────────────────────
  chip: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },
  chipTextSmall: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },

  // ── Registration ──────────────────────────────────────────────────────────
  plateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  plateWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.plate,
    borderRadius: 10,
    overflow: 'hidden',
    height: 54,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  plateBlueBand: {
    width: 26,
    backgroundColor: '#003087',
    alignSelf: 'stretch',
  },
  plateInput: {
    flex: 1,
    fontSize: 26,
    fontFamily: 'JetBrainsMono_700Bold',
    color: C.plateText,
    letterSpacing: 3,
    paddingHorizontal: 10,
  },
  dvlaBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dvlaBtnText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    color: '#fff',
    letterSpacing: 0.6,
  },

  // ── Error banner ──────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(220,31,38,0.10)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(220,31,38,0.20)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: C.accent,
    flex: 1,
  },

  // ── DVLA card ─────────────────────────────────────────────────────────────
  dvlaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  dvlaChip: {
    backgroundColor: C.blueBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
  },
  dvlaChipText: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    color: C.blue,
    letterSpacing: 1,
  },
  dvlaSuccessChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.successBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dvlaSuccessText: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    color: C.success,
    letterSpacing: 0.8,
  },
  dvlaGrid: {
    flexDirection: 'row',
    gap: 0,
  },
  dvlaCol: {
    flex: 1,
  },
  dvlaRow: {
    marginBottom: 10,
  },
  dvlaLabel: {
    fontSize: 8,
    fontFamily: FontFamily.bold,
    color: C.grey3,
    letterSpacing: 1,
    marginBottom: 2,
  },
  dvlaValue: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: C.grey1,
  },

  // ── Body type grid ────────────────────────────────────────────────────────
  bodyTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  bodyTypeChip: {
    width: (W - 68) / 4,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.glassChip,
    gap: 4,
  },
  bodyTypeChipActive: {
    borderColor: C.accent,
    backgroundColor: C.accentBg,
  },
  bodyTypeLabel: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    color: C.grey3,
    textAlign: 'center',
  },

  // ── Technical row ─────────────────────────────────────────────────────────
  techRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },

  // ── Collapse toggle ───────────────────────────────────────────────────────
  collapseToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginTop: 4,
  },
  collapseToggleText: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
    color: C.grey2,
  },

  // ── Features ──────────────────────────────────────────────────────────────
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  customFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  customFeatureInput: {
    flex: 1,
    height: 44,
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 14,
    fontSize: 13,
    fontFamily: FontFamily.medium,
    color: C.white,
  },
  addFeatureBtn: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: C.accentBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFeatureBtnText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    color: C.accent,
    letterSpacing: 0.6,
  },

  // ── AI button ─────────────────────────────────────────────────────────────
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.indigo,
    backgroundColor: C.indigoBg,
    marginBottom: 16,
  },
  aiBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
    color: C.indigo,
    letterSpacing: 0.8,
  },

  // ── Legal ─────────────────────────────────────────────────────────────────
  legalSection: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 16,
  },
  legalQ: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    color: C.grey2,
    marginBottom: 8,
    marginTop: 4,
  },

  // ── Photo tracker ─────────────────────────────────────────────────────────
  photoTrackerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoTrackerLabel: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: C.grey2,
  },
  photoTrackerCount: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
    color: C.accent,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: C.accent,
    borderRadius: 2,
  },

  // ── Photo tabs ────────────────────────────────────────────────────────────
  photoTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 14,
  },
  photoTab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
    position: 'relative',
  },
  photoTabActive: {},
  photoTabText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    color: C.grey3,
    letterSpacing: 0.8,
  },
  photoTabTextActive: {
    color: C.white,
  },
  photoTabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    right: '15%',
    height: 2,
    backgroundColor: C.accent,
    borderRadius: 1,
  },

  // ── Pro tip ───────────────────────────────────────────────────────────────
  proTipText: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: C.grey2,
    flex: 1,
    lineHeight: 18,
  },

  // ── Upload area ───────────────────────────────────────────────────────────
  uploadArea: {
    height: 160,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card,
    marginBottom: 16,
    gap: 6,
  },
  uploadAreaTitle: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
    color: C.white,
  },
  uploadAreaSub: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: C.grey3,
  },

  // ── Photo grid ────────────────────────────────────────────────────────────
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  photoThumbWrap: {
    width: (W - 60) / 3,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  coverBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: C.warning,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  coverBadgeText: {
    fontSize: 7,
    fontFamily: FontFamily.bold,
    color: '#000',
    letterSpacing: 0.5,
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Damage map ────────────────────────────────────────────────────────────
  damageMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  damageMapSub: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: C.grey3,
  },
  zoneLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  customZoneLabel: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: C.grey3,
    marginTop: 18,
    marginBottom: 8,
  },
  damageRecord: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 6,
  },
  damageRecordZone: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
    color: C.white,
  },
  damageRecordMeta: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: C.grey3,
    marginTop: 2,
  },

  // ── Pricing ───────────────────────────────────────────────────────────────
  pricingInfo: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: C.grey2,
    lineHeight: 18,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  priceInputLabel: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    color: C.grey3,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 14,
    height: 52,
  },
  pricePrefix: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    color: C.grey2,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: FontFamily.bold,
    color: C.white,
  },
  priceSub: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
    color: C.grey3,
    marginTop: 5,
  },
  priceBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  priceBarFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: C.accent,
    borderRadius: 3,
  },
  validBadge: {
    backgroundColor: C.successBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.successBorder,
  },
  validBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    color: C.success,
    letterSpacing: 0.5,
  },

  // ── Listing type ──────────────────────────────────────────────────────────
  listingTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  listingTypeCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  listingTypeCardActive: {
    borderColor: C.accent,
    backgroundColor: C.accentBg,
  },
  listingTypeTitle: {
    fontSize: 13,
    fontFamily: FontFamily.bold,
    color: C.grey1,
    textAlign: 'center',
  },
  listingTypeSub: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
    color: C.grey3,
    textAlign: 'center',
    lineHeight: 15,
  },

  // ── Badge grid ────────────────────────────────────────────────────────────
  badgeGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  badgeCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 12,
  },
  badgeCardActive: {
    borderColor: C.accent,
    backgroundColor: C.accentBg,
  },
  badgeName: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    color: C.grey1,
    letterSpacing: 0.3,
  },
  badgePrice: {
    fontSize: 16,
    fontFamily: FontFamily.extraBold,
    color: C.white,
    marginBottom: 4,
  },
  badgeSub: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
    color: C.grey3,
    lineHeight: 15,
  },
  badgeChip: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeChipText: {
    fontSize: 8,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
  },
  badgeFeature: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
    color: C.grey3,
    flex: 1,
  },
  selectedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.accentBg,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.accent,
  },
  selectedBadgeText: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    color: C.accent,
    letterSpacing: 0.5,
  },
  costLabel: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    color: C.grey2,
  },
  costValue: {
    fontSize: 16,
    fontFamily: FontFamily.extraBold,
  },

  // ── Review ────────────────────────────────────────────────────────────────
  reviewHeading: {
    fontSize: 18,
    fontFamily: FontFamily.extraBold,
    color: C.white,
    letterSpacing: -0.3,
    marginBottom: 20,
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  editLink: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: C.accent,
  },
  reviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  reviewKv: {
    width: '50%',
    marginBottom: 10,
    paddingRight: 8,
  },
  reviewKvLabel: {
    fontSize: 8,
    fontFamily: FontFamily.bold,
    color: C.grey3,
    letterSpacing: 1,
    marginBottom: 2,
  },
  reviewKvValue: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
    color: C.grey1,
  },
  reviewThumb: {
    width: 90,
    height: 70,
    borderRadius: 8,
    marginRight: 8,
  },
  reviewTitle: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    color: C.white,
    marginBottom: 8,
  },
  reviewDesc: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: C.grey2,
    lineHeight: 20,
  },
  tosText: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: C.grey3,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 10,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  nextBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    fontSize: 14,
    fontFamily: FontFamily.extraBold,
    color: '#fff',
    letterSpacing: 0.5,
  },

  // ── Damage modal ──────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  damageSheet: {
    backgroundColor: '#18181E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  damageSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  damageSheetTitle: {
    fontSize: 17,
    fontFamily: FontFamily.bold,
    color: C.white,
    marginBottom: 4,
  },
  damageConfirmBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  damageConfirmText: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    color: '#fff',
    letterSpacing: 0.4,
  },
});
