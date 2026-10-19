import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useStripe } from '@stripe/stripe-react-native';
import { Colors } from '../constants/colors';
import { useAppearanceStore } from '../store/appearanceStore';
import { mergeAppearanceStyles } from '../theme/appearancePalette';
import { FontFamily, FontSize } from '../constants/typography';
import { haptics } from '../lib/haptics';
import { previewImport, importFromUrl, type ScrapedListingPreview } from '../lib/listingsApi';
import { KeyboardStickyView } from './KeyboardStickyView';
import { createPaymentSheet } from '../lib/paymentsApi';

import { IconButton } from './IconButton';
import { useAppearance } from '../theme/useAppearance';
// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;
type BadgeTier = 'BASIC' | 'STANDARD' | 'PREMIUM';

interface Props {
  onClose: () => void;
  onImported?: (listingId: string) => void;
}

// ─── Plan config (matches SellCarFlowScreen) ─────────────────────────────────

const PLANS: Array<{
  tier: BadgeTier;
  label: string;
  price: number;
  sub: string;
  accent: string;
  features: string[];
}> = [
  {
    tier: 'BASIC',
    label: 'Basic',
    price: 1,
    sub: 'Standard listing',
    accent: Colors.white,
    features: ['Standard visibility', 'Offer range system'],
  },
  {
    tier: 'STANDARD',
    label: 'Standard',
    price: 10,
    sub: 'Most popular',
    accent: Colors.infoBlue,
    features: ['HPI vehicle-history report included', 'Standard package badge'],
  },
  {
    tier: 'PREMIUM',
    label: 'Premium',
    price: 25,
    sub: 'Best value',
    accent: Colors.warning,
    features: ['Everything in Standard, including HPI', 'Premium listing badge and presentation', 'Featured Boost included for 28 days'],
  },
];

