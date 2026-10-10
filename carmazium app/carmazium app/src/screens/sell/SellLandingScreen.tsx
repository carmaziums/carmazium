import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';
import { getVehicleValuation, type VehicleValuation } from '../../lib/valuationApi';
import { normalizeNativeRegistration } from '../../lib/sellerVehicleSpecs';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type DvlaPreview = {
  make?: string | null; model?: string | null; year?: number | string | null;
  fuelType?: string | null; transmission?: string | null;
};
type RouteSellingMode = 'AUCTION' | 'CLASSIFIED';

const money = (amount: number) =>
  '£' + Math.round(amount).toLocaleString('en-GB');
const validYear = (raw: string) => {
  const year = Number(raw);
  return /^\d{4}$/.test(raw) && Number.isSafeInteger(year)
    && year >= 1900 && year <= new Date().getFullYear() + 1;
};

export const SellLandingScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [vrm, setVrm] = useState('');
  const [mileage, setMileage] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [transmission, setTransmission] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [valuing, setValuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valuation, setValuation] = useState<VehicleValuation | null>(null);
  const requestId = useRef(0);

  const invalidate = () => {
    requestId.current += 1;
    setError(null);
    setValuation(null);
    setLookingUp(false);
    setValuing(false);
  };

  const changeVrm = (value: string) => {
    invalidate();
    setVrm(normalizeNativeRegistration(value));
    // A different registration must not retain the previous car's identity.
    setMake(''); setModel(''); setYear(''); setTransmission('');
  };

  const findRegistration = async () => {
    const clean = normalizeNativeRegistration(vrm);
    if (clean.length < 5 || clean.length > 8) {
      setError('Enter a valid UK vehicle registration.');
      return;
    }
    const id = ++requestId.current;
    setLookingUp(true);
    setError(null);
    setValuation(null);
    try {
      // DVLA analysis here never authorises sending details to OpenAI.
      // The full listing wizard has the separate explicit AI-consent gate.
      const details = await apiClient<DvlaPreview>('/dvla/lookup', {
        method: 'POST',
        body: JSON.stringify({ vrm: clean, allowAiEnrichment: false }),
        timeoutMs: 25000,
      });
      if (id !== requestId.current) return;
      if (!details?.make || !details?.year) throw new Error('DVLA did not return enough vehicle details.');
      setMake(String(details.make));
      setYear(String(details.year));
      setModel(String(details.model || ''));
      setTransmission(String(details.transmission || ''));
      if (!details.model) {
        setError('Vehicle found. Enter its actual model to complete your valuation.');
      }
    } catch (err: any) {
      if (id !== requestId.current) return;
      setError(err?.message || 'Could not confirm this registration. Enter make, model and year manually.');
    } finally {
      if (id === requestId.current) setLookingUp(false);
    }
  };

  const getGuide = async () => {
    const cleanMileage = Number(mileage.replace(/,/g, ''));
    if (!make.trim() || !model.trim() || !validYear(year)
      || !/^\d+(?:,\d{3})*$/.test(mileage.trim())
      || !Number.isSafeInteger(cleanMileage) || cleanMileage < 0 || cleanMileage > 3000000) {
      setError('Enter the make, actual model, valid year and mileage before requesting a valuation.');
      return;
    }
    const id = ++requestId.current;
    setError(null); setValuation(null); setValuing(true);
    try {
      const answer = await getVehicleValuation({
        make: make.trim(), model: model.trim(), year: Number(year),
        mileage: cleanMileage, registration: vrm || undefined,
        transmission: transmission || undefined,
      });
      if (id !== requestId.current) return;
      if (!answer?.auction || !Number.isFinite(answer.auction.marketValue)
        || answer.auction.marketValue <= 0) {
        setError('No reliable price figures were returned. You can still create your listing and set your own price.');
        return;
      }
      setValuation(answer);
    } catch (err: any) {
      if (id !== requestId.current) return;
      setError(err?.message || 'Valuation temporarily unavailable. You can still list your car.');
    } finally {
      if (id === requestId.current) setValuing(false);
    }
  };

  const startListing = (listingType: RouteSellingMode) => {
    navigation.navigate('SellCarFlow', {
      listingType,
      prefill: {
        vrm: vrm || undefined, make: make || undefined, model: model || undefined,
        year: validYear(year) ? Number(year) : undefined,
        mileage: /^\d+(?:,\d{3})*$/.test(mileage.trim())
          ? Number(mileage.replace(/,/g, '')) : undefined,
        transmission: transmission || undefined,
      },
    });
  };

  const Field = ({ label, value, onChangeText, placeholder, keyboardType }:{
    label:string; value:string; onChangeText:(text:string)=>void;
    placeholder:string; keyboardType?:'default'|'number-pad';
  }) => <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput style={styles.fieldInput} value={value} onChangeText={onChangeText}
      accessibilityLabel={label} autoCorrect={false} placeholder={placeholder}
      placeholderTextColor={Colors.textMuted} keyboardType={keyboardType || 'default'}/>
  </View>;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent"/>
      <WebsiteTopBar />
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>SELL MY CAR ONLINE · UK</Text>
        <Text style={styles.title}>Sell Your Car Online <Text style={styles.accent}>in the UK</Text></Text>
        <Text style={styles.description}>
          Get a free car valuation using your registration and mileage, then sell your car
          through a £0 dealer auction or £1 retail listing.
        </Text>

        <View style={styles.valuationCard}>
          <Text style={styles.sectionTitle}>FREE CAR VALUATION</Text>
          <Text style={styles.hint}>Enter your registration or provide vehicle details manually.</Text>
          <View style={styles.vrmRow}>
            <View style={styles.vrmInputWrap}>
              <Field label="Vehicle registration" value={vrm} onChangeText={changeVrm}
                placeholder="AB12 CDE"/>
            </View>
            <TouchableOpacity style={styles.lookupBtn} onPress={() => { void findRegistration(); }}
              disabled={lookingUp || valuing} accessibilityRole="button" accessibilityLabel="Analyse registration">
              {lookingUp ? <ActivityIndicator color={Colors.white}/> :
                <Text style={styles.lookupText}>Analyse</Text>}
            </TouchableOpacity>
          </View>
          <Field label="Mileage" value={mileage}
            onChangeText={text => { invalidate(); setMileage(text.replace(/[^\d,]/g,'')); }}
            placeholder="e.g. 45000" keyboardType="number-pad"/>
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Field label="Make" value={make}
                onChangeText={text => { invalidate(); setMake(text); }}
                placeholder="e.g. Ford"/>
            </View>
            <View style={styles.fieldHalf}>
              <Field label="Model" value={model}
                onChangeText={text => { invalidate(); setModel(text); }}
                placeholder="e.g. Focus"/>
            </View>
          </View>
          <Field label="Year" value={year}
            onChangeText={text => { invalidate(); setYear(text.replace(/[^\d]/g,'').slice(0,4)); }}
            placeholder="e.g. 2018" keyboardType="number-pad"/>
          {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
          <TouchableOpacity style={styles.valuationButton}
            onPress={() => { void getGuide(); }}
            disabled={lookingUp || valuing} accessibilityRole="button"
            accessibilityLabel="Get My Free Valuation">
            {valuing ? <ActivityIndicator color={Colors.white}/> :
              <Text style={styles.valuationButtonText}>Get My Free Valuation</Text>}
            <Ionicons name="arrow-forward" size={17} color={Colors.white}/>
          </TouchableOpacity>
          <Text style={styles.guideNote}>Free valuation · No obligation · Guide only, not a guaranteed offer.</Text>
          {!!valuation && <View style={styles.guideResult}>
            <Text style={styles.resultLabel}>
              {year} {make.trim()} {model.trim()}
            </Text>
            <Text style={styles.guideTitle}>Current Market Value</Text>
            <Text style={styles.guidePrice}>{money(valuation.auction.marketValue)}</Text>
            <Text style={styles.guideNote}>Based on vehicle details and available CarMazium market evidence.
              Condition, specification and demand may change the sale price.</Text>
          </View>}
        </View>

        <View style={styles.benefits}>
          {[
            { title:'FREE Valuation',detail:'See what your car is worth',icon:'cash-outline' },
            { title:'FREE Auction',detail:'Verified dealers compete',icon:'hammer-outline' },
            { title:'£1 Retail',detail:'Advertise directly to buyers',icon:'car-outline' },
          ].map(item=><View key={item.title} style={styles.benefit}>
            <Ionicons name={item.icon as any} size={19} color={Colors.accent}/>
            <Text style={styles.benefitTitle}>{item.title}</Text>
            <Text style={styles.benefitDetail}>{item.detail}</Text>
          </View>)}
        </View>

        <Text style={styles.chooseTitle}>Choose how to sell</Text>
        <TouchableOpacity style={styles.auctionAction} onPress={()=>startListing('AUCTION')}
          accessibilityRole="button" accessibilityLabel="FREE Dealer Auction, continue to listing">
          <Ionicons name="hammer-outline" size={20} color={Colors.white}/>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>FREE Dealer Auction</Text>
            <Text style={styles.actionSub}>£0 listing fee · Qualifying successful auction sales may earn £100 after approved handover</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={Colors.white}/>
        </TouchableOpacity>
        <TouchableOpacity style={styles.retailAction} onPress={()=>startListing('CLASSIFIED')}
          accessibilityRole="button" accessibilityLabel="£1 Retail Listing, continue to listing">
          <Ionicons name="pricetag-outline" size={20} color={Colors.accent}/>
          <View style={styles.actionCopy}>
            <Text style={styles.retailTitle}>£1 Retail Listing</Text>
            <Text style={styles.actionSub}>Advertise directly to buyers · No retail buyer fee</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={Colors.textPrimary}/>
        </TouchableOpacity>
        <Text style={styles.footnote}>The £100 CarMazium incentive applies only to eligible completed auction sales after handover approval. Vehicle payment is made directly to the seller.</Text>
      </ScrollView>
    </View>
  );
};

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:Colors.bgPrimary},
  page:{paddingTop:16,paddingHorizontal:20,paddingBottom:110,gap:10},
  eyebrow:{fontFamily:FontFamily.bold,fontSize:11,color:Colors.accent,letterSpacing:1.1},
  title:{fontFamily:FontFamily.extraBold,color:Colors.textPrimary,fontSize:28,lineHeight:33},
  accent:{color:Colors.accent},description:{fontFamily:FontFamily.medium,color:Colors.textSecondary,fontSize:14,lineHeight:21,marginBottom:6},
  valuationCard:{backgroundColor:Colors.bgCard,borderRadius:17,borderWidth:1,borderColor:Colors.borderSubtle,padding:15,gap:11},
  sectionTitle:{fontFamily:FontFamily.extraBold,color:Colors.textPrimary,fontSize:17},
  hint:{fontFamily:FontFamily.regular,color:Colors.textMuted,fontSize:12,lineHeight:18},
  field:{gap:6},fieldLabel:{fontFamily:FontFamily.bold,color:Colors.textSecondary,fontSize:11},
  fieldInput:{height:45,borderRadius:10,paddingHorizontal:12,borderWidth:1,borderColor:Colors.borderSubtle,
    color:Colors.textPrimary,backgroundColor:Colors.bgElevated,fontFamily:FontFamily.medium,fontSize:14},
  fieldRow:{flexDirection:'row',gap:9},fieldHalf:{flex:1,minWidth:0},
  vrmRow:{flexDirection:'row',alignItems:'flex-end',gap:8},
  vrmInputWrap:{flex:1},lookupBtn:{height:45,backgroundColor:Colors.accent,borderRadius:10,
    justifyContent:'center',alignItems:'center',paddingHorizontal:12,minWidth:85},
  lookupText:{color:Colors.white,fontFamily:FontFamily.bold,fontSize:12},
  valuationButton:{flexDirection:'row',alignItems:'center',justifyContent:'center',
    gap:10,backgroundColor:Colors.accent,borderRadius:12,minHeight:49,marginTop:1},
  valuationButtonText:{fontFamily:FontFamily.extraBold,color:Colors.white,fontSize:13},
  guideNote:{fontFamily:FontFamily.regular,color:Colors.textMuted,fontSize:11,lineHeight:17},
  error:{color:Colors.error,fontFamily:FontFamily.medium,fontSize:12,lineHeight:18},
  guideResult:{borderRadius:13,borderWidth:1,borderColor:Colors.infoBlue,backgroundColor:Colors.bgElevated,
    padding:13,gap:5},
  resultLabel:{fontFamily:FontFamily.bold,fontSize:11,color:Colors.accent,textTransform:'uppercase'},
  guideTitle:{fontFamily:FontFamily.bold,color:Colors.textSecondary,fontSize:11},
  guidePrice:{fontFamily:FontFamily.extraBold,color:Colors.textPrimary,fontSize:26},
  benefits:{flexDirection:'row',gap:7},benefit:{flex:1,minWidth:0,borderRadius:12,
    backgroundColor:Colors.bgCard,borderColor:Colors.borderSubtle,borderWidth:1,padding:9,gap:6},
  benefitTitle:{fontFamily:FontFamily.extraBold,color:Colors.textPrimary,fontSize:11},
  benefitDetail:{fontFamily:FontFamily.medium,color:Colors.textMuted,fontSize:10,lineHeight:14},
  chooseTitle:{fontFamily:FontFamily.extraBold,color:Colors.textPrimary,fontSize:18,marginTop:8},
  auctionAction:{backgroundColor:Colors.accent,borderRadius:13,flexDirection:'row',alignItems:'center',
    gap:11,padding:13,minHeight:72},
  retailAction:{backgroundColor:Colors.bgCard,borderRadius:13,flexDirection:'row',alignItems:'center',
    borderWidth:1,borderColor:Colors.borderSubtle,gap:11,padding:13,minHeight:72},
  actionCopy:{flex:1,gap:4},actionTitle:{fontFamily:FontFamily.extraBold,color:Colors.white,fontSize:14},
  retailTitle:{fontFamily:FontFamily.extraBold,color:Colors.textPrimary,fontSize:14},
  actionSub:{fontFamily:FontFamily.medium,fontSize:11,lineHeight:16,color:Colors.textSecondary},
  footnote:{fontFamily:FontFamily.regular,color:Colors.textMuted,fontSize:11,lineHeight:17,marginTop:4},
});
