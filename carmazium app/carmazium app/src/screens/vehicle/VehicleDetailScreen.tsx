import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
  Share,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
// expo-image: caching/recycling for the swipeable photo gallery + thumbnail
// strip — users flick through many high-res car photos per listing here.
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  clamp,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { formatPrice, formatMileage, CarListing } from '../../data/listings';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { useWatchlistStore } from '../../store/watchlistStore';
import { apiClient } from '../../lib/apiClient';
import { createChatRoom } from '../../lib/chatApi';
import { useChat } from '../../context/ChatContext';
import { DamageMapViewer } from '../../components/DamageMapViewer';
import { useAuthStore } from '../../store/authStore';
import { haptics } from '../../lib/haptics';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { createDeliveryRequest, calcDeliveryFeeExVat } from '../../lib/deliveryApi';
import { StripeCheckoutModal } from '../../components/StripeCheckoutModal';

type Props = NativeStackScreenProps<MainStackParamList, 'VehicleDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_HEIGHT = 320;

export const VehicleDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { listing } = route.params;
  const insets = useSafeAreaInsets();
  const [activeImage, setActiveImage] = useState(0);
  const { isSaved, save, unsave } = useWatchlistStore();
  const { refreshRooms } = useChat();

  const images = listing.images ?? [];

  // ── Gallery gesture values ──────────────────────────────────────────────────
  const translateX = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const totalImages = images.length;

  // ── Full-screen viewer state + gesture values ───────────────────────────────
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const pinchScale = useSharedValue(1);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const savedPanX = useSharedValue(0);
  const savedPanY = useSharedValue(0);
  const saved = isSaved(listing.id);

  // Dynamic States for Make an Offer
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerAmount, setOfferAmount] = useState(listing.price - 2500);
  const [offerSubmitted, setOfferSubmitted] = useState(false);
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);

  // Dynamic States for Live Chat simulation
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { id: '1', text: `Hi there! How can we help you with the ${listing.make} ${listing.model} today?`, isUser: false },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // HPI
  const [hpiData, setHpiData] = useState<any>(null);
  const [hpiLoading, setHpiLoading] = useState(false);
  const [hpiModalVisible, setHpiModalVisible] = useState(false);
  const [hpiError, setHpiError] = useState<string | null>(null);
  // In-app Stripe hosted checkout URL for HPI (£9.99). We use the WebView
  // path here rather than the native Payment Sheet because the backend HPI
  // report generation is triggered specifically by the /payments/hpi-checkout
  // webhook — a plain /payments/intent payment would charge the buyer but
  // never actually run HpiService.fetchAndSaveReport.
  const [hpiCheckoutUrl, setHpiCheckoutUrl] = useState<string | null>(null);

  // Damage records
  const [damageRecords, setDamageRecords] = useState<any[]>([]);
  const [damageLoading, setDamageLoading] = useState(true);

  // Finance calculator
  const [financeExpanded, setFinanceExpanded] = useState(false);
  const [depositPct, setDepositPct] = useState(10); // % of price as deposit
  const [termMonths, setTermMonths] = useState(48);

  // Delivery
  const [offerStatus, setOfferStatus] = useState<string | null>(null);
  const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);
  const [deliveryStreet, setDeliveryStreet] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryPostcode, setDeliveryPostcode] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);
  const [deliverySubmitted, setDeliverySubmitted] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  // Dealer tools panel
  const role = useAuthStore((s) => s.role);
  const isDealer = role === 'dealer';
  const [dealerPanelOpen, setDealerPanelOpen] = useState(false);
  const capEstimate = Math.round(listing.price * 0.82);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleToggleSaved = () => {
    if (isSaved(listing.id)) {
      unsave(listing.id);
    } else {
      save(listing);
    }
  };

  const handleThumbnailPress = (index: number) => {
    setActiveImage(index);
    const target = -index * SCREEN_WIDTH;
    translateX.value = withSpring(target, { damping: 20, stiffness: 200 });
    savedTranslateX.value = target;
  };

  const adjustOffer = (amount: number) => {
    setOfferAmount((prev) => Math.max(listing.price - 15000, prev + amount));
  };

  const handleSubmitOffer = async () => {
    if (!listing.id) return;
    setIsSubmittingOffer(true);
    try {
      await apiClient('/offers', {
        method: 'POST',
        body: JSON.stringify({ listingId: listing.id, amount: offerAmount }),
      });
      setOfferSubmitted(true);
    } catch (err: any) {
      Alert.alert('Offer Failed', err.message || 'Could not submit offer. Please try again.');
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  const closeOfferFlow = () => {
    setOfferModalVisible(false);
    // Reset state after closing
    setTimeout(() => {
      setOfferSubmitted(false);
    }, 300);
  };

  const handleOpenChat = async () => {
    try {
      if (listing.seller?.id) {
        const room = await createChatRoom(listing.seller.id, listing.id);
        // Refresh ChatContext so the new room is in the list before ChatScreen mounts
        await refreshRooms();
        navigation.navigate('ChatScreen', { threadId: room.id });
      } else {
        setChatVisible(true);
      }
    } catch {
      setChatVisible(true);
    }
  };

  const handleQuickReply = (text: string) => {
    // Add user message
    const userMsg = { id: String(Date.now()), text, isUser: true };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Simulate smart dealer reply
    setTimeout(() => {
      setIsTyping(false);
      let replyText = "Thank you for your message. A representative will get back to you shortly!";
      if (text.includes("available")) {
        replyText = `Yes, this ${listing.make} is currently available in our showroom! Would you like to schedule a private viewing?`;
      } else if (text.includes("test drive")) {
        replyText = `We have test drive appointments open tomorrow. Let us know a time that works best for you.`;
      } else if (text.includes("lowest price")) {
        replyText = `We are open to negotiation. Try using the "Make an Offer" button to submit your best proposal!`;
      }
      setChatMessages((prev) => [...prev, { id: String(Date.now() + 1), text: replyText, isUser: false }]);
    }, 1200);
  };

  const resetChat = () => {
    setChatMessages([
      { id: '1', text: `Hi there! How can we help you with the ${listing.make} ${listing.model} today?`, isUser: false },
    ]);
  };

  useEffect(() => {
    if (!listing.id) return;
    // Fetch damage records
    apiClient<{ success: boolean; data: any[] }>(`/damage/${listing.id}`)
      .then(res => { if (res.success) setDamageRecords(res.data || []); })
      .catch(() => {})
      .finally(() => setDamageLoading(false));
  }, [listing.id]);

  // Fetch the current user's offer status for this listing (to gate "Request Delivery")
  const { user: currentUser } = useAuthStore();
  useEffect(() => {
    if (!listing.id || !currentUser) return;
    apiClient<{ data: { status: string } | null }>(`/offers/my/${listing.id}`)
      .then(res => { if (res?.data?.status) setOfferStatus(res.data.status); })
      .catch(() => {});
  }, [listing.id, currentUser]);

  const handleDeliveryRequest = async () => {
    if (!deliveryStreet.trim() || !deliveryCity.trim() || !deliveryPostcode.trim()) {
      setDeliveryError('Street, city and postcode are required.');
      return;
    }
    setDeliverySubmitting(true);
    setDeliveryError(null);
    try {
      await createDeliveryRequest({
        listingId: listing.id,
        deliveryAddress: {
          street: deliveryStreet.trim(),
          city: deliveryCity.trim(),
          postcode: deliveryPostcode.trim().toUpperCase(),
        },
        deliveryNotes: deliveryNotes.trim() || undefined,
      });
      haptics.success();
      setDeliverySubmitted(true);
    } catch (err: any) {
      setDeliveryError(err?.message ?? 'Could not request delivery. Please try again.');
    } finally {
      setDeliverySubmitting(false);
    }
  };

  const handleHpiCheck = async () => {
    if (!listing.id) return;
    // Already-purchased report — just re-open the summary modal.
    if (hpiData) { setHpiModalVisible(true); return; }
    setHpiLoading(true);
    setHpiError(null);
    try {
      // Kick off the hosted Stripe checkout for the HPI report (£9.99).
      // The backend records HPI intent metadata and, on webhook success,
      // triggers HpiService.fetchAndSaveReport for this listing.
      const vrm = (listing as any).vrm ?? undefined;
      const res = await apiClient<{ success: boolean; data: { url: string } }>(
        '/payments/hpi-checkout',
        {
          method: 'POST',
          body: JSON.stringify({ listingId: listing.id, ...(vrm ? { vrm } : {}) }),
        },
      );
      const url = res?.data?.url;
      if (!url) throw new Error('No checkout URL returned');
      setHpiCheckoutUrl(url);
    } catch (err: any) {
      setHpiError(err.message ?? 'HPI check failed');
    } finally {
      setHpiLoading(false);
    }
  };

  // Called when the WebView reaches /checkout/success. The webhook lands
  // slightly after the redirect, so we retry the summary fetch a few times.
  const handleHpiCheckoutSuccess = async () => {
    setHpiCheckoutUrl(null);
    setHpiLoading(true);
    haptics.success();
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const res = await apiClient<{ success: boolean; data: any }>(
            `/hpi/listing/${listing.id}/summary`,
          );
          if (res.success && res.data) {
            setHpiData(res.data);
            setHpiModalVisible(true);
            return;
          }
        } catch { /* not ready yet — retry */ }
        await new Promise(r => setTimeout(r, 1500));
      }
      setHpiError('Report is still generating — check back in a minute.');
    } finally {
      setHpiLoading(false);
    }
  };

  const calcMonthlyPayment = (): number => {
    const deposit = listing.price * (depositPct / 100);
    const principal = listing.price - deposit;
    const monthlyRate = 9.9 / 1200;
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
  };

  // ── Gallery pan gesture ─────────────────────────────────────────────────────
  const galleryPanGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
    })
    .onEnd((e) => {
      const threshold = SCREEN_WIDTH * 0.3;
      let newIndex = activeImage;
      if (e.translationX < -threshold && activeImage < totalImages - 1) {
        newIndex = activeImage + 1;
      } else if (e.translationX > threshold && activeImage > 0) {
        newIndex = activeImage - 1;
      }
      const target = -newIndex * SCREEN_WIDTH;
      translateX.value = withSpring(target, { damping: 20, stiffness: 200 });
      savedTranslateX.value = target;
      runOnJS(setActiveImage)(newIndex);
    });

  const galleryAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // ── Full-screen pinch + pan gesture ────────────────────────────────────────
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      pinchScale.value = clamp(e.scale, 0.5, 4);
    })
    .onEnd(() => {
      if (pinchScale.value < 1) {
        pinchScale.value = withSpring(1, { damping: 20, stiffness: 200 });
        panX.value = withSpring(0, { damping: 20, stiffness: 200 });
        panY.value = withSpring(0, { damping: 20, stiffness: 200 });
        savedPanX.value = 0;
        savedPanY.value = 0;
      }
    });

  const fullscreenPanGesture = Gesture.Pan()
    .onUpdate((e) => {
      panX.value = savedPanX.value + e.translationX;
      panY.value = savedPanY.value + e.translationY;
    })
    .onEnd(() => {
      savedPanX.value = panX.value;
      savedPanY.value = panY.value;
    });

  const combinedFullscreenGesture = Gesture.Simultaneous(pinchGesture, fullscreenPanGesture);

  const fullscreenAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pinchScale.value },
      { translateX: panX.value },
      { translateY: panY.value },
    ],
  }));

  const openFullscreen = (index: number) => {
    setFullscreenIndex(index);
    pinchScale.value = 1;
    panX.value = 0;
    panY.value = 0;
    savedPanX.value = 0;
    savedPanY.value = 0;
    setFullscreenVisible(true);
  };

  // Render horizontal thumbnail selector bar under main gallery image
  const renderThumbnails = () => {
    const maxThumbnails = 5;
    const totalImages = images.length;
    const itemsToShow = images.slice(0, maxThumbnails);
    const extraCount = totalImages - maxThumbnails;

    return (
      <View style={styles.thumbnailRow}>
        {itemsToShow.map((img, idx) => {
          const isActive = activeImage === idx;
          const isLast = idx === maxThumbnails - 1;
          return (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.8}
              style={[
                styles.thumbnailWrapper,
                isActive && styles.thumbnailActive,
              ]}
              onPress={() => handleThumbnailPress(idx)}
            >
              <Image source={{ uri: img }} style={styles.thumbnailImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
              {isLast && extraCount > 0 && (
                <View style={styles.thumbnailOverlay}>
                  <Text style={styles.thumbnailOverlayText}>+{extraCount + 1}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Main Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Gallery Section — spring-snap gesture gallery */}
        <View style={styles.galleryContainer}>
          <GestureDetector gesture={galleryPanGesture}>
            <Animated.View style={[styles.galleryStrip, galleryAnimatedStyle]}>
              {images.map((img, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.95}
                  onPress={() => openFullscreen(idx)}
                  style={styles.galleryImageWrap}
                >
                  <Image
                    source={{ uri: img }}
                    style={styles.galleryImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                    placeholderContentFit="cover"
                  />
                </TouchableOpacity>
              ))}
            </Animated.View>
          </GestureDetector>

          {/* Page dot indicator */}
          {totalImages > 1 && (
            <View style={styles.pageDots}>
              {images.map((_, idx) => (
                <View
                  key={idx}
                  style={[styles.pageDot, activeImage === idx && styles.pageDotActive]}
                />
              ))}
            </View>
          )}

          {/* Photo counter */}
          <View style={styles.photoCounter}>
            <Text style={styles.photoCounterText}>
              {activeImage + 1}/{totalImages}
            </Text>
          </View>

          {/* Floating Header Actions */}
          <View style={[styles.floatingHeader, { top: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.iconCircleBtn}
              activeOpacity={0.7}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerRightActions}>
              <TouchableOpacity
                style={styles.iconCircleBtn}
                activeOpacity={0.7}
                onPress={() => Share.share({ message: `Check out this ${listing.year} ${listing.make} ${listing.model} on Carmazium!` })}
              >
                <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconCircleBtn}
                activeOpacity={0.7}
                onPress={handleToggleSaved}
              >
                <Ionicons
                  name={saved ? 'heart' : 'heart-outline'}
                  size={18}
                  color={saved ? Colors.accent : '#FFFFFF'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Inline thumbnails block overlaid on the bottom of gallery view */}
          {renderThumbnails()}
        </View>

        {/* Content Details Block */}
        <View style={styles.detailsBlock}>
          {/* Subtitle / Verification Tag */}
          <View style={styles.verifiedHeaderRow}>
            <Text style={styles.colorLabel}>
              {listing.colour.toUpperCase()}
            </Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ VERIFIED</Text>
            </View>
          </View>

          {/* Car Name & Model */}
          <Text style={styles.carTitle}>
            {listing.make} {listing.model}
          </Text>

          {/* Location row */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#8A8A93" />
            <Text style={styles.locationText}>{listing.location} W1</Text>
          </View>

          {/* Price & Monthly Pricing */}
          <View style={styles.priceContainerRow}>
            <Text style={styles.priceText}>
              {formatPrice(listing.price)}
            </Text>
            <Text style={styles.monthlyText}>
              {listing.monthlyPayment
                ? `or ${listing.monthlyPayment}`
                : `or £${Math.round(calcMonthlyPayment()).toLocaleString('en-GB')}/mo`}
            </Text>
          </View>

          {/* Imported-from badge — links to the original listing on the external platform */}
          {listing.importedFromUrl ? (
            <TouchableOpacity
              style={styles.importedBadge}
              onPress={() => Linking.openURL(listing.importedFromUrl!)}
              activeOpacity={0.7}
            >
              <Ionicons name="globe-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.importedBadgeText}>
                {`See on ${
                  listing.importedSource === 'AUTOTRADER' ? 'AutoTrader' :
                  listing.importedSource === 'CARGURUS'   ? 'CarGurus'   :
                  listing.importedSource === 'CARWOW'     ? 'CarWow'     :
                  'Original Platform'
                }`}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Horizontal Specifications Badges Row (4 Boxes) */}
          <View style={styles.specBadgesRow}>
            <View style={styles.specBadgeBox}>
              <Text style={styles.specBadgeLabel}>YEAR</Text>
              <Text style={styles.specBadgeValue}>{listing.year}</Text>
            </View>
            <View style={styles.specBadgeBox}>
              <Text style={styles.specBadgeLabel}>MILEAGE</Text>
              <Text style={styles.specBadgeValue}>
                {(listing.mileage / 1000).toFixed(1)}k
              </Text>
            </View>
            <View style={styles.specBadgeBox}>
              <Text style={styles.specBadgeLabel}>FUEL</Text>
              <Text style={styles.specBadgeValue}>{listing.fuelType}</Text>
            </View>
            <View style={styles.specBadgeBox}>
              <Text style={styles.specBadgeLabel}>TRANS</Text>
              <Text style={styles.specBadgeValue}>
                {listing.transmission === 'Automatic' ? 'Auto' : 'Manual'}
              </Text>
            </View>
          </View>

          {/* Dual-channel: linked live auction cross-link */}
          {listing.linkedListing?.auction?.status === 'ACTIVE' && (
            <TouchableOpacity
              style={styles.linkedAuctionBanner}
              activeOpacity={0.75}
              onPress={() =>
                Alert.alert(
                  'Live Auction Available',
                  'This vehicle is also running in a live auction. View auctions in the Live tab.',
                  [{ text: 'OK' }],
                )
              }
            >
              <Ionicons name="hammer-outline" size={14} color="#F59E0B" />
              <Text style={styles.linkedAuctionText}>
                {'Also in Live Auction — ends '}
                {new Date(listing.linkedListing.auction.endTime).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
              <Text style={styles.linkedAuctionCta}>View →</Text>
            </TouchableOpacity>
          )}

          {/* Section: About This Car */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderTitle}>ABOUT THIS CAR</Text>
            <Text style={styles.aboutText}>
              {listing.description ||
                `${listing.colour} over black Merino leather. Carbon bucket seats, M Driver's package and full ${listing.make} main-dealer service history. One owner from new, HPI clear and recently serviced — ready to drive away or finance.`}
            </Text>
          </View>

          {/* Section: Specifications list card */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderTitle}>SPECIFICATION</Text>
            <View style={styles.specCardContainer}>
              <View style={styles.specRow}>
                <Text style={styles.specRowLabel}>Body type</Text>
                <Text style={styles.specRowValue}>
                  {listing.category === 'Sports' ? 'Coupé' : listing.category}
                </Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specRowLabel}>Engine</Text>
                <Text style={styles.specRowValue}>
                  3.0L - {listing.bhp} bhp
                </Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specRowLabel}>0-60 mph</Text>
                <Text style={styles.specRowValue}>{listing.zeroToSixty}s</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specRowLabel}>Owners</Text>
                <Text style={styles.specRowValue}>1 (Full FSH)</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specRowLabel}>HPI status</Text>
                <Text style={styles.specRowValue}>Clear</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specRowLabel}>MOT until</Text>
                <Text style={styles.specRowValue}>Mar 2026</Text>
              </View>
              <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.specRowLabel}>Colour</Text>
                <Text style={styles.specRowValue}>{listing.colour}</Text>
              </View>
            </View>
          </View>

          {/* Section: Vehicle History */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderTitle}>VEHICLE HISTORY</Text>
            <View style={styles.historyGrid}>
              <View style={styles.historyBox}>
                <Text style={styles.historyLabel}>HPI</Text>
                <Text style={[styles.historyValue, styles.greenText]}>Clear</Text>
              </View>
              <View style={styles.historyBox}>
                <Text style={styles.historyLabel}>FINANCE</Text>
                <Text style={[styles.historyValue, styles.greenText]}>None owed</Text>
              </View>
              <View style={styles.historyBox}>
                <Text style={styles.historyLabel}>STOLEN</Text>
                <Text style={[styles.historyValue, styles.greenText]}>No marker</Text>
              </View>
              <View style={styles.historyBox}>
                <Text style={styles.historyLabel}>OWNERS</Text>
                <Text style={styles.historyValue}>1</Text>
              </View>
              <View style={styles.historyBox}>
                <Text style={styles.historyLabel}>MOT</Text>
                <Text style={[styles.historyValue, styles.greenText]}>5 clean</Text>
              </View>
              <View style={styles.historyBox}>
                <Text style={styles.historyLabel}>VIC</Text>
                <Text style={styles.historyValue}>Present</Text>
              </View>
            </View>
          </View>

          {/* Section: HPI Report CTA */}
          <View style={styles.sectionContainer}>
            {hpiError ? (
              <ErrorBanner message={hpiError} onRetry={handleHpiCheck} />
            ) : null}
            {hpiData ? (
              <View style={styles.hpiInlineCard}>
                <Text style={styles.hpiInlineTitle}>HPI Report</Text>
                {hpiData.stolen !== undefined && (
                  <Text style={styles.hpiInlineField}>
                    Stolen: {hpiData.stolen ? 'Yes ⚠' : 'No'}
                  </Text>
                )}
                {hpiData.financeOutstanding !== undefined && (
                  <Text style={styles.hpiInlineField}>
                    Finance Outstanding: {hpiData.financeOutstanding ? 'Yes ⚠' : 'No'}
                  </Text>
                )}
                {hpiData.writeOff !== undefined && (
                  <Text style={styles.hpiInlineField}>
                    Write-off: {hpiData.writeOff ? `Yes (${hpiData.writeOffCategory ?? ''})` : 'No'}
                  </Text>
                )}
                {hpiData.mileageAnomaly !== undefined && (
                  <Text style={styles.hpiInlineField}>
                    Mileage Anomaly: {hpiData.mileageAnomaly ? 'Yes ⚠' : 'No'}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.hpiViewFullBtn}
                  activeOpacity={0.8}
                  onPress={() => setHpiModalVisible(true)}
                >
                  <Text style={styles.hpiViewFullText}>View Full Report</Text>
                  <Ionicons name="chevron-forward" size={14} color="#3B82F6" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.hpiButton}
                activeOpacity={0.8}
                onPress={handleHpiCheck}
                disabled={hpiLoading}
              >
                <View style={styles.hpiReportLeft}>
                  <View style={styles.hpiIconBg}>
                    <Ionicons name="document-text-outline" size={16} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={styles.hpiReportTitle}>Check HPI (£9.99)</Text>
                    <Text style={styles.hpiReportSub}>Stolen · Finance · Write-off · Plate changes</Text>
                  </View>
                </View>
                {hpiLoading
                  ? <ActivityIndicator size="small" color={Colors.textMuted} />
                  : <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                }
              </TouchableOpacity>
            )}
          </View>

          {/* Section: Damage Assessment */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderTitle}>DAMAGE ASSESSMENT</Text>
            <DamageMapViewer records={damageRecords} isLoading={damageLoading} />
          </View>

          {/* Section: Seller */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderTitle}>SELLER</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.sellerCard}
              onPress={() => {
                if (listing.seller?.id) {
                  navigation.navigate('SellerProfile', { sellerId: listing.seller.id });
                } else {
                  handleOpenChat();
                }
              }}
            >
              <View style={styles.sellerAvatar}>
                <Text style={styles.sellerAvatarText}>
                  {getInitials(listing.dealer)}
                </Text>
              </View>
              <View style={styles.sellerInfo}>
                <View style={styles.sellerNameRow}>
                  <Text style={styles.sellerName}>{listing.dealer}</Text>
                  <Ionicons name="checkmark-circle" size={15} color="#3B82F6" style={styles.blueCheck} />
                </View>
                <Text style={styles.sellerSubtext}>
                  {listing.location} W1 · {listing.rating} ★ (216 sales)
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.sellerChatBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  handleOpenChat();
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={17} color="#FFFFFF" />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={18} color="#8A8A93" />
            </TouchableOpacity>
          </View>

          {/* ── Dealer Tools Panel (visible only to verified dealers) ── */}
          {isDealer && (
            <TouchableOpacity
              style={styles.dealerToolsCard}
              activeOpacity={0.85}
              onPress={() => setDealerPanelOpen((v) => !v)}
            >
              <View style={styles.dealerToolsHeader}>
                <View style={styles.dealerToolsIconWrap}>
                  <Ionicons name="briefcase-outline" size={18} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dealerToolsTitle}>Dealer Tools</Text>
                  <Text style={styles.dealerToolsSub}>Trade valuation & enquiry options</Text>
                </View>
                <Ionicons name={dealerPanelOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#F59E0B" />
              </View>
              {dealerPanelOpen && (
                <View style={styles.dealerToolsBody}>
                  {/* CAP trade value estimate */}
                  <View style={styles.dealerStatRow}>
                    <View style={styles.dealerStatBox}>
                      <Text style={styles.dealerStatLabel}>CAP TRADE EST.</Text>
                      <Text style={styles.dealerStatValue}>£{capEstimate.toLocaleString('en-GB')}</Text>
                      <Text style={styles.dealerStatSub}>~18% below asking</Text>
                    </View>
                    <View style={[styles.dealerStatBox, { borderLeftWidth: 1, borderLeftColor: 'rgba(245,158,11,0.15)' }]}>
                      <Text style={styles.dealerStatLabel}>RETAIL MARGIN</Text>
                      <Text style={styles.dealerStatValue}>£{(listing.price - capEstimate).toLocaleString('en-GB')}</Text>
                      <Text style={styles.dealerStatSub}>estimated upside</Text>
                    </View>
                  </View>

                  {/* Trade offer CTA */}
                  <TouchableOpacity
                    style={styles.dealerTradeBtn}
                    activeOpacity={0.85}
                    onPress={() => Alert.alert(
                      'Trade Enquiry',
                      `Submit a trade offer for this ${listing.make} ${listing.model}?\n\nYour offer will be sent to the seller as a verified dealer enquiry.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: `Offer £${capEstimate.toLocaleString('en-GB')}`, onPress: () => Alert.alert('Trade Offer Sent', 'The seller has been notified of your dealer trade enquiry.') },
                      ]
                    )}
                  >
                    <Ionicons name="pricetag-outline" size={15} color="#000" style={{ marginRight: 6 }} />
                    <Text style={styles.dealerTradeBtnText}>SEND TRADE OFFER</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Expandable Finance Calculator — Coming Soon */}
          <TouchableOpacity
            style={styles.financeCard}
            activeOpacity={0.85}
            onPress={() => setFinanceExpanded(!financeExpanded)}
          >
            <View style={styles.financeIconWrapper}>
              <Ionicons name="calculator-outline" size={18} color="#DC1F26" />
            </View>
            <View style={styles.financeTextContent}>
              <Text style={styles.financeTitle}>
                Finance Calculator
              </Text>
              <Text style={styles.financeSubtext}>
                9.9% APR representative · tap to expand
              </Text>
            </View>
            {/* Coming Soon badge */}
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            </View>
            <Ionicons
              name={financeExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={Colors.textMuted}
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>

          {financeExpanded && (
            <View style={styles.financeCalcBody}>
              {/* Coming Soon overlay message */}
              <View style={styles.financeComingSoonBox}>
                <Ionicons name="time-outline" size={20} color={Colors.textMuted} />
                <Text style={styles.financeComingSoonLabel}>Finance Calculator Coming Soon</Text>
                <Text style={styles.financeComingSoonSub}>
                  Finance options will be available here. Contact the seller directly to discuss finance.
                </Text>
              </View>

              {/* Deposit Row — inert preview */}
              <View style={[styles.calcRow, { opacity: 0.4 }]}>
                <Text style={styles.calcLabel}>DEPOSIT</Text>
                <Text style={styles.calcValue}>
                  {depositPct}% — £{Math.round(listing.price * depositPct / 100).toLocaleString('en-GB')}
                </Text>
              </View>
              <View style={[styles.depositStepsRow, { opacity: 0.4 }]}>
                {[0, 10, 20, 30, 40, 50].map(pct => (
                  <View
                    key={pct}
                    style={[styles.depositStep, depositPct === pct && styles.depositStepActive]}
                  >
                    <Text style={[styles.depositStepText, depositPct === pct && styles.depositStepTextActive]}>
                      {pct}%
                    </Text>
                  </View>
                ))}
              </View>

              {/* Term Row — inert preview */}
              <View style={[styles.calcRow, { marginTop: 14, opacity: 0.4 }]}>
                <Text style={styles.calcLabel}>TERM</Text>
                <Text style={styles.calcValue}>{termMonths} months</Text>
              </View>
              <View style={[styles.depositStepsRow, { opacity: 0.4 }]}>
                {[12, 24, 36, 48, 60].map(t => (
                  <View
                    key={t}
                    style={[styles.depositStep, termMonths === t && styles.depositStepActive]}
                  >
                    <Text style={[styles.depositStepText, termMonths === t && styles.depositStepTextActive]}>
                      {t}m
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Verification Banner */}
          <View style={styles.protectionCard}>
            <Ionicons name="shield-checkmark" size={16} color="#00D28E" />
            <Text style={styles.protectionText}>
              HPI clear · VIN verified
            </Text>
          </View>

          {/* ── Delivery section — only when seller offers delivery ── */}
          {listing.deliveryAvailable && (
            <View style={styles.deliveryCard}>
              {/* Header row */}
              <View style={styles.deliveryHeader}>
                <View style={styles.deliveryIconWrap}>
                  <Ionicons name="car-outline" size={16} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deliveryTitle}>Delivery available</Text>
                  {listing.deliveryMaxMiles && (
                    <Text style={styles.deliverySubtitle}>
                      Up to {listing.deliveryMaxMiles} miles from the seller
                    </Text>
                  )}
                </View>
                <View style={styles.deliveryFeeWrap}>
                  <Text style={styles.deliveryFeeLabel}>FROM</Text>
                  <Text style={styles.deliveryFeeValue}>
                    £{Math.round(calcDeliveryFeeExVat(10) * 1.2)}
                  </Text>
                  <Text style={styles.deliveryFeeHint}>inc. VAT</Text>
                </View>
              </View>

              {/* Request Delivery button — only when offer is ACCEPTED */}
              {offerStatus === 'ACCEPTED' && !deliverySubmitted && (
                <TouchableOpacity
                  style={styles.deliveryRequestBtn}
                  onPress={() => setDeliveryModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="car-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.deliveryRequestBtnText}>Request Delivery</Text>
                </TouchableOpacity>
              )}
              {deliverySubmitted && (
                <View style={styles.deliverySuccessRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                  <Text style={styles.deliverySuccessText}>Delivery request sent — seller will confirm soon.</Text>
                </View>
              )}
              {offerStatus !== 'ACCEPTED' && !deliverySubmitted && (
                <Text style={styles.deliveryPendingHint}>
                  Request delivery once your offer is accepted.
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Delivery Request Modal ── */}
      <Modal
        visible={deliveryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setDeliveryModalVisible(false); setDeliveryError(null); }}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => { setDeliveryModalVisible(false); setDeliveryError(null); }}
          />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalSheetTitle}>Request Delivery</Text>
            <Text style={styles.modalSheetSubtitle}>
              Enter your delivery address. The seller will confirm and arrange logistics.
            </Text>

            {/* Street */}
            <Text style={styles.deliveryInputLabel}>STREET ADDRESS</Text>
            <TextInput
              style={styles.deliveryInput}
              value={deliveryStreet}
              onChangeText={v => { setDeliveryStreet(v); setDeliveryError(null); }}
              placeholder="e.g. 42 Park Lane"
              placeholderTextColor="#404050"
              autoCapitalize="words"
            />

            {/* City */}
            <Text style={styles.deliveryInputLabel}>CITY / TOWN</Text>
            <TextInput
              style={styles.deliveryInput}
              value={deliveryCity}
              onChangeText={v => { setDeliveryCity(v); setDeliveryError(null); }}
              placeholder="e.g. London"
              placeholderTextColor="#404050"
              autoCapitalize="words"
            />

            {/* Postcode */}
            <Text style={styles.deliveryInputLabel}>POSTCODE</Text>
            <TextInput
              style={styles.deliveryInput}
              value={deliveryPostcode}
              onChangeText={v => { setDeliveryPostcode(v.toUpperCase()); setDeliveryError(null); }}
              placeholder="e.g. SW1A 1AA"
              placeholderTextColor="#404050"
              autoCapitalize="characters"
            />

            {/* Notes (optional) */}
            <Text style={styles.deliveryInputLabel}>NOTES (OPTIONAL)</Text>
            <TextInput
              style={[styles.deliveryInput, { height: 72, textAlignVertical: 'top', paddingTop: 12 }]}
              value={deliveryNotes}
              onChangeText={setDeliveryNotes}
              placeholder="e.g. Leave at reception, call on arrival…"
              placeholderTextColor="#404050"
              multiline
            />

            {deliveryError && (
              <ErrorBanner message={deliveryError} />
            )}

            <TouchableOpacity
              style={[styles.deliveryModalSubmitBtn, deliverySubmitting && { opacity: 0.6 }]}
              onPress={handleDeliveryRequest}
              disabled={deliverySubmitting}
              activeOpacity={0.85}
            >
              {deliverySubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.deliveryModalSubmitText}>Confirm Delivery Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sticky Bottom Actions Bar */}
      <View style={[styles.stickyCTAOuter, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.chatButton}
          activeOpacity={0.7}
          onPress={handleOpenChat}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.makeOfferButton}
          activeOpacity={0.8}
          onPress={() => setOfferModalVisible(true)}
        >
          <Text style={styles.makeOfferText}>MAKE AN OFFER</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.offerArrow} />
        </TouchableOpacity>
      </View>

      {/* DYNAMIC MAKE AN OFFER MODAL */}
      <Modal
        visible={offerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeOfferFlow}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={closeOfferFlow}
          />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Make an Offer</Text>
              <TouchableOpacity onPress={closeOfferFlow} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {!offerSubmitted ? (
              <View style={styles.modalBody}>
                <Text style={styles.modalSubheading}>
                  Submit a custom purchase offer to {listing.dealer}.
                </Text>

                {/* Offer details */}
                <View style={styles.offerBoxContainer}>
                  <Text style={styles.offerLabel}>ASKING PRICE</Text>
                  <Text style={styles.askingPriceValue}>{formatPrice(listing.price)}</Text>
                </View>

                {/* Adjuster input */}
                <View style={styles.offerAdjusterContainer}>
                  <Text style={styles.offerLabel}>YOUR OFFER</Text>
                  <View style={styles.adjusterRow}>
                    <TouchableOpacity
                      style={styles.adjustBtn}
                      onPress={() => adjustOffer(-500)}
                    >
                      <Ionicons name="remove" size={20} color="#FFFFFF" />
                    </TouchableOpacity>

                    <Text style={styles.offerAmountText}>
                      {formatPrice(offerAmount)}
                    </Text>

                    <TouchableOpacity
                      style={styles.adjustBtn}
                      onPress={() => adjustOffer(500)}
                    >
                      <Ionicons name="add" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitOfferBtn, isSubmittingOffer && { opacity: 0.7 }]}
                  activeOpacity={0.8}
                  onPress={handleSubmitOffer}
                  disabled={isSubmittingOffer}
                >
                  {isSubmittingOffer ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitOfferText}>Submit Offer</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.successContainer}>
                <View style={styles.successIconWrapper}>
                  <Ionicons name="checkmark" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.successTitle}>Offer Sent!</Text>
                <Text style={styles.successSubtitle}>
                  We have forwarded your offer of <Text style={styles.boldText}>{formatPrice(offerAmount)}</Text> to {listing.dealer}. They will review and respond to you shortly.
                </Text>
                <TouchableOpacity
                  style={styles.successCloseBtn}
                  activeOpacity={0.8}
                  onPress={closeOfferFlow}
                >
                  <Text style={styles.successCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* HPI CHECKOUT MODAL — hosted Stripe checkout for £9.99 report */}
      <StripeCheckoutModal
        url={hpiCheckoutUrl}
        title="HPI Report Checkout"
        onSuccess={handleHpiCheckoutSuccess}
        onCancel={() => setHpiCheckoutUrl(null)}
        onClose={() => setHpiCheckoutUrl(null)}
      />

      {/* HPI REPORT MODAL */}
      <Modal
        visible={hpiModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHpiModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setHpiModalVisible(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>HPI Check Report</Text>
                {hpiData && (
                  <Text style={{ fontFamily: FontFamily.medium, fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>
                    {hpiData.vrm} · {hpiData.make} {hpiData.model}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setHpiModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {hpiData && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
                {/* Overall status */}
                <View style={[styles.hpiOverallBanner, { backgroundColor: hpiData.isClear ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', borderColor: hpiData.isClear ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)' }]}>
                  <Ionicons name={hpiData.isClear ? 'shield-checkmark' : 'warning'} size={20} color={hpiData.isClear ? '#22C55E' : '#EF4444'} />
                  <Text style={[styles.hpiOverallText, { color: hpiData.isClear ? '#22C55E' : '#EF4444' }]}>
                    {hpiData.isClear ? 'HPI CLEAR — No issues found' : 'ISSUES DETECTED — Review checks below'}
                  </Text>
                </View>

                {/* Check rows */}
                {hpiData.checks && Object.entries(hpiData.checks).map(([key, check]: [string, any]) => {
                  const labels: Record<string, string> = {
                    stolen: 'Stolen Check',
                    writeOff: 'Insurance Write-Off',
                    scrapped: 'Scrapped',
                    financeOutstanding: 'Outstanding Finance',
                    plateChange: 'Plate Changes',
                    mileageAnomaly: 'Mileage Anomaly',
                  };
                  return (
                    <View key={key} style={styles.hpiCheckRow}>
                      <Ionicons
                        name={check.passed ? 'checkmark-circle' : 'close-circle'}
                        size={18}
                        color={check.passed ? '#22C55E' : '#EF4444'}
                      />
                      <View style={styles.hpiCheckText}>
                        <Text style={styles.hpiCheckLabel}>{labels[key] || key}</Text>
                        <Text style={styles.hpiCheckDetail}>{check.detail}</Text>
                      </View>
                    </View>
                  );
                })}

                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* DYNAMIC LIVE CHAT MODAL */}
      <Modal
        visible={chatVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setChatVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setChatVisible(false)}
          />
          <View style={[styles.chatSheet, { height: '80%', paddingBottom: insets.bottom + 10 }]}>
            {/* Header */}
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderLeft}>
                <View style={styles.sellerAvatarSmall}>
                  <Text style={styles.sellerAvatarTextSmall}>
                    {getInitials(listing.dealer)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.chatDealerName}>{listing.dealer}</Text>
                  <Text style={styles.chatOnlineStatus}>Active now</Text>
                </View>
              </View>
              <View style={styles.chatHeaderRight}>
                <TouchableOpacity onPress={resetChat} style={styles.chatResetBtn}>
                  <Ionicons name="refresh" size={16} color="#8A8A93" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChatVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Message History list */}
            <ScrollView
              style={styles.chatScroll}
              contentContainerStyle={styles.chatScrollContent}
              ref={(ref) => ref?.scrollToEnd({ animated: true })}
            >
              {chatMessages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.messageBubble,
                    msg.isUser ? styles.userBubble : styles.dealerBubble,
                  ]}
                >
                  <Text style={styles.messageText}>{msg.text}</Text>
                </View>
              ))}

              {isTyping && (
                <View style={[styles.messageBubble, styles.dealerBubble, styles.typingBubble]}>
                  <Text style={styles.typingText}>Dealer is typing...</Text>
                </View>
              )}
            </ScrollView>

            {/* Quick replies footer */}
            <View style={styles.quickRepliesContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickRepliesContent}
              >
                <TouchableOpacity
                  style={styles.quickReplyPill}
                  onPress={() => handleQuickReply("Is this vehicle still available?")}
                >
                  <Text style={styles.quickReplyPillText}>Is this available?</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickReplyPill}
                  onPress={() => handleQuickReply("Can I book a test drive?")}
                >
                  <Text style={styles.quickReplyPillText}>Book a test drive</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickReplyPill}
                  onPress={() => handleQuickReply("What is the lowest price you would accept?")}
                >
                  <Text style={styles.quickReplyPillText}>Lowest price?</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* FULLSCREEN PHOTO VIEWER (pinch-to-zoom) */}
      <Modal
        visible={fullscreenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenVisible(false)}
      >
        <View style={styles.fullscreenBackdrop}>
          {/* Close button */}
          <TouchableOpacity
            style={[styles.fullscreenCloseBtn, { top: insets.top + 12 }]}
            onPress={() => setFullscreenVisible(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Photo counter */}
          <View style={[styles.fullscreenCounter, { top: insets.top + 14 }]}>
            <Text style={styles.fullscreenCounterText}>
              {fullscreenIndex + 1}/{totalImages}
            </Text>
          </View>

          {/* Zoomable image */}
          <GestureDetector gesture={combinedFullscreenGesture}>
            <Animated.View style={[styles.fullscreenImageWrap, fullscreenAnimatedStyle]}>
              <Image
                source={{ uri: images[fullscreenIndex] }}
                style={styles.fullscreenImage}
                contentFit="contain"
                transition={200}
                cachePolicy="memory-disk"
                placeholderContentFit="cover"
              />
            </Animated.View>
          </GestureDetector>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  // Gallery — spring-snap strip
  galleryContainer: {
    width: SCREEN_WIDTH,
    height: GALLERY_HEIGHT,
    backgroundColor: Colors.bgTertiary,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryStrip: {
    flexDirection: 'row',
    width: '100%',
  },
  galleryImageWrap: {
    width: SCREEN_WIDTH,
    height: GALLERY_HEIGHT,
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: GALLERY_HEIGHT,
  },
  pageDots: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    zIndex: 91,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  pageDotActive: {
    backgroundColor: '#FFFFFF',
    width: 18,
    borderRadius: 3,
  },
  photoCounter: {
    position: 'absolute',
    top: 8,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 92,
  },
  photoCounterText: {
    fontFamily: FontFamily.mono,
    fontSize: 12,
    color: '#FFFFFF',
  },
  floatingHeader: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 99,
  },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  // Thumbnails row
  thumbnailRow: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    zIndex: 90,
  },
  thumbnailWrapper: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailActive: {
    borderColor: '#FFFFFF',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailOverlayText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  // Details Block
  detailsBlock: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  verifiedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  colorLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#8A8A93',
    letterSpacing: 1,
  },
  verifiedBadge: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedText: {
    fontFamily: FontFamily.bold,
    fontSize: 8,
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  carTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 26,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  locationText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#8A8A93',
  },
  priceContainerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  priceText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 28,
    color: '#FFFFFF',
  },
  monthlyText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#8A8A93',
  },
  linkedAuctionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  linkedAuctionText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#FCD34D',
    lineHeight: 17,
  },
  linkedAuctionCta: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#F59E0B',
    flexShrink: 0,
  },
  importedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  importedBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textMuted,
  },
  // Specs boxes row
  specBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  specBadgeBox: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#111115',
    borderWidth: 1,
    borderColor: '#2A2A32',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  specBadgeLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 8,
    color: '#8A8A93',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  specBadgeValue: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  // Sections container
  sectionContainer: {
    marginBottom: 34,
  },
  sectionHeaderTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  aboutText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#A0A0AB',
    lineHeight: 22,
  },
  // Specifications Table Card
  specCardContainer: {
    backgroundColor: '#111115',
    borderWidth: 1,
    borderColor: '#2A2A32',
    borderRadius: 16,
    paddingHorizontal: 18,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A32',
  },
  specRowLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#8A8A93',
  },
  specRowValue: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  // Vehicle History Grid
  historyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  historyBox: {
    width: (SCREEN_WIDTH - 60) / 3, // 3 columns
    height: 58,
    borderRadius: 12,
    backgroundColor: '#111115',
    borderWidth: 1,
    borderColor: '#2A2A32',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  historyLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 8,
    color: '#8A8A93',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  historyValue: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  greenText: {
    color: '#22C55E',
  },
  // Seller Card
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
    borderRadius: 16,
    backgroundColor: '#11131E',
    borderWidth: 1,
    borderColor: '#222636',
    paddingHorizontal: 16,
  },
  sellerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1C2033',
    borderWidth: 1,
    borderColor: '#2B3252',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sellerAvatarText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  sellerName: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  blueCheck: {
    marginLeft: 4,
  },
  sellerSubtext: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#8A8A93',
  },
  sellerChatBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C2033',
    borderWidth: 1,
    borderColor: '#2B3252',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  // Finance Box Banner
  // ── Dealer Tools Panel ──
  dealerToolsCard: {
    borderRadius: 16,
    backgroundColor: '#16140A',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },
  dealerToolsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dealerToolsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealerToolsTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#F59E0B',
  },
  dealerToolsSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#A0803A',
    marginTop: 1,
  },
  dealerToolsBody: {
    marginTop: 16,
    gap: 12,
  },
  dealerStatRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.12)',
    overflow: 'hidden',
  },
  dealerStatBox: {
    flex: 1,
    padding: 12,
    gap: 2,
  },
  dealerStatLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: '#A0803A',
    letterSpacing: 0.8,
  },
  dealerStatValue: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#F59E0B',
  },
  dealerStatSub: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: '#706050',
  },
  dealerTradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
  },
  dealerTradeBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#000000',
    letterSpacing: 1,
  },

  financeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#161118',
    borderWidth: 1,
    borderColor: '#3B1E2B',
    padding: 16,
    marginBottom: 14,
  },
  financeIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#33111C',
    borderWidth: 1,
    borderColor: '#521626',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  financeTextContent: {
    flex: 1,
  },
  financeTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  financeSubtext: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#8A8A93',
  },
  // Green Protection Banner
  protectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0B1713',
    borderWidth: 1,
    borderColor: '#1A3B2F',
    borderRadius: 14,
    padding: 14,
  },
  protectionText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#00D28E',
    lineHeight: 16,
  },

  // Delivery section
  deliveryCard: {
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.20)',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    gap: 12,
  },
  deliveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deliveryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  deliveryTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#10B981',
  },
  deliverySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#6EE7B7',
    marginTop: 2,
  },
  deliveryFeeWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  deliveryFeeLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 8,
    color: '#6EE7B7',
    letterSpacing: 0.8,
  },
  deliveryFeeValue: {
    fontFamily: FontFamily.mono,
    fontSize: 16,
    color: '#10B981',
  },
  deliveryFeeHint: {
    fontFamily: FontFamily.regular,
    fontSize: 9,
    color: '#6EE7B7',
  },
  deliveryRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#10B981',
  },
  deliveryRequestBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  deliverySuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deliverySuccessText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#10B981',
    flex: 1,
    lineHeight: 17,
  },
  deliveryPendingHint: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#6EE7B7',
    opacity: 0.7,
    lineHeight: 16,
  },

  // Delivery modal fields
  modalSheetTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  modalSheetSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#606070',
    lineHeight: 19,
    marginBottom: 16,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  deliveryInputLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#606070',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
  },
  deliveryInput: {
    backgroundColor: '#111115',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A32',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: '#FFFFFF',
  },
  deliveryModalSubmitBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  deliveryModalSubmitText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  // Bottom Sticky Actions Bar
  stickyCTAOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 86,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#0A0A0C',
    borderTopWidth: 1,
    borderTopColor: '#2A2A32',
    gap: 14,
  },
  chatButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2E3D',
    backgroundColor: '#1B1D26',
    justifyContent: 'center',
    alignItems: 'center',
  },
  makeOfferButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#DC1F26',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  makeOfferText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  offerArrow: {
    marginLeft: 6,
    marginTop: 1,
  },
  // Modals Styling
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#111115',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A32',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    gap: 16,
  },
  modalSubheading: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#8A8A93',
  },
  offerBoxContainer: {
    backgroundColor: '#0A0A0C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A32',
    padding: 14,
  },
  offerLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#8A8A93',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  askingPriceValue: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: '#FFFFFF',
  },
  offerAdjusterContainer: {
    backgroundColor: '#0A0A0C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A32',
    padding: 14,
  },
  adjusterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  adjustBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1C2033',
    borderWidth: 1,
    borderColor: '#2B3252',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offerAmountText: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    color: '#FFFFFF',
  },
  submitOfferBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#DC1F26',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitOfferText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  successIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  successTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: '#FFFFFF',
  },
  successSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#8A8A93',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  boldText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  successCloseBtn: {
    height: 44,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#1C2033',
    borderWidth: 1,
    borderColor: '#2B3252',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  successCloseText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  // Chat Sheet
  chatSheet: {
    backgroundColor: '#111115',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A32',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A32',
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sellerAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1C2033',
    borderWidth: 1,
    borderColor: '#2B3252',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerAvatarTextSmall: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  chatDealerName: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  chatOnlineStatus: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: '#22C55E',
  },
  chatHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatResetBtn: {
    padding: 4,
  },
  chatScroll: {
    flex: 1,
    padding: 16,
  },
  chatScrollContent: {
    gap: 12,
    paddingBottom: 24,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    maxWidth: '80%',
  },
  userBubble: {
    backgroundColor: '#DC1F26',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  dealerBubble: {
    backgroundColor: '#1A1A24',
    borderWidth: 1,
    borderColor: '#2A2A32',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  typingBubble: {
    opacity: 0.8,
  },
  typingText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#8A8A93',
    fontStyle: 'italic',
  },
  quickRepliesContainer: {
    borderTopWidth: 1,
    borderTopColor: '#2A2A32',
    paddingVertical: 12,
    backgroundColor: '#0A0A0C',
  },
  quickRepliesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickReplyPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1C2033',
    borderWidth: 1,
    borderColor: '#2B3252',
  },
  quickReplyPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },

  // HPI Report button
  hpiReportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#111115', borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', padding: 14,
  },
  hpiButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#111115', borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', padding: 14,
  },
  hpiReportLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  hpiIconBg: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  hpiReportTitle: { fontFamily: FontFamily.bold, fontSize: 13, color: '#FFFFFF' },
  hpiReportSub: { fontFamily: FontFamily.regular, fontSize: 11, color: '#A0A0AB', marginTop: 2 },

  // HPI inline card (shown after payment)
  hpiInlineCard: {
    backgroundColor: Colors.bgTertiary, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)', padding: 16, gap: 8,
  },
  hpiInlineTitle: {
    fontFamily: FontFamily.bold, fontSize: 14, color: '#FFFFFF', marginBottom: 4,
  },
  hpiInlineField: {
    fontFamily: FontFamily.medium, fontSize: 13, color: '#A0A0AB',
  },
  hpiViewFullBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
  },
  hpiViewFullText: {
    fontFamily: FontFamily.bold, fontSize: 12, color: '#3B82F6',
  },

  // Finance calculator body
  financeCalcBody: {
    backgroundColor: '#111115', borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', padding: 16, marginTop: 8, marginBottom: 12,
  },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  calcLabel: { fontFamily: FontFamily.bold, fontSize: 9, color: '#A0A0AB', letterSpacing: 1 },
  calcValue: { fontFamily: FontFamily.bold, fontSize: 13, color: '#FFFFFF' },
  depositStepsRow: { flexDirection: 'row', gap: 8 },
  depositStep: {
    flex: 1, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  depositStepActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  depositStepText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#A0A0AB' },
  depositStepTextActive: { color: '#FFFFFF' },
  calcResult: {
    marginTop: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 16, alignItems: 'center',
  },
  calcResultLabel: { fontFamily: FontFamily.bold, fontSize: 9, color: '#A0A0AB', letterSpacing: 1, marginBottom: 6 },
  calcResultValue: { fontFamily: FontFamily.bold, fontSize: 28, color: '#FFFFFF' },
  calcResultSub: { fontFamily: FontFamily.regular, fontSize: 11, color: '#A0A0AB', marginTop: 4, textAlign: 'center' },
  financeApplyBtn: {
    marginTop: 14, height: 44, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.accent, backgroundColor: 'rgba(220,31,38,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  financeApplyBtnText: { fontFamily: FontFamily.bold, fontSize: 13, color: Colors.accent, letterSpacing: 0.5 },

  // HPI Modal
  hpiOverallBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16,
  },
  hpiOverallText: { fontFamily: FontFamily.bold, fontSize: 13, flex: 1 },
  hpiCheckRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  hpiCheckText: { flex: 1 },
  hpiCheckLabel: { fontFamily: FontFamily.semiBold, fontSize: 13, color: '#FFFFFF', marginBottom: 2 },
  hpiCheckDetail: { fontFamily: FontFamily.regular, fontSize: 11, color: '#A0A0AB', lineHeight: 16 },

  // Finance Coming Soon
  comingSoonBadge: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.30)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
  },
  comingSoonText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.warning,
    letterSpacing: 0.3,
  },
  financeComingSoonBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    marginBottom: 16,
    gap: 8,
  },
  financeComingSoonLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  financeComingSoonSub: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Fullscreen photo viewer
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    left: 20,
    zIndex: 99,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenCounter: {
    position: 'absolute',
    right: 20,
    zIndex: 99,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  fullscreenCounterText: {
    fontFamily: FontFamily.mono,
    fontSize: 13,
    color: '#FFFFFF',
  },
  fullscreenImageWrap: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
});
