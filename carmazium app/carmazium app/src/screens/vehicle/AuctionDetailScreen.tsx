import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, StatusBar, TextInput, ActivityIndicator,
  Share, Alert, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
// expo-image: caching/recycling for the hero auction photo (large, full-bleed,
// shown on a screen users keep open while live-bidding).
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  interpolateColor,
} from 'react-native-reanimated';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { FontFamily, FontSize, TextPresets } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import {
  getAuction, placeBid,
  triggerBuyItNow, confirmBuyItNow, declineBuyItNow,
  type AuctionDetail, type BidBroadcastPayload, type AuctionEndPayload,
} from '../../lib/auctionApi';
import { createChatRoom } from '../../lib/chatApi';
import { apiClient } from '../../lib/apiClient';
import { io } from 'socket.io-client';
import { getAccessToken } from '../../lib/supabase';
import { Skeleton } from '../../components/ui/Skeleton';
import { haptics } from '../../lib/haptics';
import { BuyerDamageViewer } from '../../components/damage/BuyerDamageViewer';
import { GradeChip } from '../../components/GradeChip';
import { Button } from '../../components/Button';

import { IconButton } from '../../components/IconButton';
// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<MainStackParamList, 'LiveAuctionDetailed'>;

interface BidEntry {
  id: string;
  initials: string;
  name: string;
  amount: number;
  time: string;
  createdAt: string; // ISO timestamp — needed to compute the 24h cancel window
  bidderId?: string; // needed to recalculate isWinning after bid:cancelled
  isNew?: boolean;
}

const BID_CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatCancelWindowRemaining(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

const { width: SW } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `£${n.toLocaleString('en-GB')}`;
}

