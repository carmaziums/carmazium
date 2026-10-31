import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { BottomSheet } from '../../components/BottomSheet';
import { ImageLightbox } from '../../components/ImageLightbox';
import { BuyerDamageViewer } from '../../components/damage/BuyerDamageViewer';
import { PurchaseInspectionNotes } from '../../components/dealer/PurchaseInspectionNotes';
import { SaleCancellationSheet } from '../../components/SaleCancellationSheet';
import { apiClient } from '../../lib/apiClient';
import { getServiceSettings } from '../../lib/servicesApi';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type DetailRoute = RouteProp<MainStackParamList, 'DealerPurchaseDetail'>;

interface PurchaseDetail {
  id: string;
  listingId: string;
  purchasePrice: number;
  purchasedAt: string;
  purchaseStatus: string;
  retailSold: boolean;
  channel: 'RETAIL' | 'AUCTION';
  vehicle: {
    title: string; imageUrl: string | null; registration: string | null;
    make: string | null; model: string | null; year: number | null;
    mileage: number | null; listedLocation: string | null;
  };
  buyerFee: { required: boolean; settled: boolean };
  payment: { route: 'DIRECT_TO_SELLER'; sellerFundsConfirmedAt: string | null };
  delivery: {
    jobId: string; status: string; createdAt: string; requestedFor: string | null;
  } | null;
  documents: {
    handoverSubmittedAt: string | null; handoverRejectedAt: string | null;
    sellerBonusReleased: boolean;
  };
  auction?: { wonAt: string | null; winningBid: number | null; buyerFeeDeadlineAt: string | null } | null;
  /** True once the backend has snapshots and inspection notes switched on. */
  inspectionNotesEnabled?: boolean;
  /** Seller-supplied advert: purchase-time snapshot when one exists, else the current listing. */
  listingRecord?: {
    source: 'CURRENT_LISTING' | 'PURCHASE_SNAPSHOT';
    capturedAt?: string | null;
    capturedAfterSale?: boolean;
    lastUpdatedAt: string | null; removedFromSaleAt: string | null;
    images: string[]; description: string | null;
    variant: string | null; fuelType: string | null; transmission: string | null;
    bodyType: string | null; engineSize: number | null; color: string | null;
    vin: string | null; firstRegistered: string | null; owners: string | null;
    numberOfKeys: number | null; serviceHistory: string | null;
    motStatus: string | null; motExpiryDate: string | null; exteriorGrade: number | null;
    sellerDeclarations: {
      mechanicalIssues: string | null; electricalIssues: string | null;
      hasOutstandingFinance: boolean | null; stolenRecovered: boolean | null;
      isLegalRegisteredKeeper: boolean | null;
    };
    damage: { id: string; part: string; type: string; size: string; imageUrl: string | null }[];
  };
}

const yesNo = (v: boolean | null | undefined): string => v == null ? 'Not provided' : v ? 'Yes' : 'No';
const photoSrc = (raw: string): string => raw.split('#')[0];

interface Seller {
  sellerName: string;
  sellerCompany: string | null;
  contactUnlocked: boolean;
  buyerFeeRequired: boolean;
  sellerEmail: string | null;
  sellerPhone: string | null;
  sellerAddress: string | null;
}

const money = (amount: number): string =>
  '£' + Number(amount).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const dateTime = (value: string | null | undefined): string => value
  ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'an unknown time';
const date = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not yet recorded';

const LabelValue = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.fieldRow}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{value}</Text>
  </View>
);

const DetailSection = ({
  title, icon, children, onLayout,
}: {
  title: string; icon: string; children: React.ReactNode;
  onLayout?: (event: any) => void;
}) => (
  <View style={styles.card} onLayout={onLayout}>
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon as any} color={Colors.accent} size={19} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

