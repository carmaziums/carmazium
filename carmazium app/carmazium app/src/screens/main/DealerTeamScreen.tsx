import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  StatusBar,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../lib/apiClient';
import { PrimaryCTA } from '../../components/PrimaryCTA';
import { BottomSheet } from '../../components/BottomSheet';
import { Colors } from '../../constants/colors';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  getPartnerTeam,
  updatePartnerTeamPermissions,
  type PartnerTeam,
  type TradeTeamPermissionInput,
} from '../../lib/servicesApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  user: { id: string; firstName?: string; lastName?: string; email: string };
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

type InviteRole = 'SALES_AGENT' | 'ADMIN' | 'FINANCE_MANAGER';

// ─── Role helpers ─────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  SALES_AGENT: 'Sales Agent',
  FINANCE_MANAGER: 'Finance Manager',
};

const ROLE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  ADMIN: {
    bg: Colors.warningAlpha12,
    border: Colors.warningAlpha25,
    text: Colors.warning,
  },
  SALES_AGENT: {
    bg: Colors.infoBlueAlpha12,
    border: Colors.infoBlueAlpha25,
    text: Colors.infoBlue,
  },
  FINANCE_MANAGER: {
    bg: Colors.successAlpha12,
    border: Colors.successAlpha25,
    text: Colors.success,
  },
};

const getRoleColor = (role: string) =>
  ROLE_COLORS[role] ?? {
    bg: 'rgba(160,160,171,0.12)',
    border: Colors.textSecondaryAlpha20,
    text: Colors.textSecondary,
  };

const getInitials = (member: StaffMember): string => {
  const first = member.user.firstName?.[0] ?? '';
  const last = member.user.lastName?.[0] ?? '';
  if (first || last) return `${first}${last}`.toUpperCase();
  return member.user.email.slice(0, 2).toUpperCase();
};