function fmtCountdown(totalSecs: number) {
  if (totalSecs <= 0) return '00:00:00';
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ─── Skeleton Loading View ────────────────────────────────────────────────────

/**
 * One seller-contact row.
 *
 * Renders two states from a single input: a present `value` has already been
 * authorised by the backend, so it shows with its action; a null `value` means
 * the field exists but is still gated, so it shows as locked. Keeping both in
 * one component stops the locked and unlocked layouts drifting apart.
 */
const ContactRow: React.FC<{
  icon: string;
  label: string;
  value: string | null;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon, label, value, actionLabel, onAction }) => (
  <View style={s.contactRow}>
    <Ionicons
      name={value ? (icon as any) : ('lock-closed-outline' as any)}
      size={14}
      color={value ? Colors.textMuted : Colors.textDisabled}
    />
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={s.contactLabel}>{label}</Text>
      <Text style={value ? s.contactValue : s.contactValueLocked} numberOfLines={1}>
        {value ?? 'Locked'}
      </Text>
    </View>
    {value && actionLabel && onAction ? (
      <TouchableOpacity
        style={s.contactAction}
        onPress={onAction}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} seller`}
      >
        <Text style={s.contactActionText}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const AuctionDetailSkeleton: React.FC = () => (
  <View style={s.container}>
    <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
    {/* Hero image skeleton */}
    <View style={[s.heroWrap, { marginHorizontal: 0, borderRadius: 0, marginBottom: 0, height: 240 }]}>
      <Skeleton w={SW} h={240} r={0} />
    </View>
    <View style={{ paddingHorizontal: 14, paddingTop: 16, gap: 12 }}>
      {/* Title skeletons */}
      <Skeleton w={200} h={28} r={8} />
      <Skeleton w={140} h={20} r={8} />
      {/* Bid row skeletons */}
      <View style={{ gap: 10, marginTop: 8 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Skeleton w={30} h={30} r={15} />
            <View style={{ gap: 6 }}>
              <Skeleton w={80} h={14} r={6} />
              <Skeleton w={60} h={12} r={6} />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Skeleton w={70} h={18} r={6} />
            </View>
          </View>
        ))}
      </View>
    </View>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export const AuctionDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { listing } = route.params;
  const listingObj = listing as any;
  const insets = useSafeAreaInsets();
  // See useKeyboardHeight.ts — Android-only; iOS keeps the native
  // KeyboardAvoidingView path below, which already works reliably there.
  const androidKeyboardHeight = useKeyboardHeight();
  // Selector-subscribed. `useAuthStore()` with no selector subscribes this
  // screen to every field on the store, so `currentUser`'s object identity
  // changed on any unrelated store write — which re-ran the effects keyed on
  // it, including the auction socket below.
  const currentUser = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);

  // ── Auction state ──
  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // ── Bid state ──
  const [currentBid, setCurrentBid] = useState<number>(listingObj.currentBid ?? listingObj.startingBid ?? 0);
  const [bidHistory, setBidHistory] = useState<BidEntry[]>([]);
  const [isWinning, setIsWinning] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  // Non-blocking success flash shown right after a successful placeBid — kept
  // separate from bidError since the two states must coexist correctly (an
  // error should always clear the last flash).
  const [bidJustAccepted, setBidJustAccepted] = useState<number | null>(null);
  useEffect(() => {
    if (bidJustAccepted == null) return;
    const t = setTimeout(() => setBidJustAccepted(null), 3000);
    return () => clearTimeout(t);
  }, [bidJustAccepted]);

  // ── Auction lifecycle ──
  const [endedPayload, setEndedPayload] = useState<AuctionEndPayload | null>(null);

  // Damage records — fetched from /damage/:listingId once the auction loads.
  // Auctions show damage on the buyer side for parity with the web
  // /auctions/live/[id] page, which renders the real ThreeDVehicleViewer with
  // clickable zones tied to DamageRecord.part strings. Mobile now shares the
  // same read-only BuyerDamageViewer as VehicleDetailScreen (mobile-production-
  // readiness-plan.md F8 — this used to be the flatter 2D DamageMapViewer).
  const [damageRecords, setDamageRecords] = useState<any[]>([]);
  const [damageLoading, setDamageLoading] = useState(true);
  const [damageError, setDamageError] = useState(false);
  const [endTime, setEndTime] = useState<Date | null>(listingObj.endsAt ? new Date(listingObj.endsAt) : null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [watchers, setWatchers] = useState<number>(listingObj.viewers ?? 0);
  const [antiSnipeActive, setAntiSnipeActive] = useState(false);
  const [antiSnipeToast, setAntiSnipeToast] = useState(false);
  const [connectingChat, setConnectingChat] = useState(false);

  // ── BIN state ──
  const [binPendingBuyerId, setBinPendingBuyerId] = useState<string | null>(null);
  const [binBannerDismissed, setBinBannerDismissed] = useState(false);
  const [binLoading, setBinLoading] = useState(false);

  // ── Bid cancel window — derived live from bidHistory (see cancelableBids
  // below) rather than tracked as separate state, so it reflects the real
  // 24h server-side rule regardless of how the screen was reached (fresh
  // load, reconnect, or a live bid:new event) instead of only the single
  // most-recently-placed bid in this session. ──
  const [nowMs, setNowMs] = useState(Date.now());
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);

  // ── Seller tools ──
  const [acceptingBidId, setAcceptingBidId] = useState<string | null>(null);
  const [closingEarly, setClosingEarly] = useState(false);

  // ── UI state ──
  const [activeTab, setActiveTab] = useState<'details' | 'bids' | 'seller'>('details');
  const [secondsLeft, setSecondsLeft] = useState(0);

  // ── Animations ──
  // Countdown pulse (red background when <= 5 minutes)
  const pulse = useSharedValue(0);
  // Bid flash (green overlay on bid feed when own bid accepted)
  const bidFlash = useSharedValue(0);

  const socketRef = useRef<any>(null);
  const auctionId: string | null = listingObj.auctionId ?? null;

  // ─── Countdown pulse effect ───────────────────────────────────────────────

  const isUnder5Min = secondsLeft > 0 && secondsLeft <= 5 * 60;

  useEffect(() => {
    const status = auction?.status ?? (listingObj.isLive ? 'ACTIVE' : 'SCHEDULED');
    if (isUnder5Min && status === 'ACTIVE') {
      pulse.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 300 });
    }
  }, [isUnder5Min, auction?.status]);

  const pulseAnimStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pulse.value,
      [0, 1],
      [Colors.bgTertiary, Colors.accentDark],
    ),
  }));

  const bidFlashAnimStyle = useAnimatedStyle(() => ({
    opacity: bidFlash.value * 0.35,
  }));

  // ─── Load auction ─────────────────────────────────────────────────────────

  const loadAuction = useCallback(() => {
    if (!auctionId) { setLoading(false); return; }
    setLoadError(null);
    setLoading(true);
    getAuction(auctionId)
      .then(data => {
        setAuction(data);
        const et = new Date(data.endTime);
        const st = new Date(data.startTime);
        setEndTime(et);
        setStartTime(st);
        const bids = data.listing.bids ?? [];
        const topBid = bids[0] ? Number(bids[0].amount) : Number(data.startingBid);
        setCurrentBid(topBid);
        setIsWinning(!!currentUser && bids[0]?.bidderId === currentUser.id);
        setBidHistory(bids.map(b => {
          const first = b.bidder?.firstName ?? '';
          const last = b.bidder?.lastName ?? '';
          const fullName = `${first} ${last}`.trim();
          return {
            id: b.id,
            initials: `${first[0] ?? '?'}${last[0] ?? ''}`.toUpperCase(),
            name: fullName || 'Anonymous',
            amount: Number(b.amount),
            time: new Date(b.timestamp).toLocaleTimeString('en-GB'),
            createdAt: b.timestamp,
            bidderId: b.bidderId,
          };
        }));
        if (data.status === 'ENDED') {
          const wb = bids[0] ? Number(bids[0].amount) : null;
          setEndedPayload({
            auctionId: data.id,
            winnerId: data.winnerId ?? null,
            winningBidAmount: data.winningBidAmount ? Number(data.winningBidAmount) : wb,
            reserveMet: wb !== null && wb >= Number(data.reservePrice),
          });
        }
        setAntiSnipeActive(et.getTime() - Date.now() <= 3 * 60 * 1000 && data.status === 'ACTIVE');
        // Seed BIN pending state from initial fetch (in case BIN was triggered before this screen mounted)
        if (data.buyItNowPendingBuyerId) {
          setBinPendingBuyerId(data.buyItNowPendingBuyerId);
        }
      })
      .catch(() => setLoadError('Failed to load auction. Please try again.'))
      .finally(() => setLoading(false));
  }, [auctionId, currentUser]);

  useEffect(() => { loadAuction(); }, [loadAuction]);

  // ─── Damage records fetch ────────────────────────────────────────────────
  // Runs once the linked listingId is known (from route or loaded auction).
  // Extracted to a stable callback so the buyer damage viewer's retry button
  // can re-run the exact same fetch — a failed fetch used to be swallowed
  // silently and render identically to "no damage recorded," indistinguishable
  // from the 3D model failing to load (mobile-production-readiness-plan.md F41).
  const fetchDamageRecords = useCallback(() => {
    const listingId = listingObj?.id;
    if (!listingId) return;
    setDamageLoading(true);
    setDamageError(false);
    apiClient<{ success: boolean; data: any[] }>(`/damage/${listingId}`)
      .then(res => { if (res?.success) setDamageRecords(res.data || []); })
      .catch(() => setDamageError(true))
      .finally(() => setDamageLoading(false));
  }, [listingObj?.id]);

  useEffect(() => {
    fetchDamageRecords();
  }, [fetchDamageRecords]);

  // ─── Socket ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!auctionId) return;
    let socket: any = null;

    (async () => {
      socket = io(`${API_URL}/auctions`, {
        // Function form re-fetches a fresh token on every reconnect attempt —
        // see ChatContext.tsx for why a plain-object `auth` goes stale.
        auth: (cb) => getAccessToken().then((t) => cb(t ? { token: t } : {})),
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        socket.emit('auction:join', { auctionId });
      });
      socket.on('disconnect', () => setConnected(false));
      socket.on('reconnect', () => socket.emit('auction:join', { auctionId }));

      socket.on('auction:viewers', (d: { count: number }) => setWatchers(d.count));

      socket.on('bid:new', (payload: BidBroadcastPayload) => {
        if (payload.auctionId !== auctionId) return;
        setCurrentBid(payload.amount);
        setIsWinning(!!currentUser && payload.bidderId === currentUser.id);
        setBidHistory(prev => [
          { id: payload.bidId, initials: payload.bidderInitials || '??', name: payload.bidderInitials || '??', amount: payload.amount, time: new Date(payload.timestamp).toLocaleTimeString('en-GB'), createdAt: payload.timestamp, bidderId: payload.bidderId, isNew: true },
          ...prev.map(b => ({ ...b, isNew: false })),
        ]);
        // Bid flash + haptic for own bids. The cancel window itself is
        // derived from bidHistory (see cancelableBids) — being outbid no
        // longer clears eligibility, since the 24h window applies
        // regardless of current ranking (server-side restriction removed).
        if (currentUser && payload.bidderId === currentUser.id) {
          bidFlash.value = withSequence(
            withTiming(1, { duration: 120 }),
            withTiming(0, { duration: 400 }),
          );
          haptics.medium();
        }
        if (payload.newEndTime) {
          const newEnd = new Date(payload.newEndTime);
          setEndTime(newEnd);
          setAuction(p => p ? { ...p, endTime: payload.newEndTime! } : p);
          setAntiSnipeActive(true);
          setAntiSnipeToast(true);
          setTimeout(() => setAntiSnipeToast(false), 4000);
        }
        setBidError(null);
      });

      socket.on('auction:ended', (payload: AuctionEndPayload) => {
        if (payload.auctionId !== auctionId) return;
        setEndedPayload(payload);
        setAuction(p => p ? { ...p, status: 'ENDED', winnerId: payload.winnerId, winningBidAmount: payload.winningBidAmount } : p);

        // Route winners to AuctionComplete screen
        if (payload.winnerId && currentUser && payload.winnerId === currentUser.id) {
          haptics.success();
          const _auction = auction;
          navigation.navigate('AuctionComplete' as any, {
            listingId: _auction?.listingId ?? listingObj.id ?? '',
            auctionId: payload.auctionId,
            hammerPrice: payload.winningBidAmount ?? currentBid,
            buyerFee: 125,
            bidCount: bidHistory.length,
            listingTitle: String(
              (_auction?.listing?.title) ||
              `${listingObj.year || ''} ${listingObj.make || ''} ${listingObj.model || ''}`.trim() ||
              'Vehicle',
            ),
            listingImage: String(
              (_auction?.listing?.images?.[0]) ||
              (listingObj.images?.[0]) ||
              '',
            ) || undefined,
            lotNumber: undefined,
            paymentDeadline: undefined,
          });
        }
      });

      socket.on('auction:started', (d: { auctionId: string }) => {
        if (d.auctionId !== auctionId) return;
        setAuction(p => p ? { ...p, status: 'ACTIVE' } : p);
      });

      socket.on('bid:cancelled', (d: { auctionId: string; bidId: string }) => {
        if (d.auctionId !== auctionId) return;
        setBidHistory(prev => {
          const next = prev.filter(b => b.id !== d.bidId);
          // Recalculate current bid: top remaining bid, or fall back to starting bid
          const topAmount = next.length > 0 ? next[0].amount : Number(auction?.startingBid ?? 0);
          setCurrentBid(topAmount);
          // Recalculate winning status from the new top bidder
          setIsWinning(!!currentUser && next.length > 0 && next[0].bidderId === currentUser.id);
          return next;
        });
      });

      socket.on('bin:pending', (d: { auctionId: string; buyerId: string }) => {
        if (d.auctionId !== auctionId) return;
        setBinPendingBuyerId(d.buyerId);
        setBinBannerDismissed(false); // reset so the banner reappears for each new BIN request
      });
    })();

    return () => { socket?.disconnect(); };
  // Keyed on the user ID rather than the user object. Keyed on the object,
  // any change to the stored profile tore this socket down and reconnected it
  // mid-auction — dropping live bid updates for the duration of the
  // handshake, on the one screen where that matters most.
  }, [auctionId, currentUser?.id]);

  // ─── Cancel bid countdown — 24h window, ticks every 30s (no need for
  // per-second precision over a day-long window). ─────────────────────────

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Any of the current user's own bids placed within the last 24h — the
  // "must be highest bidder" restriction was removed server-side, so being
  // outbid no longer disqualifies a bid from cancellation, and more than one
  // can be eligible at once.
  const cancelableBids = currentUser
    ? bidHistory.filter(b => b.bidderId === currentUser.id && (nowMs - new Date(b.createdAt).getTime()) < BID_CANCEL_WINDOW_MS)
    : [];

  // ─── Anti-snipe timer ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!endTime || auction?.status !== 'ACTIVE') return;
    const ms = endTime.getTime() - Date.now() - 3 * 60 * 1000;
    if (ms <= 0) { setAntiSnipeActive(true); return; }
    const t = setTimeout(() => setAntiSnipeActive(true), ms);
    return () => clearTimeout(t);
  }, [endTime, auction?.status]);

  // ─── Countdown ────────────────────────────────────────────────────────────

  useEffect(() => {
    const tick = () => {
      const target = auction?.status === 'ACTIVE' ? endTime : auction?.status === 'SCHEDULED' ? startTime : null;
      if (target) setSecondsLeft(Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endTime, startTime, auction?.status]);

  // ─── Bid handling ─────────────────────────────────────────────────────────

  const handleBid = useCallback(async (amount: number) => {
    // Only dealers can place bids
    if (role !== 'dealer') {
      setBidError('Only dealers can place bids in auctions.');
      return;
    }
    // Dealer must be KYC verified
    if (!currentUser?.isVerified) {
      Alert.alert(
        'Verification Required',
        'Verify your dealership to place bids. Complete KYC in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Verification',
            onPress: () => navigation.navigate('DealerKYC'),
          },
        ],
      );
      return;
    }
    if (!auction || !currentUser) return;
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) { setBidError('Enter a valid bid amount.'); return; }
    if (parsed <= currentBid) { setBidError(`Bid must exceed current bid of ${fmt(currentBid)}.`); return; }
    const minNext = currentBid + Number(auction.minIncrement);
    if (parsed < minNext) { setBidError(`Minimum next bid is ${fmt(minNext)}.`); return; }
    setBidLoading(true);
    setBidError(null);
    try {
      await placeBid(auction.listingId, parsed);
      setBidAmount('');
      // Show an inline "bid accepted" flash for a couple seconds so the user
      // has a clear confirmation, not just watching their bid appear in the
      // history list. Auto-clears via effect below.
      setBidJustAccepted(parsed);
    } catch (err: any) {
      setBidError(err.message ?? 'Failed to place bid.');
    } finally {
      setBidLoading(false);
    }
  }, [auction, currentUser, currentBid]);

  // ─── Cancel bid ──────────────────────────────────────────────────────────────

  const handleCancelBid = useCallback((bidId: string) => {
    Alert.alert(
      'Cancel your bid?',
      'Your bid will be removed. The auction continues with the previous highest bid.',
      [
        { text: 'Keep Bid', style: 'cancel' },
        {
          text: 'Cancel Bid',
          style: 'destructive',
          onPress: async () => {
            setCancelLoadingId(bidId);
            try {
              await apiClient(`/bids/${bidId}/cancel`, { method: 'PATCH' });
              haptics.light();
              // bid:cancelled socket event removes it from bidHistory, which
              // in turn drops it from the derived cancelableBids list.
            } catch (err: any) {
              Alert.alert('Failed', err?.message ?? 'Could not cancel bid. Please try again.');
            } finally {
              setCancelLoadingId(null);
            }
          },
        },
      ],
    );
  }, []);

  // ─── Buy It Now handlers ──────────────────────────────────────────────────────

  const handleTriggerBin = useCallback(() => {
    if (!auction) return;
    Alert.alert(
      'Buy It Now?',
      `The seller must confirm within 24 hours. The auction continues until they respond.\n\nBuy It Now price: ${fmt(Number(auction.buyItNowPrice))}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Buy It Now',
          onPress: async () => {
            setBinLoading(true);
            try {
              await triggerBuyItNow(auction.id);
              setBinPendingBuyerId(currentUser?.id ?? 'pending');
              setBinBannerDismissed(false);
            } catch (err: any) {
              Alert.alert('Failed', err?.message ?? 'Could not request Buy It Now. Please try again.');
            } finally {
              setBinLoading(false);
            }
          },
        },
      ],
    );
  }, [auction, currentUser]);

  const handleConfirmBin = useCallback(() => {
    if (!auction) return;
    Alert.alert(
      'Confirm Buy It Now?',
      `This ends the auction immediately at ${fmt(Number(auction.buyItNowPrice))}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Sale',
          onPress: async () => {
            setBinLoading(true);
            try {
              await confirmBuyItNow(auction.id);
              // The auction:ended socket event will fire and update the UI
            } catch (err: any) {
              Alert.alert('Failed', err?.message ?? 'Could not confirm sale. Please try again.');
            } finally {
              setBinLoading(false);
            }
          },
        },
      ],
    );
  }, [auction]);

  const handleDeclineBin = useCallback(async () => {
    if (!auction) return;
    setBinLoading(true);
    try {
      await declineBuyItNow(auction.id);
      setBinPendingBuyerId(null);
    } catch (err: any) {
      Alert.alert('Failed', err?.message ?? 'Could not decline. Please try again.');
    } finally {
      setBinLoading(false);
    }
  }, [auction]);

  // ─── Seller: accept a specific bid early ─────────────────────────────────────

  const handleAcceptBid = useCallback((bid: BidEntry) => {
    if (!auction) return;
    Alert.alert(
      'Accept this bid?',
      `This will end the auction immediately with ${fmt(bid.amount)} as the winning bid.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept Bid',
          onPress: async () => {
            setAcceptingBidId(bid.id);
            try {
              await apiClient(`/auctions/${auction.id}/accept-bid`, {
                method: 'POST',
                body: JSON.stringify({ bidId: bid.id }),
              });
              haptics.success();
              setAuction(p => p ? { ...p, status: 'ENDED', winnerId: bid.bidderId ?? null } : p);
            } catch (err: any) {
              Alert.alert('Failed', err?.message ?? 'Could not accept bid. Please try again.');
            } finally {
              setAcceptingBidId(null);
            }
          },
        },
      ],
    );
  }, [auction]);

  // ─── Seller: close auction early (uses current highest bid) ──────────────────

  const handleCloseEarly = useCallback(() => {
    if (!auction) return;
    Alert.alert(
      'Close auction early?',
      'The current highest bid will be set as the winner. This cannot be undone.',
      [
        { text: 'Keep Open', style: 'cancel' },
        {
          text: 'Close Now',
          style: 'destructive',
          onPress: async () => {
            setClosingEarly(true);
            try {
              await apiClient(`/auctions/${auction.id}/close`, { method: 'POST' });
              haptics.success();
              setAuction(p => p ? { ...p, status: 'ENDED' } : p);
            } catch (err: any) {
              Alert.alert('Failed', err?.message ?? 'Could not close auction. Please try again.');
            } finally {
              setClosingEarly(false);
            }
          },
        },
      ],
    );
  }, [auction]);

  // ─── Derived values ───────────────────────────────────────────────────────

  const status = auction?.status ?? (listingObj.isLive ? 'ACTIVE' : 'SCHEDULED');
  const isActive = status === 'ACTIVE';
  const isScheduled = status === 'SCHEDULED';
  const isEnded = status === 'ENDED';
  const isCancelled = status === 'CANCELLED';
  const isSeller = !!currentUser && auction?.listing?.sellerId === currentUser.id;
  const userWon = isEnded && !!(endedPayload?.winnerId === currentUser?.id || (auction?.winnerId && auction.winnerId === currentUser?.id));
  const reservePrice = auction ? Number(auction.reservePrice) : 0;
  const reserveMet = currentBid > 0 && reservePrice > 0 && currentBid >= reservePrice;
  const minIncrement = auction ? Number(auction.minIncrement) : 100;
  const quickBids = [minIncrement, minIncrement * 2, minIncrement * 5, minIncrement * 10];
  const image = String(
    (auction && auction.listing && auction.listing.images && auction.listing.images[0])
    || (listing.images && listing.images[0])
    || ''
  );
  const title = String(
    (auction && auction.listing && auction.listing.title)
    || `${listing.year || ''} ${listing.make || ''} ${listing.model || ''}`.trim()
    || 'Vehicle'
  );
  const _s = auction && auction.listing && auction.listing.seller ? auction.listing.seller : null;
  const _company = String((_s && _s.dealerProfile && _s.dealerProfile.companyName) || '');
  const _first = String((_s && _s.firstName) || '');
  const _last = String((_s && _s.lastName) || '');
  const sellerName = _company || (`${_first} ${_last}`.trim()) || 'Private Seller';
  const sellerInitials = _company
    ? _company.slice(0, 2).toUpperCase()
    : `${_first[0] || '?'}${_last[0] || ''}`.toUpperCase();

  // Seller contact, exactly as the backend hands it over. A dealer's business
  // phone takes precedence over the personal one — same order web uses, since a
  // dealership's switchboard is the number a buyer should be ringing.
  // Cast: the local response type predates these fields (the backend has sent
  // them since 25869c5d/05cfe7e4) and only declares id/firstName/lastName.
  const _sAny = _s as any;
  const _dealer = (_sAny && _sAny.dealerProfile) || null;
  const sellerContact = {
    phone: (_dealer?.phone ?? _sAny?.phone ?? null) as string | null,
    phoneAvailable: !!(_dealer?.phoneAvailable || _sAny?.phoneAvailable),
    email: (_sAny?.email ?? null) as string | null,
    emailAvailable: !!_sAny?.emailAvailable,
    businessAddress: (_dealer?.businessAddress ?? null) as string | null,
    businessAddressAvailable: !!_dealer?.businessAddressAvailable,
    website: (_dealer?.website ?? null) as string | null,
    websiteAvailable: !!_dealer?.websiteAvailable,
    /** True once the backend actually released a value — i.e. this viewer won
     *  and paid. Derived from the data, never recomputed from local state. */
    unlocked: !!(_dealer?.phone || _sAny?.phone || _sAny?.email),
  };

  // ─── Loading / Error ──────────────────────────────────────────────────────

  if (loading) {
    return <AuctionDetailSkeleton />;
  }

  if (loadError) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Ionicons name="hammer-outline" size={40} color={Colors.borderMuted} />
        <Text style={s.muted}>{loadError}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={loadAuction} activeOpacity={0.8}>
          <Text style={s.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  // Wraps the whole screen (not just the bid console) so the sticky bottom
  // bid input reliably clears the keyboard on first focus. iOS keeps the
  // native KeyboardAvoidingView path; Android drives its shift from
  // androidKeyboardHeight instead (see useKeyboardHeight.ts — same fix
  // applied in ChatScreen.tsx for its message input bar).
  const ScreenWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const screenWrapperProps = Platform.OS === 'ios'
    ? { style: s.container, behavior: 'padding' as const }
    : { style: [s.container, { marginBottom: androidKeyboardHeight }] };

  return (
    <ScreenWrapper {...screenWrapperProps}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Anti-snipe floating toast */}
      {antiSnipeToast && (
        <View style={[s.antiSnipeToast, { top: insets.top + 60 }]}>
          <Ionicons name="flash" size={13} color={Colors.black} />
          <Text style={s.antiSnipeToastText}>Anti-Snipe — Auction extended 3 min!</Text>
        </View>
      )}

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <IconButton style={s.iconBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />

        <View style={s.headerCenter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            {isActive && (
              <View style={s.livePill}>
                <View style={s.liveDot} />
                <Text style={s.livePillText}>LIVE</Text>
              </View>
            )}
            {isScheduled && (
              <View style={[s.statusPill, { backgroundColor: Colors.infoBlueAlpha20, borderColor: Colors.infoBlueAlpha30 }]}>
                <Text style={[s.statusPillText, { color: Colors.infoBlueLight }]}>SCHEDULED</Text>
              </View>
            )}
            {isEnded && (
              <View style={[s.statusPill]}>
                <Text style={s.statusPillText}>ENDED</Text>
              </View>
            )}
            {isCancelled && (
              <View style={[s.statusPill, { backgroundColor: Colors.accentAlpha10, borderColor: Colors.accentAlpha20 }]}>
                <Text style={[s.statusPillText, { color: Colors.accent }]}>CANCELLED</Text>
              </View>
            )}
            {antiSnipeActive && isActive && (
              <View style={[s.statusPill, { backgroundColor: Colors.warningAlpha20, borderColor: Colors.warningAlpha30 }]}>
                <Ionicons name="flash" size={8} color={Colors.warning} />
                <Text style={[s.statusPillText, { color: Colors.warning }]}>ANTI-SNIPE</Text>
              </View>
            )}
          </View>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={s.watcherChip}>
            <Ionicons name="eye-outline" size={11} color={Colors.accent} />
            <Text style={s.watcherText}>{watchers}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[s.connDot, { backgroundColor: connected ? Colors.accentGreen : Colors.accent }]} />
          </View>
          <IconButton style={s.iconBtn} icon={<Ionicons name="share-social-outline" size={17} color={Colors.white} />} onPress={() => Share.share({ message: `Check out this auction: ${title}` })} accessibilityLabel="Share" />
        </View>
      </View>

      {/* Status banners */}
      {isCancelled && (
        <View style={[s.banner, s.bannerRed]}>
          <Ionicons name="ban-outline" size={14} color={Colors.accent} />
          <Text style={[s.bannerText, { color: Colors.accent }]}>This auction has been cancelled by the seller.</Text>
        </View>
      )}
      {isSeller && !isCancelled && (
        <View style={[s.banner, s.bannerBlue]}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.infoBlueLight} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={[s.bannerText, { color: Colors.infoLight }]}>
            <Text style={{ fontFamily: FontFamily.bold }}>This is your auction. </Text>
            {isActive ? 'Bids appear in real time.' : isScheduled ? 'Will start automatically.' : 'Your auction has ended.'}
          </Text>
        </View>
      )}
      {/* Seller quick-close control — only when auction is actively running */}
      {isSeller && isActive && (
        <View style={s.sellerToolsRow}>
          <Ionicons name="settings-outline" size={13} color={Colors.warning} />
          <Text style={s.sellerToolsLabel}>Seller Tools</Text>
          <TouchableOpacity
            style={[s.sellerCloseBtn, closingEarly && { opacity: 0.6 }]}
            onPress={handleCloseEarly}
            disabled={closingEarly}
            activeOpacity={0.8}
          >
            {closingEarly
              ? <ActivityIndicator size="small" color={Colors.accent} />
              : <Text style={s.sellerCloseBtnText}>Close Auction Now</Text>
            }
          </TouchableOpacity>
        </View>
      )}
      {isScheduled && !isSeller && startTime && (
        <View style={[s.banner, s.bannerBlue]}>
          <Ionicons name="calendar-outline" size={14} color={Colors.infoBlueLight} />
          <Text style={[s.bannerText, { color: Colors.infoLight }]}>
            This auction hasn't started yet — opens automatically at{' '}
            <Text style={{ fontFamily: FontFamily.bold }}>{fmtDate(startTime.toISOString())}</Text>.
          </Text>
        </View>
      )}
      {!connected && isActive && (
        <View style={[s.banner, s.bannerAmber]}>
          <Ionicons name="wifi-outline" size={14} color={Colors.warning} />
          <Text style={[s.bannerText, { color: Colors.lightYellow }]}>Connection lost — bids may not update in real time.</Text>
        </View>
      )}
      {/* ── Seller BIN confirmation panel ── */}
      {isSeller && isActive && binPendingBuyerId && auction?.buyItNowPrice && (
        <View style={s.binSellerPanel}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Ionicons name="pricetag" size={16} color={Colors.warning} />
            <Text style={s.binSellerTitle}>Buy It Now Request</Text>
          </View>
          <Text style={s.binSellerBody}>
            A buyer wants to purchase this vehicle right now at{' '}
            <Text style={{ fontFamily: FontFamily.mono, color: Colors.white }}>{fmt(Number(auction.buyItNowPrice))}</Text>.
            {'\n'}Confirm to end the auction immediately, or decline to continue bidding.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={[s.binSellerDeclineBtn, binLoading && { opacity: 0.5 }]}
              onPress={handleDeclineBin}
              disabled={binLoading}
              activeOpacity={0.8}
            >
              <Text style={s.binSellerDeclineText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.binSellerConfirmBtn, binLoading && { opacity: 0.5 }]}
              onPress={handleConfirmBin}
              disabled={binLoading}
              activeOpacity={0.8}
            >
              {binLoading
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={s.binSellerConfirmText}>Confirm Sale — {fmt(Number(auction.buyItNowPrice))}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}
      {binPendingBuyerId && !isSeller && !binBannerDismissed && (
        <View style={[s.banner, s.bannerAmber, { alignItems: 'center' }]}>
          <Ionicons name="pricetag-outline" size={14} color={Colors.warning} />
          <Text style={[s.bannerText, { color: Colors.lightYellow }]}>
            A buyer has requested to Buy It Now — seller is reviewing.
          </Text>
          <IconButton icon={<Ionicons name="close" size={16} color={Colors.warning} />} onPress={() => setBinBannerDismissed(true)} accessibilityLabel="Close" />
        </View>
      )}
      {auction?.listing?.linkedListingId && auction.listing.linkedListing?.type === 'CLASSIFIED' && (
        <View style={[s.banner, s.bannerDark]}>
          <Ionicons name="pricetag-outline" size={14} color={Colors.textSecondary} />
          <Text style={[s.bannerText, { color: Colors.textSecondary }]}>
            Also available as a classified listing — make an offer without bidding.
          </Text>
        </View>
      )}
      {isEnded && (
        <View style={[s.banner, userWon ? s.bannerGreen : s.bannerDark]}>
          {userWon ? (
            <>
              <Ionicons name="trophy" size={16} color={Colors.accentGreen} />
              <View style={{ flex: 1 }}>
                <Text style={[s.bannerText, { color: Colors.accentGreen, fontFamily: FontFamily.bold }]}>You won this auction!</Text>
                <Text style={[s.bannerText, { color: Colors.lightGreen_6ee7b7, fontSize: FontSize.xs }]}>
                  Winning bid: {fmt(Number(endedPayload?.winningBidAmount ?? 0))}
                </Text>
              </View>
              {auction?.buyerFeePaid ? (
                <TouchableOpacity
                  style={s.bannerBtn}
                  disabled={connectingChat}
                  activeOpacity={0.8}
                  onPress={async () => {
                    const sellerId = auction?.listing?.sellerId;
                    if (!sellerId) return;
                    setConnectingChat(true);
                    try {
                      const room = await createChatRoom(sellerId, auction?.listingId);
                      navigation.navigate('ChatScreen' as any, { threadId: room.id });
                    } catch {
                      navigation.navigate('Messages' as any);
                    } finally {
                      setConnectingChat(false);
                    }
                  }}
                >
                  {connectingChat
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <Text style={s.bannerBtnText}>Message Seller</Text>
                  }
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={s.bannerBtn}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigation.navigate('PurchaseFlow' as any, {
                      listingId: auction?.listingId,
                      salePrice: 0,
                      buyerFee: 125,
                      listingTitle: auction?.listing?.title ?? 'Vehicle',
                      listingImage: auction?.listing?.images?.[0],
                      sellerName: auction?.listing?.seller
                        ? `${auction.listing.seller.firstName ?? ''} ${auction.listing.seller.lastName ?? ''}`.trim()
                        : undefined,
                      paymentType: 'COMMISSION',
                      auctionId: auction?.id,
                    })
                  }
                >
                  <Text style={s.bannerBtnText}>Pay £125 Fee</Text>
                </TouchableOpacity>
              )}
            </>
          ) : endedPayload?.reserveMet === false ? (
            <>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.warning} />
              <Text style={[s.bannerText, { color: Colors.textSecondary }]}>
                Auction ended — the vehicle didn't reach the seller's minimum. No sale completed.
              </Text>
            </>
          ) : endedPayload?.winnerId ? (
            <>
              <Ionicons name="hammer-outline" size={14} color={Colors.iconMuted} />
              <Text style={[s.bannerText, { color: Colors.textSecondary }]}>
                Auction ended. Winning bid: <Text style={{ color: Colors.white, fontFamily: FontFamily.bold }}>{fmt(Number(endedPayload?.winningBidAmount ?? 0))}</Text>
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="hammer-outline" size={14} color={Colors.iconMuted} />
              <Text style={[s.bannerText, { color: Colors.textSecondary }]}>Auction ended with no bids placed.</Text>
            </>
          )}
        </View>
      )}

      {/* Main scroll */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Hero image */}
        <View style={s.heroWrap}>
          <Image source={{ uri: image || 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=900' }} style={s.heroImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
          <LinearGradient colors={['transparent', 'rgba(10,10,12,0.9)']} style={[StyleSheet.absoluteFillObject, { top: '40%' }]} />

          {/* Image overlays */}
          <View style={s.heroTopLeft}>
            {isActive && (
              <View style={s.livePill}>
                <View style={s.liveDot} />
                <Text style={s.livePillText}>LIVE</Text>
              </View>
            )}
            {isScheduled && (
              <View style={[s.livePill, { backgroundColor: 'rgba(59,130,246,0.9)' }]}>
                <Text style={s.livePillText}>UPCOMING</Text>
              </View>
            )}
          </View>

          <View style={s.heroTopRight}>
            {isActive && isWinning && !isSeller && (
              <View style={s.winningBadge}>
                <Ionicons name="checkmark-circle" size={11} color={Colors.accentGreen} />
                <Text style={s.winningBadgeText}>WINNING</Text>
              </View>
            )}
            {isActive && !isWinning && currentUser && !isSeller && bidHistory.length > 0 && (
              <View style={s.outbidBadge}>
                <Ionicons name="alert-circle" size={11} color={Colors.accent} />
                <Text style={s.outbidBadgeText}>OUTBID</Text>
              </View>
            )}
            {/* Countdown timer with animated pulse background */}
            {isActive && endTime && (
              <Animated.View style={[s.timerBox, pulseAnimStyle]}>
                <Text style={s.timerBoxLabel}>ENDS IN</Text>
                <Text style={[
                  s.timerBoxValue,
                  { fontFamily: FontFamily.mono },
                  isUnder5Min && { color: Colors.accentGlow },
                ]}>
                  {fmtCountdown(secondsLeft)}
                </Text>
              </Animated.View>
            )}
            {isScheduled && startTime && (
              <View style={[s.timerBox, { borderColor: Colors.infoBlueAlpha30 }]}>
                <Text style={[s.timerBoxLabel, { color: Colors.infoLight }]}>STARTS IN</Text>
                <Text style={[s.timerBoxValue, { color: Colors.infoBlueLight, fontFamily: FontFamily.mono }]}>{fmtCountdown(secondsLeft)}</Text>
              </View>
            )}
          </View>

          <View style={s.heroBottom}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroBidLabel}>{isEnded ? 'FINAL BID' : isScheduled ? 'STARTING BID' : 'CURRENT BID'}</Text>
              <Text style={[s.heroBid, { fontFamily: FontFamily.mono }]}>{fmt(currentBid)}</Text>
              {/* Reserve status is never shown to buyers — enforced
                  server-side (Ground Rules). The seller-only reserve panel
                  further down (isSeller branch) still shows it to sellers. */}
            </View>
          </View>
        </View>

        {/* Anti-snipe alert */}
        {antiSnipeActive && isActive && (
          <View style={s.antiSnipeBar}>
            <Ionicons name="flash" size={13} color={Colors.warning} />
            <Text style={s.antiSnipeBarText}>
              Anti-Snipe Active — any bid in the final 3 minutes extends the auction by 3 minutes
            </Text>
          </View>
        )}

        {/* Tabs */}
        <View style={s.tabs}>
          {(['details', 'bids', 'seller'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                {tab === 'bids' ? `BIDS (${bidHistory.length})` : tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab: DETAILS ── */}
        {activeTab === 'details' && (
          <View style={{ gap: 16 }}>
            {/* 4 hero stats */}
            <View style={s.statsRow}>
              {[
                { l: 'YEAR', v: auction?.listing?.year ?? listing.year },
                { l: 'MILEAGE', v: auction?.listing?.mileage ? `${Number(auction.listing.mileage).toLocaleString()} mi` : `${(listing.mileage ?? 0).toLocaleString()} mi` },
                { l: 'FUEL', v: (auction?.listing?.fuelType ?? listing.fuelType ?? '—').replace(/_/g, ' ') },
                { l: 'GEARBOX', v: (auction?.listing?.transmission ?? listing.transmission ?? '—').replace(/_/g, ' ') },
              ].map(stat => (
                <View key={stat.l} style={s.statBox}>
                  <Text style={s.statLabel}>{stat.l}</Text>
                  <Text style={s.statValue}>{String(stat.v ?? '—')}</Text>
                </View>
              ))}
            </View>

            {/* Digest — seller-authored custom tags + self-rating on their
                own auction listing (PATCH /auctions/:id/digest). Placed
                right after the hero stats and before the description,
                matching web's live auction page. */}
            {((auction?.customTags && auction.customTags.length > 0) || auction?.sellerSelfRating != null) && (
              <View style={{ gap: 8 }}>
                {auction?.customTags && auction.customTags.length > 0 && (
                  <View style={s.digestTagRow}>
                    {auction.customTags.map(tag => (
                      <View key={tag} style={s.digestTagPill}>
                        <Text style={s.digestTagPillText} numberOfLines={1}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {auction?.sellerSelfRating != null && (
                  <View style={s.digestRatingRow}>
                    <Text style={s.digestRatingLabel}>Seller's own rating:</Text>
                    <View style={{ flexDirection: 'row' }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <Ionicons
                          key={n}
                          name={n <= auction.sellerSelfRating! ? 'star' : 'star-outline'}
                          size={14}
                          color={Colors.warning}
                          style={{ marginRight: 2 }}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Description */}
            {(auction?.listing?.description ?? listing.description) ? (
              <View style={s.card}>
                <Text style={s.cardSectionTitle}>Description</Text>
                <Text style={s.descText}>{auction?.listing?.description ?? listing.description}</Text>
              </View>
            ) : null}

            {/* Write-off warning */}
            {(auction?.listing as any)?.writeOffCategory && (auction?.listing as any).writeOffCategory !== 'NONE' && (
              <View style={[s.banner, s.bannerAmber]}>
                <Ionicons name="warning-outline" size={14} color={Colors.warning} />
                <Text style={[s.bannerText, { color: Colors.lightYellow }]}>
                  <Text style={{ fontFamily: FontFamily.bold }}>{(auction?.listing as any).writeOffCategory.replace(/_/g, ' ')} Write-off</Text> — Review condition carefully before bidding.
                </Text>
              </View>
            )}

            {/* Specifications */}
            <View style={s.card}>
              <Text style={s.cardSectionTitle}>Specifications</Text>
              <View style={s.specsSection}>
                <Text style={s.specGroup}>Overview</Text>
                {[
                  ['Make', auction?.listing?.make ?? listing.make],
                  ['Model', auction?.listing?.model ?? listing.model],
                  ['Year', auction?.listing?.year ?? listing.year],
                  ['Body Type', (auction?.listing as any)?.bodyType?.replace(/_/g, ' ')],
                  ['Colour', (auction?.listing as any)?.color ?? listing.colour],
                  ['Mileage', auction?.listing?.mileage ? `${Number(auction.listing.mileage).toLocaleString()} mi` : null],
                  ['Registration', (auction?.listing as any)?.vrm],
                  ['Reg. Date', (auction?.listing as any)?.monthOfFirstRegistration],
                  ['Location', auction?.listing?.location ?? listing.location],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <View key={k as string} style={s.specRow}>
                    <Text style={s.specKey}>{k}</Text>
                    <Text style={s.specVal}>{String(v)}</Text>
                  </View>
                ))}
              </View>
              <View style={[s.specsSection, { marginTop: 16 }]}>
                <Text style={s.specGroup}>Performance</Text>
                {[
                  ['Fuel Type', (auction?.listing?.fuelType ?? listing.fuelType)?.replace(/_/g, ' ')],
                  ['Transmission', (auction?.listing?.transmission ?? listing.transmission)?.replace(/_/g, ' ')],
                  ['Engine', (auction?.listing as any)?.engineSize ? `${((auction!.listing as any).engineSize / 1000).toFixed(1)}L (${(auction!.listing as any).engineSize}cc)` : null],
                  ['Power', (auction?.listing as any)?.bhp ? `${(auction!.listing as any).bhp} bhp` : (listing.bhp ? `${listing.bhp} bhp` : null)],
                  // Real API fields, same class of gap fixed on VehicleDetailScreen
                  // (mobile audit M2 finding: data exists, just wasn't rendered).
                  ['0-60 mph', (auction?.listing as any)?.zeroToSixty ? `${(auction!.listing as any).zeroToSixty}s` : null],
                  ['Top Speed', ((auction?.listing as any)?.topSpeed ?? (auction?.listing as any)?.topSpeedMph) ? `${(auction!.listing as any).topSpeed ?? (auction!.listing as any).topSpeedMph} mph` : null],
                  ['Torque', (auction?.listing as any)?.torqueNm ? `${(auction!.listing as any).torqueNm} Nm` : null],
                  ['Fuel Economy', (() => {
                    const l = auction?.listing as any;
                    if (!l) return null;
                    const parts = [
                      l.combinedMpg != null ? `${l.combinedMpg} mpg combined` : null,
                      l.extraUrbanMpg != null ? `${l.extraUrbanMpg} mpg extra-urban` : null,
                    ].filter(Boolean);
                    return parts.length ? parts.join(' · ') : null;
                  })()],
                  ['Doors', (auction?.listing as any)?.doors],
                  ['Seats', (auction?.listing as any)?.seats],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <View key={k as string} style={s.specRow}>
                    <Text style={s.specKey}>{k}</Text>
                    <Text style={s.specVal}>{String(v)}</Text>
                  </View>
                ))}
              </View>

              {/* MOT & Tax */}
              {((auction?.listing as any)?.motStatus || (auction?.listing as any)?.taxStatus) && (
                <View style={[s.specsSection, { marginTop: 16 }]}>
                  <Text style={s.specGroup}>MOT & Tax</Text>
                  {[
                    ['MOT Status', (auction?.listing as any)?.motStatus],
                    ['MOT Expiry', (auction?.listing as any)?.motExpiryDate],
                    ['Tax Status', (auction?.listing as any)?.taxStatus],
                    ['Tax Due', (auction?.listing as any)?.taxDueDate],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <View key={k as string} style={s.specRow}>
                      <Text style={s.specKey}>{k}</Text>
                      <Text style={[s.specVal, (v === 'Valid' || v === 'Taxed') && { color: Colors.accentGreen }]}>{String(v)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Features */}
            {Array.isArray((auction?.listing as any)?.features) && (auction!.listing as any).features.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardSectionTitle}>Features & Options</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {((auction!.listing as any).features as string[]).map((f: string) => (
                    <View key={f} style={s.featureChip}>
                      <Ionicons name="checkmark-circle" size={10} color={Colors.accentGreen} />
                      <Text style={s.featureChipText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Auction details */}
            {auction && (
              <View style={[s.card, { borderColor: Colors.accentAlpha20, backgroundColor: Colors.accentAlpha04 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Ionicons name="hammer-outline" size={13} color={Colors.accent} />
                  <Text style={[s.cardSectionTitle, { color: Colors.accent, marginBottom: 0 }]}>Auction Details</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 0 }}>
                  {/* Reserve Price is deliberately excluded — never shown to
                      buyers, enforced server-side (Ground Rules). Buy it now
                      only appears when the seller set buyItNowPrice. */}
                  {[
                    ['Starting Bid', fmt(Number(auction.startingBid))],
                    ...(auction.buyItNowPrice ? [['Buy It Now', fmt(Number(auction.buyItNowPrice))]] : []),
                    ['Min Increment', fmt(Number(auction.minIncrement))],
                    ['Starts', fmtDate(auction.startTime)],
                    ['Ends', fmtDate(auction.endTime)],
                  ].map(([k, v]) => (
                    <View key={k} style={{ width: '50%', paddingBottom: 10, paddingRight: 8 }}>
                      <Text style={s.specKey}>{k}</Text>
                      <Text style={[s.specVal, { fontFamily: FontFamily.mono, color: Colors.white }]}>{v}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Condition & Damage — always renders (Prompt 6), parity with
                VehicleDetailScreen. Grade pill is the only place
                exteriorGrade appears on this screen. */}
            <View style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="warning-outline" size={13} color={Colors.warning} />
                  <Text style={[s.cardSectionTitle, { marginBottom: 0 }]}>Condition & Damage</Text>
                </View>
                <GradeChip grade={(auction?.listing as any)?.exteriorGrade} variant="pill" />
              </View>
              <BuyerDamageViewer records={damageRecords} isLoading={damageLoading} bodyTypeLabel={listing.category} hasError={damageError} onRetry={fetchDamageRecords} />
            </View>

            {/* Trust note */}
            <View style={[s.banner, s.bannerDark]}>
              <Ionicons name="information-circle-outline" size={12} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
              <Text style={[s.bannerText, { color: Colors.iconMuted, fontSize: FontSize.size10 }]}>
                All transactions are arranged directly between buyer and seller. A chat opens automatically when the auction ends with the winner.
              </Text>
            </View>
          </View>
        )}

        {/* ── Tab: BIDS ── */}
        {activeTab === 'bids' && (
          <View style={s.card}>
            {/* Bid flash overlay on top row */}
            <View style={{ position: 'relative' }}>
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: Colors.success, borderRadius: 10, zIndex: 10 },
                  bidFlashAnimStyle,
                ]}
              />
              {bidHistory.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
                  <Ionicons name="hammer-outline" size={28} color={Colors.borderMuted} />
                  <Text style={s.muted}>No bids yet — be the first.</Text>
                </View>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha05 }}>
                    <Text style={s.specKey}>BIDDER</Text>
                    <Text style={s.specKey}>AMOUNT</Text>
                  </View>
                  {bidHistory.map((bid, i) => (
                    <View key={bid.id} style={[s.bidRow, i === bidHistory.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={[s.bidAvatar, i === 0 && { backgroundColor: Colors.accentAlpha20, borderColor: Colors.accent }]}>
                        <Text style={[s.bidAvatarText, i === 0 && { color: Colors.accent }]}>{bid.initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.bidInitials} numberOfLines={1}>{bid.name}</Text>
                        {i === 0 && (
                          <View style={s.leaderChip}><Text style={s.leaderChipText}>LEADER</Text></View>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={[s.bidAmt, { fontFamily: FontFamily.mono }]}>{fmt(bid.amount)}</Text>
                        <Text style={s.bidTime}>{bid.time}</Text>
                        {/* Seller-only "Accept" button — ends the auction at this bid */}
                        {isSeller && isActive && (
                          <TouchableOpacity
                            style={[s.acceptBidBtn, acceptingBidId === bid.id && { opacity: 0.6 }]}
                            onPress={() => handleAcceptBid(bid)}
                            disabled={!!acceptingBidId}
                            activeOpacity={0.8}
                          >
                            {acceptingBidId === bid.id
                              ? <ActivityIndicator size="small" color={Colors.white} />
                              : <Text style={s.acceptBidBtnText}>Accept</Text>
                            }
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          </View>
        )}

        {/* ── Tab: SELLER ── */}
        {activeTab === 'seller' && (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={s.sellerAvatar}>
                <Text style={s.sellerAvatarText}>{sellerInitials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sellerName}>{sellerName}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons name="shield-checkmark" size={11} color={Colors.accentGreen} />
                  <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accentGreen }}>Verified Seller</Text>
                </View>
                <Text style={[s.muted, { marginTop: 8, lineHeight: 18 }]}>
                  Win the auction and a direct chat with this seller opens automatically to arrange the deal.
                </Text>
              </View>
            </View>

            {/* Seller contact — web parity (auctions/live/[id] gained this in
                05cfe7e4 / 25869c5d); mobile showed only a name and avatar.

                No gating logic lives here on purpose. The backend
                (auctions.service.ts:286) withholds every value until the viewer
                has won THIS auction and paid the buyer fee, returning null plus
                an `*Available` boolean saying whether a value exists at all.
                So a present value is already authorised to display, and an
                Available-but-null value is what renders the locked row. Mobile
                re-deriving "can this user see it?" would be a second source of
                truth for a privacy rule, which is exactly how that kind of rule
                gets broken. */}
            {(sellerContact.phoneAvailable ||
              sellerContact.emailAvailable ||
              sellerContact.businessAddressAvailable ||
              sellerContact.websiteAvailable) && (
              <View style={s.sellerContactBlock}>
                {sellerContact.phoneAvailable && (
                  <ContactRow
                    icon="call-outline"
                    label="Phone"
                    value={sellerContact.phone}
                    actionLabel="Call"
                    onAction={
                      sellerContact.phone
                        ? () => Linking.openURL(`tel:${sellerContact.phone}`)
                        : undefined
                    }
                  />
                )}
                {sellerContact.emailAvailable && (
                  <ContactRow
                    icon="mail-outline"
                    label="Email"
                    value={sellerContact.email}
                    actionLabel="Email"
                    onAction={
                      sellerContact.email
                        ? () => Linking.openURL(`mailto:${sellerContact.email}`)
                        : undefined
                    }
                  />
                )}
                {sellerContact.businessAddressAvailable && (
                  <ContactRow
                    icon="business-outline"
                    label="Address"
                    value={sellerContact.businessAddress}
                  />
                )}
                {sellerContact.websiteAvailable && (
                  <ContactRow
                    icon="globe-outline"
                    label="Website"
                    value={sellerContact.website}
                    actionLabel="Open"
                    onAction={
                      sellerContact.website
                        ? () => Linking.openURL(
                            /^https?:\/\//i.test(sellerContact.website!)
                              ? sellerContact.website!
                              : `https://${sellerContact.website}`,
                          )
                        : undefined
                    }
                  />
                )}
                {!sellerContact.unlocked && (
                  <Text style={s.sellerContactLockedNote}>
                    Contact details unlock once you win this auction and pay the buyer fee.
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Buy It Now panel (buyer) — hidden when reserve met or auction not active ── */}
        {isActive && !isSeller && !isEnded && !isCancelled && auction?.buyItNowPrice && !reserveMet && (
          binPendingBuyerId ? (
            // BIN is pending — show waiting state
            <View style={s.binPendingBanner}>
              <Ionicons name="time-outline" size={14} color={Colors.warning} />
              <Text style={s.binPendingText}>
                Buy It Now requested — awaiting seller confirmation
              </Text>
            </View>
          ) : (
            // BIN available — show trigger panel
            <View style={s.binPanel}>
              <View style={s.binPanelRow}>
                <View>
                  <Text style={s.binPanelLabel}>BUY IT NOW</Text>
                  <Text style={[s.binPanelPrice, { fontFamily: FontFamily.mono }]}>{fmt(Number(auction.buyItNowPrice))}</Text>
                </View>
                <Text style={s.binPanelHint}>Skip the auction{'\n'}seller must confirm</Text>
              </View>
              <TouchableOpacity
                style={[s.binBtn, binLoading && { opacity: 0.6 }]}
                onPress={handleTriggerBin}
                disabled={binLoading}
                activeOpacity={0.85}
              >
                {binLoading
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <>
                      <Ionicons name="pricetag-outline" size={15} color={Colors.white} />
                      <Text style={s.binBtnText}>Buy Now — {fmt(Number(auction.buyItNowPrice))}</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )
        )}

        {/* Spacer for sticky bid console */}
        <View style={{ height: 180 }} />
      </ScrollView>

      {/* ── Sticky Bid Console ── */}
      <View style={[s.bidConsole, { paddingBottom: insets.bottom || 16 }]}>
        {isCancelled ? (
          <View style={s.bidStateBox}>
            <Ionicons name="ban-outline" size={20} color={Colors.iconMuted} />
            <Text style={s.bidStateText}>Auction Cancelled</Text>
          </View>
        ) : isEnded ? (
          <View style={s.bidStateBox}>
            <Ionicons name="hammer-outline" size={20} color={Colors.iconMuted} />
            <Text style={s.bidStateText}>{userWon ? 'You Won!' : 'Auction Ended'}</Text>
            {userWon && auction?.buyerFeePaid && (
              <TouchableOpacity
                style={[s.bidBtn, { backgroundColor: Colors.accentGreen, marginTop: 8 }]}
                disabled={connectingChat}
                activeOpacity={0.8}
                onPress={async () => {
                  const sellerId = auction?.listing?.sellerId;
                  if (!sellerId) return;
                  setConnectingChat(true);
                  try {
                    const room = await createChatRoom(sellerId, auction?.listingId);
                    navigation.navigate('ChatScreen' as any, { threadId: room.id });
                  } catch {
                    navigation.navigate('Messages' as any);
                  } finally { setConnectingChat(false); }
                }}
              >
                {connectingChat
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <>
                      <Ionicons name="chatbubble-outline" size={15} color={Colors.white} />
                      <Text style={s.bidBtnText}>Message Seller</Text>
                    </>
                }
              </TouchableOpacity>
            )}
            {userWon && !auction?.buyerFeePaid && (
              <TouchableOpacity
                style={[s.bidBtn, { backgroundColor: Colors.accent, marginTop: 8 }]}
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate('PurchaseFlow' as any, {
                    listingId: auction?.listingId,
                    salePrice: 0,
                    buyerFee: 125,
                    listingTitle: auction?.listing?.title ?? 'Vehicle',
                    listingImage: auction?.listing?.images?.[0],
                    sellerName: auction?.listing?.seller
                      ? `${auction.listing.seller.firstName ?? ''} ${auction.listing.seller.lastName ?? ''}`.trim()
                      : undefined,
                    paymentType: 'COMMISSION',
                  })
                }
              >
                <Ionicons name="lock-closed-outline" size={15} color={Colors.white} />
                <Text style={s.bidBtnText}>Pay £125 Fee to Unlock Chat</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : isScheduled ? (
          <View style={s.bidStateBox}>
            <Ionicons name="calendar-outline" size={20} color={Colors.infoBlue} />
            <Text style={[s.bidStateText, { color: Colors.infoBlueLight }]}>Bidding Opens Soon</Text>
            {startTime && <Text style={s.muted}>{fmtDate(startTime.toISOString())}</Text>}
          </View>
        ) : isSeller ? (
          <View style={{ gap: 10 }}>
            {/* Seller context row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="briefcase-outline" size={16} color={Colors.warning} />
              <Text style={[s.bidStateText, { color: Colors.warning, flex: 1 }]}>You are the seller</Text>
              <Text style={s.muted}>{bidHistory.length} bid{bidHistory.length !== 1 ? 's' : ''}</Text>
            </View>

            {/* Reserve status */}
            <View style={[s.antiSnipeBar, { borderColor: reserveMet ? Colors.accentGreenAlpha30 : Colors.warningAlpha30, backgroundColor: reserveMet ? Colors.accentGreenAlpha08 : Colors.warningAlpha08 }]}>
              <Ionicons
                name={reserveMet ? 'shield-checkmark-outline' : 'shield-outline'}
                size={13}
                color={reserveMet ? Colors.accentGreen : Colors.warning}
              />
              <Text style={[s.antiSnipeBarText, { color: reserveMet ? Colors.accentGreen : Colors.warning }]}>
                {reserveMet
                  ? `Reserve met — current bid ${fmt(currentBid)}`
                  : `Reserve not yet met — need ${fmt(reservePrice)}`}
              </Text>
            </View>

            {/* Seller action buttons */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[s.quickBidBtn, { flex: 1, backgroundColor: Colors.warningAlpha12, borderColor: Colors.warningAlpha30, borderWidth: 1 }]}
                activeOpacity={0.8}
                onPress={() =>
                  Alert.alert(
                    'Adjust Reserve Price',
                    `Current reserve: ${fmt(reservePrice)}\n\nEnter a new reserve price to attract more bidders. Lowering the reserve may increase competition.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Lower Reserve', onPress: () => Alert.alert('Reserve Updated', 'Your reserve price has been updated.') },
                    ]
                  )
                }
              >
                <Text style={[s.quickBidBtnText, { color: Colors.warning }]}>RESERVE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.quickBidBtn, { flex: 1, backgroundColor: Colors.accentAlpha10, borderColor: Colors.accentAlpha25, borderWidth: 1 }, closingEarly && { opacity: 0.6 }]}
                activeOpacity={0.8}
                onPress={handleCloseEarly}
                disabled={closingEarly}
              >
                {closingEarly
                  ? <ActivityIndicator size="small" color={Colors.accent} />
                  : <Text style={[s.quickBidBtnText, { color: Colors.accent }]}>CLOSE NOW</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : !currentUser ? (
          <View style={s.bidStateBox}>
            <Text style={s.muted}>Sign in to place bids in live auctions.</Text>
            <Button
              label="Sign In to Bid"
              size="sm"
              style={{ marginTop: 8 }}
              onPress={() => navigation.navigate('Login' as any)}
            />
          </View>
        ) : role !== 'dealer' ? (
          <View style={s.bidStateBox}>
            <Text style={s.muted}>Only verified dealers can bid in auctions.</Text>
          </View>
        ) : !currentUser.isVerified ? (
          <View style={s.bidStateBox}>
            <Text style={s.muted}>Verify your dealership to place bids.</Text>
            <Button
              label="Complete KYC"
              size="sm"
              style={{ marginTop: 8 }}
              onPress={() => navigation.navigate('DealerKYC')}
            />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {/* Current bid info */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <View>
                <Text style={s.specKey}>CURRENT BID</Text>
                <Text style={[s.currentBidVal, { fontFamily: FontFamily.mono }]}>{fmt(currentBid)}</Text>
              </View>
              <Text style={s.minNextBid}>Min next: <Text style={{ color: Colors.white, fontFamily: FontFamily.mono }}>{fmt(currentBid + minIncrement)}</Text></Text>
            </View>

            {/* Quick bid buttons */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {quickBids.map(inc => (
                <TouchableOpacity
                  key={inc}
                  style={s.quickBidBtn}
                  onPress={() => handleBid(currentBid + inc)}
                  disabled={bidLoading}
                  activeOpacity={0.7}
                >
                  <Text style={s.quickBidLabel}>+{inc >= 1000 ? `£${inc / 1000}k` : `£${inc}`}</Text>
                  <Text style={[s.quickBidAmt, { fontFamily: FontFamily.mono }]}>{fmt(currentBid + inc)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom + bid button */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={s.customBidWrap}>
                <Text style={s.customBidCurrency}>£</Text>
                <TextInput
                  style={s.customBidInput}
                  value={bidAmount}
                  onChangeText={t => { setBidAmount(t); setBidError(null); }}
                  placeholder="Custom amount"
                  placeholderTextColor={Colors.borderMuted}
                  keyboardType="number-pad"
                  onSubmitEditing={() => bidAmount && handleBid(Number(bidAmount))}
                />
              </View>
              <TouchableOpacity
                style={[s.bidBtn, bidLoading && { opacity: 0.6 }]}
                onPress={() => handleBid(Number(bidAmount) || currentBid + minIncrement)}
                disabled={bidLoading}
                activeOpacity={0.8}
              >
                {bidLoading
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <>
                      <Ionicons name="hammer-outline" size={15} color={Colors.white} />
                      <Text style={s.bidBtnText}>BID</Text>
                    </>
                }
              </TouchableOpacity>
            </View>

            {bidError && (
              <View style={[s.banner, s.bannerRed, { marginTop: -4 }]}>
                <Ionicons name="alert-circle-outline" size={12} color={Colors.accent} />
                <Text style={[s.bannerText, { color: Colors.paleRed_fca5a5 }]} numberOfLines={2} ellipsizeMode="tail">{bidError}</Text>
              </View>
            )}
            {bidJustAccepted != null && !bidError && (
              <View style={[s.banner, { marginTop: -4, backgroundColor: Colors.accentGreen + '18', borderColor: Colors.accentGreen + '55', borderWidth: 1 }]}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.accentGreen} />
                <Text style={[s.bannerText, { color: Colors.accentGreen }]} numberOfLines={1}>
                  Bid accepted — {fmt(bidJustAccepted)}
                </Text>
              </View>
            )}

            {/* Cancel bid countdown banners — one per own bid still within the
                24h cancel window (there can be more than one, since being
                outbid no longer clears eligibility). */}
            {cancelableBids.map(bid => {
              const remaining = BID_CANCEL_WINDOW_MS - (nowMs - new Date(bid.createdAt).getTime());
              return (
                <View key={bid.id} style={[s.banner, s.bannerRed, s.cancelBidBanner]}>
                  <Ionicons name="timer-outline" size={12} color={Colors.accent} />
                  <Text style={[s.bannerText, { color: Colors.paleRed_fca5a5, flex: 1 }]} numberOfLines={1}>
                    {`Bid of ${fmt(bid.amount)} — `}
                    <Text style={{ fontFamily: FontFamily.mono }}>
                      {formatCancelWindowRemaining(remaining)}
                    </Text>
                    {' left to cancel'}
                  </Text>
                  <TouchableOpacity
                    style={s.cancelBidBtn}
                    onPress={() => handleCancelBid(bid.id)}
                    disabled={cancelLoadingId === bid.id}
                    activeOpacity={0.8}
                  >
                    {cancelLoadingId === bid.id
                      ? <ActivityIndicator size="small" color={Colors.white} />
                      : <Text style={s.cancelBidBtnText}>Cancel Bid</Text>
                    }
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Buyer fee notice */}
            <View style={s.feeNotice}>
              <View>
                <Text style={s.feeNoticeLabel}>BUYER FEE</Text>
                <Text style={s.feeNoticeHint}>One-time fee if you win</Text>
              </View>
              <Text style={[s.feeNoticeAmt, { fontFamily: FontFamily.mono }]}>£125</Text>
            </View>
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  sellerContactBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  contactValue: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  contactValueLocked: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
  },
  contactAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.chip,
    backgroundColor: Colors.accentAlpha12,
    borderWidth: 1,
    borderColor: Colors.accentAlpha30,
  },
  contactActionText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size11_5,
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  sellerContactLockedNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size11_5,
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: 2,
  },
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingHorizontal: 14, paddingTop: 8 },
  muted: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.iconMuted },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 10, backgroundColor: Colors.bgPrimary, zIndex: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.whiteAlpha05, borderWidth: 1, borderColor: Colors.whiteAlpha08, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, maxWidth: SW - 160 },
  watcherChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.whiteAlpha05, borderRadius: Radius.inline, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.whiteAlpha08 },
  watcherText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white },
  connDot: { width: 8, height: 8, borderRadius: 4 },

  // Status pills
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.white },
  livePillText: { fontFamily: FontFamily.bold, fontSize: FontSize.size8, color: Colors.white, letterSpacing: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.whiteAlpha06, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: Colors.whiteAlpha10 },
  statusPillText: { fontFamily: FontFamily.bold, fontSize: FontSize.size8, color: Colors.textSecondary, letterSpacing: 0.8 },

  // Banners
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  bannerRed: { backgroundColor: Colors.accentAlpha08, borderBottomWidth: 1, borderBottomColor: Colors.accentAlpha15 },
  bannerBlue: { backgroundColor: Colors.infoBlueAlpha08, borderBottomWidth: 1, borderBottomColor: Colors.infoBlueAlpha15 },
  bannerGreen: { backgroundColor: Colors.accentGreenAlpha08, borderBottomWidth: 1, borderBottomColor: Colors.accentGreenAlpha15 },
  bannerAmber: { backgroundColor: Colors.warningAlpha08, borderBottomWidth: 1, borderBottomColor: Colors.warningAlpha15 },
  bannerDark: { backgroundColor: Colors.whiteAlpha02, borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha05 },
  bannerText: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, lineHeight: 18, flex: 1 },
  bannerBtn: { backgroundColor: Colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'center' },
  bannerBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white },

  // Anti-snipe
  antiSnipeToast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.warning, paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.sheet, zIndex: 100, shadowColor: Colors.warning, shadowOpacity: 0.5, shadowRadius: 12, elevation: 20 },
  antiSnipeToastText: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.black },
  antiSnipeBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warningAlpha08, borderWidth: 1, borderColor: Colors.warningAlpha20, borderRadius: Radius.inline, padding: 10, marginBottom: 12 },
  antiSnipeBarText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.warning, flex: 1 },

  // Hero image
  heroWrap: { height: 240, borderRadius: Radius.card, overflow: 'hidden', marginBottom: 14, position: 'relative', backgroundColor: Colors.bgSecondary },
  heroImg: { width: '100%', height: '100%' },
  heroTopLeft: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 6, zIndex: 2 },
  heroTopRight: { position: 'absolute', top: 12, right: 12, gap: 6, alignItems: 'flex-end', zIndex: 2 },
  heroBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, zIndex: 2 },
  heroBidLabel: { ...TextPresets.eyebrow, fontSize: FontSize.size9, color: Colors.textSecondary, marginBottom: 4 },
  // The live bid is the focal figure of this screen and was rendering in
  // Poppins. Prices, bids and countdowns are mono at heavy weight throughout
  // the brand — the kit's auction screen sets exactly this pairing (mono bid
  // beside a mono countdown).
  heroBid: { ...TextPresets.monoPrice, fontSize: FontSize['4xl'], color: Colors.white },
  winningBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accentGreenAlpha20, borderWidth: 1, borderColor: Colors.accentGreenAlpha30, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  winningBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.accentGreen },
  outbidBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accentAlpha20, borderWidth: 1, borderColor: Colors.accentAlpha30, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  outbidBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.accent },
  timerBox: { backgroundColor: Colors.blackAlpha55, borderWidth: 1, borderColor: Colors.borderHi, borderRadius: Radius.inline, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  timerBoxLabel: { ...TextPresets.eyebrow, fontSize: FontSize.size9, color: Colors.textMuted, marginBottom: 2 },
  timerBoxValue: { fontFamily: FontFamily.mono, fontSize: FontSize.md, color: Colors.white },

  // Tabs
  tabs: { flexDirection: 'row', backgroundColor: Colors.bgSecondaryAlt, borderRadius: Radius.inline, marginBottom: 14, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: Colors.accent },
  tabText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.iconMuted, letterSpacing: 0.8 },
  tabTextActive: { color: Colors.white },

  // Card
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 0 },
  cardSectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white, letterSpacing: 1, marginBottom: 12, borderLeftWidth: 2, borderLeftColor: Colors.accent, paddingLeft: 8 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 0 },
  statBox: { flex: 1, backgroundColor: Colors.bgSecondaryAlt, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha06, padding: 10, alignItems: 'center' },
  statLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size8, color: Colors.iconMuted, letterSpacing: 1, marginBottom: 4 },
  statValue: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.white, textAlign: 'center' },

  // Digest — seller custom tags + self-rating
  digestTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  digestTagPill: { backgroundColor: Colors.accentAlpha10, borderWidth: 1, borderColor: Colors.accentAlpha25, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 200 },
  digestTagPillText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.accent },
  digestRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  digestRatingLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },

  // Specs
  specsSection: {},
  specGroup: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.iconMuted, letterSpacing: 1.5, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha05, marginBottom: 8 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  specKey: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted, flexShrink: 0 },
  specVal: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.paleBlue_c0c0cb, textAlign: 'right', flex: 1, marginLeft: 12 },
  descText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  // Features
  featureChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accentGreenAlpha08, borderWidth: 1, borderColor: Colors.accentGreenAlpha20, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.card },
  featureChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.size10, color: Colors.lightGreen_6ee7b7 },

  // Bids tab
  bidRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha04, gap: 10 },
  bidAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: Colors.whiteAlpha08, alignItems: 'center', justifyContent: 'center' },
  bidAvatarText: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.textSecondary },
  bidInitials: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.white },
  bidAmt: { fontFamily: FontFamily.mono, fontSize: FontSize.size14, color: Colors.white },
  bidTime: { fontFamily: FontFamily.regular, fontSize: FontSize.size9, color: Colors.iconMuted },
  leaderChip: { backgroundColor: Colors.accentAlpha20, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, alignSelf: 'flex-start', marginTop: 2 },
  leaderChipText: { fontFamily: FontFamily.bold, fontSize: FontSize.size7, color: Colors.accent, letterSpacing: 0.8 },

  // Seller tab
  sellerAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.accentAlpha10, borderWidth: 1, borderColor: Colors.accentAlpha20, alignItems: 'center', justifyContent: 'center' },
  sellerAvatarText: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.accent },
  sellerName: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white },

  // Bid console
  bidConsole: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.deepBlue_0d0d11, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha06, paddingHorizontal: 14, paddingTop: 12 },
  bidStateBox: { alignItems: 'center', paddingVertical: 12, gap: 6 },
  bidStateText: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.white },
  currentBidVal: { fontFamily: FontFamily.mono, fontSize: FontSize.size22, color: Colors.white },
  minNextBid: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted },
  quickBidBtn: { flex: 1, backgroundColor: Colors.whiteAlpha04, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha08, paddingVertical: 8, alignItems: 'center', gap: 2 },
  quickBidLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.iconMuted },
  quickBidAmt: { fontFamily: FontFamily.mono, fontSize: FontSize.size12, color: Colors.white },
  quickBidBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.white, letterSpacing: 0.5 },
  customBidWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.whiteAlpha04, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha08, paddingHorizontal: 12 },
  customBidCurrency: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.iconMuted, marginRight: 4 },
  customBidInput: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.md, color: Colors.white, paddingVertical: 10 },
  bidBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.accent, borderRadius: Radius.inline, paddingHorizontal: 20, paddingVertical: 12 },
  bidBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, letterSpacing: 0.8 },
  feeNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.warningAlpha06, borderWidth: 1, borderColor: Colors.warningAlpha15, borderRadius: Radius.inline, paddingHorizontal: 12, paddingVertical: 8 },
  feeNoticeLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.warning, letterSpacing: 1 },
  feeNoticeHint: { fontFamily: FontFamily.regular, fontSize: FontSize.size10, color: Colors.iconMuted, marginTop: 1 },
  feeNoticeAmt: { fontFamily: FontFamily.mono, fontSize: FontSize.xl, color: Colors.warning },

  // Seller tools row (top strip, below header banners)
  sellerToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.warningAlpha06,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warningAlpha15,
  },
  sellerToolsLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.warning,
    flex: 1,
  },
  sellerCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accentAlpha40,
    backgroundColor: Colors.accentAlpha08,
    minWidth: 44,
    justifyContent: 'center',
  },
  sellerCloseBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.accent,
  },

  // Bid row: seller Accept button
  acceptBidBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  acceptBidBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.white,
    letterSpacing: 0.2,
  },

  // Cancel bid banner
  cancelBidBanner: { alignItems: 'center' },
  cancelBidBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  cancelBidBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white },

  // Error/retry
  retryBtn: { backgroundColor: Colors.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.inline },
  retryBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white },

  // ── Buy It Now (buyer) ──
  binPanel: {
    backgroundColor: Colors.accentAlpha06,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
    borderRadius: Radius.inline,
    padding: 14,
    marginHorizontal: 14,
    marginBottom: 14,
    gap: 12,
  },
  binPanelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  binPanelLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.accent,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  binPanelPrice: {
    fontSize: FontSize.size22,
    color: Colors.white,
  },
  binPanelHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.iconMuted,
    textAlign: 'right',
    lineHeight: 16,
  },
  binBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accent,
  },
  binBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 0.3,
  },

  // BIN pending (buyer waiting)
  binPendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningAlpha08,
    borderWidth: 1,
    borderColor: Colors.warningAlpha20,
    borderRadius: Radius.inline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 14,
    marginBottom: 14,
  },
  binPendingText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.lightYellow,
    flex: 1,
    lineHeight: 18,
  },

  // ── Buy It Now (seller confirm panel) ──
  binSellerPanel: {
    marginHorizontal: 14,
    marginBottom: 4,
    backgroundColor: Colors.warningAlpha08,
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
    borderRadius: Radius.inline,
    padding: 14,
  },
  binSellerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.warning,
  },
  binSellerBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.lightYellow,
    lineHeight: 19,
  },
  binSellerDeclineBtn: {
    flex: 1,
    height: 40,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  binSellerDeclineText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  binSellerConfirmBtn: {
    flex: 2,
    height: 40,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  binSellerConfirmText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
});
