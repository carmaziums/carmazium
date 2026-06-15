import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../lib/apiClient';
import { startAddressVerification, confirmAddressVerification } from '../../lib/addressVerificationApi';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { GlobalToastContext } from '../../components/GlobalToastProvider';

interface WatchlistCountResponse {
  success: boolean;
  data: { count: number };
}

interface ListingStatsResponse {
  success: boolean;
  data: { activeListings: number; totalViews: number; offersReceived: number };
}

// Dynamic Sub-components & Modals
export const ProfileScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, logout, role, initializeAuth } = useAuthStore();
  const { showToast } = useContext(GlobalToastContext);

  // Profile Information States — derived from real auth store
  const displayName = user
    ? `${user.firstName || ''}${user.lastName ? ' ' + user.lastName : ''}`.trim() || user.email
    : 'User';
  const displayEmail = user?.email || '';

  const [profileName, setProfileName] = useState(displayName);
  const [profileEmail, setProfileEmail] = useState(displayEmail);

  useEffect(() => {
    setProfileName(
      user
        ? `${user.firstName || ''}${user.lastName ? ' ' + user.lastName : ''}`.trim() || user.email
        : (role === 'dealer' ? 'Knightsbridge Motors' : 'User')
    );
    setProfileEmail(user?.email || '');
  }, [user, role]);

  // Interactive States
  const isAddressVerified = !!user?.isAddressVerified;
  const [paymentMethod, setPaymentMethod] = useState('Visa - 4287');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Stats States
  const [purchasedCount] = useState(0);
  const [soldCount, setSoldCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch real stats on mount
  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      try {
        const [watchlistRes, statsRes] = await Promise.allSettled([
          apiClient<WatchlistCountResponse>('/watchlist/count'),
          apiClient<ListingStatsResponse>('/listings/stats'),
        ]);

        if (!mounted) return;

        if (watchlistRes.status === 'fulfilled' && watchlistRes.value?.success) {
          setSavedCount(watchlistRes.value.data?.count ?? 0);
        }
        if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
          setSoldCount(statsRes.value.data?.activeListings ?? 0);
        }
      } catch {
        // Silently fail — keep zeros
      } finally {
        if (mounted) setStatsLoading(false);
      }
    };
    fetchStats();
    return () => { mounted = false; };
  }, []);

  // Active Modals
  const [activeModal, setActiveModal] = useState<
    'settings' | 'verify' | 'payment' | 'help' | null
  >(null);

  // Address Verification Flow State — real two-step flow: confirm address (emails a code), then enter the emailed code
  const [verifyStage, setVerifyStage] = useState<'address' | 'code'>('address');
  const [verifyAddressInput, setVerifyAddressInput] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifySending, setVerifySending] = useState(false);
  const [verifyConfirming, setVerifyConfirming] = useState(false);

  // Support Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: 'user' | 'agent'; text: string }>>([
    { id: '1', sender: 'agent', text: `Hi${user?.firstName ? ' ' + user.firstName : ''}! How can we help you with your listings or purchases today?` },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Dynamic Handlers
  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleStatPress = (type: 'purchased' | 'sold' | 'saved') => {
    if (type === 'saved') {
      showToast('Navigating to Watchlist', 'info');
      if (navigation) {
        navigation.navigate('Tabs', { screen: 'Saved' });
      } else {
        Alert.alert('Saved Vehicles', `You have ${savedCount} vehicle${savedCount !== 1 ? 's' : ''} saved. Navigate to the Saved tab in the footer to view them.`);
      }
    } else if (type === 'purchased') {
      Alert.alert(
        'Purchased Vehicles',
        'You have not purchased any vehicles yet. Explore active auctions under the Live or Search tabs!'
      );
    } else {
      if (navigation) navigation.navigate('SellerDashboard');
    }
  };

  const handleSendVerificationCode = async () => {
    const address = verifyAddressInput.trim();
    if (address.length < 5) {
      Alert.alert('Enter Address', 'Please enter your full residential address to continue.');
      return;
    }
    setVerifySending(true);
    try {
      const result = await startAddressVerification(address);
      setVerificationCode('');
      setVerifyStage('code');
      showToast(result.message || 'Verification code sent to your email', 'success');
    } catch (err: any) {
      Alert.alert('Could Not Send Code', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setVerifySending(false);
    }
  };

  const handleConfirmVerificationCode = async () => {
    if (verificationCode.trim().length !== 6) {
      Alert.alert('Enter Code', 'Please enter the 6-digit code we emailed you.');
      return;
    }
    setVerifyConfirming(true);
    try {
      await confirmAddressVerification(verificationCode.trim());
      await initializeAuth();
      setActiveModal(null);
      showToast('Address verified! Verified Trader badge unlocked.', 'success');
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message || 'Incorrect or expired code. Please try again.');
    } finally {
      setVerifyConfirming(false);
    }
  };

  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;
    const userMsg = { id: Date.now().toString(), sender: 'user' as const, text: chatInput };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setSendingMessage(true);

    setTimeout(() => {
      setSendingMessage(false);
      const agentMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'agent' as const,
        text: 'Thanks for reaching out! Our Support Agent is reviewing your query and will reply within 5 minutes.',
      };
      setChatMessages((prev) => [...prev, agentMsg]);
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background gradient with top glow matching the target style */}
      <LinearGradient
        colors={['rgba(220, 31, 38, 0.04)', 'rgba(59, 130, 246, 0.04)', '#0A0A0C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <TouchableOpacity
            style={styles.settingsHeaderBtn}
            activeOpacity={0.7}
            onPress={() => setActiveModal('settings')}
          >
            <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarTextLarge}>
                {profileName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()}
              </Text>
            </View>
            <View style={styles.checkmarkBadge}>
              <Ionicons name="checkmark-sharp" size={10} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profileName}</Text>
            <Text style={styles.profileEmail}>{profileEmail}</Text>
            <TouchableOpacity
              style={[
                styles.verifiedBuyerBadge,
                role === 'dealer' && styles.verifiedDealerBadge,
                role === 'seller' && styles.verifiedSellerBadge,
              ]}
              activeOpacity={0.8}
              onPress={() => {
                if (role === 'dealer') {
                  Alert.alert(
                    'Verified Dealer status',
                    'Your dealership credentials have been fully verified and approved by Carmazium commercial operations.'
                  );
                } else if (role === 'seller') {
                  Alert.alert(
                    'Verified Seller status',
                    'Your identity has been verified. You can list vehicles and receive offers from buyers.'
                  );
                } else {
                  Alert.alert(
                    'Verified Buyer status',
                    'Your identity has been fully verified and approved by Carmazium compliance.'
                  );
                }
              }}
            >
              <Ionicons
                name="checkmark-circle-sharp"
                size={12}
                color={role === 'dealer' ? '#F59E0B' : role === 'seller' ? '#3B82F6' : '#22C55E'}
              />
              <Text style={[
                styles.verifiedBuyerText,
                role === 'dealer' && styles.verifiedDealerText,
                role === 'seller' && styles.verifiedSellerText,
              ]}>
                {role === 'dealer' ? 'VERIFIED DEALER' : role === 'seller' ? 'VERIFIED SELLER' : 'VERIFIED BUYER'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsCardContainer}>
          <TouchableOpacity
            style={styles.statCol}
            activeOpacity={0.7}
            onPress={() => handleStatPress('purchased')}
          >
            <Text style={styles.statNumber}>{purchasedCount}</Text>
            <Text style={styles.statSubText}>PURCHASED</Text>
          </TouchableOpacity>

          <View style={styles.statDivider} />

          <TouchableOpacity
            style={styles.statCol}
            activeOpacity={0.7}
            onPress={() => handleStatPress('sold')}
          >
            {statsLoading ? (
              <ActivityIndicator size="small" color={Colors.textMuted} />
            ) : (
              <Text style={styles.statNumber}>{soldCount}</Text>
            )}
            <Text style={styles.statSubText}>ACTIVE</Text>
          </TouchableOpacity>

          <View style={styles.statDivider} />

          <TouchableOpacity
            style={styles.statCol}
            activeOpacity={0.7}
            onPress={() => handleStatPress('saved')}
          >
            {statsLoading ? (
              <ActivityIndicator size="small" color={Colors.textMuted} />
            ) : (
              <Text style={styles.statNumber}>{savedCount}</Text>
            )}
            <Text style={styles.statSubText}>SAVED</Text>
          </TouchableOpacity>
        </View>

        {/* Trader Verification Card */}
        <View style={[styles.verificationCard, { borderLeftColor: isAddressVerified ? '#22C55E' : '#DC1F26' }]}>
          <View style={styles.verificationHeader}>
            <View
              style={[
                styles.verificationIconBg,
                { backgroundColor: isAddressVerified ? 'rgba(34, 197, 94, 0.12)' : 'rgba(220, 31, 38, 0.12)' }
              ]}
            >
              <Ionicons
                name={isAddressVerified ? 'shield-checkmark' : 'shield-outline'}
                size={18}
                color={isAddressVerified ? '#22C55E' : '#DC1F26'}
              />
            </View>
            <View style={styles.verificationTitleCol}>
              <Text style={styles.verificationTitle}>Trader verification</Text>
              <Text
                style={[
                  styles.verificationProgressText,
                  { color: isAddressVerified ? '#22C55E' : '#DC1F26' },
                ]}
              >
                {isAddressVerified ? 'Verified' : 'Not verified'}
              </Text>
            </View>
          </View>

          <Text style={styles.verificationSubtext}>
            {isAddressVerified
              ? 'Address verified! Your account now shows a Verified Trader badge to buyers and sellers.'
              : 'Verify your address to earn a Verified Trader badge and build trust with buyers and sellers.'}
          </Text>

          {!isAddressVerified ? (
            <TouchableOpacity
              style={styles.verifyBtn}
              activeOpacity={0.8}
              onPress={() => {
                setVerifyStage('address');
                setVerifyAddressInput(user?.location || '');
                setVerificationCode('');
                setActiveModal('verify');
              }}
            >
              <Text style={styles.verifyBtnText}>VERIFY ADDRESS</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.verifySuccessBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <Text style={styles.verifySuccessBadgeText}>FULLY VERIFIED</Text>
            </View>
          )}
        </View>

        {/* Options List Settings */}
        <View style={styles.settingsList}>
          {/* Payment Methods */}
          <TouchableOpacity
            style={styles.settingsRow}
            activeOpacity={0.7}
            onPress={() => setActiveModal('payment')}
          >
            <View style={styles.rowIconBg}>
              <Ionicons name="card-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.rowLabel}>Payment methods</Text>
            <Text style={styles.rowValue}>{paymentMethod}</Text>
          </TouchableOpacity>

          {/* My Listings */}
          <TouchableOpacity
            style={styles.settingsRow}
            activeOpacity={0.7}
            onPress={() => navigation?.navigate('SellerDashboard')}
          >
            <View style={styles.rowIconBg}>
              <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.rowLabel}>My listings</Text>
            <Text style={styles.rowValue}>{statsLoading ? '…' : `${soldCount} Active`}</Text>
          </TouchableOpacity>

          {/* My Sent Offers */}
          <TouchableOpacity
            style={styles.settingsRow}
            activeOpacity={0.7}
            onPress={() => navigation?.navigate('BuyerOffers')}
          >
            <View style={styles.rowIconBg}>
              <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.rowLabel}>My sent offers</Text>
          </TouchableOpacity>

          {/* Notifications Toggle */}
          <TouchableOpacity
            style={styles.settingsRow}
            activeOpacity={0.7}
            onPress={() => {
              const newState = !notificationsEnabled;
              setNotificationsEnabled(newState);
              showToast(`Notifications turned ${newState ? 'On' : 'Off'}`, 'info');
            }}
          >
            <View style={styles.rowIconBg}>
              <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.rowLabel}>Notifications</Text>
            <Text style={styles.rowValue}>{notificationsEnabled ? 'On' : 'Off'}</Text>
          </TouchableOpacity>

          {/* Help & Support */}
          <TouchableOpacity
            style={styles.settingsRow}
            activeOpacity={0.7}
            onPress={() => setActiveModal('help')}
          >
            <View style={styles.rowIconBg}>
              <Ionicons name="help-circle-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.rowLabel}>Help & support</Text>
          </TouchableOpacity>

          {/* Sign Out */}
          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={handleLogout}
          >
            <View style={[styles.rowIconBg, { backgroundColor: 'rgba(220, 31, 38, 0.1)' }]}>
              <Ionicons name="log-out-outline" size={18} color="#DC1F26" />
            </View>
            <Text style={[styles.rowLabel, { color: '#DC1F26' }]}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ================= MODAL SHEETS ================= */}

      {/* Settings & Profile Edit Modal */}
      <Modal
        visible={activeModal === 'settings'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                value={profileName}
                onChangeText={setProfileName}
                placeholder="Enter name"
                placeholderTextColor="#5C5C6B"
              />

              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.textInput}
                value={profileEmail}
                onChangeText={setProfileEmail}
                placeholder="Enter email"
                placeholderTextColor="#5C5C6B"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.settingsActions}>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={() => {
                    setActiveModal(null);
                    showToast('Profile updated!', 'success');
                  }}
                >
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Address Verification Stepper Modal */}
      <Modal
        visible={activeModal === 'verify'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trader Verification (Step {verifyStage === 'address' ? 1 : 2}/2)</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {verifyStage === 'address' && (
                <View>
                  <Text style={styles.verifyStepTitle}>Confirm Your Address</Text>
                  <Text style={styles.verifyStepSub}>
                    Enter your current residential address. We'll email a 6-digit verification code to {user?.email || 'your account email'}.
                  </Text>

                  <TextInput
                    style={[styles.textInput, { height: 72, paddingTop: 12, textAlignVertical: 'top' }]}
                    value={verifyAddressInput}
                    onChangeText={setVerifyAddressInput}
                    placeholder="Enter your full address"
                    placeholderTextColor="#5C5C6B"
                    autoCapitalize="words"
                    multiline
                  />

                  <TouchableOpacity
                    style={[styles.verifyStepBtn, verifySending && { opacity: 0.6 }]}
                    onPress={handleSendVerificationCode}
                    disabled={verifySending}
                  >
                    {verifySending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.verifyStepBtnText}>SEND VERIFICATION CODE</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {verifyStage === 'code' && (
                <View>
                  <Text style={styles.verifyStepTitle}>Enter Verification Code</Text>
                  <Text style={styles.verifyStepSub}>
                    We've emailed a 6-digit code to {user?.email || 'your account email'}. Enter it below to verify {verifyAddressInput.trim()}.
                  </Text>

                  <TextInput
                    style={styles.textInput}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor="#5C5C6B"
                    keyboardType="number-pad"
                    maxLength={6}
                  />

                  <TouchableOpacity
                    style={[styles.verifyStepBtn, verifyConfirming && { opacity: 0.6 }]}
                    onPress={handleConfirmVerificationCode}
                    disabled={verifyConfirming}
                  >
                    {verifyConfirming ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.verifyStepBtnText}>CONFIRM & VERIFY</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendLink}
                    onPress={() => setVerifyStage('address')}
                  >
                    <Text style={styles.resendLinkText}>Wrong address? Go back</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Methods Modal */}
      <Modal
        visible={activeModal === 'payment'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Payment Method</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'Visa - 4287' && styles.paymentOptionActive,
                ]}
                onPress={() => {
                  setPaymentMethod('Visa - 4287');
                  setActiveModal(null);
                  showToast('Payment method updated', 'success');
                }}
              >
                <Ionicons name="card-outline" size={24} color="#FFFFFF" />
                <Text style={styles.paymentOptionText}>Visa ending in 4287</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'Mastercard - 8812' && styles.paymentOptionActive,
                ]}
                onPress={() => {
                  setPaymentMethod('Mastercard - 8812');
                  setActiveModal(null);
                  showToast('Payment method updated', 'success');
                }}
              >
                <Ionicons name="card" size={24} color="#FFFFFF" />
                <Text style={styles.paymentOptionText}>Mastercard ending in 8812</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'Apple Pay' && styles.paymentOptionActive,
                ]}
                onPress={() => {
                  setPaymentMethod('Apple Pay');
                  setActiveModal(null);
                  showToast('Payment method updated', 'success');
                }}
              >
                <Ionicons name="logo-apple" size={24} color="#FFFFFF" />
                <Text style={styles.paymentOptionText}>Apple Pay Express</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Help & Support Modal */}
      <Modal
        visible={activeModal === 'help'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Carmazium Help & Chat</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalChatBody}>
              <FlatList
                data={chatMessages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.chatList}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.chatBubble,
                      item.sender === 'user' ? styles.chatBubbleUser : styles.chatBubbleAgent,
                    ]}
                  >
                    <Text style={styles.chatText}>{item.text}</Text>
                  </View>
                )}
              />

              {sendingMessage && (
                <View style={styles.typingIndicator}>
                  <ActivityIndicator size="small" color="#DC1F26" />
                  <Text style={styles.typingText}>Agent is typing...</Text>
                </View>
              )}

              <View style={styles.chatInputRow}>
                <TextInput
                  style={styles.chatInput}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Ask a question..."
                  placeholderTextColor="#5C5C6B"
                />
                <TouchableOpacity style={styles.sendChatBtn} onPress={handleSendChatMessage}>
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
  scroll: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize['3xl'],
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },
  settingsHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    marginHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatarLarge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#DC1F26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextLarge: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: '#FFFFFF',
  },
  checkmarkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.bgSecondary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  profileEmail: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#A0A0AB',
    marginBottom: 8,
  },
  verifiedBuyerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  verifiedBuyerText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#22C55E',
    letterSpacing: 0.5,
  },
  statsCardContainer: {
    marginHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 20,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: '#FFFFFF',
  },
  statSubText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#5C5C6B',
    marginTop: 2,
    letterSpacing: 0.8,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  verificationCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderLeftWidth: 4,
    borderLeftColor: '#DC1F26',
    marginBottom: 24,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  verificationIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  verificationTitleCol: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verificationTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  verificationProgressText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
  },
  verificationSubtext: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs + 1,
    color: '#A0A0AB',
    lineHeight: 18,
    marginBottom: 14,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  verifyBtn: {
    width: '100%',
    height: 44,
    borderRadius: 10,
    backgroundColor: '#DC1F26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs + 1,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  verifySuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  verifySuccessBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs + 1,
    color: '#22C55E',
    letterSpacing: 0.8,
  },
  settingsList: {
    marginHorizontal: 24,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  rowIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowLabel: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  rowValue: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#A0A0AB',
  },

  // Modal UI Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111115',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#FFFFFF',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: '#A0A0AB',
    marginBottom: 8,
  },
  textInput: {
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  settingsActions: {
    marginTop: 10,
  },
  saveBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#DC1F26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  verifyStepTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  verifyStepSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#A0A0AB',
    lineHeight: 20,
    marginBottom: 24,
  },
  uploadBox: {
    height: 160,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBoxText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    marginTop: 12,
  },
  uploadBoxSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#5C5C6B',
    marginTop: 4,
  },
  uploadProgress: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadProgressText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: '#A0A0AB',
    marginTop: 12,
  },
  addressOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  addressOptionSelected: {
    borderColor: '#DC1F26',
    backgroundColor: 'rgba(220,31,38,0.04)',
  },
  addressText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  verifyStepBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#DC1F26',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  verifyStepBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  resendLink: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  resendLinkText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: '#A0A0AB',
    textDecorationLine: 'underline',
  },

  // Payment Option Styles
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 12,
    gap: 16,
  },
  paymentOptionActive: {
    borderColor: '#DC1F26',
    backgroundColor: 'rgba(220,31,38,0.04)',
  },
  paymentOptionText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },

  // Help Modal Styles
  modalChatBody: {
    height: 480,
    justifyContent: 'space-between',
  },
  chatList: {
    padding: 20,
    gap: 12,
  },
  chatBubble: {
    maxWidth: '80%',
    borderRadius: 14,
    padding: 12,
  },
  chatBubbleUser: {
    backgroundColor: '#DC1F26',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  chatBubbleAgent: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  chatText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  typingText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#5C5C6B',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  chatInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    color: '#FFFFFF',
    paddingHorizontal: 16,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
  sendChatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DC1F26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedDealerBadge: {
    borderColor: 'rgba(245, 158, 11, 0.25)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  verifiedDealerText: {
    color: '#F59E0B',
  },
  verifiedSellerBadge: {
    borderColor: 'rgba(59, 130, 246, 0.25)',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  verifiedSellerText: {
    color: '#3B82F6',
  },
});

