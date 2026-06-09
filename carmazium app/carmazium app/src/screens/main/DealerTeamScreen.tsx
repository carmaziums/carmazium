import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../lib/apiClient';
import { PrimaryCTA } from '../../components/PrimaryCTA';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  user: { id: string; firstName?: string; lastName?: string; email: string };
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
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
    text: '#F59E0B',
  },
  SALES_AGENT: {
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.25)',
    text: '#3B82F6',
  },
  FINANCE_MANAGER: {
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.25)',
    text: '#22C55E',
  },
};

const getRoleColor = (role: string) =>
  ROLE_COLORS[role] ?? {
    bg: 'rgba(160,160,171,0.12)',
    border: 'rgba(160,160,171,0.2)',
    text: '#A0A0AB',
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
          : { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' },
      ]}
      onPress={onSelect}
      activeOpacity={0.75}
    >
      <Text
        style={[
          styles.rolePillText,
          { color: selected ? c.text : '#606070' },
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
  onRemove: () => void;
}

const StaffCard: React.FC<StaffCardProps> = ({ member, removing, onRemove }) => {
  const role = getRoleColor(member.role);
  const initials = getInitials(member);
  const displayName = getDisplayName(member);

  return (
    <View style={styles.staffCard}>
      {/* Avatar */}
      <LinearGradient
        colors={['#2d3c63', '#1a2238']}
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
        onPress={onRemove}
        activeOpacity={0.7}
        disabled={removing}
      >
        {removing ? (
          <ActivityIndicator size="small" color="#EF4444" />
        ) : (
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        )}
      </TouchableOpacity>
    </View>
  );
};

// ─── Main screen ─────────────────────────────────────────────────────────────

export const DealerTeamScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('SALES_AGENT');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);

  // ── Fetch staff ─────────────────────────────────────────────────────────────
  const fetchStaff = async () => {
    try {
      const res = await apiClient<{ success: boolean; data: StaffMember[] }>('/dealers/staff');
      if (res.success) setStaff(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
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
  const handleRemove = (member: StaffMember) => {
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
  };

  // ── Render empty state ──────────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={36} color="#5C5C6B" />
      <Text style={styles.emptyTitle}>No team members yet</Text>
      <Text style={styles.emptySub}>Invite staff to manage your dealership</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background gradient */}
      <LinearGradient
        colors={['rgba(220,31,38,0.03)', 'rgba(0,0,0,0)', '#0A0A0C']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      {/* Status bar spacer */}
      <View style={{ height: insets.top }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Team</Text>

        <TouchableOpacity
          style={styles.inviteBtn}
          onPress={() => setInviteModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
        </TouchableOpacity>
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
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#DC1F26" />
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
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <StaffCard
              member={item}
              removing={removeLoading === item.id}
              onRemove={() => handleRemove(item)}
            />
          )}
        />
      )}

      {/* ── INVITE MODAL ─────────────────────────────────────────────────── */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => !inviteLoading && setInviteModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalSheet}
            activeOpacity={1}
            onPress={() => {}}
          >
            {/* Handle */}
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>Invite Team Member</Text>

            {/* Email field */}
            <Text style={styles.fieldLabel}>EMAIL ADDRESS *</Text>
            <View style={styles.emailInputWrap}>
              <Ionicons
                name="mail-outline"
                size={18}
                color="#5C5C6B"
                style={{ marginRight: 10 }}
              />
              <TextInput
                style={styles.emailInput}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="colleague@dealership.co.uk"
                placeholderTextColor="#5C5C6B"
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

            {/* Bottom safe area spacer */}
            <View style={{ height: insets.bottom }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  inviteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Summary row
  summaryRow: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#111115',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  summaryLeft: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#A0A0AB',
    letterSpacing: 0.5,
  },
  summaryCount: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  summaryRight: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#A0A0AB',
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
    backgroundColor: '#111115',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    fontSize: 14,
    color: '#FFFFFF',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  staffEmail: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#A0A0AB',
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
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
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
    fontSize: 16,
    color: '#A0A0AB',
    marginTop: 4,
  },
  emptySub: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#5C5C6B',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#111115',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  fieldLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#A0A0AB',
    letterSpacing: 1,
    marginBottom: 8,
  },
  emailInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0C',
    borderWidth: 1,
    borderColor: '#2A2A32',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  emailInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: '#FFFFFF',
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
    fontSize: 12,
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
    fontSize: 14,
    color: '#5C5C6B',
  },
});