const PLATFORM_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  AUTOTRADER: { bg: 'rgba(249,115,22,0.12)', text: Colors.lightOrange_fb923c, label: 'AutoTrader' },
  CARGURUS:   { bg: Colors.infoBlueAlpha12,  text: Colors.infoBlueLight, label: 'CarGurus' },
  CARWOW:     { bg: Colors.successAlpha12,   text: Colors.lightGreen_4ade80, label: 'CarWow' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const ImportListingModal: React.FC<Props> = ({ onClose, onImported }) => {
  const { tc } = useAppearance();
  const insets = useSafeAreaInsets();
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? mergeAppearanceStyles(st, lightImportListingStyles) : st;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Step 2
  const [preview, setPreview] = useState<ScrapedListingPreview | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editVrm, setEditVrm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Step 3
  const [importedId, setImportedId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<BadgeTier>('BASIC');
  const [activating, setActivating] = useState(false);

  // ── Step 1 handler ──

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) { setFetchError('Paste a listing URL to continue.'); return; }
    if (!trimmed.startsWith('http')) { setFetchError('Enter a valid URL starting with http.'); return; }
    setFetching(true);
    setFetchError(null);
    try {
      const data = await previewImport(trimmed);
      setPreview(data);
      setEditTitle(data.title ?? '');
      setEditPrice(data.price ? String(Math.round(data.price)) : '');
      setEditVrm((data.vrm ?? '').toUpperCase());
      setStep(2);
    } catch (err: any) {
      setFetchError(err?.message ?? 'Could not fetch listing details. Check the URL and try again.');
    } finally {
      setFetching(false);
    }
  };

  // ── Step 2 handler ──

  const handleSave = async () => {
    if (!preview) return;
    const price = parseFloat(editPrice.replace(/[^0-9.]/g, ''));
    if (!editPrice.trim() || isNaN(price) || price <= 0) {
      setSaveError('Enter a valid asking price.');
      return;
    }
    if (!editVrm.trim()) {
      setSaveError('Vehicle registration (VRM) is required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await importFromUrl({
        url: preview.originalUrl,
        price,
        vrm: editVrm.trim().toUpperCase(),
        title: editTitle.trim() || undefined,
      });
      haptics.success();
      setImportedId(res.id);
      onImported?.(res.id);
      setStep(3);
    } catch (err: any) {
      setSaveError(err?.message ?? 'Could not save listing. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Step 3 handler — activate via Stripe Payment Sheet ──

  const handleActivate = async () => {
    if (!importedId) return;
    const plan = PLANS.find(p => p.tier === selectedTier)!;
    setActivating(true);
    try {
      const sheet = await createPaymentSheet({
        listingId: importedId,
        amount: plan.price,
        type: 'LISTING_FEE',
        currency: 'gbp',
        badgeTier: plan.tier,
      });
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
        return; // user cancelled — stay on step 3
      }
      haptics.success();
      Alert.alert('Listing Published!', 'Your imported listing is now live.', [
        { text: 'Done', onPress: onClose },
      ]);
    } catch (err: any) {
      Alert.alert('Payment failed', err?.message ?? 'Could not process payment.');
    } finally {
      setActivating(false);
    }
  };

  // ── Helpers ──

  const fmtSpec = (label: string, value?: string | number | null) =>
    value ? { label, value: String(value) } : null;

  const specChips = preview ? [
    fmtSpec('Make', preview.make),
    fmtSpec('Model', preview.model),
    fmtSpec('Year', preview.year),
    fmtSpec('Miles', preview.mileage ? `${preview.mileage.toLocaleString('en-GB')} mi` : null),
    fmtSpec('Fuel', preview.fuelType),
    fmtSpec('Gearbox', preview.transmission),
    fmtSpec('Colour', preview.color),
    fmtSpec('Engine', preview.engineSize ? `${(preview.engineSize / 1000).toFixed(1)}L` : null),
    fmtSpec('BHP', preview.bhp),
  ].filter(Boolean) as { label: string; value: string }[] : [];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle={appearanceMode === 'light' ? "dark-content" : "light-content"} translucent backgroundColor="transparent" />
      <View style={ts.container}>
        <LinearGradient
          colors={appearanceMode === 'light' ? ['#EEF5FB', '#F7FBFF', '#EEF5FB'] : [Colors.infoBlueAlpha06, 'rgba(10,10,12,0)', Colors.bgPrimary]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={{ height: insets.top }} />

        {/* Header */}
        <View style={ts.header}>
          <IconButton style={ts.closeBtn} icon={<Ionicons name="close" size={18} color={appearanceMode === 'light' ? "#0F172A" : Colors.white} />} onPress={onClose} accessibilityLabel="Close" />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={ts.headerTitle}>Import a Listing</Text>
            <Text style={ts.headerSub}>
              {step === 1 ? 'Paste a link from AutoTrader, CarGurus or CarWow'
                : step === 2 ? 'Review and confirm listing details'
                : 'Choose your listing plan'}
            </Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* Step dots */}
        <View style={ts.stepRow}>
          {([1, 2, 3] as Step[]).map(n => (
            <React.Fragment key={n}>
              <View style={[ts.stepDot, step >= n && ts.stepDotActive]}>
                {step > n
                  ? <Ionicons name="checkmark" size={10} color={tc(Colors.white)} />
                  : <Text style={[ts.stepDotText, step === n && { color: Colors.white }]}>{n}</Text>
                }
              </View>
              {n < 3 && <View style={[ts.stepLine, step > n && ts.stepLineActive]} />}
            </React.Fragment>
          ))}
        </View>

        <KeyboardStickyView style={{ flex: 1 }} behavior="padding">
          {/* ── STEP 1 — URL Input ── */}
          {step === 1 && (
            <ScrollView
              contentContainerStyle={[ts.body, { paddingBottom: insets.bottom + 32 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Platform badges */}
              <View style={ts.platformRow}>
                {Object.entries(PLATFORM_STYLES).map(([key, ps]) => (
                  <View key={key} style={[ts.platformChip, { backgroundColor: ps.bg }]}>
                    <Text style={[ts.platformChipText, { color: ps.text }]}>{ps.label}</Text>
                  </View>
                ))}
              </View>

              {/* URL input */}
              <View style={ts.urlInputRow}>
                <Ionicons name="link-outline" size={16} color={tc(Colors.iconMuted)} style={{ marginRight: 8 }} />
                <TextInput
                  style={ts.urlInput}
                  value={url}
                  onChangeText={v => { setUrl(v); setFetchError(null); }}
                  placeholder="https://www.autotrader.co.uk/car-details/..."
                  placeholderTextColor={tc(Colors.inputPlaceholder)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={handleFetch}
                />
                {url.length > 0 && (
                  <IconButton icon={<Ionicons name="close-circle" size={16} color={tc(Colors.textDisabled)} />} onPress={() => setUrl('')} accessibilityLabel="Clear" />
                )}
              </View>

              {fetchError && (
                <View style={ts.errorBox}>
                  <Ionicons name="alert-circle-outline" size={13} color={Colors.error} />
                  <Text style={ts.errorText}>{fetchError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[ts.primaryBtn, (fetching || !url.trim()) && { opacity: 0.5 }]}
                onPress={handleFetch}
                disabled={fetching || !url.trim()}
                activeOpacity={0.85}
              >
                {fetching ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="search-outline" size={16} color={Colors.white} />
                    <Text style={ts.primaryBtnText}>Fetch Details</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── STEP 2 — Preview & Edit ── */}
          {step === 2 && preview && (
            <ScrollView
              contentContainerStyle={[ts.body, { paddingBottom: insets.bottom + 32 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Platform badge */}
              {preview.platform && PLATFORM_STYLES[preview.platform] && (
                <View style={[ts.platformChip, { backgroundColor: PLATFORM_STYLES[preview.platform].bg, alignSelf: 'flex-start', marginBottom: 12 }]}>
                  <Text style={[ts.platformChipText, { color: PLATFORM_STYLES[preview.platform].text }]}>
                    Imported from {PLATFORM_STYLES[preview.platform].label}
                  </Text>
                </View>
              )}

              {/* Image strip */}
              {preview.images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
                  {preview.images.slice(0, 5).map((img, i) => (
                    <Image
                      key={`img-${i}`}
                      source={{ uri: img }}
                      style={ts.previewThumb}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  ))}
                </ScrollView>
              )}

              {/* Read-only spec chips */}
              {specChips.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={ts.sectionLabel}>SCRAPED SPECS</Text>
                  <View style={ts.specChipGrid}>
                    {specChips.map(({ label, value }) => (
                      <View key={label} style={ts.specChip}>
                        <Text style={ts.specChipLabel}>{label}</Text>
                        <Text style={ts.specChipValue}>{value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Editable fields */}
              <Text style={ts.sectionLabel}>CONFIRM DETAILS</Text>

              <Text style={ts.fieldLabel}>TITLE</Text>
              <TextInput
                style={ts.fieldInput}
                value={editTitle}
                onChangeText={v => { setEditTitle(v); setSaveError(null); }}
                placeholder="e.g. BMW M4 Competition 2021"
                placeholderTextColor={tc(Colors.inputPlaceholder)}
                autoCorrect={false}
              />

              <Text style={ts.fieldLabel}>ASKING PRICE (£) *</Text>
              <View style={ts.priceRow}>
                <Text style={ts.priceCurrency}>£</Text>
                <TextInput
                  style={[ts.fieldInput, { flex: 1, marginBottom: 0 }]}
                  value={editPrice}
                  onChangeText={v => { setEditPrice(v); setSaveError(null); }}
                  placeholder="0"
                  placeholderTextColor={tc(Colors.inputPlaceholder)}
                  keyboardType="number-pad"
                />
              </View>

              <Text style={[ts.fieldLabel, { marginTop: 14 }]}>REGISTRATION (VRM) *</Text>
              <TextInput
                style={ts.fieldInput}
                value={editVrm}
                onChangeText={v => { setEditVrm(v.toUpperCase()); setSaveError(null); }}
                placeholder="e.g. AB12 CDE"
                placeholderTextColor={tc(Colors.inputPlaceholder)}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              {saveError && (
                <View style={ts.errorBox}>
                  <Ionicons name="alert-circle-outline" size={13} color={Colors.error} />
                  <Text style={ts.errorText}>{saveError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[ts.primaryBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <Text style={ts.primaryBtnText}>Save as Draft</Text>
                    <Ionicons name="arrow-forward" size={15} color={Colors.white} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep(1)} style={ts.backLink}>
                <Text style={ts.backLinkText}>← Change URL</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── STEP 3 — Plan selection ── */}
          {step === 3 && (
            <ScrollView
              contentContainerStyle={[ts.body, { paddingBottom: insets.bottom + 32 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* Success header */}
              <View style={ts.successHeader}>
                <View style={ts.successIcon}>
                  <Ionicons name="checkmark-circle" size={32} color={tc(Colors.accentGreen)} />
                </View>
                <Text style={ts.successTitle}>Listing saved as draft</Text>
                <Text style={ts.successSub}>Choose a plan to make it live, or do it later from My Listings.</Text>
              </View>

              {/* Plan cards */}
              {PLANS.map(plan => {
                const selected = selectedTier === plan.tier;
                return (
                  <TouchableOpacity
                    key={plan.tier}
                    style={[ts.planCard, selected && { borderColor: plan.accent, backgroundColor: `${plan.accent}10` }]}
                    onPress={() => setSelectedTier(plan.tier)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[ts.planRadio, selected && { backgroundColor: plan.accent, borderColor: plan.accent }]}>
                        {selected && <Ionicons name="checkmark" size={11} color={tc(Colors.white)} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[ts.planLabel, { color: plan.accent }]}>{plan.label}</Text>
                        <Text style={ts.planSub}>{plan.sub}</Text>
                      </View>
                      <Text style={[ts.planPrice, { color: plan.accent }]}>£{plan.price}</Text>
                    </View>
                    {selected && (
                      <View style={{ marginTop: 10, marginLeft: 40, gap: 3 }}>
                        {plan.features.map(f => (
                          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="checkmark-circle" size={11} color={tc(Colors.accentGreen)} />
                            <Text style={ts.planFeatureText}>{f}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Activate */}
              <TouchableOpacity
                style={[ts.primaryBtn, activating && { opacity: 0.6 }]}
                onPress={handleActivate}
                disabled={activating}
                activeOpacity={0.85}
              >
                {activating ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={ts.primaryBtnText}>
                    Activate for £{PLANS.find(p => p.tier === selectedTier)?.price}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={ts.backLink}>
                <Text style={ts.backLinkText}>Do it later — listing saved in My Listings</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardStickyView>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const lightImportListingStyles = StyleSheet.create({
  container: {backgroundColor: '#EEF5FB'},
  header: {backgroundColor: '#EEF5FB', borderBottomColor: '#D5E1EC'},
  closeBtn: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC'},
  headerTitle: {color: '#0F172A'},
  headerSub: {color: '#526177'},
  stepDot: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC'},
  stepDotText: {color: '#526177'},
  stepLine: {backgroundColor: '#D5E1EC'},
  urlInputRow: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC'},
  urlInput: {color: '#0F172A'},
  specChip: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC'},
  specChipLabel: {color: '#526177'},
  specChipValue: {color: '#0F172A'},
  sectionLabel: {color: '#0F172A'},
  fieldLabel: {color: '#334155'},
  fieldInput: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC', color: '#0F172A'},
  priceRow: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC'},
  priceCurrency: {color: '#334155'},
  successTitle: {color: '#0F172A'},
  successSub: {color: '#526177'},
  planCard: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC'},
  planSub: {color: '#526177'},
  planFeatureText: {color: '#334155'},
  backLinkText: {color: '#526177'},
  errorText: {color: '#7F1D1D'},
});

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  // Header
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
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.white,
    textAlign: 'center',
  },
  headerSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 15,
  },

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 48,
    paddingVertical: 10,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  stepDotText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.whiteAlpha06,
    marginHorizontal: 6,
  },
  stepLineActive: {
    backgroundColor: Colors.accent,
  },

  // Body
  body: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 0,
  },

  // Platform chips (Step 1)
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  platformChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  platformChipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
  },

  // URL input
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  urlInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.textPrimary,
  },

  // Step 2 — Preview
  previewThumb: {
    width: 120,
    height: 86,
    borderRadius: 10,
    backgroundColor: Colors.bgTertiary,
  },
  specChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specChip: {
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  specChipLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  specChipValue: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.textPrimary,
  },

  // Editable fields
  sectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 12,
  },
  fieldLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 14,
  },
  fieldInput: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: 0,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  priceCurrency: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.textMuted,
    marginRight: 6,
  },

  // Step 3 — Plan selection
  successHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accentGreenAlpha12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  successSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  planCard: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  planRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.whiteAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
  },
  planSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  planPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.lg,
    flexShrink: 0,
  },
  planFeatureText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  // Shared
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    marginTop: 20,
  },
  primaryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  backLinkText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: Colors.errorAlpha08,
    borderWidth: 1,
    borderColor: Colors.errorAlpha20,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.errorLight,
    flex: 1,
    lineHeight: 17,
  },
});
