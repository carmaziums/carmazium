import React, { useContext, useState } from 'react';
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { GlobalToastContext } from '../../components/GlobalToastProvider';

export const DealerOnboardingScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { role, initializeAuth } = useAuthStore();
  const { showToast } = useContext(GlobalToastContext);

  // Form states — start EMPTY. These previously shipped pre-filled with fake
  // demo business details ("Knightsbridge Motors Ltd", a fake Companies House
  // number, VAT number, address & phone), so a real dealer who didn't notice
  // and clear them could submit fabricated registration data as their own.
  // Hint text now lives in `placeholder` props instead.
  const [tradingName, setTradingName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Submits the business details to the backend and advances the user into
  // verification (DealerKYCScreen). Two real backend calls:
  //   1. POST /users/elevate    — grants the DEALER role (only needed once)
  //   2. PATCH /users/dealer-profile — creates/updates the DealerProfile record
  // Previously this just did `setStep('payments')` — nothing was ever persisted.
  const handleContinue = async () => {
    const trimmedName = tradingName.trim();
    const trimmedVat = vatNumber.trim();

    if (!trimmedName || !trimmedVat) {
      Alert.alert('Missing details', 'Trading name and VAT number are required to verify your dealership.');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: elevate to DEALER if this account isn't one yet.
      if (role !== 'dealer') {
        await apiClient('/users/elevate', {
          method: 'POST',
          body: JSON.stringify({ newRole: 'DEALER' }),
        });
        // Refresh local auth state so `role` reflects the new DEALER status —
        // /users/dealer-profile requires the account to already be a dealer.
        await initializeAuth();
      }

      // Step 2: create/update the dealer profile with the submitted details.
      await apiClient('/users/dealer-profile', {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: trimmedName,
          vatNumber: trimmedVat,
          ...(regNumber.trim() && { registrationNumber: regNumber.trim() }),
          ...(address.trim() && { businessAddress: address.trim() }),
          ...(phone.trim() && { phone: phone.trim() }),
        }),
      });

      showToast('Dealership details saved — let’s verify your business', 'success');
      navigation?.navigate('DealerKYC');
    } catch (err: any) {
      Alert.alert('Couldn’t save your details', err?.message || 'Please check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.03)', 'rgba(0,0,0,0)', '#0A0A0C']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />
      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 14 }]}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerSubRed}>DEALER PRO</Text>
              <Text style={styles.headerTitle}>Set up your dealership</Text>
            </View>
            <View style={{ width: 38 }} />
          </View>

          {/* Stepper — Business (this screen) → Verify (DealerKYCScreen next) */}
          <View style={styles.stepperWrap}>
            <View style={styles.stepperItem}>
              <View style={[styles.stepperCircle, styles.stepperCircleActive]}>
                 <Text style={[styles.stepperNum, styles.stepperNumActive]}>1</Text>
              </View>
              <Text style={[styles.stepperLabel, styles.stepperLabelActive]}>Business</Text>
            </View>
            <View style={styles.stepperLine} />

            <View style={styles.stepperItem}>
              <View style={styles.stepperCircle}>
                 <Text style={styles.stepperNum}>2</Text>
              </View>
              <Text style={styles.stepperLabel}>Verify</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>BUSINESS DETAILS</Text>

          {/* Form Inputs */}
          <View style={styles.formGroup}>
             <Text style={styles.inputLabel}>TRADING NAME</Text>
             <View style={styles.inputWrap}>
                <Ionicons name="business-outline" size={18} color="#606070" style={styles.inputIcon} />
                <TextInput style={styles.textInput} value={tradingName} onChangeText={setTradingName} placeholder="e.g. Knightsbridge Motors Ltd" placeholderTextColor="#606070" />
                <Ionicons name="pencil-outline" size={16} color="#606070" style={styles.inputIconRight} />
             </View>
          </View>

          <View style={styles.formGroup}>
             <Text style={styles.inputLabel}>COMPANIES HOUSE REG</Text>
             <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="pound" size={18} color="#606070" style={styles.inputIcon} />
                <TextInput style={styles.textInput} value={regNumber} onChangeText={setRegNumber} keyboardType="numeric" placeholder="e.g. 12345678" placeholderTextColor="#606070" />
                <Ionicons name="pencil-outline" size={16} color="#606070" style={styles.inputIconRight} />
             </View>
          </View>

          <View style={styles.formGroup}>
             <Text style={styles.inputLabel}>VAT NUMBER</Text>
             <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="file-document-outline" size={18} color="#606070" style={styles.inputIcon} />
                <TextInput style={styles.textInput} value={vatNumber} onChangeText={setVatNumber} placeholder="e.g. GB 123 456 789" placeholderTextColor="#606070" />
                <Ionicons name="pencil-outline" size={16} color="#606070" style={styles.inputIconRight} />
             </View>
          </View>

          <View style={styles.formGroup}>
             <Text style={styles.inputLabel}>BUSINESS ADDRESS</Text>
             <View style={styles.inputWrap}>
                <Ionicons name="location-outline" size={18} color="#606070" style={styles.inputIcon} />
                <TextInput style={styles.textInput} value={address} onChangeText={setAddress} placeholder="e.g. 42 Sloane St, SW1X 9LT" placeholderTextColor="#606070" />
                <Ionicons name="pencil-outline" size={16} color="#606070" style={styles.inputIconRight} />
             </View>
          </View>

          <View style={styles.formGroup}>
             <Text style={styles.inputLabel}>BUSINESS PHONE</Text>
             <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color="#606070" style={styles.inputIcon} />
                <TextInput style={styles.textInput} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="e.g. +44 20 7123 4567" placeholderTextColor="#606070" />
                <Ionicons name="pencil-outline" size={16} color="#606070" style={styles.inputIconRight} />
             </View>
          </View>

          <View style={styles.signInRow}>
             <Text style={styles.signInText}>Already have a dealer account? <Text style={styles.signInLink}>Sign in</Text></Text>
          </View>

        </ScrollView>

        {/* Continue CTA */}
        <View style={[styles.bottomCTA, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.continueBtn} activeOpacity={0.85} onPress={handleContinue} disabled={submitting}>
            <LinearGradient
              colors={['#FF2D35', '#DC1F26']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueText}>CONTINUE</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{marginLeft: 8}} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubRed: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#DC1F26',
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },

  // Stepper
  stepperWrap: {
     flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 24, marginBottom: 32
  },
  stepperItem: {
     flexDirection: 'row', alignItems: 'center', gap: 8
  },
  stepperCircle: {
     width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)',
     borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center'
  },
  stepperCircleActive: {
     backgroundColor: '#DC1F26', borderColor: '#FF2D35',
  },
  stepperNum: {
     fontFamily: FontFamily.bold, fontSize: 13, color: '#606070'
  },
  stepperNumActive: {
     color: '#FFFFFF'
  },
  stepperLabel: {
     fontFamily: FontFamily.bold, fontSize: 12, color: '#606070'
  },
  stepperLabelActive: {
     color: '#FFFFFF'
  },
  stepperLine: {
     flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 12
  },

  sectionLabel: {
     fontFamily: FontFamily.bold, fontSize: 10, color: '#FFFFFF', letterSpacing: 1.5,
     marginLeft: 24, marginBottom: 16
  },

  // Form
  formGroup: {
     marginHorizontal: 24, marginBottom: 16
  },
  inputLabel: {
     fontFamily: FontFamily.bold, fontSize: 9, color: '#606070', letterSpacing: 1.2, marginBottom: 8
  },
  inputWrap: {
     flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 12,
     backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
     paddingHorizontal: 16
  },
  inputIcon: {
     marginRight: 10
  },
  textInput: {
     flex: 1, fontFamily: FontFamily.medium, fontSize: 14, color: '#FFFFFF'
  },
  inputIconRight: {
     marginLeft: 10
  },
  signInRow: {
     alignItems: 'center', marginTop: 24
  },
  signInText: {
     fontFamily: FontFamily.regular, fontSize: 13, color: '#606070'
  },
  signInLink: {
     fontFamily: FontFamily.bold, color: '#DC1F26'
  },

  bottomCTA: {
     position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16,
     backgroundColor: 'rgba(10,10,12,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)'
  },
  continueBtn: {
     height: 56,
     borderTopLeftRadius: 12,
     borderTopRightRadius: 12,
     borderBottomLeftRadius: 12,
     borderBottomRightRadius: 4,
     flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
     overflow: 'hidden'
  },
  continueText: {
     fontFamily: FontFamily.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 1.5,
     marginRight: 6
  },
});