const getDisplayName = (member: StaffMember): string => {
  const parts = [member.user.firstName, member.user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : member.user.email;
};

const blankTradeDraft = (email: string): TradeTeamPermissionInput => ({
  email: email.trim().toLowerCase(),
  deliveryEnabled: false,
  inspectionEnabled: false,
  canView: false,
  canChat: false,
  canQuote: false,
  canManage: false,
  canComplete: false,
});

// ─── Invite role pill ─────────────────────────────────────────────────────────

interface RolePillProps {
  role: InviteRole;
  label: string;
  selected: boolean;
  onSelect: () => void;
  colorKey: string;
}

const RolePill: React.FC<RolePillProps> = ({ label, selected, onSelect, colorKey }) => {
  const c = getRoleColor(colorKey);
  return (
    <TouchableOpacity
      style={[
        styles.rolePill,
        selected
          ? { backgroundColor: c.bg, borderColor: c.border }
          : { backgroundColor: Colors.whiteAlpha03, borderColor: Colors.whiteAlpha08 },
      ]}
      onPress={onSelect}
      activeOpacity={0.75}
    >
      <Text
        style={[
          styles.rolePillText,
          { color: selected ? c.text : Colors.iconMuted },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// ─── Staff card ───────────────────────────────────────────────────────────────

interface StaffCardProps {
  member: StaffMember;
  removing: boolean;
  onRemove: (id: string) => void;
}

// Hoisted + memoized so FlatList only re-renders the row whose props actually
// changed, instead of recreating this JSX inline in renderItem on every
// parent re-render (mobile-audit.md P3/P4). onRemove takes the id rather than
// closing over `member` so its identity stays stable across rows.
const StaffCard: React.FC<StaffCardProps> = React.memo(({ member, removing, onRemove }) => {
  const role = getRoleColor(member.role);
  const initials = getInitials(member);
  const displayName = getDisplayName(member);

  return (
    <View style={styles.staffCard}>
      {/* Avatar */}
      <LinearGradient
        colors={[Colors.darkBlue_2d3c63, Colors.darkBlue_1a2238]}
        style={styles.avatar}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.avatarText}>{initials}</Text>
      </LinearGradient>

      {/* Info */}
      <View style={styles.staffInfo}>
        <Text style={styles.staffName} numberOfLines={1}>
          {displayName}
        </Text>
        {member.user.firstName || member.user.lastName ? (
          <Text style={styles.staffEmail} numberOfLines={1}>
            {member.user.email}
          </Text>
        ) : null}
        <View
          style={[
            styles.roleChip,
            { backgroundColor: role.bg, borderColor: role.border },
          ]}
        >
          <Text style={[styles.roleChipText, { color: role.text }]}>
            {ROLE_LABELS[member.role] ?? member.role}
          </Text>
        </View>
      </View>

      {/* Remove */}
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => onRemove(member.id)}
        activeOpacity={0.7}
        disabled={removing}
        accessibilityLabel={`Remove ${displayName} from team`}
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {removing ? (
          <ActivityIndicator size="small" color={Colors.error} />
        ) : (
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
        )}
      </TouchableOpacity>
    </View>
  );
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export const DealerTeamScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('SALES_AGENT');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);
  const [tradeTeam, setTradeTeam] = useState<PartnerTeam | null>(null);
  const [tradeDrafts, setTradeDrafts] = useState<Record<string, TradeTeamPermissionInput>>({});
  const [tradeSaving, setTradeSaving] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);

  // ── Fetch staff ─────────────────────────────────────────────────────────────
  // GET /dealers/staff returns { active: [...], pending: [...] }, not a bare
  // array — the old code here read `res.data` directly as StaffMember[], so
  // Array.isArray(res.data) was always false and the whole team list silently
  // rendered empty for every dealer, not just missing the pending-invite
  // section (confirmed against dealers.service.ts's getStaff()).
  const fetchStaff = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [res, team] = await Promise.all([
        apiClient<{ success: boolean; data: { active: StaffMember[]; pending: PendingInvite[] } }>('/dealers/staff'),
        getPartnerTeam().catch(() => null),
      ]);
      if (res.success) {
        const active = Array.isArray(res.data?.active) ? res.data.active : [];
        const pending = Array.isArray(res.data?.pending) ? res.data.pending : [];
        setStaff(active);
        setPendingInvites(pending);
        setTradeTeam(team);
        if (team) {
          const byEmail = new Map(team.permissions.map((permission) => [permission.email.toLowerCase(), permission]));
          const nextDrafts: Record<string, TradeTeamPermissionInput> = {};
          for (const person of [
            ...active.map((member) => member.user.email),
            ...pending.map((invite) => invite.email),
          ]) {
            const email = person.trim().toLowerCase();
            const existing = byEmail.get(email);
            nextDrafts[email] = existing
              ? {
                  email,
                  deliveryEnabled: existing.deliveryEnabled,
                  inspectionEnabled: existing.inspectionEnabled,
                  canView: existing.canView,
                  canChat: existing.canChat,
                  canQuote: existing.canQuote,
                  canManage: existing.canManage,
                  canComplete: existing.canComplete,
                }
              : blankTradeDraft(email);
          }
          setTradeDrafts(nextDrafts);
        }
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // ── Invite handler ──────────────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Email Required', 'Please enter an email address.');
      return;
    }
    setInviteLoading(true);
    try {
      await apiClient('/dealers/staff', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setInviteModalVisible(false);
      const sentTo = inviteEmail.trim();
      setInviteEmail('');
      setInviteRole('SALES_AGENT');
      fetchStaff();
      Alert.alert('Invite Sent', `An invitation has been sent to ${sentTo}.`);
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not send invite.');
    } finally {
      setInviteLoading(false);
    }
  };

  // ── Remove handler ──────────────────────────────────────────────────────────
  // Stable id-keyed callback (mobile-audit.md P4 pattern) so StaffCard's
  // React.memo isn't busted by a fresh closure every render — identity only
  // changes when `staff` itself changes.
  const handleRemove = useCallback((id: string) => {
    const member = staff.find((s) => s.id === id);
    if (!member) return;
    const name =
      [member.user.firstName, member.user.lastName].filter(Boolean).join(' ') ||
      member.user.email;

    Alert.alert('Remove Team Member', `Remove ${name} from your dealership?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemoveLoading(member.id);
          try {
            await apiClient(`/dealers/staff/${member.id}`, { method: 'DELETE' });
            setStaff((prev) => prev.filter((s) => s.id !== member.id));
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally {
            setRemoveLoading(null);
          }
        },
      },
    ]);
  }, [staff]);

  const renderStaffCard = useCallback(
    ({ item }: { item: StaffMember }) => (
      <StaffCard member={item} removing={removeLoading === item.id} onRemove={handleRemove} />
    ),
    [removeLoading, handleRemove],
  );

  const setTradeFlag = (
    email: string,
    field: Exclude<keyof TradeTeamPermissionInput, 'email'>,
    value: boolean,
  ) => {
    setTradeDrafts((current) => {
      const key = email.trim().toLowerCase();
      const next = { ...(current[key] ?? blankTradeDraft(key)), [field]: value };
      const hasService = next.deliveryEnabled || next.inspectionEnabled;
      if (!hasService) {
        next.canView = false;
        next.canChat = false;
        next.canQuote = false;
        next.canManage = false;
        next.canComplete = false;
      }
      if (field === 'canView' && !value) {
        next.canChat = false;
        next.canQuote = false;
        next.canManage = false;
        next.canComplete = false;
      }
      if (['canChat', 'canQuote', 'canManage', 'canComplete'].includes(field) && value) {
        next.canView = true;
      }
      return { ...current, [key]: next };
    });
  };

  const saveTradeAccess = async (email: string) => {
    const key = email.trim().toLowerCase();
    const draft = tradeDrafts[key] ?? blankTradeDraft(key);
    setTradeSaving(key);
    setTradeError(null);
    try {
      const saved = await updatePartnerTeamPermissions(draft);
      setTradeTeam((current) => current
        ? {
            ...current,
            permissions: [
              ...current.permissions.filter((permission) => permission.email.toLowerCase() !== key),
              saved,
            ],
          }
        : current);
      Alert.alert('Saved', `TradeXchange access updated for ${key}.`);
    } catch (err: any) {
      setTradeError(err?.message || 'Could not save TradeXchange permissions.');
    } finally {
      setTradeSaving(null);
    }
  };

  const renderTradeToggle = (
    email: string,
    label: string,
    field: Exclude<keyof TradeTeamPermissionInput, 'email'>,
    disabled = false,
  ) => {
    const draft = tradeDrafts[email] ?? blankTradeDraft(email);
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 }}>
        <Text style={{ color: disabled ? Colors.textMuted : Colors.textSecondary, fontFamily: FontFamily.medium, fontSize: FontSize.size12 }}>
          {label}
        </Text>
        <Switch
          value={Boolean(draft[field])}
          disabled={disabled}
          onValueChange={(value) => setTradeFlag(email, field, value)}
          trackColor={{ false: Colors.borderMuted, true: Colors.accent }}
          thumbColor={Colors.white}
        />
      </View>
    );
  };

  const renderTradeAccess = () => {
    if (!tradeTeam || (!staff.length && !pendingInvites.length)) return null;
    const people = [
      ...staff.map((member) => ({
        id: member.id,
        email: member.user.email.trim().toLowerCase(),
        name: getDisplayName(member),
        pending: false,
      })),
      ...pendingInvites.map((invite) => ({
        id: invite.id,
        email: invite.email.trim().toLowerCase(),
        name: invite.email,
        pending: true,
      })),
    ];

    return (
      <View style={{ marginTop: 26, gap: 12 }}>
        <View>
          <Text style={styles.pendingSectionTitle}>TRADEXCHANGE TEAM ACCESS</Text>
          <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.regular, fontSize: FontSize.xs, lineHeight: 18 }}>
            Match the website controls: choose Delivery/Recovery or Inspection, then grant view, chat, bid, manage and complete rights. Payouts always stay with the Partner business.
          </Text>
        </View>
        {tradeError ? (
          <Text style={{ color: Colors.error, fontFamily: FontFamily.medium, fontSize: FontSize.xs }}>{tradeError}</Text>
        ) : null}
        {people.map((person) => {
          const draft = tradeDrafts[person.email] ?? blankTradeDraft(person.email);
          const hasService = draft.deliveryEnabled || draft.inspectionEnabled;
          return (
            <View key={`trade-${person.id}`} style={[styles.pendingCard, { alignItems: 'stretch', flexDirection: 'column' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingEmail} numberOfLines={1}>{person.name}</Text>
                  <Text style={styles.pendingRole} numberOfLines={1}>{person.email}</Text>
                </View>
                {person.pending ? <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>PENDING</Text></View> : null}
              </View>
              {renderTradeToggle(person.email, 'Delivery & Recovery', 'deliveryEnabled')}
              {renderTradeToggle(person.email, 'Vehicle Inspection', 'inspectionEnabled')}
              {renderTradeToggle(person.email, 'View jobs', 'canView', !hasService)}
              {renderTradeToggle(person.email, 'Job chat', 'canChat', !hasService || !draft.canView)}
              {renderTradeToggle(person.email, 'Can bid / quote', 'canQuote', !hasService || !draft.canView)}
              {renderTradeToggle(person.email, 'Manage job', 'canManage', !hasService || !draft.canView)}
              {renderTradeToggle(person.email, 'Complete job', 'canComplete', !hasService || !draft.canView)}
              <TouchableOpacity
                style={[styles.inviteBtn, { width: '100%', borderRadius: 12, minHeight: 42, marginTop: 4 }]}
                onPress={() => saveTradeAccess(person.email)}
                disabled={tradeSaving === person.email}
                accessibilityRole="button"
              >
                {tradeSaving === person.email
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={{ color: Colors.white, fontFamily: FontFamily.bold, fontSize: FontSize.xs }}>SAVE TRADEXCHANGE ACCESS</Text>}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  // ── Render empty state ──────────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <EmptyState
        icon="people-outline"
        title="No team members yet"
        subtitle="Invite staff to manage your dealership"
      />
    </View>
  );

  // ── Pending invitations — matches web's dealer team page, which shows
  // invited-but-not-yet-accepted staff separately from active members. ──
  const renderPendingInvites = () => {
    if (pendingInvites.length === 0) return null;
    return (
      <View style={styles.pendingSection}>
        <Text style={styles.pendingSectionTitle}>PENDING INVITATIONS</Text>
        {pendingInvites.map((invite) => (
          <View key={invite.id} style={styles.pendingCard}>
            <View style={styles.pendingIconWrap}>
              <Ionicons name="mail-outline" size={16} color={Colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingEmail} numberOfLines={1}>{invite.email}</Text>
              <Text style={styles.pendingRole}>{ROLE_LABELS[invite.role] ?? invite.role}</Text>
            </View>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>AWAITING</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background gradient */}
      <LinearGradient
        colors={[Colors.accentAlpha03, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      {/* Status bar spacer */}
      <View style={{ height: insets.top }} />

      {/* Header */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />

        <Text style={styles.headerTitle}>Team</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton style={styles.inviteBtn} icon={<Ionicons name="person-add-outline" size={18} color={Colors.white} />} onPress={() => setInviteModalVisible(true)} accessibilityLabel="Invite team member" />
          <HamburgerButton />
        </View>
      </View>

      {/* Summary row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLeft}>
            <Text style={styles.summaryCount}>{staff.length}</Text> MEMBERS
          </Text>
          <Text style={styles.summaryRight}>MANAGE TEAM</Text>
        </View>
      </View>

      {/* Staff list */}
      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} w={SCREEN_WIDTH - 32} h={72} r={18} />
          ))}
        </View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            staff.length === 0 && styles.listContentEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={() => (
            <>
              {renderPendingInvites()}
              {renderTradeAccess()}
            </>
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchStaff(true)}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          renderItem={renderStaffCard}
        />
      )}

      {/* ── INVITE MODAL ─────────────────────────────────────────────────── */}
      <BottomSheet
        visible={inviteModalVisible}
        onClose={() => !inviteLoading && setInviteModalVisible(false)}
        title="Invite Team Member"
        avoidKeyboard
      >
        {/* Email field */}
        <Text style={styles.fieldLabel}>EMAIL ADDRESS *</Text>
        <View style={styles.emailInputWrap}>
          <Ionicons
            name="mail-outline"
            size={18}
            color={Colors.textMuted}
            style={{ marginRight: 10 }}
          />
          <TextInput
            style={styles.emailInput}
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="colleague@dealership.co.uk"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Role selector */}
        <Text style={[styles.fieldLabel, { marginTop: 20 }]}>ROLE *</Text>
        <View style={styles.rolePillRow}>
          <RolePill
            role="SALES_AGENT"
            label="Sales Agent"
            colorKey="SALES_AGENT"
            selected={inviteRole === 'SALES_AGENT'}
            onSelect={() => setInviteRole('SALES_AGENT')}
          />
          <RolePill
            role="ADMIN"
            label="Admin"
            colorKey="ADMIN"
            selected={inviteRole === 'ADMIN'}
            onSelect={() => setInviteRole('ADMIN')}
          />
          <RolePill
            role="FINANCE_MANAGER"
            label="Finance"
            colorKey="FINANCE_MANAGER"
            selected={inviteRole === 'FINANCE_MANAGER'}
            onSelect={() => setInviteRole('FINANCE_MANAGER')}
          />
        </View>

        {/* Send invite CTA */}
        <View style={{ marginTop: 28 }}>
          <PrimaryCTA
            label="SEND INVITE"
            onPress={handleInvite}
            isLoading={inviteLoading}
            disabled={inviteLoading}
          />
        </View>

        {/* Cancel */}
        <TouchableOpacity
          style={styles.cancelLink}
          onPress={() => {
            if (!inviteLoading) {
              setInviteModalVisible(false);
              setInviteEmail('');
              setInviteRole('SALES_AGENT');
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
    letterSpacing: -0.3,
  },
  inviteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Summary row
  summaryRow: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  summaryLeft: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  summaryCount: {
    fontFamily: FontFamily.mono,
    color: Colors.white,
    fontSize: FontSize.base,
  },
  summaryRight: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  listContentEmpty: {
    flex: 1,
  },

  // Staff card
  staffCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    flexDirection: 'row',
    padding: 14,
    gap: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    marginBottom: 2,
  },
  staffEmail: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  roleChip: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleChipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.errorAlpha08,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Loading / Empty
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  emptySub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Pending invitations
  pendingSection: {
    marginTop: 20,
    gap: 10,
  },
  pendingSectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.whiteAlpha03,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    borderStyle: 'dashed',
    padding: 14,
    marginBottom: 10,
  },
  pendingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.whiteAlpha06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingEmail: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  pendingRole: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: Colors.warningAlpha10,
    borderWidth: 1,
    borderColor: Colors.warningAlpha25,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.warning,
    letterSpacing: 0.6,
  },

  // Modal
  fieldLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  emailInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.inline,
    paddingHorizontal: 14,
    height: 52,
  },
  emailInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.white,
  },

  // Role pills
  rolePillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  rolePill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  rolePillText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    letterSpacing: 0.3,
  },

  // Cancel
  cancelLink: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 6,
  },
  cancelLinkText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size14,
    color: Colors.textMuted,
  },
});
