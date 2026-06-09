import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';

type FilterTab = 'All' | 'Hot' | 'Warm' | 'New';

interface Lead {
  id: string;
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
}

const STATUS_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: 'CONTACTED', label: 'Contacted', color: '#3B82F6' },
  { key: 'QUALIFIED', label: 'Qualified', color: '#22C55E' },
  { key: 'NEGOTIATING', label: 'Negotiating', color: '#F59E0B' },
  { key: 'WON', label: 'Won', color: '#22C55E' },
  { key: 'LOST', label: 'Lost', color: '#DC1F26' },
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
});

// ─── Lead Detail Sub-Screen ──────────────────────────────────────────────────
const LeadDetail: React.FC<{
  lead: Lead;
  onBack: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onSaveNotes: (id: string, notes: string) => void;
  busy: boolean;
}> = ({ lead, onBack, onUpdateStatus, onSaveNotes, busy }) => {
  const insets = useSafeAreaInsets();
  const [notesDraft, setNotesDraft] = useState(lead.notes);

  useEffect(() => { setNotesDraft(lead.notes); }, [lead.id, lead.notes]);

  const notesChanged = notesDraft.trim() !== (lead.notes || '').trim();
  const sourceLabel = lead.source ? (SOURCE_LABELS[lead.source] || lead.source) : 'Direct';
  const hasListing = lead.vehicle !== 'General enquiry';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.05)', 'rgba(0,0,0,0)', '#0A0A0C']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.detailHeader, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
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
                  <Ionicons name="car-sport-outline" size={20} color="#606070" />
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
              <Ionicons name="radio-outline" size={12} color="#A0A0AB" />
              <Text style={styles.metaChipText}>{sourceLabel}</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={12} color="#A0A0AB" />
              <Text style={styles.metaChipText}>{lead.time} ago</Text>
            </View>
          </View>

          {/* Contact card */}
          <Text style={styles.sectionLabel}>CONTACT</Text>
          <View style={styles.contactCard}>
            {lead.phone ? (
              <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`tel:${lead.phone}`)} activeOpacity={0.7}>
                <View style={[styles.contactIconWrap, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                  <Ionicons name="call-outline" size={15} color="#22C55E" />
                </View>
                <Text style={styles.contactText}>{lead.phone}</Text>
                <Ionicons name="chevron-forward" size={14} color="#606070" />
              </TouchableOpacity>
            ) : null}
            {lead.email ? (
              <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${lead.email}`)} activeOpacity={0.7}>
                <View style={[styles.contactIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                  <Ionicons name="mail-outline" size={15} color="#3B82F6" />
                </View>
                <Text style={styles.contactText} numberOfLines={1}>{lead.email}</Text>
                <Ionicons name="chevron-forward" size={14} color="#606070" />
              </TouchableOpacity>
            ) : null}
            {!lead.phone && !lead.email && (
              <Text style={styles.emptyMutedText}>No contact details on file for this lead.</Text>
            )}
          </View>

          {/* Notes */}
          <Text style={styles.sectionLabel}>NOTES</Text>
          <TextInput
            style={styles.notesInput}
            multiline
            placeholder="Add notes — call outcomes, requirements, follow-ups…"
            placeholderTextColor="#606070"
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
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                <>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
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

// ─── Main Leads Screen ───────────────────────────────────────────────────────
export const DealerLeadsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchLeads = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await apiClient<{ success: boolean; data: any[]; pagination: any }>('/dealers/leads?page=1&limit=50');
      if (res.success) setLeads((res.data || []).map(mapApiLead));
    } catch { /* keep previous */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const selectedLead = selectedLeadId ? leads.find(l => l.id === selectedLeadId) ?? null : null;

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

  if (selectedLead) {
    return (
      <LeadDetail
        lead={selectedLead}
        onBack={() => setSelectedLeadId(null)}
        onUpdateStatus={handleUpdateLeadStatus}
        onSaveNotes={handleSaveNotes}
        busy={updatingId === selectedLead.id}
      />
    );
  }

  const newCount = leads.filter(l => l.status === 'NEW').length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = leads.filter(l => l.createdAtIso && new Date(l.createdAtIso).getTime() >= weekAgo).length;

  const FILTERS: { label: FilterTab; count: number }[] = [
    { label: 'All', count: leads.length },
    { label: 'Hot', count: leads.filter(l => l.tag === 'HOT').length },
    { label: 'Warm', count: leads.filter(l => l.tag === 'WARM').length },
    { label: 'New', count: newCount },
  ];

  const filteredLeads = leads.filter(lead => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Hot') return lead.tag === 'HOT';
    if (activeFilter === 'Warm') return lead.tag === 'WARM';
    if (activeFilter === 'New') return lead.status === 'NEW';
    return true;
  });

  const renderEmptyState = () => (
    <View style={styles.emptyWrap}>
      <Ionicons name="people-outline" size={40} color="#606070" />
      <Text style={styles.emptyTitle}>{activeFilter === 'All' ? 'No leads yet' : `No ${activeFilter.toLowerCase()} leads`}</Text>
      <Text style={styles.emptySub}>Buyer enquiries on your listings will show up here as leads.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.05)', 'rgba(0,0,0,0)', '#0A0A0C']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
         <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
               style={[styles.backBtn, { marginRight: 12 }]}
               onPress={() => navigation?.goBack()}
               activeOpacity={0.7}
            >
               <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
               <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <View style={styles.unreadDot} />
                  <Text style={styles.headerSub}>{newCount} NEW · {newThisWeek} THIS WEEK</Text>
               </View>
               <Text style={styles.headerTitle}>Leads</Text>
            </View>
         </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
         {FILTERS.map(f => (
            <TouchableOpacity
               key={f.label}
               style={[styles.filterTab, activeFilter === f.label && styles.filterTabActive]}
               onPress={() => setActiveFilter(f.label)}
               activeOpacity={0.7}
            >
               {(f.label === 'Hot' || f.label === 'Warm') && (
                  <View style={[styles.filterDot, { backgroundColor: f.label === 'Hot' ? '#DC1F26' : '#F59E0B' }]} />
               )}
               <Text style={[styles.filterTabText, activeFilter === f.label && styles.filterTabTextActive]}>
                  {f.label} <Text style={{opacity: 0.7}}>{f.count}</Text>
               </Text>
            </TouchableOpacity>
         ))}
      </ScrollView>

      {loading && leads.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#DC1F26" />
        </View>
      ) : filteredLeads.length === 0 ? (
        renderEmptyState()
      ) : (
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchLeads(true)} tintColor="#DC1F26" />}
      >
         {filteredLeads.map(lead => (
            <TouchableOpacity key={lead.id} style={styles.leadCard} onPress={() => setSelectedLeadId(lead.id)} activeOpacity={0.7}>
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
                           <Ionicons name="pricetag-outline" size={10} color="#DC1F26" style={{marginRight: 4}}/>
                           <Text style={styles.tagPriceText}>{formatPrice(lead.listingPrice)}</Text>
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
         ))}
      </ScrollView>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  header: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'flex-start',
     paddingHorizontal: 24,
     marginBottom: 16,
  },
  unreadDot: {
     width: 4, height: 4, borderRadius: 2, backgroundColor: '#DC1F26', marginRight: 6
  },
  headerSub: {
     fontFamily: FontFamily.bold,
     fontSize: 9,
     color: '#A0A0AB',
     letterSpacing: 1.5,
  },
  headerTitle: {
     fontFamily: FontFamily.extraBold,
     fontSize: 28,
     color: '#FFFFFF',
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
     borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
  },
  filterTabActive: {
     backgroundColor: '#DC1F26', borderColor: '#DC1F26'
  },
  filterDot: {
     width: 6, height: 6, borderRadius: 3, marginRight: 6,
  },
  filterTabText: {
     fontFamily: FontFamily.bold, fontSize: 13, color: '#A0A0AB'
  },
  filterTabTextActive: {
     color: '#FFFFFF'
  },
  listScroll: {
     flex: 1,
  },
  leadCard: {
     flexDirection: 'row', backgroundColor: '#111116', borderRadius: 20, padding: 16,
     marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
  },
  avatar: {
     width: 44, height: 44, borderRadius: 22, backgroundColor: '#1C1C24',
     alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  avatarText: {
     fontFamily: FontFamily.bold, fontSize: 16, color: '#FFFFFF'
  },
  leadInfo: {
     flex: 1,
  },
  leadNameRow: {
     flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2
  },
  leadName: {
     fontFamily: FontFamily.bold, fontSize: 15, color: '#FFFFFF'
  },
  leadTime: {
     fontFamily: FontFamily.regular, fontSize: 11, color: '#606070'
  },
  leadVehicle: {
     fontFamily: FontFamily.regular, fontSize: 12, color: '#A0A0AB', marginBottom: 10
  },
  leadMetaRow: {
     flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8
  },
  tagHot: {
     backgroundColor: 'rgba(220,31,38,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  tagHotText: {
     fontFamily: FontFamily.bold, fontSize: 9, color: '#DC1F26'
  },
  tagWarm: {
     backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  tagWarmText: {
     fontFamily: FontFamily.bold, fontSize: 9, color: '#F59E0B'
  },
  tagCold: {
     backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  tagColdText: {
     fontFamily: FontFamily.bold, fontSize: 9, color: '#A0A0AB'
  },
  tagPrice: {
     flexDirection: 'row', alignItems: 'center',
  },
  tagPriceText: {
     fontFamily: FontFamily.bold, fontSize: 11, color: '#DC1F26'
  },
  leadMessage: {
     flex: 1, fontFamily: FontFamily.regular, fontSize: 13, color: '#FFFFFF'
  },
  unreadBadge: {
     position: 'absolute', right: 16, top: '50%', marginTop: 2, width: 18, height: 18,
     borderRadius: 9, backgroundColor: '#DC1F26', alignItems: 'center', justifyContent: 'center'
  },
  unreadBadgeText: {
     fontFamily: FontFamily.bold, fontSize: 10, color: '#FFFFFF'
  },

  emptyWrap: {
     flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10, paddingBottom: 80,
  },
  emptyTitle: {
     fontFamily: FontFamily.bold, fontSize: 14, color: '#FFFFFF', textAlign: 'center',
  },
  emptySub: {
     fontFamily: FontFamily.regular, fontSize: 12, color: '#A0A0AB', textAlign: 'center', lineHeight: 18,
  },

  // Detail View
  detailHeader: {
     flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16,
     borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 16
  },
  backBtn: {
     width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)',
     borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center'
  },
  detailHeaderCenter: {
     flex: 1, paddingLeft: 12,
  },
  detailAvatarWrap: {
     flexDirection: 'row', alignItems: 'center', gap: 12
  },
  detailName: {
     fontFamily: FontFamily.bold, fontSize: 16, color: '#FFFFFF', marginRight: 8
  },
  tagHotInline: {
     backgroundColor: 'rgba(220,31,38,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  tagHotTextInline: {
     fontFamily: FontFamily.bold, fontSize: 8, color: '#DC1F26'
  },
  detailVehicle: {
     fontFamily: FontFamily.regular, fontSize: 12, color: '#606070', marginTop: 2
  },
  chatScroll: {
     flex: 1,
  },
  chatContent: {
     paddingHorizontal: 20, paddingBottom: 20,
  },

  listingCard: {
     flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 12, borderWidth: 1,
     borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#111116', marginBottom: 16,
  },
  listingThumb: {
     width: 52, height: 52, borderRadius: 10, backgroundColor: '#1C1C24',
  },
  listingThumbFallback: {
     alignItems: 'center', justifyContent: 'center',
  },
  listingTitle: {
     fontFamily: FontFamily.bold, fontSize: 13, color: '#FFFFFF',
  },
  listingPrice: {
     fontFamily: FontFamily.semiBold, fontSize: 12, color: '#DC1F26', marginTop: 2,
  },

  metaRow: {
     flexDirection: 'row', gap: 8, marginBottom: 24,
  },
  metaChip: {
     flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6,
     borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  metaChipText: {
     fontFamily: FontFamily.medium, fontSize: 11, color: '#A0A0AB',
  },

  sectionLabel: {
     fontFamily: FontFamily.bold, fontSize: 10, color: '#606070', letterSpacing: 1.5, marginBottom: 10,
  },

  contactCard: {
     borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#111116',
     marginBottom: 24, overflow: 'hidden',
  },
  contactRow: {
     flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14,
     borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  contactIconWrap: {
     width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  contactText: {
     flex: 1, fontFamily: FontFamily.semiBold, fontSize: 13, color: '#FFFFFF',
  },
  emptyMutedText: {
     fontFamily: FontFamily.regular, fontSize: 12, color: '#606070', padding: 16, textAlign: 'center',
  },

  notesInput: {
     minHeight: 100, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
     backgroundColor: '#111116', color: '#FFFFFF', fontFamily: FontFamily.regular, fontSize: 13,
     padding: 14, lineHeight: 20,
  },
  saveNotesBtn: {
     flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10,
     height: 40, borderRadius: 12, backgroundColor: '#DC1F26',
  },
  saveNotesBtnText: {
     fontFamily: FontFamily.bold, fontSize: 13, color: '#FFFFFF',
  },

  statusBarWrap: {
     backgroundColor: '#111116', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 14,
  },
  statusBarLabel: {
     fontFamily: FontFamily.bold, fontSize: 9, color: '#606070', letterSpacing: 1.5, marginBottom: 10, marginLeft: 16,
  },
  statusChip: {
     height: 36, paddingHorizontal: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
     backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statusChipText: {
     fontFamily: FontFamily.bold, fontSize: 12, color: '#A0A0AB',
  },
});
