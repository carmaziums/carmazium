import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {FontFamily, FontSize } from '../../constants/typography';
import { Colors } from '../../constants/colors';
import { RowDensity } from '../../constants/spacing';
import { apiClient } from '../../lib/apiClient';
import { createChatRoom } from '../../lib/chatApi';
import { haptics } from '../../lib/haptics';
import { Skeleton } from '../../components/ui/Skeleton';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
type FilterTab = 'All' | 'Hot' | 'Warm' | 'New' | 'Won' | 'Lost';
type ViewMode = 'list' | 'board';

interface Lead {
  id: string;
  buyerId?: string;
  listingId?: string;
  name: string;
  initials: string;
  email?: string;
  phone?: string;
  vehicle: string;
  listingImage?: string;
  listingPrice?: number;
  source?: string;
  notes: string;
  time: string;
  createdAtIso?: string;
  status: string;
  tag: 'HOT' | 'WARM' | 'COLD';
  unreadCount?: number;
  assignedToId?: string;
  assignedToName?: string;
}

interface StaffOption {
  userId: string;
  name: string;
}

const STATUS_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: 'CONTACTED', label: 'Contacted', color: Colors.infoBlue },
  { key: 'QUALIFIED', label: 'Qualified', color: Colors.success },
  { key: 'NEGOTIATING', label: 'Negotiating', color: Colors.warning },
  { key: 'WON', label: 'Won', color: Colors.success },
  { key: 'LOST', label: 'Lost', color: Colors.accent },
];

// Board view's 6 columns — NEW is a starting state (not one of STATUS_OPTIONS'
// manual-reassignment targets above), but leads do sit in it until a dealer
// acts, so it still needs a column. Mirrors web's dashboard/dealer/crm Kanban
// stage set (mobile-production-readiness-plan.md F16) as a tap-based board
// rather than drag-and-drop — see that finding for why.
const BOARD_STAGES: { key: string; label: string; color: string }[] = [
  { key: 'NEW', label: 'New', color: Colors.textMuted },
  { key: 'CONTACTED', label: 'Contacted', color: Colors.infoBlue },
  { key: 'QUALIFIED', label: 'Qualified', color: Colors.success },
  { key: 'NEGOTIATING', label: 'Negotiating', color: Colors.warning },
  { key: 'WON', label: 'Won', color: Colors.success },
  { key: 'LOST', label: 'Lost', color: Colors.accent },
];

