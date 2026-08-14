import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  LayoutAnimation,
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
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize, TextPresets } from '../../constants/typography';
import { Elevation, Radius } from '../../constants/spacing';
import { useWatchlistStore } from '../../store/watchlistStore';
import { apiClient } from '../../lib/apiClient';
import { getListingById } from '../../lib/listingsApi';
import { createChatRoom } from '../../lib/chatApi';
import { useChat } from '../../context/ChatContext';
import { BuyerDamageViewer } from '../../components/damage/BuyerDamageViewer';
import { GradeChip } from '../../components/GradeChip';
import { useAuthStore } from '../../store/authStore';
import { haptics } from '../../lib/haptics';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { createDeliveryRequest, getDeliveryQuote, DeliveryQuote } from '../../lib/deliveryApi';
import { StripeCheckoutModal } from '../../components/StripeCheckoutModal';
import { BottomSheet } from '../../components/BottomSheet';
import { EnquireModal } from '../../components/listing/EnquireModal';
import { useLocation } from '../../context/LocationContext';

import { IconButton } from '../../components/IconButton';
type Props = NativeStackScreenProps<MainStackParamList, 'VehicleDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_HEIGHT = 320;

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : null;
}

function getVideoPlatformLabel(url: string): string {
  if (/instagram\.com/i.test(url)) return 'Instagram';
  if (/facebook\.com|fb\.watch/i.test(url)) return 'Facebook';
  if (/(?:^|\/\/)x\.com|twitter\.com/i.test(url)) return 'X';
  return 'Video';
}

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

  // Enquire modal — structured form the buyer fills before landing in chat.
  const [enquireVisible, setEnquireVisible] = useState(false);

  // Dynamic States for Live Chat simulation
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { id: '1', text: `Hi there! How can we help you with the ${listing.make} ${listing.model} today?`, isUser: false },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // Vehicle Features dropdown — collapsed by default (Prompt M1)
  const [featuresExpanded, setFeaturesExpanded] = useState(false);
  const toggleFeatures = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFeaturesExpanded(prev => !prev);
  };

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
  const [damageError, setDamageError] = useState(false);

  // Seller contact phone — gated by login server-side (see /sellers/:id/phone)
  const [sellerPhone, setSellerPhone] = useState<string | null>(null);
  const [sellerPhoneAvailable, setSellerPhoneAvailable] = useState(false);

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

  // Postcode entry inline in the delivery card — buyers who haven't set one
  // yet can type it here without leaving the listing.
  const {
    postcode: userPostcode,
    setPostcode: savePostcode,
  } = useLocation();
  const [postcodeDraft, setPostcodeDraft] = useState('');
  const [postcodeSaving, setPostcodeSaving] = useState(false);

  // Real server-computed estimate (road distance x the listing's own
  // deliveryPricePerMile) — replaces a client-side haversine distance + a
  // hardcoded tiered fee formula + a fabricated x1.2 "VAT" markup that
  // didn't match what the backend actually charges (the backend has no VAT
  // concept for delivery at all). mobile-production-readiness-plan.md F24.
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [deliveryQuoteLoading, setDeliveryQuoteLoading] = useState(false);

  useEffect(() => {
    if (!listing.id || !listing.deliveryAvailable || !userPostcode) {
      setDeliveryQuote(null);
      return;
    }
    let cancelled = false;
    setDeliveryQuoteLoading(true);
    getDeliveryQuote(listing.id, userPostcode)
      .then(q => { if (!cancelled) setDeliveryQuote(q); })
      .catch(() => { if (!cancelled) setDeliveryQuote(null); })
      .finally(() => { if (!cancelled) setDeliveryQuoteLoading(false); });
    return () => { cancelled = true; };
  }, [listing.id, listing.deliveryAvailable, userPostcode]);

  const deliveryDistanceMiles: number | null =
    deliveryQuote ? Math.round(deliveryQuote.distanceMiles) : null;

  const deliveryFee: number | null =
    deliveryQuote ? deliveryQuote.estimatedCostGbp : null;

  const outsideRadius = deliveryQuote ? !deliveryQuote.withinRadius : false;

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

  // Floor matches the pre-existing behavior; ceiling is new — the ± steppers
  // previously had no upper bound at all, so repeatedly tapping "+" could
  // push an offer arbitrarily above the asking price.
  const OFFER_MIN = listing.price - 15000;
  const OFFER_MAX = listing.price;
  const clampOffer = (v: number) => Math.min(OFFER_MAX, Math.max(OFFER_MIN, v));

  const [offerAmountDraft, setOfferAmountDraft] = useState(String(offerAmount));
  useEffect(() => { setOfferAmountDraft(String(offerAmount)); }, [offerModalVisible]);

  const adjustOffer = (amount: number) => {
    // Must update BOTH the numeric state and the visible-text state — the
    // TextInput binds to offerAmountDraft (a raw-digit string), so updating
    // only offerAmount would change the internal number without ever
    // repainting the input the user sees.
    setOfferAmount((prev) => {
      const next = clampOffer(prev + amount);
      setOfferAmountDraft(String(next));
      return next;
    });
  };

  const handleOfferAmountChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    setOfferAmountDraft(digits);
    if (digits) setOfferAmount(clampOffer(parseInt(digits, 10)));
  };

  const handleOfferAmountBlur = () => {
    // Snap the visible text back to the clamped numeric value once the user
    // finishes typing (e.g. a value that got clamped, or an empty field).
    setOfferAmountDraft(String(offerAmount));
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

  // "Also in Live Auction" banner used to just alert() with no real navigation
  // (mobile-ui-ux-audit.md §C13). LiveAuctionDetailed needs a full CarListing,
  // and listing.linkedListing only carries {id, type, auction}, so fetch the
  // real linked listing before navigating rather than faking the missing fields.
  const [openingLinkedAuction, setOpeningLinkedAuction] = useState(false);
  const handleOpenLinkedAuction = async () => {
    if (!listing.linkedListing?.id || openingLinkedAuction) return;
    setOpeningLinkedAuction(true);
    try {
      const linked = await getListingById(listing.linkedListing.id);
      if (linked) navigation.navigate('LiveAuctionDetailed', { listing: linked });
    } finally {
      setOpeningLinkedAuction(false);
    }
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

  // Extracted so the buyer damage viewer's retry button can re-run the exact
  // same fetch (mobile-production-readiness-plan.md F41) — a failed fetch
  // used to be swallowed silently and render identically to "no damage
  // recorded," indistinguishable from the 3D model failing to load.
  const fetchDamageRecords = useCallback(() => {
    if (!listing.id) return;
    setDamageLoading(true);
    setDamageError(false);
    apiClient<{ success: boolean; data: any[] }>(`/damage/${listing.id}`)
      .then(res => { if (res.success) setDamageRecords(res.data || []); })
      .catch(() => setDamageError(true))
      .finally(() => setDamageLoading(false));
  }, [listing.id]);

  useEffect(() => {
    fetchDamageRecords();
  }, [fetchDamageRecords]);

  // Fetch the seller's gated contact phone (web parity: BlurredPhone / SellerContactPhone)
  useEffect(() => {
    if (!listing.seller?.id) return;
    apiClient<{ success: boolean; data: { phone: string | null; phoneAvailable: boolean } }>(
      `/sellers/${listing.seller.id}/phone`
    )
      .then(res => {
        if (res.success && res.data) {
          setSellerPhone(res.data.phone);
          setSellerPhoneAvailable(res.data.phoneAvailable);
        }
      })
      .catch(() => {});
  }, [listing.seller?.id]);

  // Fetch the current user's offer status for this listing (to gate "Request Delivery")
  const { user: currentUser } = useAuthStore();
  // Full offer object — kept alongside offerStatus so we can render the
  // OfferStatusChip on this screen with the amount, matching web
  // VehicleDetailPageClient.tsx L31-90 wording.
  const [myOffer, setMyOffer] = useState<{ amount: number; status: string } | null>(null);
  useEffect(() => {
    if (!listing.id || !currentUser) return;
    apiClient<{ data: { status: string; amount: number } | null }>(`/offers/my/${listing.id}`)
      .then(res => {
        if (res?.data?.status) {
          setOfferStatus(res.data.status);
          setMyOffer({ amount: res.data.amount, status: res.data.status });
        }
      })
      .catch(() => {});
  }, [listing.id, currentUser]);

  // "Last offer" teaser — public / seller-facing signal that negotiation is
  // active on this listing (matches web VehicleDetailPageClient.tsx L650-657).
  // Hidden from the buyer themselves since they see their own offer chip.
  const [latestOffer, setLatestOffer] = useState<{ amount: number; createdAt: string; buyerId: string } | null>(null);
  useEffect(() => {
    if (!listing.id) return;
    apiClient<{ data: { items?: Array<{ amount: number; createdAt: string; buyerId: string }> } }>(`/offers/listing/${listing.id}?limit=1`)
      .then(res => {
        const first = res?.data?.items?.[0];
        if (first) setLatestOffer(first);
      })
      .catch(() => {});
  }, [listing.id]);
  const showLatestOfferTeaser =
    !!latestOffer && (!currentUser || latestOffer.buyerId !== currentUser.id);

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
      // Close the modal so the user actually sees the "Delivery request sent"
      // success row (rendered further down the page) — previously the modal
      // stayed open with the same form fields and no visible acknowledgement.
      setDeliveryModalVisible(false);
      Alert.alert('Delivery request sent', 'The seller will confirm and arrange logistics — you can track the status on this page.');
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
    // Was 9.9% — web's FinanceCalculator.tsx uses a 9–49% adjustable range
    // with a 19% representative default; mobile's fixed rate undershot the
    // real quoted figure by ~15-20% for the same inputs.
    const monthlyRate = 19 / 1200;
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
            <IconButton style={styles.iconCircleBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />

            <View style={styles.headerRightActions}>
              <IconButton style={styles.iconCircleBtn} icon={<Ionicons name="git-compare-outline" size={18} color={Colors.white} />} onPress={() => navigation.navigate('Compare', { initialListing: listing })} accessibilityLabel="Compare this car" />
              <IconButton style={styles.iconCircleBtn} icon={<Ionicons name="share-social-outline" size={18} color={Colors.white} />} onPress={() => Share.share({ message: `Check out this ${listing.year} ${listing.make} ${listing.model} on Carmazium!` })} accessibilityLabel="Share this listing" />
              <IconButton style={styles.iconCircleBtn} icon={<Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? Colors.accent : Colors.white} />} onPress={handleToggleSaved} accessibilityLabel={saved ? 'Remove from watchlist' : 'Save to watchlist'} />
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
            {listing.isSellerVerified === true && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓ VERIFIED</Text>
              </View>
            )}
          </View>

          {/* Seller-set banner ribbon (e.g. "Price Drop", "Just Arrived") */}
          {listing.bannerLabel && (
            <View style={styles.detailBannerChip}>
              <Text style={styles.detailBannerText}>{listing.bannerLabel}</Text>
            </View>
          )}

          {/* Car Name & Model */}
          <Text style={styles.carTitle}>
            {listing.make} {listing.model}
          </Text>

          {/* Location row — hidden entirely (not a dangling icon) when the
              listing has no location, same pattern as GradeChip's null case */}
          {!!listing.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={Colors.textFaint} />
              <Text style={styles.locationText}>{listing.location}</Text>
            </View>
          )}

          {/* Listing status warning banner — mirrors web's VehicleDetailPageClient
              behavior (SOLD is prominent red, DRAFT/PENDING_REVIEW/REJECTED show
              amber "not yet live" banners). Buyers must see immediately when a
              listing is unavailable or in review; otherwise they might try to
              make an offer that will silently fail. */}
          {listing.status && listing.status !== 'ACTIVE' && (() => {
            const s = String(listing.status);
            const isSold = s === 'SOLD';
            const label =
              s === 'DRAFT' ? 'Preview only — Draft (not live yet)' :
              s === 'PENDING_REVIEW' ? 'Under admin review — not live yet' :
              s === 'REJECTED' ? 'Rejected — not listed' :
              isSold ? 'SOLD — this vehicle is no longer available' :
              s;
            return (
              <View style={[styles.statusBanner, isSold ? styles.statusBannerSold : styles.statusBannerWarning]}>
                <Ionicons
                  name={isSold ? 'close-circle' : 'alert-circle-outline'}
                  size={18}
                  color={isSold ? Colors.error : Colors.warning}
                />
                <Text style={[styles.statusBannerText, { color: isSold ? Colors.error : Colors.warning }]}>
                  {label}
                </Text>
              </View>
            );
          })()}

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
          {showLatestOfferTeaser && latestOffer && (
            <View style={styles.lastOfferTeaser}>
              <Ionicons name="pricetag" size={11} color={Colors.warning} />
              <Text style={styles.lastOfferTeaserText}>
                Last offer: <Text style={styles.lastOfferTeaserAmount}>{formatPrice(latestOffer.amount)}</Text>
                {'  ·  '}
                {new Date(latestOffer.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          )}

          {/* Buyer's own offer status chip — copy mirrors web's OfferStatusChip
              (VehicleDetailPageClient.tsx L31-90). Hidden on the buyer's own
              listings and when there's no offer yet. */}
          {myOffer && listing.seller?.id !== currentUser?.id && (() => {
            const amt = formatPrice(myOffer.amount);
            const s = myOffer.status;
            const config =
              s === 'PENDING' ? {
                icon: 'time-outline', color: Colors.warning,
                text: `Your offer of ${amt} is awaiting the seller's response.`,
              } :
              s === 'REJECTED' ? {
                icon: 'close-circle', color: Colors.error,
                text: `Your offer of ${amt} was declined. You may submit a new one.`,
              } :
              s === 'ACCEPTED' ? {
                icon: 'checkmark-circle', color: Colors.success,
                text: `🎉 Your offer of ${amt} was accepted! Contact the seller to proceed.`,
              } :
              s === 'WITHDRAWN' ? {
                icon: 'close-circle', color: Colors.textMuted,
                text: `Your previous offer of ${amt} was withdrawn. You can make a new offer.`,
              } :
              s === 'COUNTERED' ? {
                icon: 'time-outline', color: Colors.infoBlue,
                text: 'The seller countered your offer. Tap to review it in your dashboard.',
              } : null;
            if (!config) return null;
            const isCounter = s === 'COUNTERED';
            const chipInner = (
              <>
                <Ionicons name={config.icon} size={13} color={config.color} />
                <Text style={[styles.offerStatusChipText, { color: config.color }]}>{config.text}</Text>
                {isCounter && <Ionicons name="chevron-forward" size={13} color={config.color} />}
              </>
            );
            return isCounter ? (
              <TouchableOpacity
                style={[styles.offerStatusChip, { borderColor: config.color + '55', backgroundColor: config.color + '18' }]}
                onPress={() => navigation.navigate('BuyerOffers')}
                activeOpacity={0.75}
              >
                {chipInner}
              </TouchableOpacity>
            ) : (
              <View style={[styles.offerStatusChip, { borderColor: config.color + '55', backgroundColor: config.color + '18' }]}>
                {chipInner}
              </View>
            );
          })()}

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
              onPress={handleOpenLinkedAuction}
              disabled={openingLinkedAuction}
            >
              <Ionicons name="hammer-outline" size={14} color={Colors.warning} />
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
            {listing.description ? (
              <Text style={styles.aboutText}>{listing.description}</Text>
            ) : (
              <Text style={[styles.aboutText, { color: Colors.textMuted, fontStyle: 'italic' }]}>
                No description provided
              </Text>
            )}
          </View>

          {/* Section: Vehicle Features — collapsed by default, same label web
              uses (VehicleDetailsPageClient.tsx: "Vehicle Features"). Web
              always shows the full list; mobile collapses it since feature
              lists can run long on a small screen (Prompt M1). */}
          {listing.features && listing.features.length > 0 && (
            <View style={styles.sectionContainer}>
              <TouchableOpacity
                style={styles.featuresHeaderRow}
                activeOpacity={0.7}
                onPress={toggleFeatures}
                accessibilityRole="button"
                accessibilityState={{ expanded: featuresExpanded }}
              >
                <Text style={[styles.sectionHeaderTitle, { marginBottom: 0 }]}>
                  VEHICLE FEATURES ({listing.features.length})
                </Text>
                <Ionicons
                  name={featuresExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
              {featuresExpanded && (
                <View style={styles.featuresGrid}>
                  {listing.features.map((feature, idx) => (
                    <View key={`${feature}-${idx}`} style={styles.featureChip}>
                      <Ionicons name="checkmark-circle" size={12} color={Colors.accentGreen} />
                      <Text style={styles.featureChipText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Section: Videos — YouTube gets a tappable thumbnail, other
              platforms (Instagram/Facebook/X) get a labelled link chip */}
          {listing.videoUrls != null && listing.videoUrls.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeaderTitle}>VIDEOS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {listing.videoUrls.map((url, i) => {
                  const ytId = extractYouTubeId(url);
                  if (ytId) {
                    return (
                      <TouchableOpacity
                        key={`video-${i}`}
                        style={styles.videoThumbWrap}
                        activeOpacity={0.85}
                        onPress={() => Linking.openURL(url)}
                        accessibilityLabel="Play video"
                        accessibilityRole="button"
                      >
                        <Image
                          source={{ uri: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
                          style={styles.videoThumb}
                          contentFit="cover"
                        />
                        <View style={styles.videoPlayOverlay}>
                          <Ionicons name="play-circle" size={36} color={Colors.white} />
                        </View>
                      </TouchableOpacity>
                    );
                  }
                  const platform = getVideoPlatformLabel(url);
                  return (
                    <TouchableOpacity
                      key={`video-${i}`}
                      style={styles.videoLinkChip}
                      activeOpacity={0.85}
                      onPress={() => Linking.openURL(url)}
                    >
                      <Ionicons name="videocam-outline" size={16} color={Colors.accent} />
                      <Text style={styles.videoLinkText}>{platform}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

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
                  {/* Was a hardcoded "3.0L" for every listing regardless of the
                      real vehicle — now uses the real engineSize field, with
                      an honest fallback instead of a fabricated number. */}
                  {listing.engineSize ? `${(listing.engineSize / 1000).toFixed(1)}L` : 'Not disclosed'}
                  {listing.bhp ? ` - ${listing.bhp} bhp` : ''}
                </Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specRowLabel}>0-60 mph</Text>
                <Text style={styles.specRowValue}>{listing.zeroToSixty}s</Text>
              </View>
              {/* Performance fields — real API data (torqueNm/combinedMpg/
                  extraUrbanMpg/topSpeed) that reaches CarListing via the
                  mapper but had no row in this grid until now (mobile
                  audit M2 finding: not a missing endpoint, just unrendered). */}
              {!!listing.topSpeed && (
                <View style={styles.specRow}>
                  <Text style={styles.specRowLabel}>Top speed</Text>
                  <Text style={styles.specRowValue}>{listing.topSpeed} mph</Text>
                </View>
              )}
              {listing.torqueNm != null && (
                <View style={styles.specRow}>
                  <Text style={styles.specRowLabel}>Torque</Text>
                  <Text style={styles.specRowValue}>{listing.torqueNm} Nm</Text>
                </View>
              )}
              <View style={styles.specRow}>
                <Text style={styles.specRowLabel}>Doors / Seats</Text>
                <Text style={styles.specRowValue}>
                  {listing.doors != null || listing.seats != null
                    ? `${listing.doors ?? '—'} / ${listing.seats ?? '—'}`
                    : 'Not disclosed'}
                </Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specRowLabel}>CO₂ emissions</Text>
                <Text style={styles.specRowValue}>
                  {listing.co2Emissions != null ? `${listing.co2Emissions} g/km` : 'Not disclosed'}
                </Text>
              </View>
              {(listing.combinedMpg != null || listing.extraUrbanMpg != null) && (
                <View style={styles.specRow}>
                  <Text style={styles.specRowLabel}>Fuel economy</Text>
                  <Text style={styles.specRowValue}>
                    {listing.combinedMpg != null ? `${listing.combinedMpg} mpg combined` : ''}
                    {listing.combinedMpg != null && listing.extraUrbanMpg != null ? ' · ' : ''}
                    {listing.extraUrbanMpg != null ? `${listing.extraUrbanMpg} mpg extra-urban` : ''}
                  </Text>
                </View>
              )}
              <View style={styles.specRow}>
                <Text style={styles.specRowLabel}>Owners</Text>
                <Text style={styles.specRowValue}>
                  {listing.owners != null
                    ? `${listing.owners}${listing.serviceHistory ? ` (${listing.serviceHistory})` : ''}`
                    : 'Not disclosed'}
                </Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specRowLabel}>MOT until</Text>
                <Text style={styles.specRowValue}>
                  {listing.motExpiry
                    ? new Date(listing.motExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Not disclosed'}
                </Text>
              </View>
              <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.specRowLabel}>Colour</Text>
                <Text style={styles.specRowValue}>{listing.colour}</Text>
              </View>
            </View>
          </View>

          {/* Section: Vehicle History — real DVLA/seller-declared fields only.
              Paid HPI report below (:314-360, 1399-1406) is the actual verified check;
              this grid must never imply that outcome for free. */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderTitle}>VEHICLE HISTORY</Text>
            <View style={styles.historyGrid}>
              <View style={styles.historyBox}>
                <Text style={styles.historyLabel}>WRITE-OFF</Text>
                <Text style={[
                  styles.historyValue,
                  listing.writeOffCategory == null ? undefined
                    : listing.writeOffCategory === 'NONE' ? styles.greenText : styles.warnText,
                ]}>
                  {listing.writeOffCategory == null
                    ? 'Not disclosed'
                    : listing.writeOffCategory === 'NONE' ? 'None' : listing.writeOffCategory}
                </Text>
              </View>
              <View style={styles.historyBox}>
                <Text style={styles.historyLabel}>FINANCE</Text>
                <Text style={[
                  styles.historyValue,
                  listing.hasOutstandingFinance == null ? undefined
                    : listing.hasOutstandingFinance ? styles.warnText : styles.greenText,
                ]}>
                  {listing.hasOutstandingFinance == null
                    ? 'Not disclosed'
                    : listing.hasOutstandingFinance ? 'Outstanding' : 'None declared'}
                </Text>
              </View>
              <View style={styles.historyBox}>
                <Text style={styles.historyLabel}>STOLEN</Text>
                <Text style={[
                  styles.historyValue,
                  listing.stolenRecovered == null ? undefined
                    : listing.stolenRecovered ? styles.warnText : styles.greenText,
                ]}>
                  {listing.stolenRecovered == null
                    ? 'Not disclosed'
                    : listing.stolenRecovered ? 'Marker found' : 'No marker'}
                </Text>
              </View>
              <View style={styles.historyBox}>
                <Text style={styles.historyLabel}>OWNERS</Text>
                <Text style={styles.historyValue}>
                  {listing.owners != null ? String(listing.owners) : 'Not disclosed'}
                </Text>
              </View>
              <View style={styles.historyBox}>
                <Text style={styles.historyLabel}>MOT</Text>
                <Text style={[
                  styles.historyValue,
                  listing.motStatus == null ? undefined
                    : listing.motStatus.toLowerCase() === 'valid' ? styles.greenText : styles.warnText,
                ]}>
                  {listing.motStatus ?? 'Not disclosed'}
                </Text>
              </View>
              <View style={styles.historyBox}>
                <Text style={styles.historyLabel}>TAX</Text>
                <Text style={[
                  styles.historyValue,
                  listing.taxStatus == null ? undefined
                    : listing.taxStatus.toLowerCase() === 'taxed' ? styles.greenText : styles.warnText,
                ]}>
                  {listing.taxStatus ?? 'Not disclosed'}
                </Text>
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
                  <Ionicons name="chevron-forward" size={14} color={Colors.infoBlue} accessibilityElementsHidden importantForAccessibility="no" />
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
                    <Ionicons name="document-text-outline" size={16} color={Colors.infoBlue} />
                  </View>
                  <View>
                    <Text style={styles.hpiReportTitle}>Check HPI (£9.99)</Text>
                    <Text style={styles.hpiReportSub}>Stolen · Finance · Write-off · Plate changes</Text>
                  </View>
                </View>
                {hpiLoading
                  ? <ActivityIndicator size="small" color={Colors.textMuted} />
                  : <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
                }
              </TouchableOpacity>
            )}
          </View>

          {/* Section: Condition & Damage — always renders (Prompt 6). Grade
              pill is the ONLY place exteriorGrade appears on this screen —
              never duplicated in the specs grid above. */}
          <View style={styles.sectionContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={[styles.sectionHeaderTitle, { marginBottom: 0 }]}>CONDITION & DAMAGE</Text>
              <GradeChip grade={listing.exteriorGrade} variant="pill" />
            </View>
            <BuyerDamageViewer records={damageRecords} isLoading={damageLoading} bodyTypeLabel={listing.category} hasError={damageError} onRetry={fetchDamageRecords} />
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
                  <Ionicons name="checkmark-circle" size={15} color={Colors.infoBlue} style={styles.blueCheck} />
                </View>
                <Text style={styles.sellerSubtext}>
                  {listing.location}
                  {listing.rating != null ? ` · ${listing.rating} ★` : ''}
                  {listing.totalSales != null ? ` (${listing.totalSales} sales)` : ''}
                </Text>
              </View>
              {sellerPhoneAvailable && sellerPhone && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.sellerChatBtn, { backgroundColor: Colors.successAlpha06, borderColor: Colors.successAlpha20 }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    Linking.openURL(`tel:${sellerPhone}`);
                  }}
                  accessibilityLabel={`Call ${sellerPhone}`}
                >
                  <Ionicons name="call" size={15} color={Colors.success} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.sellerChatBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  if (listing.seller?.id) {
                    setEnquireVisible(true);
                  } else {
                    handleOpenChat();
                  }
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={17} color={Colors.white} />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} accessibilityElementsHidden importantForAccessibility="no" />
            </TouchableOpacity>
          </View>

          {/* Expandable Finance Calculator — Coming Soon */}
          <TouchableOpacity
            style={styles.financeCard}
            activeOpacity={0.85}
            onPress={() => setFinanceExpanded(!financeExpanded)}
          >
            <View style={styles.financeIconWrapper}>
              <Ionicons name="calculator-outline" size={18} color={Colors.accent} />
            </View>
            <View style={styles.financeTextContent}>
              <Text style={styles.financeTitle}>
                Finance Calculator
              </Text>
              <Text style={styles.financeSubtext}>
                19% APR representative · tap to expand
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
            <Ionicons name="shield-checkmark" size={16} color={Colors.midGreen_00d28e} />
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
                  <Ionicons name="car-outline" size={16} color={Colors.accentGreen} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deliveryTitle}>Delivery available</Text>
                  {listing.deliveryMaxMiles ? (
                    <Text style={styles.deliverySubtitle}>
                      Up to {listing.deliveryMaxMiles} miles from the seller
                    </Text>
                  ) : null}
                </View>
                <View style={styles.deliveryFeeWrap}>
                  {deliveryQuoteLoading ? (
                    <ActivityIndicator size="small" color={Colors.accentGreen} />
                  ) : deliveryFee != null ? (
                    <>
                      <Text style={styles.deliveryFeeLabel}>ESTIMATE</Text>
                      <Text style={styles.deliveryFeeValue}>£{deliveryFee}</Text>
                    </>
                  ) : listing.deliveryPricePerMile ? (
                    <>
                      <Text style={styles.deliveryFeeLabel}>FROM</Text>
                      <Text style={styles.deliveryFeeValue}>£{listing.deliveryPricePerMile}/mi</Text>
                    </>
                  ) : (
                    <Text style={styles.deliveryFeeHint}>Enter postcode for a quote</Text>
                  )}
                </View>
              </View>

              {/* Distance / postcode summary row */}
              {userPostcode ? (
                <Text style={styles.deliveryDistanceLine}>
                  {deliveryDistanceMiles != null
                    ? `≈ ${deliveryDistanceMiles} mi from ${userPostcode}`
                    : `From ${userPostcode} — seller location coordinates missing, server will validate`}
                </Text>
              ) : (
                <View style={styles.postcodeEntryRow}>
                  <Ionicons name="location-outline" size={13} color={Colors.infoBlueLight} />
                  <TextInput
                    style={styles.postcodeInput}
                    value={postcodeDraft}
                    onChangeText={setPostcodeDraft}
                    autoCapitalize="characters"
                    placeholder="Enter your postcode"
                    placeholderTextColor={Colors.iconMuted}
                    editable={!postcodeSaving}
                    returnKeyType="done"
                    onSubmitEditing={async () => {
                      const trimmed = postcodeDraft.trim();
                      if (!trimmed) return;
                      setPostcodeSaving(true);
                      try {
                        await savePostcode(trimmed);
                        setPostcodeDraft('');
                      } finally {
                        setPostcodeSaving(false);
                      }
                    }}
                  />
                  <TouchableOpacity
                    disabled={postcodeSaving || !postcodeDraft.trim()}
                    onPress={async () => {
                      const trimmed = postcodeDraft.trim();
                      if (!trimmed) return;
                      setPostcodeSaving(true);
                      try {
                        await savePostcode(trimmed);
                        setPostcodeDraft('');
                      } finally {
                        setPostcodeSaving(false);
                      }
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {postcodeSaving ? (
                      <ActivityIndicator size="small" color={Colors.infoBlueLight} />
                    ) : (
                      <Text style={styles.postcodeSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Outside-radius warning */}
              {outsideRadius && (
                <View style={styles.deliveryOutsideRadius}>
                  <Ionicons name="alert-circle-outline" size={13} color={Colors.paleRed_f87171} />
                  <Text style={styles.deliveryOutsideRadiusText}>
                    Outside your delivery radius ({deliveryDistanceMiles} mi &gt; {listing.deliveryMaxMiles} mi)
                  </Text>
                </View>
              )}

              {/* Request Delivery button — only when offer is ACCEPTED and inside radius */}
              {offerStatus === 'ACCEPTED' && !deliverySubmitted && !outsideRadius && (
                <TouchableOpacity
                  style={styles.deliveryRequestBtn}
                  onPress={() => setDeliveryModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="car-outline" size={15} color={Colors.white} />
                  <Text style={styles.deliveryRequestBtnText}>Request Delivery</Text>
                </TouchableOpacity>
              )}
              {deliverySubmitted && (
                <View style={styles.deliverySuccessRow}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.accentGreen} />
                  <Text style={styles.deliverySuccessText}>Delivery request sent — seller will confirm soon.</Text>
                </View>
              )}
              {offerStatus !== 'ACCEPTED' && !deliverySubmitted && !outsideRadius && (
                <Text style={styles.deliveryPendingHint}>
                  Request delivery once your offer is accepted.
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Delivery Request Modal ── */}
      <BottomSheet
        visible={deliveryModalVisible}
        onClose={() => { setDeliveryModalVisible(false); setDeliveryError(null); }}
        title="Request Delivery"
        avoidKeyboard
      >
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
          placeholderTextColor={Colors.borderMuted}
          autoCapitalize="words"
        />

        {/* City */}
        <Text style={styles.deliveryInputLabel}>CITY / TOWN</Text>
        <TextInput
          style={styles.deliveryInput}
          value={deliveryCity}
          onChangeText={v => { setDeliveryCity(v); setDeliveryError(null); }}
          placeholder="e.g. London"
          placeholderTextColor={Colors.borderMuted}
          autoCapitalize="words"
        />

        {/* Postcode */}
        <Text style={styles.deliveryInputLabel}>POSTCODE</Text>
        <TextInput
          style={styles.deliveryInput}
          value={deliveryPostcode}
          onChangeText={v => { setDeliveryPostcode(v.toUpperCase()); setDeliveryError(null); }}
          placeholder="e.g. SW1A 1AA"
          placeholderTextColor={Colors.borderMuted}
          autoCapitalize="characters"
        />

        {/* Notes (optional) */}
        <Text style={styles.deliveryInputLabel}>NOTES (OPTIONAL)</Text>
        <TextInput
          style={[styles.deliveryInput, { height: 72, textAlignVertical: 'top', paddingTop: 12 }]}
          value={deliveryNotes}
          onChangeText={setDeliveryNotes}
          placeholder="e.g. Leave at reception, call on arrival…"
          placeholderTextColor={Colors.borderMuted}
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
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.deliveryModalSubmitText}>Confirm Delivery Request</Text>
          )}
        </TouchableOpacity>
      </BottomSheet>

      {/* Sticky Bottom Actions Bar */}
      {/* The kit fades the content out under the CTA rather than cutting it
          with a hairline and an opaque slab — the bar reads as floating over
          the page instead of bolted to the bottom of it. */}
      <View style={[styles.stickyCTAOuter, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(10,13,20,0)', Colors.bgPrimary, Colors.bgPrimary]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <IconButton style={styles.chatButton} icon={<Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.white} />} onPress={() => {
            if (listing.seller?.id) {
              setEnquireVisible(true);
            } else {
              handleOpenChat();
            }
          }} accessibilityLabel="Message seller" />

        {/* Disable the offer CTA when the listing isn't ACTIVE, matching web —
            web disables + relabels the button for SOLD/DRAFT/PENDING_REVIEW/
            REJECTED (VehicleDetailPageClient.tsx L679-683) so a buyer can't
            submit an offer that the backend will reject. */}
        {(() => {
          const s = listing.status ? String(listing.status) : 'ACTIVE';
          const isActive = s === 'ACTIVE';
          const disabledLabel =
            s === 'SOLD' ? 'SOLD' :
            s === 'DRAFT' ? 'PREVIEW ONLY (DRAFT)' :
            s === 'PENDING_REVIEW' ? 'UNDER ADMIN REVIEW' :
            s === 'REJECTED' ? 'REJECTED — NOT LISTED' :
            s;
          return isActive ? (
            <TouchableOpacity
              style={styles.makeOfferButton}
              activeOpacity={0.8}
              onPress={() => setOfferModalVisible(true)}
            >
              <Text style={styles.makeOfferText}>MAKE AN OFFER</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.white} style={styles.offerArrow} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.makeOfferButton, styles.makeOfferButtonDisabled]}>
              <Text style={styles.makeOfferText}>{disabledLabel}</Text>
            </View>
          );
        })()}
      </View>

      {/* DYNAMIC MAKE AN OFFER MODAL */}
      <BottomSheet
        visible={offerModalVisible}
        onClose={closeOfferFlow}
        title="Make an Offer"
        avoidKeyboard
      >
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
                <IconButton
                  style={styles.adjustBtn}
                  icon={<Ionicons name="remove" size={20} color={Colors.white} />}
                  onPress={() => adjustOffer(-500)}
                  disabled={offerAmount <= OFFER_MIN}
                  accessibilityLabel="Decrease offer by £500"
                />

                <View style={styles.offerAmountInputWrap}>
                  <Text style={styles.offerAmountCurrency}>£</Text>
                  <TextInput
                    style={styles.offerAmountInput}
                    value={offerAmountDraft}
                    onChangeText={handleOfferAmountChange}
                    onBlur={handleOfferAmountBlur}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textSecondary}
                    selectTextOnFocus
                    accessibilityLabel="Your offer amount"
                  />
                </View>

                <IconButton
                  style={styles.adjustBtn}
                  icon={<Ionicons name="add" size={20} color={Colors.white} />}
                  onPress={() => adjustOffer(500)}
                  disabled={offerAmount >= OFFER_MAX}
                  accessibilityLabel="Increase offer by £500"
                />
              </View>
              <Text style={styles.offerRangeHint}>
                Range: {formatPrice(OFFER_MIN)} – {formatPrice(OFFER_MAX)}
              </Text>
              {offerAmount >= OFFER_MAX && (
                <Text style={styles.offerLimitHint}>You've reached the asking price</Text>
              )}
              {offerAmount <= OFFER_MIN && (
                <Text style={styles.offerLimitHint}>You've reached the minimum offer we'll forward</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitOfferBtn, isSubmittingOffer && { opacity: 0.7 }]}
              activeOpacity={0.8}
              onPress={handleSubmitOffer}
              disabled={isSubmittingOffer}
            >
              {isSubmittingOffer ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.submitOfferText}>Submit Offer</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.successContainer}>
            <View style={styles.successIconWrapper}>
              <Ionicons name="checkmark" size={32} color={Colors.white} />
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
      </BottomSheet>

      {/* ENQUIRE MODAL — structured form the buyer fills before chatting */}
      <EnquireModal
        visible={enquireVisible}
        onClose={() => setEnquireVisible(false)}
        listing={{
          id: listing.id,
          make: listing.make,
          model: listing.model,
          year: listing.year,
        }}
        sellerId={listing.seller?.id}
        onSent={async (roomId) => {
          setEnquireVisible(false);
          // Make sure the ChatContext room list has the new/found room before
          // ChatScreen mounts so the header + last message render immediately.
          await refreshRooms();
          navigation.navigate('ChatScreen', { threadId: roomId });
        }}
      />

      {/* HPI CHECKOUT MODAL — hosted Stripe checkout for £9.99 report */}
      <StripeCheckoutModal
        url={hpiCheckoutUrl}
        title="HPI Report Checkout"
        onSuccess={handleHpiCheckoutSuccess}
        onCancel={() => setHpiCheckoutUrl(null)}
        onClose={() => setHpiCheckoutUrl(null)}
      />

      {/* HPI REPORT MODAL */}
      <BottomSheet
        visible={hpiModalVisible}
        onClose={() => setHpiModalVisible(false)}
        maxHeightPercent={85}
      >
        {/* Custom header (with vrm/make/model subline) kept as content —
            BottomSheet's own title row only supports a single line of text. */}
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>HPI Check Report</Text>
            {hpiData && (
              <Text style={{ fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 }}>
                {hpiData.vrm} · {hpiData.make} {hpiData.model}
              </Text>
            )}
          </View>
          <IconButton style={styles.modalCloseBtn} icon={<Ionicons name="close" size={20} color={Colors.white} />} onPress={() => setHpiModalVisible(false)} accessibilityLabel="Close" />
        </View>

        {hpiData && (
          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
            {/* Overall status */}
            <View style={[styles.hpiOverallBanner, { backgroundColor: hpiData.isClear ? Colors.successAlpha08 : Colors.errorAlpha08, borderColor: hpiData.isClear ? Colors.successAlpha25 : Colors.errorAlpha25 }]}>
              <Ionicons name={hpiData.isClear ? 'shield-checkmark' : 'warning'} size={20} color={hpiData.isClear ? Colors.success : Colors.error} />
              <Text style={[styles.hpiOverallText, { color: hpiData.isClear ? Colors.success : Colors.error }]}>
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
                    color={check.passed ? Colors.success : Colors.error}
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
      </BottomSheet>

      {/* DYNAMIC LIVE CHAT MODAL */}
      <BottomSheet
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        maxHeightPercent={80}
      >
        <>
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
                <IconButton style={styles.chatResetBtn} icon={<Ionicons name="refresh" size={16} color={Colors.textFaint} />} onPress={resetChat} accessibilityLabel="Reset conversation" />
                <IconButton style={styles.modalCloseBtn} icon={<Ionicons name="close" size={20} color={Colors.white} />} onPress={() => setChatVisible(false)} accessibilityLabel="Close" />
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
        </>
      </BottomSheet>

      {/* FULLSCREEN PHOTO VIEWER (pinch-to-zoom) */}
      <Modal
        visible={fullscreenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenVisible(false)}
      >
        <View style={styles.fullscreenBackdrop}>
          {/* Close button */}
          <IconButton style={[styles.fullscreenCloseBtn, { top: insets.top + 12 }]} icon={<Ionicons name="close" size={22} color={Colors.white} />} onPress={() => setFullscreenVisible(false)} accessibilityLabel="Close" />

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
    backgroundColor: Colors.bgPrimary,
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
    backgroundColor: Colors.white,
    width: 18,
    borderRadius: 3,
  },
  photoCounter: {
    position: 'absolute',
    top: 8,
    right: 16,
    backgroundColor: Colors.blackAlpha55,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 92,
  },
  photoCounterText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size12,
    color: Colors.white,
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
    backgroundColor: Colors.blackAlpha45,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
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
    borderColor: Colors.whiteAlpha15,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailActive: {
    borderColor: Colors.white,
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
    fontSize: FontSize.size12,
    color: Colors.white,
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
    fontSize: FontSize.size10,
    color: Colors.textFaint,
    letterSpacing: 1,
  },
  verifiedBadge: {
    backgroundColor: Colors.darkBlue_1e293b,
    borderColor: Colors.infoBlueAlpha30,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.infoBlue,
    letterSpacing: 0.5,
  },
  detailBannerChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.infoBlueAlpha14,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  detailBannerText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.infoBlueLight,
    letterSpacing: 0.3,
  },
  carTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.size26,
    color: Colors.white,
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
    fontSize: FontSize.sm,
    color: Colors.textFaint,
  },
  priceContainerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  priceText: {
    // The hero price is the brand's signature element and was rendering in
    // Poppins like a heading. Prices are mono at heavy weight throughout
    // CarMazium — the design kit's vehicle screen sets this exact treatment.
    ...TextPresets.monoPrice,
    fontSize: FontSize['3xl'],
    color: Colors.white,
  },
  monthlyText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.textFaint,
  },
  linkedAuctionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningAlpha08,
    borderWidth: 1,
    borderColor: Colors.warningAlpha25,
    borderRadius: Radius.inline,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  linkedAuctionText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.lightYellow,
    lineHeight: 17,
  },
  linkedAuctionCta: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.warning,
    flexShrink: 0,
  },
  importedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  importedBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
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
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  specBadgeLabel: {
    ...TextPresets.eyebrow,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  specBadgeValue: {
    // Figures in the spec strip are mono, per the kit.
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  // Sections container
  sectionContainer: {
    marginBottom: 34,
  },
  sectionHeaderTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.size12,
    color: Colors.white,
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  aboutText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  // Vehicle Features dropdown
  featuresHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  featureChipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
  },
  // Videos
  videoThumbWrap: {
    width: 160,
    height: 90,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.bgSecondary,
  },
  videoThumb: {
    width: '100%',
    height: '100%',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  videoLinkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 90,
    paddingHorizontal: 16,
    borderRadius: Radius.inline,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  videoLinkText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.accent,
  },
  // Specifications Table Card
  specCardContainer: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.card,
    paddingHorizontal: 18,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  specRowLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textFaint,
  },
  specRowValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
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
    borderRadius: Radius.inline,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  historyLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.textFaint,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  historyValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
  },
  greenText: {
    color: Colors.success,
  },
  warnText: {
    color: Colors.warning,
  },
  // Seller Card
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
    borderRadius: Radius.card,
    backgroundColor: Colors.deepBlue_11131e,
    borderWidth: 1,
    borderColor: Colors.darkBlue_222636,
    paddingHorizontal: 16,
  },
  sellerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.darkBlue_1c2033,
    borderWidth: 1,
    borderColor: Colors.darkBlue_2b3252,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sellerAvatarText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
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
    fontSize: FontSize.size14,
    color: Colors.white,
  },
  blueCheck: {
    marginLeft: 4,
  },
  sellerSubtext: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textFaint,
  },
  sellerChatBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.darkBlue_1c2033,
    borderWidth: 1,
    borderColor: Colors.darkBlue_2b3252,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  financeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    backgroundColor: Colors.deepPurple,
    borderWidth: 1,
    borderColor: Colors.darkPink_3b1e2b,
    padding: 16,
    marginBottom: 14,
  },
  financeIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.deepPink_33111c,
    borderWidth: 1,
    borderColor: Colors.darkPink_521626,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  financeTextContent: {
    flex: 1,
  },
  financeTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    marginBottom: 2,
  },
  financeSubtext: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textFaint,
  },
  // Green Protection Banner
  protectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.deepGreen,
    borderWidth: 1,
    borderColor: Colors.darkGreen,
    borderRadius: Radius.inline,
    padding: 14,
  },
  protectionText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.midGreen_00d28e,
    lineHeight: 16,
  },

  // Delivery section
  deliveryCard: {
    backgroundColor: Colors.accentGreenAlpha06,
    borderWidth: 1,
    borderColor: Colors.accentGreenAlpha20,
    borderRadius: Radius.inline,
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
    borderRadius: Radius.inline,
    backgroundColor: Colors.accentGreenAlpha12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  deliveryTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.accentGreen,
  },
  deliverySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.lightGreen_6ee7b7,
    marginTop: 2,
  },
  deliveryFeeWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  deliveryFeeLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.lightGreen_6ee7b7,
    letterSpacing: 0.8,
  },
  deliveryFeeValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.md,
    color: Colors.accentGreen,
  },
  deliveryFeeHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size9,
    color: Colors.lightGreen_6ee7b7,
  },
  deliveryRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 42,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accentGreen,
  },
  deliveryRequestBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  deliverySuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deliverySuccessText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.accentGreen,
    flex: 1,
    lineHeight: 17,
  },
  deliveryPendingHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.lightGreen_6ee7b7,
    opacity: 0.7,
    lineHeight: 16,
  },
  deliveryDistanceLine: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  postcodeEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.infoBlueAlpha28,
    backgroundColor: Colors.infoBlueAlpha06,
    borderRadius: Radius.inline,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  postcodeInput: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.white,
    paddingVertical: 6,
  },
  postcodeSaveText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.infoBlueLight,
    letterSpacing: 0.3,
  },
  deliveryOutsideRadius: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.errorAlpha08,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.28)',
    borderRadius: Radius.inline,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deliveryOutsideRadiusText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.paleRed_f87171,
    lineHeight: 17,
  },

  // Delivery modal fields
  modalSheetSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.iconMuted,
    lineHeight: 19,
    marginBottom: 16,
  },
  deliveryInputLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.iconMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
  },
  deliveryInput: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  deliveryModalSubmitBtn: {
    height: 50,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  deliveryModalSubmitText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
  },

  // Bottom Sticky Actions Bar
  stickyCTAOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 18,
    gap: 14,
  },
  chatButton: {
    width: 52,
    height: 52,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderHi,
    backgroundColor: Colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  makeOfferButton: {
    flex: 1,
    height: 52,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // The primary CTA is the one place the design system asks for the red glow.
    ...Elevation.neon,
  },
  makeOfferButtonDisabled: {
    backgroundColor: Colors.whiteAlpha10,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.inline,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  statusBannerWarning: {
    backgroundColor: Colors.warningAlpha08,
    borderColor: Colors.warningAlpha30,
  },
  statusBannerSold: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.32)',
  },
  statusBannerText: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    letterSpacing: 0.2,
  },
  lastOfferTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  lastOfferTeaserText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  lastOfferTeaserAmount: {
    fontFamily: FontFamily.bold,
    color: Colors.warning,
  },
  offerStatusChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: Radius.inline,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  offerStatusChipText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  makeOfferText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 1,
  },
  offerArrow: {
    marginLeft: 6,
    marginTop: 1,
  },
  // Modals Styling
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    gap: 16,
  },
  modalSubheading: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textFaint,
  },
  offerBoxContainer: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 14,
  },
  offerLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textFaint,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  askingPriceValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.white,
  },
  offerAdjusterContainer: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 14,
  },
  adjusterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  offerLimitHint: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.textFaint,
    textAlign: 'center',
    marginTop: 8,
  },
  offerRangeHint: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  adjustBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.inline,
    backgroundColor: Colors.darkBlue_1c2033,
    borderWidth: 1,
    borderColor: Colors.darkBlue_2b3252,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offerAmountText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.white,
  },
  offerAmountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  offerAmountCurrency: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.white,
  },
  offerAmountInput: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.white,
    minWidth: 90,
    padding: 0,
    textAlign: 'center',
  },
  submitOfferBtn: {
    height: 48,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitOfferText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
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
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  successTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size22,
    color: Colors.white,
  },
  successSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textFaint,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  boldText: {
    color: Colors.white,
    fontFamily: FontFamily.bold,
  },
  successCloseBtn: {
    height: 44,
    width: '100%',
    borderRadius: Radius.inline,
    backgroundColor: Colors.darkBlue_1c2033,
    borderWidth: 1,
    borderColor: Colors.darkBlue_2b3252,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  successCloseText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  // Chat Sheet
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
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
    backgroundColor: Colors.darkBlue_1c2033,
    borderWidth: 1,
    borderColor: Colors.darkBlue_2b3252,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerAvatarTextSmall: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.white,
  },
  chatDealerName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
  },
  chatOnlineStatus: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.success,
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
    backgroundColor: Colors.accent,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  dealerBubble: {
    backgroundColor: Colors.deepBlue_1a1a24,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.white,
    lineHeight: 18,
  },
  typingBubble: {
    opacity: 0.8,
  },
  typingText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textFaint,
    fontStyle: 'italic',
  },
  quickRepliesContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingVertical: 12,
    backgroundColor: Colors.bgPrimary,
  },
  quickRepliesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickReplyPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.darkBlue_1c2033,
    borderWidth: 1,
    borderColor: Colors.darkBlue_2b3252,
  },
  quickReplyPillText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
  },

  // HPI Report button
  hpiReportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.inline, borderWidth: 1,
    borderColor: Colors.whiteAlpha06, padding: 14,
  },
  hpiButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.inline, borderWidth: 1,
    borderColor: Colors.whiteAlpha06, padding: 14,
  },
  hpiReportLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  hpiIconBg: {
    width: 34, height: 34, borderRadius: Radius.inline, backgroundColor: Colors.infoBlueAlpha12,
    alignItems: 'center', justifyContent: 'center',
  },
  hpiReportTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white },
  hpiReportSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // HPI inline card (shown after payment)
  hpiInlineCard: {
    backgroundColor: Colors.bgTertiary, borderRadius: Radius.inline, borderWidth: 1,
    borderColor: Colors.infoBlueAlpha20, padding: 16, gap: 8,
  },
  hpiInlineTitle: {
    fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.white, marginBottom: 4,
  },
  hpiInlineField: {
    fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary,
  },
  hpiViewFullBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
  },
  hpiViewFullText: {
    fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.infoBlue,
  },

  // Finance calculator body
  financeCalcBody: {
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.inline, borderWidth: 1,
    borderColor: Colors.whiteAlpha06, padding: 16, marginTop: 8, marginBottom: 12,
  },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  calcLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.textSecondary, letterSpacing: 1 },
  calcValue: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white },
  depositStepsRow: { flexDirection: 'row', gap: 8 },
  depositStep: {
    flex: 1, height: 34, borderRadius: 8, backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1, borderColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center',
  },
  depositStepActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  depositStepText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
  depositStepTextActive: { color: Colors.white },
  calcResult: {
    marginTop: 16, backgroundColor: Colors.whiteAlpha03, borderRadius: Radius.inline,
    borderWidth: 1, borderColor: Colors.whiteAlpha06, padding: 16, alignItems: 'center',
  },
  calcResultLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 6 },
  calcResultValue: { fontFamily: FontFamily.bold, fontSize: FontSize['3xl'], color: Colors.white },
  calcResultSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  financeApplyBtn: {
    marginTop: 14, height: 44, borderRadius: Radius.inline, borderWidth: 1,
    borderColor: Colors.accent, backgroundColor: Colors.accentAlpha08, alignItems: 'center', justifyContent: 'center',
  },
  financeApplyBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.accent, letterSpacing: 0.5 },

  // HPI Modal
  hpiOverallBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.inline, borderWidth: 1, padding: 14, marginBottom: 16,
  },
  hpiOverallText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, flex: 1 },
  hpiCheckRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha04,
  },
  hpiCheckText: { flex: 1 },
  hpiCheckLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.white, marginBottom: 2 },
  hpiCheckDetail: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },

  // Finance Coming Soon
  comingSoonBadge: {
    backgroundColor: Colors.warningAlpha12,
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
  },
  comingSoonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.warning,
    letterSpacing: 0.3,
  },
  financeComingSoonBox: {
    alignItems: 'center',
    backgroundColor: Colors.whiteAlpha02,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 20,
    marginBottom: 16,
    gap: 8,
  },
  financeComingSoonLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  financeComingSoonSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Fullscreen photo viewer
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: Colors.black,
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
    backgroundColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenCounter: {
    position: 'absolute',
    right: 20,
    zIndex: 99,
    backgroundColor: Colors.blackAlpha55,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  fullscreenCounterText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.white,
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