/** Never request seller PII outside the fee-gated /:id/seller endpoint. */
export const DealerPurchaseDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<DetailRoute>();
  const { saleId } = params;
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const deliveryTop = useRef(0);
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerError, setSellerError] = useState(false);
  const [actions, setActions] = useState(false);
  const [showSeller, setShowSeller] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  // The 3D viewer is a WebView, so it only mounts when the dealer asks for it.
  const [show3d, setShow3d] = useState(false);
  // Same emergency switch as the website (NEXT_PUBLIC_FEATURE_DELIVERY),
  // read from the backend that enforces it. Viewing an existing job is
  // always allowed; only new delivery jobs are blocked.
  const [deliveryAvailable, setDeliveryAvailable] = useState(true);
  useEffect(() => {
    let active = true;
    getServiceSettings()
      .then(s => { if (active) setDeliveryAvailable(s.availability?.DELIVERY !== false); })
      .catch(() => { /* the backend still refuses new jobs if delivery is switched off */ });
    return () => { active = false; };
  }, []);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSellerError(false);
    const [purchaseResult, sellerResult] = await Promise.allSettled([
      apiClient<{ data: PurchaseDetail }>(`/dealers/purchases/${encodeURIComponent(saleId)}`),
      apiClient<{ data: Seller }>(`/dealers/purchases/${encodeURIComponent(saleId)}/seller`),
    ]);
    if (purchaseResult.status === 'fulfilled') {
      setDetail(purchaseResult.value.data);
    } else {
      setDetail(null);
      setError(purchaseResult.reason instanceof Error
        ? purchaseResult.reason.message : 'Purchase not found or access denied.');
    }
    if (sellerResult.status === 'fulfilled') setSeller(sellerResult.value.data);
    else { setSeller(null); setSellerError(true); }
    setLoading(false);
  }, [saleId]);

  useEffect(() => { void load(); }, [load]);

  const openAction = (action: 'summary' | 'seller' | 'delivery' | 'adjustments') => {
    setActions(false);
    if (action === 'summary') scrollRef.current?.scrollTo({ y: 0, animated: true });
    if (action === 'seller') setShowSeller(true);
    if (action === 'delivery') scrollRef.current?.scrollTo({ y: deliveryTop.current, animated: true });
    if (action === 'adjustments') setCancelOpen(true);
  };

  const bookDelivery = () => {
    if (!detail) return;
    if (detail.buyerFee.required && !detail.buyerFee.settled) {
      Alert.alert('Auction fee pending',
        'Complete the applicable auction buyer-fee checks before arranging collection.');
      return;
    }
    if (detail.delivery) {
      navigation.navigate('CustomerServiceJobDetail', { jobId: detail.delivery.jobId });
      return;
    }
    if (!deliveryAvailable) {
      Alert.alert('Delivery unavailable', 'Delivery jobs are currently unavailable. Please try again later.');
      return;
    }
    navigation.navigate('CreateServiceJob', {
      serviceType: 'DELIVERY',
      purchase: {
        listingId: detail.listingId,
        title: detail.vehicle.title,
        registration: detail.vehicle.registration,
        make: detail.vehicle.make,
        model: detail.vehicle.model,
      },
    });
  };

  const openContact = (kind: 'call' | 'email') => {
    if (!seller?.contactUnlocked) return;
    const target = kind === 'call'
      ? seller.sellerPhone?.replace(/[^+\d]/g, '')
      : seller.sellerEmail;
    if (!target) return;
    Linking.openURL(`${kind === 'call' ? 'tel' : 'mailto'}:${target}`)
      .catch(() => Alert.alert('Unavailable', 'This device cannot open that contact option.'));
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to purchases"
          onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="chevron-back" color={Colors.textPrimary} size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Purchase details</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Purchase actions"
          onPress={() => setActions(true)} style={styles.iconButton}>
          <Ionicons name="ellipsis-horizontal" color={Colors.textPrimary} size={22} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.muted}>Loading your purchase…</Text>
        </View>
      ) : error || !detail ? (
        <View style={styles.loading}>
          <Text style={styles.warning}>{error || 'Purchase not available.'}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void load()} style={styles.buttonOutline}>
            <Text style={styles.buttonOutlineText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <DetailSection title="Purchase summary" icon="car-outline">
              {!!detail.vehicle.imageUrl && (
                <Image source={{ uri: detail.vehicle.imageUrl }} style={styles.hero} contentFit="cover" />
              )}
              <Text style={styles.vehicleTitle}>{detail.vehicle.title}</Text>
              <Text style={styles.price}>{money(detail.purchasePrice)}</Text>
              <View style={styles.status}>
                <Ionicons name="checkmark-circle-outline" color={Colors.success} size={16} />
                <Text style={styles.statusText}>
                  {detail.retailSold ? 'Purchased' : detail.channel === 'AUCTION' ? 'Auction won'
                    : detail.purchaseStatus.replace(/_/g, ' ')}
                </Text>
              </View>
              <LabelValue label="Reference" value={detail.id.slice(0, 8).toUpperCase()} />
              <LabelValue label="Purchased" value={date(detail.purchasedAt)} />
              <LabelValue label="Sale channel" value={detail.channel === 'RETAIL' ? 'Retail' : 'Auction'} />
              <LabelValue label="Registration" value={detail.vehicle.registration || 'Not provided'} />
              <LabelValue label="Mileage" value={detail.vehicle.mileage == null
                ? 'Not provided' : detail.vehicle.mileage.toLocaleString('en-GB') + ' miles'} />
              <LabelValue label="Listed location" value={detail.vehicle.listedLocation || 'Not provided'} />
            </DetailSection>

            {detail.listingRecord && (() => {
              const r = detail.listingRecord;
              const photos = r.images.filter(Boolean).map(photoSrc);
              const damagePhotos = r.damage.map(x => x.imageUrl).filter((u): u is string => !!u);
              return (
                <DetailSection title="Listing record" icon="clipboard-outline">
                  {/* Honest provenance: the purchase-time snapshot, or the
                      current advert for purchases made before snapshots. */}
                  <Text style={r.source === 'PURCHASE_SNAPSHOT' ? styles.snapshotNote : styles.warning}>
                    {r.source === 'PURCHASE_SNAPSHOT'
                      ? `${r.capturedAfterSale
                        ? `Saved ${r.capturedAt ? dateTime(r.capturedAt) : 'at an unknown time'}, after the sale was recorded on ${dateTime(detail.purchasedAt)}. The seller could have changed the advert in between.`
                        : `Saved when you bought this vehicle${r.capturedAt ? `, ${date(r.capturedAt)}` : ''}.`} Later changes by the seller don't affect it.${r.removedFromSaleAt ? ` The live advert was removed ${date(r.removedFromSaleAt)}.` : ''}`
                      : `Current listing${r.lastUpdatedAt ? `, last updated ${date(r.lastUpdatedAt)}` : ''}. The seller may have changed it since you bought the vehicle.${r.removedFromSaleAt ? ` Removed from sale ${date(r.removedFromSaleAt)}.` : ''}`}
                  </Text>
                  {photos.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recordPhotos}>
                      {photos.map((uri, i) => (
                        <TouchableOpacity key={uri + i} accessibilityRole="imagebutton"
                          accessibilityLabel={`Open photo ${i + 1} of ${photos.length}`}
                          onPress={() => setLightbox({ images: photos, index: i })}>
                          <Image source={{ uri }} style={styles.recordPhoto} contentFit="cover" />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : <Text style={styles.fieldLabel}>No photos are stored for this listing.</Text>}
                  {!!r.description && <Text style={styles.recordText}>{r.description}</Text>}
                  {!!r.variant && <LabelValue label="Variant" value={r.variant} />}
                  {!!r.firstRegistered && <LabelValue label="First registered" value={r.firstRegistered} />}
                  {!!r.fuelType && <LabelValue label="Fuel" value={r.fuelType} />}
                  {!!r.transmission && <LabelValue label="Transmission" value={r.transmission} />}
                  {!!r.engineSize && <LabelValue label="Engine" value={`${r.engineSize} cc`} />}
                  {!!r.color && <LabelValue label="Colour" value={r.color} />}
                  {!!r.vin && <LabelValue label="VIN" value={r.vin} />}
                  {!!r.owners && <LabelValue label="Previous owners" value={r.owners} />}
                  {r.numberOfKeys != null && <LabelValue label="Keys" value={String(r.numberOfKeys)} />}
                  {!!r.serviceHistory && <LabelValue label="Service history" value={r.serviceHistory} />}
                  {!!(r.motStatus || r.motExpiryDate) && <LabelValue label="MOT"
                    value={[r.motStatus, r.motExpiryDate ? `expires ${date(r.motExpiryDate)}` : null].filter(Boolean).join(', ')} />}
                  {r.exteriorGrade != null && <LabelValue label="Condition grade" value={`Grade ${r.exteriorGrade}`} />}
                  <LabelValue label="Known mechanical issues" value={r.sellerDeclarations.mechanicalIssues || 'None declared'} />
                  <LabelValue label="Known electrical issues" value={r.sellerDeclarations.electricalIssues || 'None declared'} />
                  <LabelValue label="Outstanding finance" value={yesNo(r.sellerDeclarations.hasOutstandingFinance)} />
                  <LabelValue label="Stolen and recovered" value={yesNo(r.sellerDeclarations.stolenRecovered)} />
                  <LabelValue label="Seller is registered keeper" value={yesNo(r.sellerDeclarations.isLegalRegisteredKeeper)} />
                  <Text style={styles.recordSubhead}>Declared damage ({r.damage.length})</Text>
                  {r.damage.length > 0 && (
                    <TouchableOpacity style={styles.show3dButton} onPress={() => setShow3d(v => !v)}
                      accessibilityRole="button" accessibilityState={{ expanded: show3d }}>
                      <Ionicons name="cube-outline" size={16} color={Colors.accent} />
                      <Text style={styles.show3dText}>{show3d ? 'Hide 3D damage markers' : 'Show damage markers in 3D'}</Text>
                    </TouchableOpacity>
                  )}
                  {show3d && r.damage.length > 0 && (
                    <BuyerDamageViewer records={r.damage} isLoading={false} bodyTypeLabel={r.bodyType ?? undefined} />
                  )}
                  {r.damage.length === 0 ? <Text style={styles.fieldLabel}>No damage was declared on the listing.</Text>
                    : r.damage.map(item => (
                      <TouchableOpacity key={item.id} style={styles.damageRow} disabled={!item.imageUrl}
                        accessibilityRole={item.imageUrl ? 'imagebutton' : undefined}
                        onPress={() => item.imageUrl && setLightbox({ images: damagePhotos, index: Math.max(0, damagePhotos.indexOf(item.imageUrl)) })}>
                        {item.imageUrl
                          ? <Image source={{ uri: item.imageUrl }} style={styles.damagePhoto} contentFit="cover" />
                          : <View style={styles.damagePhoto} />}
                        <Text style={styles.recordText}>{item.part} · {item.type} · {item.size}</Text>
                      </TouchableOpacity>
                    ))}
                </DetailSection>
              );
            })()}

            {detail.inspectionNotesEnabled && <PurchaseInspectionNotes saleId={detail.id} />}

            <DetailSection title="Seller details" icon="person-outline">
              {sellerError && <Text style={styles.warning}>Seller details could not be loaded.</Text>}
              {seller && (
                <>
                  <LabelValue label="Seller" value={seller.sellerCompany || seller.sellerName} />
                  {seller.contactUnlocked ? (
                    <>
                      <LabelValue label="Phone" value={seller.sellerPhone || 'Not provided'} />
                      <LabelValue label="Email" value={seller.sellerEmail || 'Not provided'} />
                      <LabelValue label="Address on file" value={seller.sellerAddress || 'Not available'} />
                      <Text style={styles.muted}>
                        The address on file may not be the vehicle pickup point. Confirm with the seller.
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.warning}>
                      Auction seller contact is locked until the applicable buyer-fee checks are satisfied.
                    </Text>
                  )}
                </>
              )}
              <TouchableOpacity accessibilityRole="button" onPress={() => setShowSeller(true)}
                style={styles.inlineLink}>
                <Text style={styles.link}>Seller&apos;s details</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
              </TouchableOpacity>
            </DetailSection>

            <DetailSection title="Payment and fees" icon="wallet-outline">
              <LabelValue label="Vehicle price" value={money(detail.purchasePrice)} />
              <LabelValue label="Vehicle payment"
                value="Paid by buyer directly to seller; not handled by Carmazium" />
              <LabelValue label="Seller confirms funds"
                value={detail.payment.sellerFundsConfirmedAt
                  ? 'Confirmed ' + date(detail.payment.sellerFundsConfirmedAt)
                  : 'Not confirmed in this record'} />
              <LabelValue label="Auction buyer fee" value={!detail.buyerFee.required
                ? 'Not applicable — retail purchase'
                : detail.buyerFee.settled ? 'Settled' : 'Not marked settled'} />
              {detail.buyerFee.required && !detail.buyerFee.settled && (
                <Text style={styles.muted}>Any applicable admin grants are checked through the authorised payment process.</Text>
              )}
            </DetailSection>

            <DetailSection title="Documents and handover" icon="document-text-outline">
              {detail.channel === 'RETAIL' ? (
                <Text style={styles.muted}>
                  No completed document upload is recorded for this retail purchase.
                  Confirm V5C and handover details with the seller before collecting.
                </Text>
              ) : (
                <>
                  <LabelValue label="Handover photo submitted"
                    value={date(detail.documents.handoverSubmittedAt)} />
                  <LabelValue label="Handover evidence" value={detail.documents.handoverRejectedAt
                    ? 'Rejected — replacement required'
                    : detail.documents.sellerBonusReleased ? 'Seller reward released'
                      : 'Not marked approved'} />
                  <Text style={styles.muted}>A handover photo is not proof of vehicle payment.</Text>
                </>
              )}
            </DetailSection>

            <DetailSection title="Delivery details" icon="car-sport-outline"
              onLayout={event => { deliveryTop.current = event.nativeEvent.layout.y; }}>
              {detail.delivery ? (
                <>
                  <LabelValue label="Job status" value={detail.delivery.status.replace(/_/g, ' ')} />
                  <LabelValue label="Posted" value={date(detail.delivery.createdAt)} />
                  <LabelValue label="Requested delivery" value={date(detail.delivery.requestedFor)} />
                  <TouchableOpacity accessibilityRole="button" onPress={bookDelivery} style={styles.inlineLink}>
                    <Text style={styles.link}>View delivery job and quotes</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.muted}>
                  No TradeXchange delivery job linked yet. Post a job to collect competing
                  transporter quotes. This does not automatically book or charge for delivery.
                </Text>
              )}
            </DetailSection>
            <View style={{ height: 110 }} />
          </ScrollView>
          {lightbox && (
            <ImageLightbox visible images={lightbox.images} initialIndex={lightbox.index}
              onClose={() => setLightbox(null)} />
          )}

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) + 10 }]}>
            <TouchableOpacity accessibilityRole="button" style={styles.buttonOutline}
              onPress={() => setShowSeller(true)}>
              <Ionicons name="person-outline" color={Colors.textPrimary} size={17} />
              <Text style={styles.buttonOutlineText}>Seller&apos;s details</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button"
              style={[styles.buttonPrimary,
                !detail.delivery && ((detail.buyerFee.required && !detail.buyerFee.settled) || !deliveryAvailable)
                  && styles.buttonDisabled]}
              onPress={bookDelivery}>
              <Ionicons name="car-sport-outline" color={Colors.white} size={17} />
              <Text style={styles.buttonPrimaryText}>{detail.delivery ? 'View delivery' : 'Book delivery'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <BottomSheet visible={actions} onClose={() => setActions(false)} title="Purchase actions">
        <View style={{ gap: 5, paddingBottom: 12 }}>
          {([
            ['summary', 'Purchase summary'],
            ['seller', 'Seller details'],
            ['delivery', 'Delivery details'],
            ['adjustments', 'Adjustments & cancellations'],
          ] as const).map(([action, label]) => (
            <TouchableOpacity key={action} accessibilityRole="button"
              style={styles.actionItem} onPress={() => openAction(action)}>
              <Text style={styles.actionText}>{label}</Text>
              <Ionicons name="chevron-forward" color={Colors.textMuted} size={16} />
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={showSeller} onClose={() => setShowSeller(false)}
        title="Full seller details">
        <View style={{ gap: 10, paddingBottom: 20 }}>
          {sellerError && <Text style={styles.warning}>Seller details could not be loaded. Please retry.</Text>}
          {seller && (
            <>
              <LabelValue label="Seller" value={seller.sellerCompany || seller.sellerName} />
              {!seller.contactUnlocked ? (
                <Text style={styles.warning}>
                  Contact details remain locked until the applicable auction buyer-fee checks are satisfied.
                </Text>
              ) : (
                <>
                  <LabelValue label="Phone" value={seller.sellerPhone || 'Not provided'} />
                  <LabelValue label="Email" value={seller.sellerEmail || 'Not provided'} />
                  <LabelValue label="Address on file" value={seller.sellerAddress || 'Not available'} />
                  <Text style={styles.muted}>The recorded address is not necessarily the pickup location.</Text>
                  <View style={styles.contactRow}>
                    <TouchableOpacity accessibilityRole="button" onPress={() => openContact('call')}
                      disabled={!seller.sellerPhone} style={styles.buttonOutline}>
                      <Text style={styles.buttonOutlineText}>Call seller</Text>
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" onPress={() => openContact('email')}
                      disabled={!seller.sellerEmail} style={styles.buttonOutline}>
                      <Text style={styles.buttonOutlineText}>Email seller</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </BottomSheet>

      {cancelOpen && detail && (
        <SaleCancellationSheet visible listingId={detail.listingId}
          vehicleTitle={detail.vehicle.title}
          onClose={() => setCancelOpen(false)}
          onCreated={() => { setCancelOpen(false); void load(); }} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  recordPhotos: { marginVertical: 10 },
  recordPhoto: { width: 132, height: 99, borderRadius: 10, marginRight: 8, backgroundColor: Colors.bgCard },
  recordText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20, marginVertical: 6, flexShrink: 1 },
  recordSubhead: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: 15, marginTop: 12, marginBottom: 4 },
  damageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  snapshotNote: { color: Colors.success, fontFamily: FontFamily.medium, fontSize: 13, lineHeight: 19 },
  show3dButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, alignSelf: 'flex-start' },
  show3dText: { fontFamily: FontFamily.bold, fontSize: 14, color: Colors.accent },
  damagePhoto: { width: 72, height: 54, borderRadius: 8, backgroundColor: Colors.bgCard },
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    height: 60, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 18,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  headerTitle: { fontFamily: FontFamily.extraBold, fontSize: 18, color: Colors.textPrimary },
  iconButton: {
    minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: Colors.bgCard,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 18, gap: 14 },
  card: {
    borderRadius: 16, padding: 17, gap: 10, backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  sectionTitleRow: { flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 5 },
  sectionTitle: { fontFamily: FontFamily.extraBold, fontSize: 16, color: Colors.textPrimary },
  vehicleTitle: { fontSize: 20, fontFamily: FontFamily.extraBold, color: Colors.textPrimary },
  price: { fontSize: 25, fontFamily: FontFamily.extraBold, color: Colors.textPrimary },
  hero: { width: '100%', height: 180, borderRadius: 12 },
  fieldRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingVertical: 7, gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  fieldLabel: { flex: 1, color: Colors.textMuted, fontFamily: FontFamily.medium, fontSize: 12 },
  fieldValue: {
    flex: 1.3, color: Colors.textPrimary, textAlign: 'right',
    fontFamily: FontFamily.bold, fontSize: 12,
  },
  status: {
    alignSelf: 'flex-start', flexDirection: 'row', gap: 5, alignItems: 'center',
    backgroundColor: Colors.successAlpha12, borderRadius: 10, padding: 8,
  },
  statusText: { color: Colors.success, fontSize: 12, fontFamily: FontFamily.bold },
  muted: { color: Colors.textMuted, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 19 },
  warning: { color: Colors.warning, fontFamily: FontFamily.medium, fontSize: 13, lineHeight: 19 },
  inlineLink: { minHeight: 44, flexDirection: 'row', gap: 5, alignItems: 'center' },
  link: { color: Colors.accent, fontFamily: FontFamily.bold, fontSize: 13 },
  footer: {
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.bgCard, flexDirection: 'row', gap: 10,
    paddingHorizontal: 14, paddingTop: 10,
  },
  buttonOutline: {
    flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.borderSubtle, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8,
  },
  buttonOutlineText: { fontFamily: FontFamily.bold, color: Colors.textPrimary, fontSize: 12 },
  buttonPrimary: {
    flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: Colors.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonPrimaryText: { fontFamily: FontFamily.bold, color: Colors.white, fontSize: 12 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 24 },
  actionItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionText: { fontFamily: FontFamily.bold, color: Colors.textPrimary, fontSize: 14 },
  contactRow: { flexDirection: 'row', gap: 8, paddingTop: 10 },
});