const SOURCE_LABELS: Record<string, string> = {
  listing_enquiry: 'Listing Enquiry',
  chat: 'Chat Message',
  offer: 'Offer Submitted',
  walk_in: 'Walk-in',
  phone: 'Phone Call',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getLeadTag = (status: string): 'HOT' | 'WARM' | 'COLD' => {
  if (status === 'NEW' || status === 'CONTACTED') return 'HOT';
  if (status === 'QUALIFIED' || status === 'NEGOTIATING') return 'WARM';
  return 'COLD';
};

const getLeadInitials = (name: string): string => {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
};

const formatTimeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

const formatPrice = (n?: number | null): string | undefined =>
  typeof n === 'number' && !Number.isNaN(n) ? `£${n.toLocaleString('en-GB')}` : undefined;

const mapApiLead = (l: any): Lead => ({
  id: l.id,
  buyerId: l.buyerId || l.buyer?.id || undefined,
  listingId: l.listing?.id || l.listingId || undefined,
  name: l.buyerName || 'Unknown',
  initials: getLeadInitials(l.buyerName || 'Unknown'),
  email: l.buyerEmail || undefined,
  phone: l.buyerPhone || undefined,
  vehicle: l.listing?.title || 'General enquiry',
  listingImage: l.listing?.images?.[0],
  listingPrice: l.listing?.price != null ? Number(l.listing.price) : undefined,
  source: l.source || undefined,
  notes: l.notes || '',
  time: l.createdAt ? formatTimeAgo(l.createdAt) : '–',
  createdAtIso: l.createdAt,
  status: l.status || 'NEW',
  tag: getLeadTag(l.status || 'NEW'),
  unreadCount: l.status === 'NEW' ? 1 : 0,
  assignedToId: l.assignedTo?.id || l.assignedToId || undefined,
  assignedToName: l.assignedTo
    ? ([l.assignedTo.firstName, l.assignedTo.lastName].filter(Boolean).join(' ') || l.assignedTo.email)
    : undefined,
});

// ─── Lead Detail Sub-Screen ──────────────────────────────────────────────────
const LeadDetail: React.FC<{
  lead: Lead;
  onBack: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onSaveNotes: (id: string, notes: string) => void;
  onReassign: (id: string, assignedToId: string | null) => void;
  staffOptions: StaffOption[];
  busy: boolean;
  navigation?: any;
}> = ({ lead, onBack, onUpdateStatus, onSaveNotes, onReassign, staffOptions, busy, navigation }) => {
  const insets = useSafeAreaInsets();
  const [notesDraft, setNotesDraft] = useState(lead.notes);
  const [messagingBusy, setMessagingBusy] = useState(false);

  const handleMessageLead = async () => {
    if (!lead.buyerId) {
      Alert.alert('Cannot message', 'No buyer account linked to this lead.');
      return;
    }
    haptics.light();
    setMessagingBusy(true);
    try {
      const room = await createChatRoom(lead.buyerId, lead.listingId);
      navigation?.navigate('ChatScreen' as any, { threadId: room.id });
    } catch {
      Alert.alert('Error', 'Could not open chat. Please try again.');
    } finally {
      setMessagingBusy(false);
    }
  };

  useEffect(() => { setNotesDraft(lead.notes); }, [lead.id, lead.notes]);

  const notesChanged = notesDraft.trim() !== (lead.notes || '').trim();
  const sourceLabel = lead.source ? (SOURCE_LABELS[lead.source] || lead.source) : 'Direct';
  const hasListing = lead.vehicle !== 'General enquiry';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha05, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.detailHeader, { paddingTop: insets.top + 14 }]}>
          <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={onBack} accessibilityLabel="Go back" />
          <View style={styles.detailHeaderCenter}>
            <View style={styles.detailAvatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{lead.initials}</Text>
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.detailName}>{lead.name}</Text>
                  {lead.tag === 'HOT' && (
                    <View style={styles.tagHotInline}>
                      <Text style={styles.tagHotTextInline}>HOT</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.detailVehicle} numberOfLines={1}>{lead.vehicle}</Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatContent}>
          {/* Listing card */}
          {hasListing && (
            <View style={styles.listingCard}>
              {lead.listingImage ? (
                <Image source={{ uri: lead.listingImage }} style={styles.listingThumb} contentFit="cover" transition={200} cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.listingThumb, styles.listingThumbFallback]}>
                  <Ionicons name="car-sport-outline" size={20} color={Colors.iconMuted} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.listingTitle} numberOfLines={1}>{lead.vehicle}</Text>
                {formatPrice(lead.listingPrice) && (
                  <Text style={styles.listingPrice}>{formatPrice(lead.listingPrice)}</Text>
                )}
              </View>
            </View>
          )}

          {/* Meta row — source & time */}
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons name="radio-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.metaChipText}>{sourceLabel}</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.metaChipText}>{lead.time} ago</Text>
            </View>
          </View>

          {/* Assigned To */}
          {staffOptions.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>ASSIGNED TO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 24 }}>
                <TouchableOpacity
                  style={[styles.staffChip, !lead.assignedToId && styles.staffChipActive]}
                  onPress={() => onReassign(lead.id, null)}
                  disabled={busy}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.staffChipText, !lead.assignedToId && styles.staffChipTextActive]}>Unassigned</Text>
                </TouchableOpacity>
                {staffOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.userId}
                    style={[styles.staffChip, lead.assignedToId === opt.userId && styles.staffChipActive]}
                    onPress={() => onReassign(lead.id, opt.userId)}
                    disabled={busy}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.staffChipText, lead.assignedToId === opt.userId && styles.staffChipTextActive]}>{opt.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Contact card */}
          <Text style={styles.sectionLabel}>CONTACT</Text>
          <View style={styles.contactCard}>
            {lead.phone ? (
              <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`tel:${lead.phone}`)} activeOpacity={0.7}>
                <View style={[styles.contactIconWrap, { backgroundColor: Colors.successAlpha12 }]}>
                  <Ionicons name="call-outline" size={15} color={Colors.success} />
                </View>
                <Text style={styles.contactText}>{lead.phone}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
              </TouchableOpacity>
            ) : null}
            {lead.email ? (
              <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${lead.email}`)} activeOpacity={0.7}>
                <View style={[styles.contactIconWrap, { backgroundColor: Colors.infoBlueAlpha12 }]}>
                  <Ionicons name="mail-outline" size={15} color={Colors.infoBlue} />
                </View>
                <Text style={styles.contactText} numberOfLines={1}>{lead.email}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
              </TouchableOpacity>
            ) : null}
            {!lead.phone && !lead.email && (
              <Text style={styles.emptyMutedText}>No contact details on file for this lead.</Text>
            )}
          </View>

          {/* Message Lead CTA */}
          {lead.buyerId ? (
            <TouchableOpacity
              style={[styles.messageCTA, messagingBusy && { opacity: 0.6 }]}
              onPress={handleMessageLead}
              disabled={messagingBusy}
              activeOpacity={0.8}
            >
              {messagingBusy ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="chatbubble-ellipses-outline" size={15} color={Colors.white} />
                  <Text style={styles.messageCTAText}>Message Lead</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {/* Notes */}
          <Text style={styles.sectionLabel}>NOTES</Text>
          <TextInput
            style={styles.notesInput}
            multiline
            placeholder="Add notes — call outcomes, requirements, follow-ups…"
            placeholderTextColor={Colors.iconMuted}
            value={notesDraft}
            onChangeText={setNotesDraft}
            textAlignVertical="top"
          />
          {notesChanged && (
            <TouchableOpacity
              style={[styles.saveNotesBtn, busy && { opacity: 0.6 }]}
              onPress={() => onSaveNotes(lead.id, notesDraft.trim())}
              disabled={busy}
              activeOpacity={0.8}
            >
              {busy ? <ActivityIndicator size="small" color={Colors.white} /> : (
                <>
                  <Ionicons name="checkmark" size={14} color={Colors.white} />
                  <Text style={styles.saveNotesBtnText}>Save Notes</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <View style={{ height: 12 }} />
        </ScrollView>

        {/* Status pipeline footer */}
        <View style={[styles.statusBarWrap, { paddingBottom: Math.max(insets.bottom + 12, 12) }]}>
          <Text style={styles.statusBarLabel}>UPDATE STATUS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {STATUS_OPTIONS.map(opt => {
              const active = lead.status === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.statusChip,
                    active && { backgroundColor: `${opt.color}26`, borderColor: opt.color },
                  ]}
                  onPress={() => onUpdateStatus(lead.id, opt.key)}
                  disabled={busy || active}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.statusChipText, active && { color: opt.color }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── Lead row — hoisted + memoized so FlatList only re-renders the row whose
// own props changed (mobile-audit.md P3/P4). ──
const LeadRow: React.FC<{ lead: Lead; onPress: (id: string) => void }> = React.memo(({ lead, onPress }) => (
  <TouchableOpacity style={styles.leadCard} onPress={() => onPress(lead.id)} activeOpacity={0.7}>
     <View style={styles.avatar}>
        <Text style={styles.avatarText}>{lead.initials}</Text>
     </View>
     <View style={styles.leadInfo}>
        <View style={styles.leadNameRow}>
           <Text style={styles.leadName}>{lead.name}</Text>
           <Text style={styles.leadTime}>{lead.time}</Text>
        </View>
        <Text style={styles.leadVehicle} numberOfLines={1}>{lead.vehicle}</Text>

        <View style={styles.leadMetaRow}>
           {lead.tag === 'HOT' && <View style={styles.tagHot}><Text style={styles.tagHotText}>HOT</Text></View>}
           {lead.tag === 'WARM' && <View style={styles.tagWarm}><Text style={styles.tagWarmText}>WARM</Text></View>}
           {lead.tag === 'COLD' && <View style={styles.tagCold}><Text style={styles.tagColdText}>{lead.status}</Text></View>}

           {formatPrice(lead.listingPrice) && (
              <View style={styles.tagPrice}>
                 <Ionicons name="pricetag-outline" size={10} color={Colors.accent} style={{marginRight: 4}}/>
                 <Text style={styles.tagPriceText}>{formatPrice(lead.listingPrice)}</Text>
              </View>
           )}
           {lead.assignedToName && (
              <View style={styles.tagCold}>
                 <Text style={styles.tagColdText}>→ {lead.assignedToName}</Text>
              </View>
           )}

           <Text style={styles.leadMessage} numberOfLines={1}>
              {lead.notes || (lead.source ? (SOURCE_LABELS[lead.source] || lead.source) : `Status: ${lead.status}`)}
           </Text>
        </View>
     </View>
     {lead.unreadCount ? (
        <View style={styles.unreadBadge}>
           <Text style={styles.unreadBadgeText}>{lead.unreadCount}</Text>
        </View>
     ) : null}
  </TouchableOpacity>
));

// ─── Board card — compact, memoized (same rationale as LeadRow above).
// Deliberately no drag handle: tapping the move icon opens a stage-picker
// sheet instead of a physical drag gesture (see BOARD_STAGES comment). ──
const BoardCard: React.FC<{
  lead: Lead;
  onPress: (id: string) => void;
  onMove: (id: string) => void;
}> = React.memo(({ lead, onPress, onMove }) => (
  <TouchableOpacity style={styles.boardCard} onPress={() => onPress(lead.id)} activeOpacity={0.75}>
    <View style={styles.boardCardTopRow}>
      <View style={styles.boardAvatar}>
        <Text style={styles.boardAvatarText}>{lead.initials}</Text>
      </View>
      <TouchableOpacity
        style={styles.boardMoveBtn}
        onPress={() => onMove(lead.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={`Move ${lead.name} to a different stage`}
      >
        <Ionicons name="swap-horizontal-outline" size={14} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
    <Text style={styles.boardCardName} numberOfLines={1}>{lead.name}</Text>
    <Text style={styles.boardCardVehicle} numberOfLines={1}>{lead.vehicle}</Text>
    <View style={styles.boardCardFooterRow}>
      {formatPrice(lead.listingPrice) && (
        <Text style={styles.boardCardPrice}>{formatPrice(lead.listingPrice)}</Text>
      )}
      {lead.assignedToName && (
        <Text style={styles.boardCardAssignee} numberOfLines={1}>→ {lead.assignedToName}</Text>
      )}
    </View>
  </TouchableOpacity>
));

// ─── Main Leads Screen ───────────────────────────────────────────────────────
export const DealerLeadsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [reassignLeadId, setReassignLeadId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);

  // Lead creation
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newAssignedToId, setNewAssignedToId] = useState<string | null>(null);
  const [newSource, setNewSource] = useState<string>('walk_in');
  const [creating, setCreating] = useState(false);

  const fetchLeads = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await apiClient<{ success: boolean; data: any[]; pagination: any }>('/dealers/leads?page=1&limit=50');
      if (res.success) setLeads((res.data || []).map(mapApiLead));
    } catch { /* keep previous */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await apiClient<{ success: boolean; data: any[] }>('/dealers/staff');
      if (res.success) {
        setStaffOptions(
          (res.data || [])
            .filter((s: any) => s.isActive)
            .map((s: any): StaffOption => ({
              userId: s.user.id,
              name: [s.user.firstName, s.user.lastName].filter(Boolean).join(' ') || s.user.email,
            }))
        );
      }
    } catch { /* staff assignment simply won't be offered */ }
  }, []);

  useEffect(() => { fetchLeads(); fetchStaff(); }, [fetchLeads, fetchStaff]);

  const handleReassign = async (leadId: string, assignedToId: string | null) => {
    setUpdatingId(leadId);
    try {
      await apiClient(`/dealers/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ assignedToId }),
      });
      const assignee = staffOptions.find(s => s.userId === assignedToId);
      setLeads(prev => prev.map(l => (l.id === leadId
        ? { ...l, assignedToId: assignedToId ?? undefined, assignedToName: assignee?.name }
        : l)));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not reassign lead.');
    } finally {
      setUpdatingId(null);
    }
  };

  const resetCreateForm = () => {
    setNewName(''); setNewEmail(''); setNewPhone(''); setNewNotes(''); setNewAssignedToId(null);
    setNewSource('walk_in');
  };

  const handleCreateLead = async () => {
    if (!newName.trim()) {
      Alert.alert('Name required', 'Enter the prospective buyer’s name.');
      return;
    }
    setCreating(true);
    try {
      const res = await apiClient<{ success: boolean; data: any }>('/dealers/leads', {
        method: 'POST',
        body: JSON.stringify({
          buyerName: newName.trim(),
          buyerEmail: newEmail.trim() || undefined,
          buyerPhone: newPhone.trim() || undefined,
          notes: newNotes.trim() || undefined,
          assignedToId: newAssignedToId ?? undefined,
          source: newSource,
        }),
      });
      if (res.success && res.data) {
        setLeads(prev => [mapApiLead(res.data), ...prev]);
      } else {
        await fetchLeads();
      }
      haptics.success();
      setCreateModalVisible(false);
      resetCreateForm();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not create lead.');
    } finally {
      setCreating(false);
    }
  };

  const selectedLead = selectedLeadId ? leads.find(l => l.id === selectedLeadId) ?? null : null;
  const reassignLead = reassignLeadId ? leads.find(l => l.id === reassignLeadId) ?? null : null;

  const handleUpdateLeadStatus = async (leadId: string, newStatus: string) => {
    setUpdatingId(leadId);
    try {
      await apiClient(`/dealers/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, status: newStatus, tag: getLeadTag(newStatus) } : l)));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update lead status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveNotes = async (leadId: string, notes: string) => {
    setUpdatingId(leadId);
    try {
      await apiClient(`/dealers/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      });
      setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, notes } : l)));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save notes.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Stable id-keyed handler so LeadRow's React.memo isn't busted by a fresh
  // closure every render (mobile-audit.md P4). Hooks must stay unconditional,
  // so this is declared before the early return below (Rules of Hooks).
  const handleLeadPress = useCallback((id: string) => setSelectedLeadId(id), []);
  const renderLeadRow = useCallback(
    ({ item }: { item: Lead }) => <LeadRow lead={item} onPress={handleLeadPress} />,
    [handleLeadPress],
  );
  const handleOpenReassign = useCallback((id: string) => setReassignLeadId(id), []);

  // Board view groups the same `leads` state by stage — no separate fetch,
  // just a client-side transform, recomputed only when leads actually change.
  const leadsByStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const stage of BOARD_STAGES) map[stage.key] = [];
    for (const lead of leads) {
      (map[lead.status] ?? (map[lead.status] = [])).push(lead);
    }
    return map;
  }, [leads]);

  const renderBoardColumn = useCallback(
    ({ item: stage }: { item: (typeof BOARD_STAGES)[number] }) => {
      const stageLeads = leadsByStage[stage.key] ?? [];
      return (
        <View style={styles.boardColumn}>
          <View style={styles.boardColumnHeader}>
            <View style={[styles.boardColumnDot, { backgroundColor: stage.color }]} />
            <Text style={styles.boardColumnTitle}>{stage.label}</Text>
            <Text style={styles.boardColumnCount}>{stageLeads.length}</Text>
          </View>
          <FlatList
            style={styles.boardColumnList}
            data={stageLeads}
            keyExtractor={(l) => l.id}
            renderItem={({ item }) => (
              <BoardCard lead={item} onPress={handleLeadPress} onMove={handleOpenReassign} />
            )}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.boardColumnEmpty}>No leads</Text>}
          />
        </View>
      );
    },
    [leadsByStage, handleLeadPress, handleOpenReassign],
  );

  if (selectedLead) {
    return (
      <LeadDetail
        lead={selectedLead}
        onBack={() => setSelectedLeadId(null)}
        onUpdateStatus={handleUpdateLeadStatus}
        onSaveNotes={handleSaveNotes}
        onReassign={handleReassign}
        staffOptions={staffOptions}
        busy={updatingId === selectedLead.id}
        navigation={navigation}
      />
    );
  }

  const newCount = leads.filter(l => l.status === 'NEW').length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = leads.filter(l => l.createdAtIso && new Date(l.createdAtIso).getTime() >= weekAgo).length;

  // Won/Lost used to be invisible inside a catch-all "Cold" tag with no
  // dedicated filter — only reachable by scrolling "All" (mobile-production-
  // readiness-plan.md F16). Explicit tabs now, independent of the board view.
  const FILTERS: { label: FilterTab; count: number }[] = [
    { label: 'All', count: leads.length },
    { label: 'Hot', count: leads.filter(l => l.tag === 'HOT').length },
    { label: 'Warm', count: leads.filter(l => l.tag === 'WARM').length },
    { label: 'New', count: newCount },
    { label: 'Won', count: leads.filter(l => l.status === 'WON').length },
    { label: 'Lost', count: leads.filter(l => l.status === 'LOST').length },
  ];

  const filteredLeads = leads.filter(lead => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Hot') return lead.tag === 'HOT';
    if (activeFilter === 'Warm') return lead.tag === 'WARM';
    if (activeFilter === 'New') return lead.status === 'NEW';
    if (activeFilter === 'Won') return lead.status === 'WON';
    if (activeFilter === 'Lost') return lead.status === 'LOST';
    return true;
  });

  const renderEmptyState = () => (
    <View style={styles.emptyWrap}>
      <Ionicons name="people-outline" size={40} color={Colors.iconMuted} />
      <Text style={styles.emptyTitle}>{activeFilter === 'All' ? 'No leads yet' : `No ${activeFilter.toLowerCase()} leads`}</Text>
      <Text style={styles.emptySub}>Buyer enquiries on your listings will show up here as leads.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha05, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
         <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton style={[styles.backBtn, { marginRight: 12 }]} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />
            <View>
               <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <View style={styles.unreadDot} />
                  <Text style={styles.headerSub}>{newCount} NEW · {newThisWeek} THIS WEEK</Text>
               </View>
               <Text style={styles.headerTitle}>Leads</Text>
            </View>
         </View>
         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.viewModeToggle}>
               <TouchableOpacity
                  style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
                  onPress={() => setViewMode('list')}
                  activeOpacity={0.7}
                  accessibilityLabel="List view"
               >
                  <Ionicons name="list-outline" size={15} color={viewMode === 'list' ? Colors.white : Colors.textMuted} />
               </TouchableOpacity>
               <TouchableOpacity
                  style={[styles.viewModeBtn, viewMode === 'board' && styles.viewModeBtnActive]}
                  onPress={() => setViewMode('board')}
                  activeOpacity={0.7}
                  accessibilityLabel="Board view"
               >
                  <Ionicons name="albums-outline" size={15} color={viewMode === 'board' ? Colors.white : Colors.textMuted} />
               </TouchableOpacity>
            </View>
            <IconButton style={styles.addLeadBtn} icon={<Ionicons name="add" size={20} color={Colors.white} />} onPress={() => setCreateModalVisible(true)} accessibilityLabel="Add lead" />
            <HamburgerButton />
         </View>
      </View>

      {viewMode === 'list' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
           {FILTERS.map(f => (
              <TouchableOpacity
                 key={f.label}
                 style={[styles.filterTab, activeFilter === f.label && styles.filterTabActive]}
                 onPress={() => setActiveFilter(f.label)}
                 activeOpacity={0.7}
              >
                 {(f.label === 'Hot' || f.label === 'Warm') && (
                    <View style={[styles.filterDot, { backgroundColor: f.label === 'Hot' ? Colors.accent : Colors.warning }]} />
                 )}
                 <Text style={[styles.filterTabText, activeFilter === f.label && styles.filterTabTextActive]}>
                    {f.label} <Text style={{opacity: 0.7}}>{f.count}</Text>
                 </Text>
              </TouchableOpacity>
           ))}
        </ScrollView>
      )}

      {loading && leads.length === 0 ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} w={SCREEN_WIDTH - 32} h={84} r={20} />
          ))}
        </View>
      ) : viewMode === 'board' ? (
        <FlatList
          horizontal
          style={styles.boardScroll}
          contentContainerStyle={styles.boardContent}
          showsHorizontalScrollIndicator={false}
          data={BOARD_STAGES}
          keyExtractor={(s) => s.key}
          renderItem={renderBoardColumn}
        />
      ) : filteredLeads.length === 0 ? (
        renderEmptyState()
      ) : (
      <FlatList
        style={styles.listScroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchLeads(true)} tintColor={Colors.accent} />}
        data={filteredLeads}
        keyExtractor={(item) => item.id}
        renderItem={renderLeadRow}
      />
      )}

      {/* Board-view stage reassignment sheet — same STATUS_OPTIONS the list-view
          lead detail's status footer uses, triggered from a board card's move
          icon instead of drag-and-drop (mobile-production-readiness-plan.md F16). */}
      <BottomSheet
        visible={!!reassignLeadId}
        onClose={() => setReassignLeadId(null)}
        title={reassignLead ? `Move ${reassignLead.name}` : 'Move lead'}
      >
        <View style={{ gap: 8, paddingBottom: 8 }}>
          {STATUS_OPTIONS.map(opt => {
            const active = reassignLead?.status === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.reassignRow, active && { borderColor: opt.color, backgroundColor: `${opt.color}14` }]}
                disabled={active || updatingId === reassignLeadId}
                onPress={async () => {
                  if (reassignLeadId) await handleUpdateLeadStatus(reassignLeadId, opt.key);
                  setReassignLeadId(null);
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.reassignDot, { backgroundColor: opt.color }]} />
                <Text style={[styles.reassignRowText, active && { color: opt.color }]}>{opt.label}</Text>
                {active && <Ionicons name="checkmark" size={16} color={opt.color} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

      {/* Create Lead modal */}
      <BottomSheet
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        title="New Lead"
        avoidKeyboard
      >
        <>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
                <Text style={styles.createFieldLabel}>NAME *</Text>
                <TextInput
                  style={styles.createInput}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Buyer's name"
                  placeholderTextColor={Colors.iconMuted}
                />
                <Text style={styles.createFieldLabel}>EMAIL</Text>
                <TextInput
                  style={styles.createInput}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="buyer@example.com"
                  placeholderTextColor={Colors.iconMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <Text style={styles.createFieldLabel}>PHONE</Text>
                <TextInput
                  style={styles.createInput}
                  value={newPhone}
                  onChangeText={setNewPhone}
                  placeholder="07…"
                  placeholderTextColor={Colors.iconMuted}
                  keyboardType="phone-pad"
                />
                <Text style={styles.createFieldLabel}>NOTES</Text>
                <TextInput
                  style={[styles.createInput, { minHeight: 70, textAlignVertical: 'top' }]}
                  value={newNotes}
                  onChangeText={setNewNotes}
                  placeholder="Requirements, follow-ups…"
                  placeholderTextColor={Colors.iconMuted}
                  multiline
                />

                <Text style={styles.createFieldLabel}>SOURCE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                  {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.staffChip, newSource === key && styles.staffChipActive]}
                      onPress={() => setNewSource(key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.staffChipText, newSource === key && styles.staffChipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {staffOptions.length > 0 && (
                  <>
                    <Text style={styles.createFieldLabel}>ASSIGN TO</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                      <TouchableOpacity
                        style={[styles.staffChip, !newAssignedToId && styles.staffChipActive]}
                        onPress={() => setNewAssignedToId(null)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.staffChipText, !newAssignedToId && styles.staffChipTextActive]}>Unassigned</Text>
                      </TouchableOpacity>
                      {staffOptions.map(opt => (
                        <TouchableOpacity
                          key={opt.userId}
                          style={[styles.staffChip, newAssignedToId === opt.userId && styles.staffChipActive]}
                          onPress={() => setNewAssignedToId(opt.userId)}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.staffChipText, newAssignedToId === opt.userId && styles.staffChipTextActive]}>{opt.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
              </ScrollView>

              <Button label="Create Lead" onPress={handleCreateLead} loading={creating} fullWidth style={{ marginTop: 4 }} />
        </>
      </BottomSheet>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'flex-start',
     paddingHorizontal: 24,
     marginBottom: 16,
  },
  unreadDot: {
     width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent, marginRight: 6
  },
  addLeadBtn: {
     width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent,
     alignItems: 'center', justifyContent: 'center',
  },
  viewModeToggle: {
     flexDirection: 'row', backgroundColor: Colors.whiteAlpha05, borderRadius: 12,
     borderWidth: 1, borderColor: Colors.whiteAlpha08, padding: 2,
  },
  viewModeBtn: {
     width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  viewModeBtnActive: {
     backgroundColor: Colors.accent,
  },
  headerSub: {
     fontFamily: FontFamily.bold,
     fontSize: FontSize.size9,
     color: Colors.textSecondary,
     letterSpacing: 1.5,
  },
  headerTitle: {
     fontFamily: FontFamily.extraBold,
     fontSize: FontSize['3xl'],
     color: Colors.white,
     letterSpacing: -0.8,
  },
  filterScroll: {
     maxHeight: 40,
     marginBottom: 20,
  },
  filterContent: {
     paddingHorizontal: 20,
     gap: 10,
  },
  filterTab: {
     flexDirection: 'row', alignItems: 'center', height: 32, paddingHorizontal: 16,
     borderRadius: 16, backgroundColor: Colors.whiteAlpha05, borderWidth: 1, borderColor: Colors.whiteAlpha08
  },
  filterTabActive: {
     backgroundColor: Colors.accent, borderColor: Colors.accent
  },
  filterDot: {
     width: 6, height: 6, borderRadius: 3, marginRight: 6,
  },
  filterTabText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textSecondary
  },
  filterTabTextActive: {
     color: Colors.white
  },
  listScroll: {
     flex: 1,
  },

  // Board view
  boardScroll: {
     flex: 1,
  },
  boardContent: {
     paddingHorizontal: 16,
     paddingBottom: 20,
     gap: 12,
  },
  boardColumn: {
     width: 240,
     // Columns need a resolved height for their inner FlatList to actually
     // virtualize/scroll instead of expanding to full content height — a
     // plain View would stretch to the outer horizontal FlatList's row
     // height automatically, but a nested FlatList (ScrollView-based) needs
     // an explicit dimension of its own, not just an unconstrained parent.
     height: '100%',
     backgroundColor: Colors.whiteAlpha03,
     borderRadius: 16,
     borderWidth: 1,
     borderColor: Colors.whiteAlpha06,
     padding: 10,
  },
  boardColumnList: {
     flex: 1,
  },
  boardColumnHeader: {
     flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, paddingHorizontal: 4,
  },
  boardColumnDot: {
     width: 7, height: 7, borderRadius: 3.5,
  },
  boardColumnTitle: {
     flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.white,
  },
  boardColumnCount: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textMuted,
     backgroundColor: Colors.whiteAlpha08, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1,
  },
  boardColumnEmpty: {
     fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted,
     textAlign: 'center', paddingVertical: 16,
  },
  boardCard: {
     backgroundColor: Colors.bgSecondaryAlt, borderRadius: 12, borderWidth: 1,
     borderColor: Colors.whiteAlpha06, padding: 10, marginBottom: 8,
  },
  boardCardTopRow: {
     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  boardAvatar: {
     width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.deepBlue_1c1c24,
     alignItems: 'center', justifyContent: 'center',
  },
  boardAvatarText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.white,
  },
  boardMoveBtn: {
     width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
     backgroundColor: Colors.whiteAlpha05,
  },
  boardCardName: {
     fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, marginBottom: 2,
  },
  boardCardVehicle: {
     fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 6,
  },
  boardCardFooterRow: {
     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
  },
  boardCardPrice: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.accent,
  },
  boardCardAssignee: {
     flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.size10, color: Colors.textMuted, textAlign: 'right',
  },

  // Reassign sheet
  reassignRow: {
     flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13,
     borderRadius: 12, backgroundColor: Colors.whiteAlpha04, borderWidth: 1, borderColor: Colors.whiteAlpha08,
  },
  reassignDot: {
     width: 8, height: 8, borderRadius: 4,
  },
  reassignRowText: {
     flex: 1, fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.white,
  },
  // Dealer leads is a power-user surface, so it uses the compact row density
  // preset instead of buyer-card spacing (mobile-ui-ux-audit.md §C9).
  leadCard: {
     flexDirection: 'row', backgroundColor: Colors.bgSecondaryAlt, borderRadius: RowDensity.compact.borderRadius,
     padding: RowDensity.compact.padding, minHeight: RowDensity.compact.rowHeight,
     marginBottom: RowDensity.compact.gap, borderWidth: 1, borderColor: Colors.whiteAlpha06
  },
  avatar: {
     width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.deepBlue_1c1c24,
     alignItems: 'center', justifyContent: 'center', marginRight: RowDensity.compact.gap,
  },
  avatarText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.rowLabel, color: Colors.white
  },
  leadInfo: {
     flex: 1,
  },
  leadNameRow: {
     flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2
  },
  leadName: {
     fontFamily: FontFamily.bold, fontSize: FontSize.rowLabel, color: Colors.white
  },
  leadTime: {
     fontFamily: FontFamily.regular, fontSize: FontSize.rowMeta, color: Colors.iconMuted
  },
  leadVehicle: {
     fontFamily: FontFamily.regular, fontSize: FontSize.rowMeta, color: Colors.textSecondary, marginBottom: 6
  },
  leadMetaRow: {
     flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8
  },
  tagHot: {
     backgroundColor: Colors.accentAlpha15, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  tagHotText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.accent
  },
  tagWarm: {
     backgroundColor: Colors.warningAlpha15, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  tagWarmText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.warning
  },
  tagCold: {
     backgroundColor: Colors.whiteAlpha10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  tagColdText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.textSecondary
  },
  tagPrice: {
     flexDirection: 'row', alignItems: 'center',
  },
  tagPriceText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accent
  },
  leadMessage: {
     flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.white
  },
  unreadBadge: {
     position: 'absolute', right: 16, top: '50%', marginTop: 2, width: 18, height: 18,
     borderRadius: 9, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center'
  },
  unreadBadgeText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.white
  },

  emptyWrap: {
     flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10, paddingBottom: 80,
  },
  emptyTitle: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.white, textAlign: 'center',
  },
  emptySub: {
     fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18,
  },

  // Detail View
  detailHeader: {
     flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16,
     borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha05, paddingBottom: 16
  },
  backBtn: {
     width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.whiteAlpha05,
     borderWidth: 1, borderColor: Colors.whiteAlpha08, alignItems: 'center', justifyContent: 'center'
  },
  detailHeaderCenter: {
     flex: 1, paddingLeft: 12,
  },
  detailAvatarWrap: {
     flexDirection: 'row', alignItems: 'center', gap: 12
  },
  detailName: {
     fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white, marginRight: 8
  },
  tagHotInline: {
     backgroundColor: Colors.accentAlpha15, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  tagHotTextInline: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size8, color: Colors.accent
  },
  detailVehicle: {
     fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.iconMuted, marginTop: 2
  },
  chatScroll: {
     flex: 1,
  },
  chatContent: {
     paddingHorizontal: 20, paddingBottom: 20,
  },

  listingCard: {
     flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 12, borderWidth: 1,
     borderColor: Colors.whiteAlpha06, backgroundColor: Colors.bgSecondaryAlt, marginBottom: 16,
  },
  listingThumb: {
     width: 52, height: 52, borderRadius: 10, backgroundColor: Colors.deepBlue_1c1c24,
  },
  listingThumbFallback: {
     alignItems: 'center', justifyContent: 'center',
  },
  listingTitle: {
     fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white,
  },
  listingPrice: {
     fontFamily: FontFamily.semiBold, fontSize: FontSize.size12, color: Colors.accent, marginTop: 2,
  },

  metaRow: {
     flexDirection: 'row', gap: 8, marginBottom: 24,
  },
  metaChip: {
     flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6,
     borderRadius: 10, backgroundColor: Colors.whiteAlpha04, borderWidth: 1, borderColor: Colors.whiteAlpha06,
  },
  metaChipText: {
     fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary,
  },
  staffChip: {
     paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
     backgroundColor: Colors.whiteAlpha05, borderWidth: 1, borderColor: Colors.whiteAlpha08,
  },
  staffChipActive: {
     backgroundColor: Colors.accentAlpha15, borderColor: Colors.accent,
  },
  staffChipText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.textSecondary,
  },
  staffChipTextActive: {
     color: Colors.accent,
  },

  sectionLabel: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.iconMuted, letterSpacing: 1.5, marginBottom: 10,
  },

  contactCard: {
     borderRadius: 16, borderWidth: 1, borderColor: Colors.whiteAlpha06, backgroundColor: Colors.bgSecondaryAlt,
     marginBottom: 24, overflow: 'hidden',
  },
  contactRow: {
     flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14,
     borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.whiteAlpha05,
  },
  contactIconWrap: {
     width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  contactText: {
     flex: 1, fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.white,
  },
  emptyMutedText: {
     fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.iconMuted, padding: 16, textAlign: 'center',
  },

  notesInput: {
     minHeight: 100, borderRadius: 16, borderWidth: 1, borderColor: Colors.whiteAlpha08,
     backgroundColor: Colors.bgSecondaryAlt, color: Colors.white, fontFamily: FontFamily.regular, fontSize: FontSize.sm,
     padding: 14, lineHeight: 20,
  },
  saveNotesBtn: {
     flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10,
     height: 40, borderRadius: 12, backgroundColor: Colors.accent,
  },
  saveNotesBtnText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white,
  },
  messageCTA: {
     flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20,
     height: 46, borderRadius: 14, backgroundColor: Colors.bgSecondaryAlt,
     borderWidth: 1, borderColor: Colors.whiteAlpha12,
  },
  messageCTAText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.white,
  },

  statusBarWrap: {
     backgroundColor: Colors.bgSecondaryAlt, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha05, paddingTop: 14,
  },
  statusBarLabel: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.iconMuted, letterSpacing: 1.5, marginBottom: 10, marginLeft: 16,
  },
  statusChip: {
     height: 36, paddingHorizontal: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
     backgroundColor: Colors.whiteAlpha05, borderWidth: 1, borderColor: Colors.whiteAlpha08,
  },
  statusChipText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.textSecondary,
  },

  // Create Lead modal (shell now provided by shared <BottomSheet>)
  createFieldLabel: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.iconMuted, letterSpacing: 1.2, marginBottom: 6, marginTop: 12,
  },
  createInput: {
     borderRadius: 12, borderWidth: 1, borderColor: Colors.whiteAlpha08,
     backgroundColor: Colors.bgPrimary, color: Colors.white, fontFamily: FontFamily.regular, fontSize: FontSize.size14,
     paddingHorizontal: 14, paddingVertical: 12,
  },
});
