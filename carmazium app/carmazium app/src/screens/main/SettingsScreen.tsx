import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuthStore } from '../../store/authStore';
import { FontFamily } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { GlobalToastContext } from '../../components/GlobalToastProvider';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

export const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { logout, role } = useAuthStore();
  const { showToast } = useContext(GlobalToastContext);

  // Switch Toggle States
  const [priceDropAlerts, setPriceDropAlerts] = useState(true);
  const [bidUpdates, setBidUpdates] = useState(true);
  const [newCarMatches, setNewCarMatches] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [faceId, setFaceId] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  // Dynamic Value Row States
  const [profileVisibility, setProfileVisibility] = useState('Verified buyers');
  const [connectedAccount, setConnectedAccount] = useState('Google');
  const [cardProfile, setCardProfile] = useState('Visa - 4287');
  const [financePartners, setFinancePartners] = useState('2 lenders');
  const [region, setRegion] = useState('en-UK');

  const handleToggle = (label: string, value: boolean, setter: (val: boolean) => void) => {
    setter(!value);
    showToast(`${label} ${!value ? 'enabled' : 'disabled'}`, 'success');
  };

  const handleApplyForDealer = () => {
    navigation.navigate('DealerOnboarding');
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Sign Out\n\nAre you sure you want to sign out?');
      if (confirmed) {
        logout();
        showToast('Signed out successfully', 'success');
        navigation.navigate('Tabs', { screen: 'Home' });
      }
      return;
    }

    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          logout();
          showToast('Signed out successfully', 'success');
          navigation.navigate('Tabs', { screen: 'Home' });
        },
      },
    ]);
  };

  // Dynamic Handlers
  const handleProfileVisibilityPress = () => {
    Alert.alert(
      'Profile Visibility',
      'Choose who can see your buying and bidding activity:',
      [
        { text: 'Public (Everyone)', onPress: () => { setProfileVisibility('Public'); showToast('Visibility set to Public', 'success'); } },
        { text: 'Verified buyers (Recommended)', onPress: () => { setProfileVisibility('Verified buyers'); showToast('Visibility set to Verified buyers', 'success'); } },
        { text: 'Private (Dealerships only)', onPress: () => { setProfileVisibility('Private'); showToast('Visibility set to Private', 'success'); } },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleConnectedAccountsPress = () => {
    const isGoogle = connectedAccount === 'Google';
    Alert.alert(
      'Connected Accounts',
      `Manage your connected credentials (Currently connected via: ${connectedAccount}):`,
      [
        { 
          text: isGoogle ? 'Switch to Apple Sign-In' : 'Switch to Google Sign-In', 
          onPress: () => { 
            const next = isGoogle ? 'Apple' : 'Google';
            setConnectedAccount(next); 
            showToast(`Connected via ${next}`, 'success'); 
          } 
        },
        { 
          text: 'Disconnect Account', 
          style: 'destructive',
          onPress: () => { 
            setConnectedAccount('None'); 
            showToast('Accounts disconnected', 'info'); 
          } 
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleCardsPress = () => {
    Alert.alert(
      'Manage Cards',
      `Active card: ${cardProfile}\n\nSelect a funding source or connect a new card:`,
      [
        { text: 'Visa - 4287 (Default)', onPress: () => { setCardProfile('Visa - 4287'); showToast('Primary source: Visa', 'success'); } },
        { text: 'Mastercard - 8812', onPress: () => { setCardProfile('Mastercard - 8812'); showToast('Primary source: Mastercard', 'success'); } },
        { 
          text: 'Link New Card',
          onPress: () => {
            setCardProfile('Amex - 5001');
            showToast('Added Amex card ending in 5001', 'success');
          } 
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleFinancePartnersPress = () => {
    Alert.alert(
      'Finance Pre-Approval',
      `Status: ${financePartners} Pre-Approved\n\nManage active lending options:`,
      [
        { text: 'Request Limit Increase', onPress: () => { setFinancePartners('3 lenders'); showToast('Limit increased pre-approvals', 'success'); } },
        { text: 'Clear Finance Profiles', onPress: () => { setFinancePartners('None'); showToast('Finance profiles cleared', 'info'); } },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleRegionPress = () => {
    Alert.alert(
      'Select Region',
      'Choose region settings for price formats and distance units:',
      [
        { text: 'United Kingdom (en-UK)', onPress: () => { setRegion('en-UK'); showToast('Region: United Kingdom', 'success'); } },
        { text: 'United States (en-US)', onPress: () => { setRegion('en-US'); showToast('Region: United States', 'success'); } },
        { text: 'European Union (en-EU)', onPress: () => { setRegion('en-EU'); showToast('Region: European Union', 'success'); } },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const renderSwitchRow = (title: string, subtext: string, value: boolean, setter: (val: boolean) => void) => {
    return (
      <View style={styles.row}>
        <View style={styles.rowTextContainer}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSub}>{subtext}</Text>
        </View>
        <TouchableOpacity
          style={[styles.switch, value ? styles.switchActive : styles.switchInactive]}
          onPress={() => handleToggle(title, value, setter)}
          activeOpacity={0.8}
        >
          <View style={[styles.switchThumb, value ? styles.switchThumbActive : styles.switchThumbInactive]} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderValueRow = (title: string, value: string, onPress: () => void, isWarning = false, isSuccess = false) => {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={styles.rowTitleOnly}>{title}</Text>
        <View style={styles.rowValueContainer}>
          <Text style={[
            styles.rowValueText, 
            isWarning && styles.rowValueWarning,
            isSuccess && styles.rowValueSuccess
          ]}>
            {value}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#606070" style={{ marginLeft: 6 }} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderPlainRow = (title: string, actionLabel: string, message: string) => {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => Alert.alert(actionLabel, message)}
        activeOpacity={0.7}
      >
        <Text style={styles.rowTitleOnly}>{title}</Text>
        <Ionicons name="chevron-forward" size={14} color="#606070" />
      </TouchableOpacity>
    );
  };

  const renderNavRow = (title: string, screenName: 'HowItWorks' | 'Services' | 'Terms') => {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate(screenName)}
        activeOpacity={0.7}
      >
        <Text style={styles.rowTitleOnly}>{title}</Text>
        <Ionicons name="chevron-forward" size={14} color="#606070" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Glow gradient background */}
      <LinearGradient
        colors={['rgba(220, 31, 38, 0.03)', 'rgba(59, 130, 246, 0.03)', '#0A0A0C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Screen Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.title}>Settings</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* GROUP 1: NOTIFICATIONS */}
        <View style={styles.group}>
          <View style={styles.groupHeader}>
            <Ionicons name="notifications-outline" size={12} color="#DC1F26" style={{ marginRight: 6 }} />
            <Text style={styles.groupLabel}>NOTIFICATIONS</Text>
          </View>
          <View style={styles.card}>
            {renderSwitchRow('Price drop alerts', 'Saved cars only', priceDropAlerts, setPriceDropAlerts)}
            <View style={styles.divider} />
            {renderSwitchRow('Bid updates', "When you're outbid", bidUpdates, setBidUpdates)}
            <View style={styles.divider} />
            {renderSwitchRow('New car matches', 'From saved searches', newCarMatches, setNewCarMatches)}
            <View style={styles.divider} />
            {renderSwitchRow('Marketing emails', 'Offers and news', marketingEmails, setMarketingEmails)}
          </View>
        </View>

        {/* GROUP 2: PRIVACY */}
        <View style={styles.group}>
          <View style={styles.groupHeader}>
            <Ionicons name="shield-outline" size={12} color="#DC1F26" style={{ marginRight: 6 }} />
            <Text style={styles.groupLabel}>PRIVACY</Text>
          </View>
          <View style={styles.card}>
            {renderValueRow('Profile visibility', profileVisibility, handleProfileVisibilityPress)}
            <View style={styles.divider} />
            {renderPlainRow('Data & download', 'Data & Downloads', 'Request an archive download of all your submitted offers, watchlists and auction bid histories.')}
            <View style={styles.divider} />
            {renderValueRow('Connected accounts', connectedAccount, handleConnectedAccountsPress)}
          </View>
        </View>

        {/* GROUP: ACCOUNT TYPE */}
        <View style={styles.group}>
          <View style={styles.groupHeader}>
            <Ionicons name="person-circle-outline" size={12} color="#DC1F26" style={{ marginRight: 6 }} />
            <Text style={styles.groupLabel}>ACCOUNT TYPE</Text>
          </View>
          <View style={styles.card}>
            {role === 'dealer'
              ? renderValueRow('Account type', 'Verified dealer', () => navigation.navigate('DealerOnboarding'), true, false)
              : renderValueRow(
                  'Apply for dealer account',
                  role === 'seller' ? 'Verified seller' : 'Verified buyer',
                  handleApplyForDealer,
                  false,
                  true
                )
            }
          </View>
        </View>

        {/* GROUP 3: PAYMENT */}
        <View style={styles.group}>
          <View style={styles.groupHeader}>
            <Ionicons name="card-outline" size={12} color="#DC1F26" style={{ marginRight: 6 }} />
            <Text style={styles.groupLabel}>PAYMENT</Text>
          </View>
          <View style={styles.card}>
            {renderValueRow('Cards', cardProfile, handleCardsPress)}
            <View style={styles.divider} />
            {renderValueRow('Finance partners', financePartners, handleFinancePartnersPress)}
          </View>
        </View>

        {/* GROUP 4: APP */}
        <View style={styles.group}>
          <View style={styles.groupHeader}>
            <Ionicons name="phone-portrait-outline" size={12} color="#DC1F26" style={{ marginRight: 6 }} />
            <Text style={styles.groupLabel}>APP</Text>
          </View>
          <View style={styles.card}>
            {renderSwitchRow('Face ID', 'Sign-in & confirm bids', faceId, setFaceId)}
            <View style={styles.divider} />
            {renderSwitchRow('Haptic feedback', 'Subtle taps', hapticFeedback, setHapticFeedback)}
            <View style={styles.divider} />
            {renderValueRow('Region', region, handleRegionPress)}
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowTitleOnly}>App version</Text>
              <Text style={styles.versionValue}>2.4.1</Text>
            </View>
          </View>
        </View>

        {/* GROUP 5: ABOUT & LEGAL */}
        <View style={styles.group}>
          <View style={styles.groupHeader}>
            <Ionicons name="information-circle-outline" size={12} color="#DC1F26" style={{ marginRight: 6 }} />
            <Text style={styles.groupLabel}>ABOUT & LEGAL</Text>
          </View>
          <View style={styles.card}>
            {renderNavRow('How it works', 'HowItWorks')}
            <View style={styles.divider} />
            {renderNavRow('Services', 'Services')}
            <View style={styles.divider} />
            {renderNavRow('Terms & Conditions', 'Terms')}
          </View>
        </View>

        {/* SIGN OUT CTA CARD */}
        <TouchableOpacity
          style={styles.signOutCard}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color="#DC1F26" style={{ marginRight: 10 }} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
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
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  group: {
    marginBottom: 24,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: 4,
  },
  groupLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#606070',
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: '#111116',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  rowSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#606070',
  },
  rowTitleOnly: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  rowValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValueText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#A0A0AB',
  },
  rowValueWarning: {
    color: '#F59E0B',
  },
  rowValueSuccess: {
    color: '#22C55E',
  },
  versionValue: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#606070',
  },
  // Switch Toggle Styles
  switch: {
    width: 38,
    height: 20,
    borderRadius: 10,
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: '#DC1F26',
  },
  switchInactive: {
    backgroundColor: '#2A2A32',
  },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  switchThumbInactive: {
    alignSelf: 'flex-start',
  },
  // Sign out card styles
  signOutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1115',
    borderWidth: 1,
    borderColor: '#3B1A22',
    borderRadius: 16,
    height: 48,
  },
  signOutText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#DC1F26',
    letterSpacing: 0.5,
  },
});
